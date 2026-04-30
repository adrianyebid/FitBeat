#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-fast}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[ERROR] Missing required command: $1"
    exit 1
  fi
}

require_cmd docker
require_cmd curl

echo "[INFO] Running FitBeat QA smoke tests (mode=$MODE)"

if [[ "$MODE" == "full" ]]; then
  echo "[STEP] docker compose up -d --build"
  docker compose up -d --build
else
  echo "[STEP] docker compose up -d"
  docker compose up -d
fi

echo "[STEP] Verifying services status"
PS_OUT="$(docker compose ps)"
echo "$PS_OUT"
for svc in achievements_service achievements_db rabbitmq music_service component_a frontend; do
  if ! grep -q "$svc" <<<"$PS_OUT"; then
    echo "[ERROR] Service not found in docker compose ps: $svc"
    exit 1
  fi
done

echo "[STEP] Health checks"
ACH_HEALTH="$(curl -fsS http://localhost:8082/health)"
ACH_DB_HEALTH="$(curl -fsS http://localhost:8082/health/db)"
CATALOG="$(curl -fsS http://localhost:8082/achievements/catalog)"
[[ "$ACH_HEALTH" == *'"status":"ok"'* ]] || { echo "[ERROR] achievements /health failed: $ACH_HEALTH"; exit 1; }
[[ "$ACH_DB_HEALTH" == *'"status":"ok"'* ]] || { echo "[ERROR] achievements /health/db failed: $ACH_DB_HEALTH"; exit 1; }
[[ "$CATALOG" == *'first_workout_completed'* ]] || { echo "[ERROR] catalog does not include expected badges"; exit 1; }

echo "[STEP] REST evaluate + user progress"
TS="$(date +%s)"
USER_REST="qa-rest-user-$TS"
SESSION_REST="qa-rest-session-$TS"
EVAL_RESPONSE="$(curl -fsS -X POST http://localhost:8082/achievements/evaluate \
  -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$USER_REST\",\"sessionId\":\"$SESSION_REST\",\"durationMinutes\":45,\"completedAtUtc\":\"2026-04-27T19:30:00Z\"}")"
USER_PROGRESS_REST="$(curl -fsS "http://localhost:8082/achievements/user/$USER_REST")"
[[ "$EVAL_RESPONSE" == *"$SESSION_REST"* ]] || { echo "[ERROR] REST evaluate response invalid: $EVAL_RESPONSE"; exit 1; }
[[ "$USER_PROGRESS_REST" == *'first_workout_completed'* ]] || { echo "[ERROR] REST user progress missing expected unlock"; exit 1; }

echo "[STEP] Rabbit first_10_sessions + idempotency"
EVENT_ID_10="qa-evt-first10-$TS"
USER_10="qa-rabbit-user10-$TS"
PAYLOAD_10="{\"event_id\":\"$EVENT_ID_10\",\"event_type\":\"first_10_sessions\",\"occurred_at\":\"2026-04-27T15:04:05Z\",\"source\":\"event-processor\",\"version\":1,\"payload\":{\"user_id\":\"$USER_10\",\"sessions_finished\":10}}"
docker compose exec -T rabbitmq sh -lc "rabbitmqadmin publish exchange=fitbeat.events routing_key=first_10_sessions payload='$PAYLOAD_10'" >/dev/null
# Duplicate publish with same event_id should be ignored
docker compose exec -T rabbitmq sh -lc "rabbitmqadmin publish exchange=fitbeat.events routing_key=first_10_sessions payload='$PAYLOAD_10'" >/dev/null
sleep 2
USER_PROGRESS_10="$(curl -fsS "http://localhost:8082/achievements/user/$USER_10")"
[[ "$USER_PROGRESS_10" == *'first_10_sessions'* ]] || { echo "[ERROR] first_10_sessions not unlocked from Rabbit event"; exit 1; }

COUNT_EVENT_10="$(docker compose exec -T achievements_db psql -U postgres -d achievements_db -t -A -c "SELECT count(*) FROM \"ProcessedInboundEvents\" WHERE \"EventId\"='$EVENT_ID_10';" | tr -d '[:space:]')"
[[ "$COUNT_EVENT_10" == "1" ]] || { echo "[ERROR] idempotency failed for $EVENT_ID_10, count=$COUNT_EVENT_10"; exit 1; }

echo "[STEP] Rabbit session.finished + idempotency"
EVENT_ID_SF="qa-evt-sf-$TS"
USER_SF="qa-rabbit-user-sf-$TS"
SESSION_SF="qa-rabbit-session-sf-$TS"
PAYLOAD_SF="{\"event_id\":\"$EVENT_ID_SF\",\"event_type\":\"session.finished\",\"occurred_at\":\"2026-04-27T16:00:00Z\",\"source\":\"music-service\",\"version\":1,\"payload\":{\"session_id\":\"$SESSION_SF\",\"user_id\":\"$USER_SF\",\"finished_at\":\"2026-04-27T16:00:00Z\"}}"
docker compose exec -T rabbitmq sh -lc "rabbitmqadmin publish exchange=fitbeat.events routing_key=session.finished payload='$PAYLOAD_SF'" >/dev/null
docker compose exec -T rabbitmq sh -lc "rabbitmqadmin publish exchange=fitbeat.events routing_key=session.finished payload='$PAYLOAD_SF'" >/dev/null
sleep 2
USER_PROGRESS_SF="$(curl -fsS "http://localhost:8082/achievements/user/$USER_SF")"
[[ "$USER_PROGRESS_SF" == *'"totalSessions":1'* ]] || { echo "[ERROR] session.finished did not update totalSessions correctly: $USER_PROGRESS_SF"; exit 1; }
COUNT_EVENT_SF="$(docker compose exec -T achievements_db psql -U postgres -d achievements_db -t -A -c "SELECT count(*) FROM \"ProcessedInboundEvents\" WHERE \"EventId\"='$EVENT_ID_SF';" | tr -d '[:space:]')"
[[ "$COUNT_EVENT_SF" == "1" ]] || { echo "[ERROR] idempotency failed for $EVENT_ID_SF, count=$COUNT_EVENT_SF"; exit 1; }

echo "[STEP] Retry + DLQ with invalid event"
EVENT_ID_BAD="qa-evt-bad-$TS"
PAYLOAD_BAD="{\"event_id\":\"$EVENT_ID_BAD\",\"event_type\":\"session.finished\",\"occurred_at\":\"2026-04-27T18:00:00Z\",\"source\":\"music-service\",\"version\":1,\"payload\":{\"session_id\":\"qa-bad-session-$TS\"}}"
docker compose exec -T rabbitmq sh -lc "rabbitmqadmin publish exchange=fitbeat.events routing_key=session.finished payload='$PAYLOAD_BAD'" >/dev/null
# max retries=3 and retry delay=5s => wait a bit more than 15s
sleep 18
DLQ_ROW="$(docker compose exec -T rabbitmq sh -lc 'rabbitmqadmin list queues name messages | grep fitbeat.achievements.dlq || true')"
DLQ_COUNT="$(echo "$DLQ_ROW" | tr -d ' ' | cut -d'|' -f3)"
if [[ -z "$DLQ_COUNT" ]]; then
  echo "[ERROR] could not read DLQ queue count"
  exit 1
fi
if ! [[ "$DLQ_COUNT" =~ ^[0-9]+$ ]]; then
  echo "[ERROR] invalid DLQ count value: $DLQ_COUNT"
  exit 1
fi
if (( DLQ_COUNT < 1 )); then
  echo "[ERROR] expected DLQ messages >=1 after invalid event, got $DLQ_COUNT"
  exit 1
fi

echo "[STEP] Compose config sanity"
docker compose config >/tmp/fitbeat-compose-config.out

echo "[PASS] QA smoke completed successfully"
echo "[INFO] Tested users/events suffix: $TS"
echo "[INFO] Current git status:"
git status --short --branch

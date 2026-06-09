#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Warm Spare Pattern — Manual failover script
#
# Usage:
#   On Linux/Mac:  bash warm-spare/failover.sh
#   On Windows:    Run inside Git Bash or WSL, or use the Docker Desktop terminal
#
# What it does:
#   1. Verifies the standby is in recovery mode
#   2. Promotes fb_users_db_standby to primary via pg_ctl promote
#   3. Polls until promotion is confirmed
#   4. The user-service containers reconnect automatically (pool_pre_ping + multi-host URL)
# ─────────────────────────────────────────────────────────────────────────────

STANDBY="fb_users_db_standby"
PRIMARY="fb_users_db"
PGUSER="${POSTGRES_USER:-postgres}"

echo "=========================================="
echo " FitBeat Warm Spare — Failover to Standby"
echo "=========================================="
echo ""

# ── Sanity check ──────────────────────────────
if ! docker inspect "$STANDBY" > /dev/null 2>&1; then
  echo "ERROR: Container '$STANDBY' not found. Is the stack running?"
  exit 1
fi

echo "[1/3] Checking standby recovery state..."
STATUS=$(docker exec "$STANDBY" psql -U "$PGUSER" -t -c "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d '[:space:]')
if [ "$STATUS" = "f" ]; then
  echo "  WARNING: Standby reports it is NOT in recovery (already a primary?)."
  echo "  Aborting — no failover needed."
  exit 0
fi
echo "  OK — standby is in hot-standby (recovery) mode."

# ── Promote ───────────────────────────────────
echo ""
echo "[2/3] Promoting '$STANDBY' to primary..."
docker exec -u postgres "$STANDBY" pg_ctl promote -D /var/lib/postgresql/data

# ── Wait for promotion ────────────────────────
echo ""
echo "[3/3] Waiting for promotion to complete..."
MAX_WAIT=30
COUNT=0
while [ "$COUNT" -lt "$MAX_WAIT" ]; do
  STATUS=$(docker exec "$STANDBY" psql -U "$PGUSER" -t -c "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d '[:space:]')
  if [ "$STATUS" = "f" ]; then
    echo "  Promoted! '$STANDBY' is now the read-write primary."
    break
  fi
  printf "  Still promoting... (%ds)\r" "$COUNT"
  sleep 1
  COUNT=$((COUNT + 1))
done

if [ "$COUNT" -eq "$MAX_WAIT" ]; then
  echo "ERROR: Promotion timed out after ${MAX_WAIT}s."
  exit 1
fi

echo ""
echo "=========================================="
echo " Failover complete!"
echo ""
echo " The user-service will reconnect automatically."
echo " Verify recovery:"
echo "   curl -s http://localhost:8000/health | python -m json.tool"
echo "   (POST /api/auth/login should return 200)"
echo ""
echo " IMPORTANT: Do NOT restart '$PRIMARY' without first"
echo " reconfiguring it as a new standby (split-brain risk)."
echo "=========================================="

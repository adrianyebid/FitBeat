#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Warm Spare Pattern — Automatic Failover Watchdog
#
# Monitors fb_users_db (primary). When it detects consecutive failures it
# promotes fb_users_db_standby via pg_promote() — a standard PostgreSQL SQL
# function (no docker.sock required, no external tools).
#
# Flow:
#   1. Poll primary with pg_isready every CHECK_INTERVAL seconds
#   2. On FAILURE_THRESHOLD consecutive failures → promote standby
#   3. Set FAILOVER_DONE flag so it never promotes twice
#   4. Keep running (logs primary recovery if it comes back)
# ─────────────────────────────────────────────────────────────────────────────

PRIMARY_HOST="${PRIMARY_HOST:-postgres_db}"
STANDBY_HOST="${STANDBY_HOST:-postgres_db_standby}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
CHECK_INTERVAL="${CHECK_INTERVAL:-5}"
FAILURE_THRESHOLD="${FAILURE_THRESHOLD:-3}"

# PGPASSWORD is expected as an env variable (set in docker-compose, comes from .env)
export PGPASSWORD

consecutive_failures=0
failover_done="false"

log() {
  echo "[watchdog $(date '+%H:%M:%S')] $1"
}

log "Starting — primary=$PRIMARY_HOST standby=$STANDBY_HOST interval=${CHECK_INTERVAL}s threshold=${FAILURE_THRESHOLD}"

# ── Wait until standby is healthy before starting to monitor ──────────────
log "Waiting for standby $STANDBY_HOST to be ready..."
until pg_isready -h "$STANDBY_HOST" -p 5432 -U "$PGUSER" -q; do
  sleep 3
done
log "Standby is ready. Monitoring primary..."

# ── Main loop ─────────────────────────────────────────────────────────────
while true; do

  if pg_isready -h "$PRIMARY_HOST" -p 5432 -U "$PGUSER" -q; then
    # Primary is alive
    if [ "$consecutive_failures" -gt 0 ]; then
      log "Primary is back after $consecutive_failures failure(s). Resetting failure counter."
    fi
    consecutive_failures=0
    # If a failover happened in a previous watchdog run and primary came back,
    # warn the operator (split-brain risk).
    if [ "$failover_done" = "true" ]; then
      log "WARNING: Primary is reachable but failover was already performed."
      log "         Do NOT allow the old primary to restart as primary — reconfigure it as a standby first."
    fi

  else
    # Primary is NOT reachable
    consecutive_failures=$((consecutive_failures + 1))
    log "Primary unreachable ($consecutive_failures/$FAILURE_THRESHOLD consecutive failures)"

    if [ "$consecutive_failures" -ge "$FAILURE_THRESHOLD" ]; then
      if [ "$failover_done" = "true" ]; then
        log "Failover already performed. Nothing to do."
      else
        log "Failure threshold reached. Checking standby state..."

        # Check if standby is still in recovery (i.e., not yet promoted)
        STANDBY_STATE=$(psql \
          -h "$STANDBY_HOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" \
          -t -c "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d '[:space:]')

        if [ "$STANDBY_STATE" = "t" ]; then
          log "Promoting standby $STANDBY_HOST ..."
          RESULT=$(psql \
            -h "$STANDBY_HOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" \
            -t -c "SELECT pg_promote();" 2>/dev/null | tr -d '[:space:]')

          log "pg_promote() returned: $RESULT"

          # Verify promotion within 30 seconds
          wait=0
          while [ "$wait" -lt 30 ]; do
            sleep 2
            wait=$((wait + 2))
            NEW_STATE=$(psql \
              -h "$STANDBY_HOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" \
              -t -c "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d '[:space:]')
            if [ "$NEW_STATE" = "f" ]; then
              log "FAILOVER COMPLETE — $STANDBY_HOST is now read-write primary."
              log "user-service instances will reconnect automatically via multi-host URL."
              failover_done="true"
              break
            fi
            log "Still promoting... (${wait}s elapsed)"
          done

          if [ "$failover_done" = "false" ]; then
            log "ERROR: Promotion did not complete within 30s. Will retry on next cycle."
            consecutive_failures=0  # reset so threshold is re-evaluated next cycle
          fi

        elif [ "$STANDBY_STATE" = "f" ]; then
          log "Standby is already a primary (pg_is_in_recovery = false). Marking failover done."
          failover_done="true"
        else
          log "Cannot reach standby either ($STANDBY_HOST). Both nodes unreachable. Waiting."
        fi
      fi
    fi
  fi

  sleep "$CHECK_INTERVAL"
done

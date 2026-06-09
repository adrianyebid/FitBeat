#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Warm Spare Pattern — Standby container entrypoint
# Bootstraps a PostgreSQL streaming replica from the primary, then hands off
# to the official docker-entrypoint.sh which starts postgres in hot-standby mode.
#
# Smart restart logic:
#   - No PG_VERSION                      -> fresh volume, run pg_basebackup
#   - PG_VERSION + standby.signal        -> still a replica, resume normally
#   - PG_VERSION but NO standby.signal   -> was promoted in a prior run,
#                                           wipe data dir and re-sync from primary
# ─────────────────────────────────────────────────────────────────────────────
set -e

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
PRIMARY_HOST="${PRIMARY_HOST:-postgres_db}"
REPL_USER="${REPL_USER:-replicator}"

needs_basebackup="false"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "[warm-spare] Data dir is empty — fresh bootstrap needed."
  needs_basebackup="true"
elif [ ! -f "$PGDATA/standby.signal" ]; then
  echo "[warm-spare] Data dir exists but standby.signal is missing (node was promoted before)."
  echo "[warm-spare] Wiping stale data dir and re-syncing from primary..."
  rm -rf "${PGDATA:?}/"*
  needs_basebackup="true"
else
  echo "[warm-spare] Data dir exists with standby.signal — resuming hot-standby."
fi

if [ "$needs_basebackup" = "true" ]; then
  echo "[warm-spare] Waiting for primary at $PRIMARY_HOST..."

  until pg_isready -h "$PRIMARY_HOST" -p 5432 -U "$POSTGRES_USER" -q; do
    printf '.'
    sleep 3
  done
  echo ""
  echo "[warm-spare] Primary is up. Running pg_basebackup..."

  mkdir -p "$PGDATA"
  chmod 700 "$PGDATA"
  chown postgres:postgres "$PGDATA"

  # -R creates standby.signal and writes primary_conninfo automatically.
  # No password needed — primary uses 'trust' for replication on the internal network.
  su-exec postgres pg_basebackup \
    -h "$PRIMARY_HOST" \
    -p 5432 \
    -U "$REPL_USER" \
    -D "$PGDATA" \
    -Fp -Xs -P -R

  echo "[warm-spare] Standby initialized. Starting PostgreSQL in hot-standby mode..."
fi

# Hand off to the official postgres entrypoint (handles user-switch + startup)
exec docker-entrypoint.sh postgres

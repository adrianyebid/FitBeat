#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Warm Spare Pattern — Primary initialization script
# Runs ONCE on an empty postgres_data volume via /docker-entrypoint-initdb.d/
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "[warm-spare] Configuring primary for streaming replication..."

# 1. Create the replication user
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicator_pass';
EOSQL

# 2. Set WAL parameters (written to postgresql.auto.conf; takes effect on restart)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  ALTER SYSTEM SET wal_level       = 'replica';
  ALTER SYSTEM SET max_wal_senders = 3;
  ALTER SYSTEM SET wal_keep_size   = 128;
  ALTER SYSTEM SET hot_standby     = on;
EOSQL

# 3. Allow the standby to connect for replication (any host inside Docker network)
# 'trust' avoids md5/scram-sha-256 mismatch issues across PostgreSQL versions.
# Safe because users_db_net is an internal Docker network and 'replicator'
# has no data access — only REPLICATION privilege.
echo "host  replication  replicator  0.0.0.0/0  trust" >> "$PGDATA/pg_hba.conf"

echo "[warm-spare] Primary configuration complete. Streaming replication is ready."

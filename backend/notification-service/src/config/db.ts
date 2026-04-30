import { Pool } from 'pg';

function getDatabaseUrl(): string {
    const databaseUrl = process.env.NOTIFICATION_DB_URL || process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('NOTIFICATION_DB_URL o DATABASE_URL es requerido para notification-service');
    }
    return databaseUrl;
}

export const pool = new Pool({
    connectionString: getDatabaseUrl(),
});

export async function initializeDatabase(): Promise<void> {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS notification_history (
            id BIGSERIAL PRIMARY KEY,
            event_id TEXT NOT NULL UNIQUE,
            event_type TEXT NOT NULL,
            source TEXT NOT NULL,
            version INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            recipient_email TEXT,
            recipient_name TEXT,
            subject TEXT,
            body_text TEXT,
            status TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            payload_json JSONB NOT NULL,
            occurred_at TIMESTAMPTZ NOT NULL,
            processed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_notification_history_user_id
        ON notification_history (user_id, created_at DESC)
    `);
}

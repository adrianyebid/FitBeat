import { pool } from '../config/db';
import { NotificationEnvelope, NotificationRecordStatus } from '../models/events';

type ReserveOutcome =
    | { action: 'process'; attempts: number }
    | { action: 'skip'; status: NotificationRecordStatus };

export async function reserveEvent(
    envelope: NotificationEnvelope,
    userId: string,
): Promise<ReserveOutcome> {
    const inserted = await pool.query(
        `
            INSERT INTO notification_history (
                event_id,
                event_type,
                source,
                version,
                user_id,
                status,
                attempts,
                payload_json,
                occurred_at
            )
            VALUES ($1, $2, $3, $4, $5, 'processing', 1, $6::jsonb, $7::timestamptz)
            ON CONFLICT (event_id) DO NOTHING
            RETURNING attempts
        `,
        [
            envelope.event_id,
            envelope.event_type,
            envelope.source,
            envelope.version,
            userId,
            JSON.stringify(envelope.payload),
            envelope.occurred_at,
        ],
    );

    if (inserted.rowCount && inserted.rows[0]) {
        return { action: 'process', attempts: Number(inserted.rows[0].attempts) };
    }

    const existing = await pool.query(
        `SELECT status, attempts FROM notification_history WHERE event_id = $1`,
        [envelope.event_id],
    );

    const row = existing.rows[0];
    if (!row) {
        return { action: 'process', attempts: 1 };
    }

    if (row.status === 'sent') {
        return { action: 'skip', status: 'sent' };
    }

    const updated = await pool.query(
        `
            UPDATE notification_history
            SET status = 'processing',
                attempts = attempts + 1,
                updated_at = NOW()
            WHERE event_id = $1
            RETURNING attempts
        `,
        [envelope.event_id],
    );

    return {
        action: 'process',
        attempts: Number(updated.rows[0]?.attempts || Number(row.attempts) + 1),
    };
}

export async function markNotificationSent(params: {
    eventId: string;
    recipientEmail: string;
    recipientName: string | null;
    subject: string;
    bodyText: string;
}): Promise<void> {
    await pool.query(
        `
            UPDATE notification_history
            SET status = 'sent',
                recipient_email = $2,
                recipient_name = $3,
                subject = $4,
                body_text = $5,
                last_error = NULL,
                processed_at = NOW(),
                updated_at = NOW()
            WHERE event_id = $1
        `,
        [
            params.eventId,
            params.recipientEmail,
            params.recipientName,
            params.subject,
            params.bodyText,
        ],
    );
}

export async function markNotificationFailed(eventId: string, errorMessage: string): Promise<void> {
    await pool.query(
        `
            UPDATE notification_history
            SET status = 'failed',
                last_error = $2,
                updated_at = NOW()
            WHERE event_id = $1
        `,
        [eventId, errorMessage],
    );
}

export async function listNotificationsByUser(userId: string): Promise<unknown[]> {
    const result = await pool.query(
        `
            SELECT
                event_id,
                event_type,
                source,
                recipient_email,
                recipient_name,
                subject,
                body_text,
                status,
                attempts,
                last_error,
                occurred_at,
                processed_at,
                created_at
            FROM notification_history
            WHERE user_id = $1
            ORDER BY created_at DESC
        `,
        [userId],
    );

    return result.rows;
}

import {
    AchievementPayload,
    NotificationEnvelope,
    SessionFinishedPayload,
    SUPPORTED_EVENT_TYPES,
    SupportedEventType,
} from '../models/events';

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`campo invalido: ${field}`);
    }
    return value.trim();
}

function asNumber(value: unknown, field: string): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`campo invalido: ${field}`);
    }
    return value;
}

function isSupportedEventType(value: string): value is SupportedEventType {
    return (SUPPORTED_EVENT_TYPES as readonly string[]).includes(value);
}

function validateAchievementPayload(payload: Record<string, unknown>, eventType: SupportedEventType): AchievementPayload {
    const userId = asNonEmptyString(payload.user_id, 'payload.user_id');
    const sessionsFinished = asNumber(payload.sessions_finished, 'payload.sessions_finished');

    if (eventType === 'weekly_goal_reached') {
        return {
            user_id: userId,
            week_start: asNonEmptyString(payload.week_start, 'payload.week_start'),
            sessions_finished: sessionsFinished,
            goal: asNumber(payload.goal, 'payload.goal'),
        };
    }

    return {
        user_id: userId,
        sessions_finished: sessionsFinished,
    };
}

function validateSessionFinishedPayload(payload: Record<string, unknown>): SessionFinishedPayload {
    return {
        session_id: asNonEmptyString(payload.session_id, 'payload.session_id'),
        user_id: asNonEmptyString(payload.user_id, 'payload.user_id'),
        activity_type: typeof payload.activity_type === 'string' ? payload.activity_type : undefined,
        mode: typeof payload.mode === 'string' ? payload.mode : undefined,
        finished_at: asNonEmptyString(payload.finished_at, 'payload.finished_at'),
    };
}

export function validateEnvelope(input: unknown): NotificationEnvelope<AchievementPayload | SessionFinishedPayload> {
    if (!isObject(input)) {
        throw new Error('envelope invalido');
    }

    const eventTypeRaw = asNonEmptyString(input.event_type, 'event_type');
    if (!isSupportedEventType(eventTypeRaw)) {
        throw new Error(`event_type no soportado: ${eventTypeRaw}`);
    }

    const payloadRaw = input.payload;
    if (!isObject(payloadRaw)) {
        throw new Error('payload invalido');
    }

    let occurredAtStr: string;
    if (typeof input.occurred_at === 'number') {
        // Asumimos que viene como epoch seconds con decimales
        occurredAtStr = new Date(input.occurred_at * 1000).toISOString();
    } else {
        occurredAtStr = asNonEmptyString(input.occurred_at, 'occurred_at');
    }

    const base = {
        event_id: asNonEmptyString(input.event_id, 'event_id'),
        event_type: eventTypeRaw,
        occurred_at: occurredAtStr,
        source: asNonEmptyString(input.source, 'source'),
        version: asNumber(input.version, 'version'),
    };

    const payload =
        eventTypeRaw === 'session.finished'
            ? validateSessionFinishedPayload(payloadRaw)
            : validateAchievementPayload(payloadRaw, eventTypeRaw);

    return {
        ...base,
        payload,
    };
}

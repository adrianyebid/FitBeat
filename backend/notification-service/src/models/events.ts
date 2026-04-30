export const SUPPORTED_EVENT_TYPES = [
    'weekly_goal_reached',
    'first_10_sessions',
    'session.finished',
] as const;

export type SupportedEventType = (typeof SUPPORTED_EVENT_TYPES)[number];

export type NotificationEnvelope<TPayload = Record<string, unknown>> = {
    event_id: string;
    event_type: SupportedEventType;
    occurred_at: string;
    source: string;
    version: number;
    payload: TPayload;
};

export type AchievementPayload = {
    user_id: string;
    week_start?: string;
    sessions_finished: number;
    goal?: number;
};

export type SessionFinishedPayload = {
    session_id: string;
    user_id: string;
    activity_type?: string;
    mode?: string;
    finished_at: string;
};

export type NotificationRecordStatus = 'processing' | 'sent' | 'failed';

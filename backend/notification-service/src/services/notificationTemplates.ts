import {
    AchievementPayload,
    NotificationEnvelope,
    SessionFinishedPayload,
    SupportedEventType,
} from '../models/events';

export type RenderedNotification = {
    userId: string;
    subject: string;
    text: string;
    html: string;
};

type Recipient = {
    email: string;
    firstName?: string;
    lastName?: string;
};

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function greeting(recipient: Recipient): string {
    if (recipient.firstName) {
        return `Hola ${recipient.firstName},`;
    }
    return 'Hola,';
}

function signoff(): string[] {
    return [
        'Nos alegra acompañarte en este proceso.',
        '',
        'Con cariño,',
        'Tu equipo de FitBeat',
    ];
}

function buildHtml(lines: string[]): string {
    const body = lines
        .map((line) => {
            if (!line.trim()) {
                return '<br />';
            }
            return `<p style="margin: 0 0 12px 0;">${escapeHtml(line)}</p>`;
        })
        .join('');

    return `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.6;">
            <div style="max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
                <h1 style="margin: 0 0 20px 0; color: #0f172a; font-size: 22px;">FitBeat</h1>
                ${body}
            </div>
        </div>
    `;
}

function normalizeActivityType(value: string | undefined): string {
    const normalized = String(value || '').trim().toLowerCase();
    const labels: Record<string, string> = {
        running: 'Running',
        lifting: 'Lifting',
        hiking: 'Hiking',
        crossfit: 'Crossfit',
        hiit: 'HIIT',
        cycling: 'Cycling',
        mindfulness: 'Mindfulness',
    };
    return labels[normalized] || (normalized ? normalized : 'Entrenamiento');
}

function renderWeeklyGoal(
    envelope: NotificationEnvelope<AchievementPayload>,
    recipient: Recipient,
): RenderedNotification {
    const payload = envelope.payload;
    const lines = [
        greeting(recipient),
        '',
        '¡Cumpliste tu meta semanal de entrenamiento y queríamos celebrarlo contigo!',
        '',
        `Resumen de tu avance:`,
        `- Semana iniciada el: ${payload.week_start}`,
        `- Sesiones completadas: ${payload.sessions_finished}`,
        `- Meta semanal: ${payload.goal}`,
        '',
        'Este logro habla de tu constancia. Sigue así, vas construyendo una rutina muy valiosa.',
        '',
        ...signoff(),
    ];

    return {
        userId: payload.user_id,
        subject: 'FitBeat | Alcanzaste tu meta semanal',
        text: lines.join('\n'),
        html: buildHtml(lines),
    };
}

function renderFirst10Sessions(
    envelope: NotificationEnvelope<AchievementPayload>,
    recipient: Recipient,
): RenderedNotification {
    const payload = envelope.payload;
    const lines = [
        greeting(recipient),
        '',
        '¡Completaste tus primeras 10 sesiones en FitBeat!',
        '',
        `Llevas ${payload.sessions_finished} sesiones finalizadas y eso merece celebrarse.`,
        '',
        'Gracias por confiar en nosotros para acompañar tu progreso. Lo que estas construyendo no es solo una racha, es un hábito.',
        '',
        ...signoff(),
    ];

    return {
        userId: payload.user_id,
        subject: 'FitBeat | Ya completaste 10 sesiones',
        text: lines.join('\n'),
        html: buildHtml(lines),
    };
}

function renderSessionFinished(
    envelope: NotificationEnvelope<SessionFinishedPayload>,
    recipient: Recipient,
): RenderedNotification {
    const payload = envelope.payload;
    const trainingType = normalizeActivityType(payload.activity_type);
    const lines = [
        greeting(recipient),
        '',
        '¡Has finalizado tu entrenamiento!',
        '',
        `Resumen rápido:`,
        `- Tipo de entrenamiento: ${trainingType}`,
        `- Modo: ${payload.mode || 'No disponible'}`,
        `- Hora de finalización: ${payload.finished_at}`,
        '',
        'Buen trabajo por cerrar esta sesión. Date un momento para recuperarte y volver con energía cuando quieras.',
        '',
        ...signoff(),
    ];

    return {
        userId: payload.user_id,
        subject: 'FitBeat | Resumen de tu sesión',
        text: lines.join('\n'),
        html: buildHtml(lines),
    };
}

export function renderNotification(
    eventType: SupportedEventType,
    envelope: NotificationEnvelope<AchievementPayload | SessionFinishedPayload>,
    recipient: Recipient,
): RenderedNotification {
    switch (eventType) {
        case 'weekly_goal_reached':
            return renderWeeklyGoal(envelope as NotificationEnvelope<AchievementPayload>, recipient);
        case 'first_10_sessions':
            return renderFirst10Sessions(envelope as NotificationEnvelope<AchievementPayload>, recipient);
        case 'session.finished':
            return renderSessionFinished(envelope as NotificationEnvelope<SessionFinishedPayload>, recipient);
        default:
            throw new Error(`event_type no soportado: ${String(eventType)}`);
    }
}

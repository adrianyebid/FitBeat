import { AchievementPayload, NotificationEnvelope, SessionFinishedPayload, SupportedEventType } from '../models/events';
import { sendEmail } from './emailService';
import { renderNotification } from './notificationTemplates';
import { markNotificationFailed, markNotificationSent, reserveEvent } from './notificationRepository';
import { fetchUserContact } from './userDirectoryService';

function getUserId(
    envelope: NotificationEnvelope<AchievementPayload | SessionFinishedPayload>,
): string {
    return envelope.payload.user_id;
}

export async function processNotificationEvent(
    envelope: NotificationEnvelope<AchievementPayload | SessionFinishedPayload>,
): Promise<'processed' | 'duplicate'> {
    const userId = getUserId(envelope);
    const reserve = await reserveEvent(envelope, userId);

    if (reserve.action === 'skip') {
        console.log(`[notification-service][event_id=${envelope.event_id}] duplicado omitido con status=${reserve.status}`);
        return 'duplicate';
    }

    try {
        const recipient = await fetchUserContact(userId);
        const rendered = renderNotification(envelope.event_type as SupportedEventType, envelope, recipient);

        const emailResult = await sendEmail({
            to: recipient.email,
            subject: rendered.subject,
            text: rendered.text,
            html: rendered.html,
        });

        if (!emailResult.success) {
            throw new Error('fallo el envio del correo');
        }

        await markNotificationSent({
            eventId: envelope.event_id,
            recipientEmail: recipient.email,
            recipientName: recipient.firstName || null,
            subject: rendered.subject,
            bodyText: rendered.text,
        });

        console.log(`[notification-service][event_id=${envelope.event_id}] notificacion enviada para user_id=${userId}`);
        return 'processed';
    } catch (error) {
        const message = error instanceof Error ? error.message : 'error desconocido procesando notificacion';
        await markNotificationFailed(envelope.event_id, message);
        console.error(`[notification-service][event_id=${envelope.event_id}] error procesando evento: ${message}`);
        throw error;
    }
}

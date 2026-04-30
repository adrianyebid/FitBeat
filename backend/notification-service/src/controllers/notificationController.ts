import { Request, Response } from 'express';
import { listNotificationsByUser } from '../services/notificationRepository';

export const getUserNotifications = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id) {
        res.status(400).json({ error: 'user_id requerido' });
        return;
    }

    try {
        const notifications = await listNotificationsByUser(id);
        res.status(200).json({ notifications });
    } catch (error) {
        console.error('[notification-service] error listando notificaciones', error);
        res.status(500).json({ error: 'No se pudieron obtener las notificaciones' });
    }
};

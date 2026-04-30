import { Router } from 'express';
import { getUserNotifications } from '../controllers/notificationController';

const router = Router();

router.get('/user/:id', getUserNotifications);

export default router;

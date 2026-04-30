import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { initializeDatabase } from './config/db';
import notificationRoutes from './routes/notificationRoutes';
import { startRabbitConsumer } from './services/rabbitConsumer';

async function bootstrap(): Promise<void> {
    await initializeDatabase();
    await startRabbitConsumer();

    const app = express();
    const port = Number(process.env.PORT || 8083);

    app.use(cors());
    app.use(express.json());
    app.use('/notifications', notificationRoutes);

    app.get('/health', (_req, res) => {
        res.status(200).json({ status: 'notification-service running' });
    });

    app.listen(port, () => {
        console.log(`[notification-service] HTTP escuchando en puerto ${port}`);
    });
}

bootstrap().catch((error) => {
    console.error('[notification-service] fallo al iniciar', error);
    process.exit(1);
});

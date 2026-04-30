import amqp, { Channel, ConsumeMessage } from 'amqplib';
import { processNotificationEvent } from './notificationProcessor';
import { validateEnvelope } from './eventValidation';

const routingKeys = ['weekly_goal_reached', 'first_10_sessions', 'session.finished'];

function getRabbitConfig() {
    return {
        rabbitUrl: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/',
        eventsExchange: process.env.RABBITMQ_EVENTS_EXCHANGE || 'fitbeat.events',
        queueName: process.env.NOTIFICATION_QUEUE_NAME || 'fitbeat.notification.q',
        retryQueueName: process.env.NOTIFICATION_RETRY_QUEUE_NAME || 'fitbeat.notification.retry.q',
        dlqExchange: process.env.NOTIFICATION_DLX_NAME || 'fitbeat.notification.dlx',
        dlqQueueName: process.env.NOTIFICATION_DLQ_NAME || 'fitbeat.notification.dlq',
        retryDelayMs: Number(process.env.NOTIFICATION_RETRY_DELAY_MS || 5000),
        maxRetries: Number(process.env.NOTIFICATION_MAX_RETRIES || 3),
    };
}

function readRetryCount(message: ConsumeMessage): number {
    const headerValue = message.properties.headers?.['x-retry-count'];
    if (typeof headerValue === 'number') {
        return headerValue;
    }
    if (typeof headerValue === 'string') {
        const parsed = Number(headerValue);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

async function sendToRetry(channel: Channel, message: ConsumeMessage, retryCount: number): Promise<void> {
    const { retryQueueName } = getRabbitConfig();
    await channel.sendToQueue(retryQueueName, message.content, {
        persistent: true,
        contentType: message.properties.contentType,
        headers: {
            ...message.properties.headers,
            'x-retry-count': retryCount,
        },
        type: message.properties.type,
        timestamp: message.properties.timestamp,
    });
}

async function sendToDlq(channel: Channel, message: ConsumeMessage, reason: string, retryCount: number): Promise<void> {
    const { dlqExchange } = getRabbitConfig();
    await channel.publish(dlqExchange, 'notification.failed', message.content, {
        persistent: true,
        contentType: message.properties.contentType,
        headers: {
            ...message.properties.headers,
            'x-retry-count': retryCount,
            'x-failure-reason': reason,
            'x-original-routing-key': message.fields.routingKey,
        },
    });
}

async function declareTopology(channel: Channel): Promise<void> {
    const { eventsExchange, queueName, retryQueueName, dlqExchange, dlqQueueName, retryDelayMs } = getRabbitConfig();
    await channel.assertExchange(eventsExchange, 'topic', { durable: true });
    await channel.assertExchange(dlqExchange, 'direct', { durable: true });

    await channel.assertQueue(queueName, { durable: true });
    await channel.assertQueue(retryQueueName, {
        durable: true,
        arguments: {
            'x-message-ttl': retryDelayMs,
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': queueName,
        },
    });
    await channel.assertQueue(dlqQueueName, { durable: true });

    for (const routingKey of routingKeys) {
        await channel.bindQueue(queueName, eventsExchange, routingKey);
    }

    await channel.bindQueue(dlqQueueName, dlqExchange, 'notification.failed');
}

async function handleMessage(channel: Channel, message: ConsumeMessage): Promise<void> {
    const { maxRetries } = getRabbitConfig();
    const retryCount = readRetryCount(message);

    try {
        const raw = JSON.parse(message.content.toString('utf-8')) as unknown;
        const envelope = validateEnvelope(raw);

        console.log(
            `[notification-service][event_id=${envelope.event_id}] recibido event_type=${envelope.event_type} retry=${retryCount}`,
        );

        await processNotificationEvent(envelope);
        channel.ack(message);
    } catch (error) {
        const reason = error instanceof Error ? error.message : 'error desconocido';
        const nextRetry = retryCount + 1;

        if (nextRetry <= maxRetries) {
            console.warn(`[notification-service] reintentando mensaje retry=${nextRetry} motivo=${reason}`);
            await sendToRetry(channel, message, nextRetry);
            channel.ack(message);
            return;
        }

        console.error(`[notification-service] enviando mensaje a DLQ motivo=${reason}`);
        await sendToDlq(channel, message, reason, retryCount);
        channel.ack(message);
    }
}

export async function startRabbitConsumer(): Promise<void> {
    const { rabbitUrl, queueName } = getRabbitConfig();
    const connection = await amqp.connect(rabbitUrl);
    const channel = await connection.createChannel();

    await declareTopology(channel);
    await channel.prefetch(10);

    await channel.consume(
        queueName,
        async (message) => {
            if (!message) {
                return;
            }
            await handleMessage(channel, message);
        },
        { noAck: false },
    );

    console.log(`[notification-service] consumer activo en cola ${queueName}`);

    const shutdown = async () => {
        await channel.close();
        await connection.close();
    };

    process.once('SIGINT', () => {
        shutdown().finally(() => process.exit(0));
    });
    process.once('SIGTERM', () => {
        shutdown().finally(() => process.exit(0));
    });
}

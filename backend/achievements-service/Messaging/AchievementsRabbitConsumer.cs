using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace AchievementsService.Messaging;

public sealed class AchievementsRabbitConsumer(
    IServiceProvider serviceProvider,
    AchievementsMessagingOptions messagingOptions,
    ILogger<AchievementsRabbitConsumer> logger) : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation(
            "Starting Achievements RabbitMQ consumer. queue={Queue} exchange={Exchange}",
            messagingOptions.QueueName,
            messagingOptions.EventsExchange);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunConsumerLoopAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "RabbitMQ consumer failed. Retrying in 5s...");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task RunConsumerLoopAsync(CancellationToken stoppingToken)
    {
        var factory = new ConnectionFactory
        {
            HostName = messagingOptions.RabbitHost,
            Port = messagingOptions.RabbitPort,
            UserName = messagingOptions.RabbitUser,
            Password = messagingOptions.RabbitPass,
            DispatchConsumersAsync = true,
            AutomaticRecoveryEnabled = true,
            TopologyRecoveryEnabled = true,
            NetworkRecoveryInterval = TimeSpan.FromSeconds(5)
        };

        using var connection = factory.CreateConnection();
        using var channel = connection.CreateModel();

        DeclareTopology(channel);
        channel.BasicQos(prefetchSize: 0, prefetchCount: 1, global: false);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.Received += async (_, delivery) => await HandleDeliveryAsync(channel, delivery, stoppingToken);

        var consumerTag = channel.BasicConsume(
            queue: messagingOptions.QueueName,
            autoAck: false,
            consumer: consumer);

        logger.LogInformation("RabbitMQ consumer started. consumerTag={ConsumerTag}", consumerTag);

        var stopTcs = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        void HandleShutdown(object? _, ShutdownEventArgs args)
        {
            logger.LogWarning("RabbitMQ connection shutdown detected. cause={Cause}", args.Cause);
            stopTcs.TrySetResult();
        }

        connection.ConnectionShutdown += HandleShutdown;

        using var registration = stoppingToken.Register(() => stopTcs.TrySetResult());
        await stopTcs.Task;

        connection.ConnectionShutdown -= HandleShutdown;
    }

    private async Task HandleDeliveryAsync(IModel channel, BasicDeliverEventArgs delivery, CancellationToken cancellationToken)
    {
        var rawBody = delivery.Body.ToArray();
        var envelope = default(InboundEventEnvelope);
        var eventIdForLogs = "unknown";

        try
        {
            envelope = JsonSerializer.Deserialize<InboundEventEnvelope>(rawBody, JsonOptions)
                ?? throw new InvalidOperationException("Invalid event envelope payload");

            eventIdForLogs = envelope.EventId?.Trim() ?? "unknown";

            using var scope = serviceProvider.CreateScope();
            var processor = scope.ServiceProvider.GetRequiredService<InboundEventProcessor>();

            await processor.ProcessAsync(envelope, cancellationToken);

            channel.BasicAck(delivery.DeliveryTag, multiple: false);
            logger.LogInformation("Event acked. event_id={EventId} event_type={EventType}", eventIdForLogs, envelope.EventType);
        }
        catch (Exception ex)
        {
            HandleFailure(channel, delivery, rawBody, envelope, eventIdForLogs, ex);
        }
    }

    private void HandleFailure(
        IModel channel,
        BasicDeliverEventArgs delivery,
        byte[] rawBody,
        InboundEventEnvelope? envelope,
        string eventId,
        Exception exception)
    {
        var currentRetry = ReadRetryCount(delivery.BasicProperties?.Headers);
        var nextRetry = currentRetry + 1;

        if (currentRetry < messagingOptions.MaxRetries)
        {
            var retryProps = BuildForwardedProperties(channel, delivery.BasicProperties, nextRetry, delivery.RoutingKey, exception);

            channel.BasicPublish(
                exchange: messagingOptions.DlxExchange,
                routingKey: messagingOptions.RetryRoutingKey,
                basicProperties: retryProps,
                body: rawBody);

            channel.BasicAck(delivery.DeliveryTag, multiple: false);

            logger.LogWarning(
                exception,
                "Event processing failed; sent to retry queue. event_id={EventId} event_type={EventType} retry={Retry}/{MaxRetries}",
                eventId,
                envelope?.EventType ?? "unknown",
                nextRetry,
                messagingOptions.MaxRetries);

            return;
        }

        var dlqProps = BuildForwardedProperties(channel, delivery.BasicProperties, currentRetry, delivery.RoutingKey, exception);
        channel.BasicPublish(
            exchange: messagingOptions.DlxExchange,
            routingKey: messagingOptions.DlqRoutingKey,
            basicProperties: dlqProps,
            body: rawBody);

        channel.BasicAck(delivery.DeliveryTag, multiple: false);

        logger.LogError(
            exception,
            "Event moved to DLQ after max retries. event_id={EventId} event_type={EventType} retries={Retries}",
            eventId,
            envelope?.EventType ?? "unknown",
            currentRetry);
    }

    private void DeclareTopology(IModel channel)
    {
        channel.ExchangeDeclare(
            exchange: messagingOptions.EventsExchange,
            type: ExchangeType.Topic,
            durable: true,
            autoDelete: false);

        channel.ExchangeDeclare(
            exchange: messagingOptions.DlxExchange,
            type: ExchangeType.Topic,
            durable: true,
            autoDelete: false);

        channel.QueueDeclare(
            queue: messagingOptions.QueueName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: null);

        channel.QueueBind(messagingOptions.QueueName, messagingOptions.EventsExchange, "session.finished");
        channel.QueueBind(messagingOptions.QueueName, messagingOptions.EventsExchange, "weekly_goal_reached");
        channel.QueueBind(messagingOptions.QueueName, messagingOptions.EventsExchange, "first_10_sessions");
        channel.QueueBind(messagingOptions.QueueName, messagingOptions.EventsExchange, messagingOptions.RetryRoutingKey);

        channel.QueueDeclare(
            queue: messagingOptions.RetryQueueName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: new Dictionary<string, object>
            {
                ["x-message-ttl"] = messagingOptions.RetryDelayMs,
                ["x-dead-letter-exchange"] = messagingOptions.EventsExchange,
                ["x-dead-letter-routing-key"] = messagingOptions.RetryRoutingKey
            });

        channel.QueueBind(messagingOptions.RetryQueueName, messagingOptions.DlxExchange, messagingOptions.RetryRoutingKey);

        channel.QueueDeclare(
            queue: messagingOptions.DlqName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: null);

        channel.QueueBind(messagingOptions.DlqName, messagingOptions.DlxExchange, messagingOptions.DlqRoutingKey);
    }

    private static IBasicProperties BuildForwardedProperties(
        IModel channel,
        IBasicProperties? source,
        int retryCount,
        string originalRoutingKey,
        Exception exception)
    {
        var properties = channel.CreateBasicProperties();
        properties.Persistent = true;
        properties.ContentType = source?.ContentType ?? "application/json";
        properties.Headers = CloneHeaders(source?.Headers);
        properties.Headers["x-retry-count"] = retryCount;
        properties.Headers["x-original-routing-key"] = Encoding.UTF8.GetBytes(originalRoutingKey);
        properties.Headers["x-last-error"] = Encoding.UTF8.GetBytes(Truncate(exception.Message, 256));
        return properties;
    }

    private static Dictionary<string, object> CloneHeaders(IDictionary<string, object>? source)
    {
        var cloned = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        if (source is null)
        {
            return cloned;
        }

        foreach (var (key, value) in source)
        {
            cloned[key] = value;
        }

        return cloned;
    }

    private static int ReadRetryCount(IDictionary<string, object>? headers)
    {
        if (headers is null || !headers.TryGetValue("x-retry-count", out var raw) || raw is null)
        {
            return 0;
        }

        return raw switch
        {
            byte[] bytes when int.TryParse(Encoding.UTF8.GetString(bytes), out var parsed) => parsed,
            sbyte value => value,
            byte value => value,
            short value => value,
            ushort value => value,
            int value => value,
            uint value => (int)value,
            long value => (int)value,
            ulong value => (int)value,
            _ => 0
        };
    }

    private static string Truncate(string value, int maxLength)
    {
        if (value.Length <= maxLength)
        {
            return value;
        }

        return value[..maxLength];
    }
}

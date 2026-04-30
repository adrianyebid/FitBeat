namespace AchievementsService.Messaging;

public sealed class AchievementsMessagingOptions
{
    public string RabbitHost { get; init; } = "rabbitmq";
    public int RabbitPort { get; init; } = 5672;
    public string RabbitUser { get; init; } = "guest";
    public string RabbitPass { get; init; } = "guest";

    public string EventsExchange { get; init; } = "fitbeat.events";
    public string DlxExchange { get; init; } = "fitbeat.events.dlx";

    public string QueueName { get; init; } = "fitbeat.achievements.q";
    public string RetryQueueName { get; init; } = "fitbeat.achievements.retry.q";
    public string DlqName { get; init; } = "fitbeat.achievements.dlq";

    public string RetryRoutingKey { get; init; } = "fitbeat.achievements.retry";
    public string DlqRoutingKey { get; init; } = "fitbeat.achievements.dlq";

    public int RetryDelayMs { get; init; } = 5000;
    public int MaxRetries { get; init; } = 3;

    public int FallbackSessionDurationMinutes { get; init; } = 30;

    public static AchievementsMessagingOptions FromEnvironment()
    {
        return new AchievementsMessagingOptions
        {
            RabbitHost = GetString("RABBITMQ_HOST", "rabbitmq"),
            RabbitPort = GetInt("RABBITMQ_PORT", 5672),
            RabbitUser = GetString("RABBITMQ_USER", "guest"),
            RabbitPass = GetString("RABBITMQ_PASS", "guest"),
            EventsExchange = GetString("RABBITMQ_EVENTS_EXCHANGE", "fitbeat.events"),
            DlxExchange = GetString("RABBITMQ_DLX_EXCHANGE", "fitbeat.events.dlx"),
            QueueName = GetString("ACHIEVEMENTS_QUEUE_NAME", "fitbeat.achievements.q"),
            RetryQueueName = GetString("ACHIEVEMENTS_RETRY_QUEUE_NAME", "fitbeat.achievements.retry.q"),
            DlqName = GetString("ACHIEVEMENTS_DLQ_NAME", "fitbeat.achievements.dlq"),
            RetryRoutingKey = GetString("ACHIEVEMENTS_RETRY_ROUTING_KEY", "fitbeat.achievements.retry"),
            DlqRoutingKey = GetString("ACHIEVEMENTS_DLQ_ROUTING_KEY", "fitbeat.achievements.dlq"),
            RetryDelayMs = GetInt("ACHIEVEMENTS_RETRY_DELAY_MS", 5000),
            MaxRetries = GetInt("ACHIEVEMENTS_MAX_RETRIES", 3),
            FallbackSessionDurationMinutes = GetInt("ACHIEVEMENTS_DEFAULT_SESSION_MINUTES", 30)
        };
    }

    private static string GetString(string key, string fallback)
    {
        var value = Environment.GetEnvironmentVariable(key);
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    private static int GetInt(string key, int fallback)
    {
        var value = Environment.GetEnvironmentVariable(key);
        return int.TryParse(value, out var parsed) ? parsed : fallback;
    }
}

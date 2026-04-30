using System.Text.Json;
using System.Text.Json.Serialization;

namespace AchievementsService.Messaging;

public sealed class InboundEventEnvelope
{
    [JsonPropertyName("event_id")]
    public string? EventId { get; init; }

    [JsonPropertyName("event_type")]
    public string? EventType { get; init; }

    [JsonPropertyName("occurred_at")]
    public DateTimeOffset? OccurredAt { get; init; }

    [JsonPropertyName("source")]
    public string? Source { get; init; }

    [JsonPropertyName("version")]
    public int? Version { get; init; }

    [JsonPropertyName("payload")]
    public JsonElement Payload { get; init; }
}

public sealed class SessionFinishedPayload
{
    [JsonPropertyName("session_id")]
    public string? SessionId { get; init; }

    [JsonPropertyName("user_id")]
    public string? UserId { get; init; }

    [JsonPropertyName("finished_at")]
    public DateTimeOffset? FinishedAt { get; init; }

    [JsonPropertyName("duration_minutes")]
    public int? DurationMinutes { get; init; }

    [JsonPropertyName("real_duration_sec")]
    public int? RealDurationSec { get; init; }
}

public sealed class WeeklyGoalReachedPayload
{
    [JsonPropertyName("user_id")]
    public string? UserId { get; init; }

    [JsonPropertyName("week_start")]
    public string? WeekStart { get; init; }

    [JsonPropertyName("sessions_finished")]
    public int? SessionsFinished { get; init; }

    [JsonPropertyName("goal")]
    public int? Goal { get; init; }
}

public sealed class First10SessionsPayload
{
    [JsonPropertyName("user_id")]
    public string? UserId { get; init; }

    [JsonPropertyName("sessions_finished")]
    public int? SessionsFinished { get; init; }
}

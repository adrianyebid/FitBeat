using System.Text.Json;
using AchievementsService.Application;
using AchievementsService.Data;
using AchievementsService.Models;
using Microsoft.EntityFrameworkCore;

namespace AchievementsService.Messaging;

public sealed class InboundEventProcessor(
    AchievementsDbContext db,
    AchievementEvaluationService evaluator,
    AchievementsMessagingOptions messagingOptions,
    ILogger<InboundEventProcessor> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task ProcessAsync(InboundEventEnvelope envelope, CancellationToken cancellationToken = default)
    {
        var eventId = envelope.EventId?.Trim();
        var eventType = envelope.EventType?.Trim();

        if (string.IsNullOrWhiteSpace(eventId))
        {
            throw new InvalidOperationException("event_id is required");
        }

        if (string.IsNullOrWhiteSpace(eventType))
        {
            throw new InvalidOperationException("event_type is required");
        }

        var alreadyProcessed = await db.ProcessedInboundEvents
            .AsNoTracking()
            .AnyAsync(x => x.EventId == eventId, cancellationToken);

        if (alreadyProcessed)
        {
            logger.LogInformation("Skipping duplicate event {EventId} ({EventType})", eventId, eventType);
            return;
        }

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);

        string? userId = null;

        switch (eventType)
        {
            case "session.finished":
                userId = await HandleSessionFinishedAsync(envelope, cancellationToken);
                break;
            case "weekly_goal_reached":
                userId = await HandleWeeklyGoalReachedAsync(envelope, cancellationToken);
                break;
            case "first_10_sessions":
                userId = await HandleFirst10SessionsAsync(envelope, cancellationToken);
                break;
            default:
                logger.LogInformation("Ignoring unsupported event type {EventType} (event_id={EventId})", eventType, eventId);
                break;
        }

        db.ProcessedInboundEvents.Add(new ProcessedInboundEvent
        {
            EventId = eventId,
            EventType = eventType,
            Source = envelope.Source,
            UserId = userId,
            ProcessedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        logger.LogInformation("Processed event {EventId} ({EventType}) for user {UserId}", eventId, eventType, userId ?? "n/a");
    }

    private async Task<string> HandleSessionFinishedAsync(InboundEventEnvelope envelope, CancellationToken cancellationToken)
    {
        var payload = DeserializePayload<SessionFinishedPayload>(envelope.Payload);
        var userId = payload.UserId?.Trim();
        var sessionId = payload.SessionId?.Trim();

        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new InvalidOperationException("session.finished payload.user_id is required");
        }

        if (string.IsNullOrWhiteSpace(sessionId))
        {
            throw new InvalidOperationException("session.finished payload.session_id is required");
        }

        var durationMinutes = ResolveDurationMinutes(payload);
        var completedAtUtc = payload.FinishedAt?.UtcDateTime
            ?? envelope.OccurredAt?.UtcDateTime
            ?? DateTime.UtcNow;

        var result = await evaluator.EvaluateSessionAsync(
            userId,
            sessionId,
            durationMinutes,
            completedAtUtc,
            cancellationToken);

        if (result.NewlyUnlocked.Count > 0)
        {
            logger.LogInformation(
                "Unlocked achievements for user {UserId} from event session.finished: {Unlocked}",
                userId,
                string.Join(',', result.NewlyUnlocked));
        }

        return userId;
    }

    private async Task<string> HandleWeeklyGoalReachedAsync(InboundEventEnvelope envelope, CancellationToken cancellationToken)
    {
        var payload = DeserializePayload<WeeklyGoalReachedPayload>(envelope.Payload);
        var userId = payload.UserId?.Trim();

        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new InvalidOperationException("weekly_goal_reached payload.user_id is required");
        }

        // The weekly event may arrive even if no duration field is available in upstream events.
        // Re-evaluate current persisted progress and enforce badge rules from stored sessions.
        var progress = await evaluator.GetUserProgressAsync(userId, DateTime.UtcNow, cancellationToken);
        if (progress.Progress.WeeklyMinutes >= 100)
        {
            await evaluator.EnsureAchievementUnlockedAsync(
                userId,
                AchievementLogic.Weekly100Minutes,
                DateTime.UtcNow,
                cancellationToken);
        }

        return userId;
    }

    private async Task<string> HandleFirst10SessionsAsync(InboundEventEnvelope envelope, CancellationToken cancellationToken)
    {
        var payload = DeserializePayload<First10SessionsPayload>(envelope.Payload);
        var userId = payload.UserId?.Trim();

        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new InvalidOperationException("first_10_sessions payload.user_id is required");
        }

        if ((payload.SessionsFinished ?? 0) >= 10)
        {
            await evaluator.EnsureAchievementUnlockedAsync(
                userId,
                AchievementLogic.First10Sessions,
                DateTime.UtcNow,
                cancellationToken);
        }

        return userId;
    }

    private static T DeserializePayload<T>(JsonElement payload)
    {
        var result = payload.Deserialize<T>(JsonOptions);
        return result ?? throw new InvalidOperationException($"payload is invalid for {typeof(T).Name}");
    }

    private int ResolveDurationMinutes(SessionFinishedPayload payload)
    {
        if ((payload.DurationMinutes ?? 0) > 0)
        {
            return payload.DurationMinutes!.Value;
        }

        if ((payload.RealDurationSec ?? 0) > 0)
        {
            return Math.Max(1, (int)Math.Ceiling(payload.RealDurationSec!.Value / 60.0));
        }

        logger.LogWarning(
            "session.finished arrived without duration; using fallback {FallbackMinutes} minutes",
            messagingOptions.FallbackSessionDurationMinutes);

        return Math.Max(1, messagingOptions.FallbackSessionDurationMinutes);
    }
}

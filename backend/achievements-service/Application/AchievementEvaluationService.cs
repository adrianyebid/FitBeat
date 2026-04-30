using AchievementsService.Contracts;
using AchievementsService.Data;
using AchievementsService.Models;
using Microsoft.EntityFrameworkCore;

namespace AchievementsService.Application;

public sealed class AchievementEvaluationService(AchievementsDbContext db)
{
    public async Task<EvaluateAchievementResponse> EvaluateSessionAsync(
        string userId,
        string? sessionId,
        int durationMinutes,
        DateTime completedAtUtc,
        CancellationToken cancellationToken = default)
    {
        var normalizedUserId = userId.Trim();
        var normalizedSessionId = string.IsNullOrWhiteSpace(sessionId)
            ? Guid.NewGuid().ToString("N")
            : sessionId.Trim();

        var alreadyProcessed = await db.TrainingSessions
            .AsNoTracking()
            .AnyAsync(x => x.UserId == normalizedUserId && x.SessionId == normalizedSessionId, cancellationToken);

        if (alreadyProcessed)
        {
            return await BuildResponseForExistingSessionAsync(
                normalizedUserId,
                normalizedSessionId,
                completedAtUtc,
                "session already processed",
                cancellationToken);
        }

        db.TrainingSessions.Add(new TrainingSessionEvent
        {
            UserId = normalizedUserId,
            SessionId = normalizedSessionId,
            DurationMinutes = Math.Max(0, durationMinutes),
            CompletedAtUtc = completedAtUtc
        });

        await db.SaveChangesAsync(cancellationToken);

        var userSessions = await db.TrainingSessions
            .AsNoTracking()
            .Where(x => x.UserId == normalizedUserId)
            .OrderByDescending(x => x.CompletedAtUtc)
            .ToListAsync(cancellationToken);

        var progress = AchievementLogic.BuildProgress(userSessions, completedAtUtc);

        var unlockedCodes = await db.UserAchievements
            .Where(x => x.UserId == normalizedUserId)
            .Select(x => x.AchievementCode)
            .ToListAsync(cancellationToken);

        var unlockedSet = unlockedCodes.ToHashSet();
        var newlyUnlocked = AchievementLogic.CalculateNewUnlocks(progress, unlockedSet);

        if (newlyUnlocked.Count > 0)
        {
            var unlockedAt = DateTime.UtcNow;
            foreach (var code in newlyUnlocked)
            {
                db.UserAchievements.Add(new UserAchievement
                {
                    UserId = normalizedUserId,
                    AchievementCode = code,
                    UnlockedAtUtc = unlockedAt
                });
                unlockedSet.Add(code);
            }

            await db.SaveChangesAsync(cancellationToken);
        }

        var unlockedAchievements = unlockedSet.OrderBy(x => x).ToList();

        return new EvaluateAchievementResponse(
            normalizedUserId,
            normalizedSessionId,
            completedAtUtc,
            progress,
            newlyUnlocked,
            unlockedAchievements,
            null
        );
    }

    public async Task<UserProgressResponse> GetUserProgressAsync(
        string userId,
        DateTime referenceUtc,
        CancellationToken cancellationToken = default)
    {
        var normalizedUserId = userId.Trim();

        var sessions = await db.TrainingSessions
            .AsNoTracking()
            .Where(x => x.UserId == normalizedUserId)
            .OrderByDescending(x => x.CompletedAtUtc)
            .ToListAsync(cancellationToken);

        var progress = AchievementLogic.BuildProgress(sessions, referenceUtc);

        var unlocked = await db.UserAchievements
            .AsNoTracking()
            .Where(x => x.UserId == normalizedUserId)
            .OrderByDescending(x => x.UnlockedAtUtc)
            .Select(x => new UserAchievementResponse(x.AchievementCode, x.UnlockedAtUtc))
            .ToListAsync(cancellationToken);

        return new UserProgressResponse(normalizedUserId, progress, unlocked);
    }

    public async Task<bool> EnsureAchievementUnlockedAsync(
        string userId,
        string achievementCode,
        DateTime? unlockedAtUtc = null,
        CancellationToken cancellationToken = default)
    {
        var normalizedUserId = userId.Trim();
        var normalizedCode = achievementCode.Trim();

        if (string.IsNullOrWhiteSpace(normalizedUserId) || string.IsNullOrWhiteSpace(normalizedCode))
        {
            return false;
        }

        var exists = await db.UserAchievements
            .AsNoTracking()
            .AnyAsync(
                x => x.UserId == normalizedUserId && x.AchievementCode == normalizedCode,
                cancellationToken);

        if (exists)
        {
            return false;
        }

        db.UserAchievements.Add(new UserAchievement
        {
            UserId = normalizedUserId,
            AchievementCode = normalizedCode,
            UnlockedAtUtc = unlockedAtUtc ?? DateTime.UtcNow
        });

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException)
        {
            // Another worker or request may have inserted the same unlock concurrently.
            return false;
        }
    }

    private async Task<EvaluateAchievementResponse> BuildResponseForExistingSessionAsync(
        string userId,
        string sessionId,
        DateTime completedAtUtc,
        string message,
        CancellationToken cancellationToken)
    {
        var sessions = await db.TrainingSessions
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CompletedAtUtc)
            .ToListAsync(cancellationToken);

        var progress = AchievementLogic.BuildProgress(sessions, completedAtUtc);

        var unlockedAchievements = await db.UserAchievements
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => x.AchievementCode)
            .OrderBy(x => x)
            .ToListAsync(cancellationToken);

        return new EvaluateAchievementResponse(
            userId,
            sessionId,
            completedAtUtc,
            progress,
            [],
            unlockedAchievements,
            message
        );
    }
}

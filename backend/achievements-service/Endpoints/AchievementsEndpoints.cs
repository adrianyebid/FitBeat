using AchievementsService.Application;
using AchievementsService.Contracts;
using AchievementsService.Data;
using AchievementsService.Models;
using Microsoft.EntityFrameworkCore;

namespace AchievementsService.Endpoints;

public static class AchievementsEndpoints
{
    public static IEndpointRouteBuilder MapAchievementsEndpoints(this IEndpointRouteBuilder app)
    {
        var achievements = app.MapGroup("/achievements");

        achievements.MapGet("/catalog", async (AchievementsDbContext db) =>
        {
            var catalog = await db.AchievementCatalog
                .AsNoTracking()
                .OrderBy(x => x.Code)
                .Select(x => new CatalogItemResponse(x.Code, x.Name, x.Description, x.TargetValue, x.Unit))
                .ToListAsync();

            return Results.Ok(catalog);
        });

        achievements.MapGet("/user/{id}", async (string id, AchievementsDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return Results.BadRequest(new ErrorResponse("user id is required"));
            }

            var sessions = await db.TrainingSessions
                .AsNoTracking()
                .Where(x => x.UserId == id)
                .OrderByDescending(x => x.CompletedAtUtc)
                .ToListAsync();

            var progress = AchievementLogic.BuildProgress(sessions, DateTime.UtcNow);

            var unlocked = await db.UserAchievements
                .AsNoTracking()
                .Where(x => x.UserId == id)
                .OrderByDescending(x => x.UnlockedAtUtc)
                .Select(x => new UserAchievementResponse(x.AchievementCode, x.UnlockedAtUtc))
                .ToListAsync();

            return Results.Ok(new UserProgressResponse(id, progress, unlocked));
        });

        achievements.MapPost("/evaluate", async (EvaluateAchievementRequest request, AchievementsDbContext db) =>
        {
            var validationErrors = RequestValidator.Validate(request);
            if (validationErrors.Count > 0)
            {
                return Results.BadRequest(new ValidationErrorResponse("invalid request payload", validationErrors));
            }

            var completedAtUtc = request.CompletedAtUtc ?? DateTime.UtcNow;
            var sessionId = string.IsNullOrWhiteSpace(request.SessionId)
                ? Guid.NewGuid().ToString("N")
                : request.SessionId.Trim();
            var userId = request.UserId.Trim();

            var alreadyProcessed = await db.TrainingSessions
                .AsNoTracking()
                .AnyAsync(x => x.UserId == userId && x.SessionId == sessionId);

            if (alreadyProcessed)
            {
                var existingSessions = await db.TrainingSessions
                    .AsNoTracking()
                    .Where(x => x.UserId == userId)
                    .OrderByDescending(x => x.CompletedAtUtc)
                    .ToListAsync();

                var existingProgress = AchievementLogic.BuildProgress(existingSessions, completedAtUtc);

                var existingUnlockedCodes = await db.UserAchievements
                    .AsNoTracking()
                    .Where(x => x.UserId == userId)
                    .Select(x => x.AchievementCode)
                    .OrderBy(x => x)
                    .ToListAsync();

                return Results.Ok(new EvaluateAchievementResponse(
                    userId,
                    sessionId,
                    completedAtUtc,
                    existingProgress,
                    [],
                    existingUnlockedCodes,
                    "session already processed"
                ));
            }

            db.TrainingSessions.Add(new TrainingSessionEvent
            {
                UserId = userId,
                SessionId = sessionId,
                DurationMinutes = request.DurationMinutes,
                CompletedAtUtc = completedAtUtc
            });
            await db.SaveChangesAsync();

            var userSessions = await db.TrainingSessions
                .AsNoTracking()
                .Where(x => x.UserId == userId)
                .OrderByDescending(x => x.CompletedAtUtc)
                .ToListAsync();

            var progress = AchievementLogic.BuildProgress(userSessions, completedAtUtc);

            var unlockedList = await db.UserAchievements
                .Where(x => x.UserId == userId)
                .Select(x => x.AchievementCode)
                .ToListAsync();
            var unlockedSet = unlockedList.ToHashSet();

            var newlyUnlocked = AchievementLogic.CalculateNewUnlocks(progress, unlockedSet);

            if (newlyUnlocked.Count > 0)
            {
                var unlockedAt = DateTime.UtcNow;
                foreach (var code in newlyUnlocked)
                {
                    db.UserAchievements.Add(new UserAchievement
                    {
                        UserId = userId,
                        AchievementCode = code,
                        UnlockedAtUtc = unlockedAt
                    });
                    unlockedSet.Add(code);
                }

                await db.SaveChangesAsync();
            }

            var unlockedAchievements = unlockedSet.OrderBy(x => x).ToList();

            return Results.Ok(new EvaluateAchievementResponse(
                userId,
                sessionId,
                completedAtUtc,
                progress,
                newlyUnlocked,
                unlockedAchievements,
                null
            ));
        });

        return app;
    }
}

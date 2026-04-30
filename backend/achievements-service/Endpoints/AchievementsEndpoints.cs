using AchievementsService.Application;
using AchievementsService.Contracts;
using AchievementsService.Data;
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

        achievements.MapGet("/user/{id}", async (string id, AchievementEvaluationService evaluator) =>
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return Results.BadRequest(new ErrorResponse("user id is required"));
            }

            var progress = await evaluator.GetUserProgressAsync(id, DateTime.UtcNow);
            return Results.Ok(progress);
        });

        achievements.MapPost("/evaluate", async (EvaluateAchievementRequest request, AchievementEvaluationService evaluator) =>
        {
            var validationErrors = RequestValidator.Validate(request);
            if (validationErrors.Count > 0)
            {
                return Results.BadRequest(new ValidationErrorResponse("invalid request payload", validationErrors));
            }

            var completedAtUtc = request.CompletedAtUtc ?? DateTime.UtcNow;
            var result = await evaluator.EvaluateSessionAsync(
                request.UserId,
                request.SessionId,
                request.DurationMinutes,
                completedAtUtc);

            return Results.Ok(result);
        });

        return app;
    }
}

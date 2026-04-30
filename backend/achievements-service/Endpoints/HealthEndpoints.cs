using AchievementsService.Contracts;
using AchievementsService.Data;

namespace AchievementsService.Endpoints;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", () => Results.Ok(new HealthResponse("ok", "achievements-service")));

        app.MapGet("/health/db", async (AchievementsDbContext db) =>
        {
            var canConnect = await db.Database.CanConnectAsync();
            return canConnect
                ? Results.Ok(new HealthResponse("ok", "achievements-db"))
                : Results.Problem("database connection failed", statusCode: StatusCodes.Status503ServiceUnavailable);
        });

        return app;
    }
}

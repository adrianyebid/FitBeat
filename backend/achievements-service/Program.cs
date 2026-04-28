using AchievementsService.Data;
using AchievementsService.Endpoints;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var achievementsDatabaseUrl = Environment.GetEnvironmentVariable("ACHIEVEMENTS_DATABASE_URL");
var dbPath = Environment.GetEnvironmentVariable("ACHIEVEMENTS_DB_PATH") ?? "Data/achievements.db";
var frontendAppUrl = Environment.GetEnvironmentVariable("FRONTEND_APP_URL") ?? "http://localhost:5173";

builder.Services.AddDbContext<AchievementsDbContext>(options =>
{
    if (!string.IsNullOrWhiteSpace(achievementsDatabaseUrl))
    {
        options.UseNpgsql(achievementsDatabaseUrl);
        return;
    }

    var dataDirectory = Path.GetDirectoryName(dbPath);
    if (!string.IsNullOrWhiteSpace(dataDirectory))
    {
        Directory.CreateDirectory(dataDirectory);
    }

    options.UseSqlite($"Data Source={dbPath}");
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        policy
            .WithOrigins(frontendAppUrl, "http://127.0.0.1:5173", "http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();
app.UseCors("frontend");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AchievementsDbContext>();
    await MigrationBootstrapper.BaselineIfNeededAsync(db);
    await db.Database.MigrateAsync();
    await CatalogSeeder.SeedAsync(db);
}

app.MapHealthEndpoints();
app.MapAchievementsEndpoints();

app.Run();

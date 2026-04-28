using AchievementsService.Application;
using AchievementsService.Models;
using Microsoft.EntityFrameworkCore;

namespace AchievementsService.Data;

public static class CatalogSeeder
{
    public static async Task SeedAsync(AchievementsDbContext db)
    {
        var seedItems = new[]
        {
            new AchievementDefinition
            {
                Code = "first_workout_completed",
                Name = "Primer entreno completado",
                Description = "Completa tu primera sesión de entrenamiento.",
                TargetValue = 1,
                Unit = "session"
            },
            new AchievementDefinition
            {
                Code = "five_sessions_streak",
                Name = "Constancia 5 días",
                Description = "Completa entrenamientos en 5 días consecutivos.",
                TargetValue = 5,
                Unit = "days"
            },
            new AchievementDefinition
            {
                Code = "first_10_sessions",
                Name = "Primeras 10 sesiones",
                Description = "Completa tus primeras 10 sesiones de entrenamiento.",
                TargetValue = 10,
                Unit = "sessions"
            },
            new AchievementDefinition
            {
                Code = "weekly_100_minutes",
                Name = "100 minutos semanales",
                Description = "Acumula al menos 100 minutos de entrenamiento en 7 días.",
                TargetValue = 100,
                Unit = "minutes"
            }
        };

        foreach (var item in seedItems)
        {
            var exists = await db.AchievementCatalog.AnyAsync(x => x.Code == item.Code);
            if (!exists)
            {
                db.AchievementCatalog.Add(item);
            }
        }

        await db.SaveChangesAsync();
    }
}

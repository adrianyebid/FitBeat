using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace AchievementsService.Data;

public sealed class AchievementsDbContextFactory : IDesignTimeDbContextFactory<AchievementsDbContext>
{
    public AchievementsDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AchievementsDbContext>();

        var connectionString =
            Environment.GetEnvironmentVariable("ACHIEVEMENTS_DATABASE_URL")
            ?? "Host=localhost;Port=5434;Database=achievements_db;Username=postgres;Password=postgres";

        optionsBuilder.UseNpgsql(connectionString);

        return new AchievementsDbContext(optionsBuilder.Options);
    }
}

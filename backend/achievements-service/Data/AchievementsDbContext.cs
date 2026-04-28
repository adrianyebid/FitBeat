using AchievementsService.Models;
using Microsoft.EntityFrameworkCore;

namespace AchievementsService.Data;

public sealed class AchievementsDbContext(DbContextOptions<AchievementsDbContext> options) : DbContext(options)
{
    public DbSet<AchievementDefinition> AchievementCatalog => Set<AchievementDefinition>();
    public DbSet<UserAchievement> UserAchievements => Set<UserAchievement>();
    public DbSet<TrainingSessionEvent> TrainingSessions => Set<TrainingSessionEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AchievementDefinition>()
            .HasKey(x => x.Code);

        modelBuilder.Entity<UserAchievement>()
            .HasIndex(x => new { x.UserId, x.AchievementCode })
            .IsUnique();

        modelBuilder.Entity<TrainingSessionEvent>()
            .HasIndex(x => new { x.UserId, x.SessionId })
            .IsUnique();
    }
}

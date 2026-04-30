namespace AchievementsService.Models;

public sealed class UserAchievement
{
    public long Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string AchievementCode { get; set; } = string.Empty;
    public DateTime UnlockedAtUtc { get; set; }
}

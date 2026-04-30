namespace AchievementsService.Models;

public sealed class TrainingSessionEvent
{
    public long Id { get; set; }
    public string SessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public int DurationMinutes { get; set; }
    public DateTime CompletedAtUtc { get; set; }
}

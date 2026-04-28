namespace AchievementsService.Models;

public sealed class ProcessedInboundEvent
{
    public long Id { get; set; }
    public string EventId { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string? Source { get; set; }
    public string? UserId { get; set; }
    public DateTime ProcessedAtUtc { get; set; }
}

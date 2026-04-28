namespace AchievementsService.Models;

public sealed class AchievementDefinition
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int TargetValue { get; set; }
    public string Unit { get; set; } = string.Empty;
}

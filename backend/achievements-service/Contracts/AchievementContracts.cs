using System.ComponentModel.DataAnnotations;

namespace AchievementsService.Contracts;

public sealed record EvaluateAchievementRequest(
    [Required] string UserId,
    string? SessionId,
    [Range(1, 24 * 60)] int DurationMinutes,
    DateTime? CompletedAtUtc
);

public sealed record HealthResponse(string Status, string Service);
public sealed record ErrorResponse(string Message);
public sealed record ValidationErrorResponse(string Message, List<string> Details);
public sealed record CatalogItemResponse(string Code, string Name, string Description, int TargetValue, string Unit);
public sealed record UserAchievementResponse(string AchievementCode, DateTime UnlockedAtUtc);
public sealed record AchievementProgress(int TotalSessions, int CurrentStreakDays, int WeeklyMinutes);
public sealed record UserProgressResponse(string UserId, AchievementProgress Progress, List<UserAchievementResponse> UnlockedAchievements);
public sealed record EvaluateAchievementResponse(
    string UserId,
    string SessionId,
    DateTime EvaluatedAtUtc,
    AchievementProgress Progress,
    List<string> NewlyUnlocked,
    List<string> UnlockedAchievements,
    string? Message
);

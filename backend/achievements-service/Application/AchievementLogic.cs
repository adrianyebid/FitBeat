using AchievementsService.Contracts;
using AchievementsService.Models;

namespace AchievementsService.Application;

public static class AchievementLogic
{
    public const string FirstWorkoutCompleted = "first_workout_completed";
    public const string FiveSessionsStreak = "five_sessions_streak";
    public const string Weekly100Minutes = "weekly_100_minutes";

    public static AchievementProgress BuildProgress(List<TrainingSessionEvent> sessions, DateTime referenceUtc)
    {
        return new AchievementProgress(
            sessions.Count,
            CalculateConsecutiveDayStreak(sessions),
            CalculateWeeklyMinutes(sessions, referenceUtc)
        );
    }

    public static List<string> CalculateNewUnlocks(AchievementProgress progress, HashSet<string> unlockedSet)
    {
        var newlyUnlocked = new List<string>();

        TryUnlockIf(progress.TotalSessions >= 1, FirstWorkoutCompleted);
        TryUnlockIf(progress.CurrentStreakDays >= 5, FiveSessionsStreak);
        TryUnlockIf(progress.WeeklyMinutes >= 100, Weekly100Minutes);

        return newlyUnlocked;

        void TryUnlockIf(bool condition, string code)
        {
            if (!condition || unlockedSet.Contains(code))
            {
                return;
            }

            newlyUnlocked.Add(code);
        }
    }

    private static int CalculateConsecutiveDayStreak(List<TrainingSessionEvent> sessions)
    {
        var distinctDays = sessions
            .Select(x => DateOnly.FromDateTime(x.CompletedAtUtc.Date))
            .Distinct()
            .OrderByDescending(x => x)
            .ToList();

        if (distinctDays.Count == 0)
        {
            return 0;
        }

        var streak = 1;
        var previous = distinctDays[0];

        for (var i = 1; i < distinctDays.Count; i++)
        {
            var current = distinctDays[i];
            if (previous.DayNumber - current.DayNumber != 1)
            {
                break;
            }

            streak++;
            previous = current;
        }

        return streak;
    }

    private static int CalculateWeeklyMinutes(List<TrainingSessionEvent> sessions, DateTime referenceUtc)
    {
        var startOfWindow = referenceUtc.Date.AddDays(-6);
        return sessions
            .Where(x => x.CompletedAtUtc >= startOfWindow && x.CompletedAtUtc <= referenceUtc)
            .Sum(x => x.DurationMinutes);
    }
}

using System.ComponentModel.DataAnnotations;
using AchievementsService.Contracts;

namespace AchievementsService.Application;

public static class RequestValidator
{
    public static List<string> Validate(EvaluateAchievementRequest request)
    {
        var context = new ValidationContext(request);
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(request, context, results, validateAllProperties: true);

        var errors = results
            .Select(x => x.ErrorMessage)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Cast<string>()
            .ToList();

        if (string.IsNullOrWhiteSpace(request.UserId))
        {
            errors.Add("UserId is required");
        }

        if (!string.IsNullOrWhiteSpace(request.SessionId) && request.SessionId.Length > 128)
        {
            errors.Add("SessionId max length is 128 characters");
        }

        return errors.Distinct().ToList();
    }
}

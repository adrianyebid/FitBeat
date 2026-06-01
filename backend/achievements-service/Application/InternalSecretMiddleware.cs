using System.Security.Cryptography;
using System.Text;

namespace AchievementsService.Application;

/// <summary>
/// ASP.NET Core middleware that validates the X-Internal-Token header for S2S routes.
/// Uses CryptographicOperations.FixedTimeEquals for timing-attack mitigation.
/// Only applies to routes matching the /internal/ path prefix.
/// </summary>
public sealed class InternalSecretMiddleware
{
    private const string HeaderName = "X-Internal-Token";
    private readonly RequestDelegate _next;
    private readonly byte[] _expectedBytes;

    public InternalSecretMiddleware(RequestDelegate next, string secret)
    {
        _next = next;
        _expectedBytes = Encoding.UTF8.GetBytes(secret);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Only validate internal routes — public routes pass through untouched
        if (!context.Request.Path.StartsWithSegments("/internal"))
        {
            await _next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue(HeaderName, out var tokenValues)
            || string.IsNullOrWhiteSpace(tokenValues.FirstOrDefault()))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { message = "missing " + HeaderName + " header" });
            return;
        }

        var providedBytes = Encoding.UTF8.GetBytes(tokenValues.First()!);

        if (_expectedBytes.Length != providedBytes.Length
            || !CryptographicOperations.FixedTimeEquals(providedBytes, _expectedBytes))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { message = "invalid internal token" });
            return;
        }

        await _next(context);
    }
}

/// <summary>
/// Extension method to register the InternalSecretMiddleware in the ASP.NET pipeline.
/// </summary>
public static class InternalSecretMiddlewareExtensions
{
    public static IApplicationBuilder UseInternalSecretAuth(this IApplicationBuilder app)
    {
        var secret = Environment.GetEnvironmentVariable("FITBEAT_INTERNAL_SECRET") ?? "";
        if (string.IsNullOrWhiteSpace(secret))
        {
            // If no secret is configured, skip registration — no internal routes will be protected.
            // This allows local development without the secret set.
            return app;
        }

        return app.UseMiddleware<InternalSecretMiddleware>(secret);
    }
}

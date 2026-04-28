using System.Data;
using System.Reflection;
using Microsoft.EntityFrameworkCore;

namespace AchievementsService.Data;

public static class MigrationBootstrapper
{
    public static async Task BaselineIfNeededAsync(AchievementsDbContext db)
    {
        var allMigrations = db.Database.GetMigrations().ToList();
        var appliedMigrations = db.Database.GetAppliedMigrations().ToList();

        if (allMigrations.Count == 0 || appliedMigrations.Count > 0)
        {
            return;
        }

        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync();
        }

        if (!await ExistsAsync(connection, "AchievementCatalog")
            || !await ExistsAsync(connection, "TrainingSessions")
            || !await ExistsAsync(connection, "UserAchievements")
            || !await ExistsAsync(connection, "__EFMigrationsHistory"))
        {
            return;
        }

        var firstMigration = allMigrations[0];
        var efProductVersion =
            typeof(DbContext).Assembly
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
                .InformationalVersion?
                .Split('+')[0]
            ?? "8.0.8";

        await using var insert = connection.CreateCommand();
        insert.CommandText = @"
INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
SELECT @migrationId, @productVersion
WHERE NOT EXISTS (
    SELECT 1 FROM ""__EFMigrationsHistory"" WHERE ""MigrationId"" = @migrationId
);";

        var migrationParam = insert.CreateParameter();
        migrationParam.ParameterName = "@migrationId";
        migrationParam.Value = firstMigration;
        insert.Parameters.Add(migrationParam);

        var versionParam = insert.CreateParameter();
        versionParam.ParameterName = "@productVersion";
        versionParam.Value = efProductVersion;
        insert.Parameters.Add(versionParam);

        await insert.ExecuteNonQueryAsync();
    }

    private static async Task<bool> ExistsAsync(System.Data.Common.DbConnection connection, string tableName)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT to_regclass(@tableName) IS NOT NULL;";

        var parameter = command.CreateParameter();
        parameter.ParameterName = "@tableName";
        parameter.Value = $"public.\"{tableName}\"";
        command.Parameters.Add(parameter);

        var result = await command.ExecuteScalarAsync();
        return result is bool exists && exists;
    }
}

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY AchievementsService.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://0.0.0.0:8082
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ACHIEVEMENTS_DB_PATH=/app/Data/achievements.db
ENV DOTNET_EnableDiagnostics=0

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/Data \
    && chown -R app:app /app

COPY --from=build /app/publish .

EXPOSE 8082

USER app

ENTRYPOINT ["dotnet", "AchievementsService.dll"]

package com.fitbeat.eventprocessor.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fitbeat.eventprocessor.config.AppProperties;
import com.fitbeat.eventprocessor.domain.EmittedBusinessEvent;
import com.fitbeat.eventprocessor.domain.ProcessedEvent;
import com.fitbeat.eventprocessor.domain.SessionMetric;
import com.fitbeat.eventprocessor.domain.WeeklyUserStat;
import com.fitbeat.eventprocessor.messaging.InboundEventEnvelope;
import com.fitbeat.eventprocessor.messaging.payload.SessionFinishedPayload;
import com.fitbeat.eventprocessor.messaging.payload.SessionStartedPayload;
import com.fitbeat.eventprocessor.messaging.payload.TrackSkippedPayload;
import com.fitbeat.eventprocessor.repository.EmittedBusinessEventRepository;
import com.fitbeat.eventprocessor.repository.ProcessedEventRepository;
import com.fitbeat.eventprocessor.repository.SessionMetricRepository;
import com.fitbeat.eventprocessor.repository.WeeklyUserStatRepository;
import jakarta.transaction.Transactional;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class EventProcessingService {

    private final ObjectMapper objectMapper;
    private final ProcessedEventRepository processedEventRepository;
    private final SessionMetricRepository sessionMetricRepository;
    private final WeeklyUserStatRepository weeklyUserStatRepository;
    private final EmittedBusinessEventRepository emittedBusinessEventRepository;
    private final BusinessEventPublisher businessEventPublisher;
    private final AppProperties appProperties;

    public EventProcessingService(
            ObjectMapper objectMapper,
            ProcessedEventRepository processedEventRepository,
            SessionMetricRepository sessionMetricRepository,
            WeeklyUserStatRepository weeklyUserStatRepository,
            EmittedBusinessEventRepository emittedBusinessEventRepository,
            BusinessEventPublisher businessEventPublisher,
            AppProperties appProperties) {
        this.objectMapper = objectMapper;
        this.processedEventRepository = processedEventRepository;
        this.sessionMetricRepository = sessionMetricRepository;
        this.weeklyUserStatRepository = weeklyUserStatRepository;
        this.emittedBusinessEventRepository = emittedBusinessEventRepository;
        this.businessEventPublisher = businessEventPublisher;
        this.appProperties = appProperties;
    }

    @Transactional
    public void process(InboundEventEnvelope envelope) {
        if (envelope == null || !StringUtils.hasText(envelope.getEventId())) {
            return;
        }

        if (processedEventRepository.existsById(envelope.getEventId())) {
            return;
        }

        switch (envelope.getEventType()) {
            case "session.started" -> handleSessionStarted(envelope);
            case "track.skipped" -> handleTrackSkipped(envelope);
            case "session.finished" -> handleSessionFinished(envelope);
            default -> {
                // Evento no relevante para este componente, se marca como procesado para evitar reprocesos.
            }
        }

        processedEventRepository.save(new ProcessedEvent(envelope.getEventId(), OffsetDateTime.now(ZoneOffset.UTC)));
    }

    private void handleSessionStarted(InboundEventEnvelope envelope) {
        SessionStartedPayload payload = objectMapper.convertValue(envelope.getPayload(), SessionStartedPayload.class);
        if (payload == null || !StringUtils.hasText(payload.getSessionId())) {
            return;
        }

        SessionMetric metric =
                sessionMetricRepository.findById(payload.getSessionId()).orElseGet(() -> newMetric(payload.getSessionId()));
        metric.setUserId(payload.getUserId());
        metric.setActivityType(payload.getActivityType());
        metric.setMode(payload.getMode());
        metric.setStartedAt(payload.getStartedAt() != null ? payload.getStartedAt() : envelope.getOccurredAt());
        sessionMetricRepository.save(metric);
    }

    private void handleTrackSkipped(InboundEventEnvelope envelope) {
        TrackSkippedPayload payload = objectMapper.convertValue(envelope.getPayload(), TrackSkippedPayload.class);
        if (payload == null || !StringUtils.hasText(payload.getSessionId())) {
            return;
        }

        SessionMetric metric = sessionMetricRepository
                .findById(payload.getSessionId())
                .orElseGet(() -> newMetric(payload.getSessionId()));

        int current = metric.getSkipCount() != null ? metric.getSkipCount() : 0;
        metric.setSkipCount(current + 1);
        sessionMetricRepository.save(metric);
    }

    private void handleSessionFinished(InboundEventEnvelope envelope) {
        SessionFinishedPayload payload = objectMapper.convertValue(envelope.getPayload(), SessionFinishedPayload.class);
        if (payload == null || !StringUtils.hasText(payload.getSessionId())) {
            return;
        }

        SessionMetric metric = sessionMetricRepository
                .findById(payload.getSessionId())
                .orElseGet(() -> newMetric(payload.getSessionId()));

        if (metric.getFinishedAt() != null) {
            return;
        }

        if (StringUtils.hasText(payload.getUserId())) {
            metric.setUserId(payload.getUserId());
        }
        if (StringUtils.hasText(payload.getActivityType())) {
            metric.setActivityType(payload.getActivityType());
        }
        if (StringUtils.hasText(payload.getMode())) {
            metric.setMode(payload.getMode());
        }

        OffsetDateTime finishedAt = payload.getFinishedAt() != null ? payload.getFinishedAt() : envelope.getOccurredAt();
        if (finishedAt == null) {
            finishedAt = OffsetDateTime.now(ZoneOffset.UTC);
        }
        metric.setFinishedAt(finishedAt);

        if (metric.getStartedAt() == null) {
            metric.setStartedAt(finishedAt);
        }

        int durationSec = Math.max(0, (int) (finishedAt.toEpochSecond() - metric.getStartedAt().toEpochSecond()));
        metric.setRealDurationSec(durationSec);

        LocalDate weekStart = toWeekStart(finishedAt.toLocalDate());
        metric.setWeekStart(weekStart);
        sessionMetricRepository.saveAndFlush(metric);

        if (StringUtils.hasText(metric.getUserId())) {
            updateWeeklyStats(metric, weekStart, durationSec);
            checkFirst10Sessions(metric.getUserId());
        }
    }

    private void updateWeeklyStats(SessionMetric metric, LocalDate weekStart, int durationSec) {
        WeeklyUserStat stat = weeklyUserStatRepository
                .findByUserIdAndWeekStart(metric.getUserId(), weekStart)
                .orElseGet(() -> {
                    WeeklyUserStat created = new WeeklyUserStat();
                    created.setUserId(metric.getUserId());
                    created.setWeekStart(weekStart);
                    return created;
                });

        int sessions = stat.getSessionsFinished() != null ? stat.getSessionsFinished() : 0;
        int minutes = stat.getMinutesTotal() != null ? stat.getMinutesTotal() : 0;

        stat.setSessionsFinished(sessions + 1);
        stat.setMinutesTotal(minutes + Math.max(0, durationSec / 60));

        int weeklyGoal = Math.max(1, appProperties.getGoals().getWeeklySessions());
        int adherencePct = Math.min(100, (stat.getSessionsFinished() * 100) / weeklyGoal);
        stat.setAdherencePct(adherencePct);

        weeklyUserStatRepository.save(stat);

        if (stat.getSessionsFinished() >= weeklyGoal) {
            String eventKey = "weekly_goal_reached:" + metric.getUserId() + ":" + weekStart;
            maybeEmit(
                    eventKey,
                    "weekly_goal_reached",
                    Map.of(
                            "user_id", metric.getUserId(),
                            "week_start", weekStart.toString(),
                            "sessions_finished", stat.getSessionsFinished(),
                            "goal", weeklyGoal));
        }
    }

    private void checkFirst10Sessions(String userId) {
        long completed = sessionMetricRepository.countByUserIdAndFinishedAtIsNotNull(userId);
        if (completed < 10) {
            return;
        }

        String eventKey = "first_10_sessions:" + userId;
        maybeEmit(
                eventKey,
                "first_10_sessions",
                Map.of(
                        "user_id", userId,
                        "sessions_finished", completed));
    }

    private void maybeEmit(String eventKey, String eventType, Map<String, Object> payload) {
        if (emittedBusinessEventRepository.existsById(eventKey)) {
            return;
        }
        businessEventPublisher.publish(eventType, payload);
        emittedBusinessEventRepository.save(
                new EmittedBusinessEvent(eventKey, eventType, OffsetDateTime.now(ZoneOffset.UTC)));
    }

    private SessionMetric newMetric(String sessionId) {
        SessionMetric metric = new SessionMetric();
        metric.setSessionId(sessionId);
        metric.setSkipCount(0);
        return metric;
    }

    private LocalDate toWeekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }
}

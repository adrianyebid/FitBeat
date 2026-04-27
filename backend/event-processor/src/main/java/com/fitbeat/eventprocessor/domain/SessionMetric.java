package com.fitbeat.eventprocessor.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "session_metrics")
public class SessionMetric {

    @Id
    @Column(name = "session_id", nullable = false, updatable = false, length = 80)
    private String sessionId;

    @Column(name = "user_id", length = 80)
    private String userId;

    @Column(name = "activity_type", length = 50)
    private String activityType;

    @Column(name = "mode", length = 30)
    private String mode;

    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "finished_at")
    private OffsetDateTime finishedAt;

    @Column(name = "real_duration_sec")
    private Integer realDurationSec;

    @Column(name = "skip_count", nullable = false)
    private Integer skipCount = 0;

    @Column(name = "week_start")
    private LocalDate weekStart;

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getActivityType() {
        return activityType;
    }

    public void setActivityType(String activityType) {
        this.activityType = activityType;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public OffsetDateTime getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(OffsetDateTime startedAt) {
        this.startedAt = startedAt;
    }

    public OffsetDateTime getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(OffsetDateTime finishedAt) {
        this.finishedAt = finishedAt;
    }

    public Integer getRealDurationSec() {
        return realDurationSec;
    }

    public void setRealDurationSec(Integer realDurationSec) {
        this.realDurationSec = realDurationSec;
    }

    public Integer getSkipCount() {
        return skipCount;
    }

    public void setSkipCount(Integer skipCount) {
        this.skipCount = skipCount;
    }

    public LocalDate getWeekStart() {
        return weekStart;
    }

    public void setWeekStart(LocalDate weekStart) {
        this.weekStart = weekStart;
    }
}

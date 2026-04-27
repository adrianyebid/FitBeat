package com.fitbeat.eventprocessor.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "weekly_user_stats")
public class WeeklyUserStat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, length = 80)
    private String userId;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(name = "sessions_finished", nullable = false)
    private Integer sessionsFinished = 0;

    @Column(name = "minutes_total", nullable = false)
    private Integer minutesTotal = 0;

    @Column(name = "adherence_pct", nullable = false)
    private Integer adherencePct = 0;

    public Long getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public LocalDate getWeekStart() {
        return weekStart;
    }

    public void setWeekStart(LocalDate weekStart) {
        this.weekStart = weekStart;
    }

    public Integer getSessionsFinished() {
        return sessionsFinished;
    }

    public void setSessionsFinished(Integer sessionsFinished) {
        this.sessionsFinished = sessionsFinished;
    }

    public Integer getMinutesTotal() {
        return minutesTotal;
    }

    public void setMinutesTotal(Integer minutesTotal) {
        this.minutesTotal = minutesTotal;
    }

    public Integer getAdherencePct() {
        return adherencePct;
    }

    public void setAdherencePct(Integer adherencePct) {
        this.adherencePct = adherencePct;
    }
}

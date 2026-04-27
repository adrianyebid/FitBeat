package com.fitbeat.eventprocessor.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "emitted_business_events")
public class EmittedBusinessEvent {

    @Id
    @Column(name = "event_key", nullable = false, updatable = false, length = 150)
    private String eventKey;

    @Column(name = "event_type", nullable = false, length = 80)
    private String eventType;

    @Column(name = "emitted_at", nullable = false)
    private OffsetDateTime emittedAt;

    public EmittedBusinessEvent() {}

    public EmittedBusinessEvent(String eventKey, String eventType, OffsetDateTime emittedAt) {
        this.eventKey = eventKey;
        this.eventType = eventType;
        this.emittedAt = emittedAt;
    }

    public String getEventKey() {
        return eventKey;
    }

    public String getEventType() {
        return eventType;
    }

    public OffsetDateTime getEmittedAt() {
        return emittedAt;
    }
}

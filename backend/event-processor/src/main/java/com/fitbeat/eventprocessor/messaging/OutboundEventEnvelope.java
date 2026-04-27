package com.fitbeat.eventprocessor.messaging;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

public class OutboundEventEnvelope {

    @JsonProperty("event_id")
    private String eventId;

    @JsonProperty("event_type")
    private String eventType;

    @JsonProperty("occurred_at")
    private OffsetDateTime occurredAt;

    private String source;
    private int version;
    private Object payload;

    public static OutboundEventEnvelope from(String eventType, String source, Object payload) {
        OutboundEventEnvelope envelope = new OutboundEventEnvelope();
        envelope.eventId = UUID.randomUUID().toString();
        envelope.eventType = eventType;
        envelope.occurredAt = OffsetDateTime.now(ZoneOffset.UTC);
        envelope.source = source;
        envelope.version = 1;
        envelope.payload = payload;
        return envelope;
    }

    public String getEventId() {
        return eventId;
    }

    public String getEventType() {
        return eventType;
    }

    public OffsetDateTime getOccurredAt() {
        return occurredAt;
    }

    public String getSource() {
        return source;
    }

    public int getVersion() {
        return version;
    }

    public Object getPayload() {
        return payload;
    }
}

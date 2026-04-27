package com.fitbeat.eventprocessor.messaging.payload;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

public class TrackSkippedPayload {

    @JsonProperty("session_id")
    private String sessionId;

    @JsonProperty("skipped_at")
    private OffsetDateTime skippedAt;

    public String getSessionId() {
        return sessionId;
    }

    public OffsetDateTime getSkippedAt() {
        return skippedAt;
    }
}

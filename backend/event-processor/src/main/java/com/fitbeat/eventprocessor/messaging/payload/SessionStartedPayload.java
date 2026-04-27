package com.fitbeat.eventprocessor.messaging.payload;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

public class SessionStartedPayload {

    @JsonProperty("session_id")
    private String sessionId;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("activity_type")
    private String activityType;

    private String mode;

    @JsonProperty("started_at")
    private OffsetDateTime startedAt;

    public String getSessionId() {
        return sessionId;
    }

    public String getUserId() {
        return userId;
    }

    public String getActivityType() {
        return activityType;
    }

    public String getMode() {
        return mode;
    }

    public OffsetDateTime getStartedAt() {
        return startedAt;
    }
}

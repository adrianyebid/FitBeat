package com.fitbeat.eventprocessor.messaging.payload;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

public class SessionFinishedPayload {

    @JsonProperty("session_id")
    private String sessionId;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("activity_type")
    private String activityType;

    private String mode;

    @JsonProperty("finished_at")
    private OffsetDateTime finishedAt;

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

    public OffsetDateTime getFinishedAt() {
        return finishedAt;
    }
}

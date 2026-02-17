package org.example.gymtrack.dto;

public record AuthResponse(
        String message,
        UserResponse user
) {
}

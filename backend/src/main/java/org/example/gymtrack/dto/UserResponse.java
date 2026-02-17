package org.example.gymtrack.dto;

public record UserResponse(
        Long id,
        String firstName,
        String lastName,
        String email
) {
}

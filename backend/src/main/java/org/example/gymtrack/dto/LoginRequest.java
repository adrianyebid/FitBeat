package org.example.gymtrack.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank @Email @Size(max = 120) String email,
        @NotBlank @Size(min = 6, max = 72) String password
) {
}

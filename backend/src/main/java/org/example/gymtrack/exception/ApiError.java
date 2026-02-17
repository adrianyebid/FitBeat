package org.example.gymtrack.exception;

import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.List;

public record ApiError(
        LocalDateTime timestamp,
        HttpStatus status,
        String message,
        List<String> details
) {
}

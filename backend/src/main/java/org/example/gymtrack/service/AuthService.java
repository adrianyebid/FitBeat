package org.example.gymtrack.service;

import org.example.gymtrack.dto.AuthResponse;
import org.example.gymtrack.dto.LoginRequest;
import org.example.gymtrack.dto.RegisterRequest;
import org.example.gymtrack.dto.UserResponse;
import org.example.gymtrack.entity.User;
import org.example.gymtrack.exception.BadRequestException;
import org.example.gymtrack.exception.UnauthorizedException;
import org.example.gymtrack.repository.UserRepository;
import org.mindrot.jbcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
public class AuthService {

    private final UserRepository userRepository;

    public AuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());

        if (userRepository.existsByEmail(email)) {
            throw new BadRequestException("Email already registered");
        }

        User user = new User();
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setEmail(email);
        user.setPasswordHash(BCrypt.hashpw(request.password(), BCrypt.gensalt()));

        User savedUser = userRepository.save(user);
        return new AuthResponse("User registered successfully", toUserResponse(savedUser));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));

        boolean isPasswordCorrect = BCrypt.checkpw(request.password(), user.getPasswordHash());
        if (!isPasswordCorrect) {
            throw new UnauthorizedException("Invalid credentials");
        }

        return new AuthResponse("Login successful", toUserResponse(user));
    }

    private UserResponse toUserResponse(User user) {
        return new UserResponse(user.getId(), user.getFirstName(), user.getLastName(), user.getEmail());
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}

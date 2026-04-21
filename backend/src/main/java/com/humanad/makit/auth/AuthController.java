package com.humanad.makit.auth;

import com.humanad.makit.auth.dto.*;
import com.humanad.makit.common.AuthenticationException;
import io.jsonwebtoken.Claims;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Date;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "auth")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto register(@Valid @RequestBody RegisterRequest req) {
        return authService.register(req);
    }

    @GetMapping("/me")
    public UserDto me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) {
            throw new AuthenticationException("Not authenticated");
        }
        UUID userId = UUID.fromString(auth.getName());
        return authService.me(userId);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getDetails() instanceof Claims claims) {
            String jti = claims.getId();
            Date exp = claims.getExpiration();
            if (jti != null && exp != null) {
                long remainingMs = exp.getTime() - System.currentTimeMillis();
                authService.logout(jti, Duration.ofMillis(Math.max(0, remainingMs)));
            }
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/refresh")
    public LoginResponse refresh(@Valid @RequestBody RefreshRequest req) {
        return authService.refresh(req);
    }
}

package com.humanad.makit.audit;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Audit log controller — exposes activity history endpoints.
 * Requires authentication (protected by SecurityConfig /api/** filter).
 */
@Slf4j
@RestController
@RequestMapping("/api/audit-logs")
@RequiredArgsConstructor
@Tag(name = "audit-logs")
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;

    /**
     * GET /api/audit-logs/me
     *
     * Returns paginated activity history for the authenticated user.
     * Sorted by creation time descending (most recent first).
     *
     * @param page zero-indexed page number (default 0)
     * @param size page size, clamped to 1-100 (default 20)
     * @return Page of AuditLogDto entries
     */
    @GetMapping("/me")
    @Operation(summary = "Get activity history for authenticated user")
    public ResponseEntity<Page<AuditLogDto>> myActivity(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        UUID userId = currentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        // Clamp page and size to safe ranges.
        page = Math.max(0, page);
        size = Math.min(100, Math.max(1, size));
        Pageable pageable = PageRequest.of(page, size);

        try {
            Page<AuditLog> entities = auditLogRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
            Page<AuditLogDto> dtos = entities.map(AuditLogDto::from);
            return ResponseEntity.ok(dtos);
        } catch (Exception e) {
            log.error("Error retrieving audit logs for user {}", userId, e);
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Extract the authenticated user's ID from the Spring Security context.
     */
    private UUID currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        try {
            return UUID.fromString(auth.getName());
        } catch (Exception ex) {
            log.warn("Failed to extract user ID from authentication", ex);
            return null;
        }
    }
}

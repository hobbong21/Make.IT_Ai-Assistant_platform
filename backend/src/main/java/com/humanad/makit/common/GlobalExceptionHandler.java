package com.humanad.makit.common;

import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String details = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Request validation failed", details, Map.of());
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiErrorResponse> handleAuth(AuthenticationException ex) {
        return build(HttpStatus.UNAUTHORIZED, ex.getErrorCode(), ex.getMessage(), null, Map.of());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return build(HttpStatus.FORBIDDEN, "AUTH_FORBIDDEN", "Access denied", ex.getMessage(), Map.of());
    }

    @ExceptionHandler(MarKITException.class)
    public ResponseEntity<ApiErrorResponse> handleBusiness(MarKITException ex) {
        return build(ex.getStatus(), ex.getErrorCode(), ex.getMessage(), null, Map.of());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnknown(Exception ex) {
        log.error("Unhandled exception", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "An unexpected error occurred", null, Map.of());
    }

    private ResponseEntity<ApiErrorResponse> build(HttpStatus status, String code, String message, String details, Map<String, Object> meta) {
        String rid = MDC.get(RequestIdFilter.MDC_KEY);
        if (rid == null) rid = UUID.randomUUID().toString();
        return ResponseEntity.status(status).body(new ApiErrorResponse(
                code, message, details, OffsetDateTime.now(), rid, meta
        ));
    }
}

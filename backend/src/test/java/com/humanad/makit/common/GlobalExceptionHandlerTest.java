package com.humanad.makit.common;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handleAuthReturns401() {
        ResponseEntity<ApiErrorResponse> res = handler.handleAuth(new AuthenticationException("bad"));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(res.getBody().errorCode()).isEqualTo("AUTH_INVALID_CREDENTIALS");
    }

    @Test
    void handleBusinessReturnsMappedStatus() {
        ResponseEntity<ApiErrorResponse> res = handler.handleBusiness(new ResourceNotFoundException("X", 1));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(res.getBody().errorCode()).isEqualTo("RESOURCE_NOT_FOUND");
    }

    @Test
    void handleUnknownReturns500() {
        ResponseEntity<ApiErrorResponse> res = handler.handleUnknown(new RuntimeException("boom"));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(res.getBody().errorCode()).isEqualTo("INTERNAL_ERROR");
    }
}

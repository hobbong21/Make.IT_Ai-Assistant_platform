package com.humanad.makit.common;

import org.springframework.http.HttpStatus;

public class AuthenticationException extends MarKITException {
    public AuthenticationException(String errorCode, String message) {
        super(errorCode, HttpStatus.UNAUTHORIZED, message);
    }
    public AuthenticationException(String message) {
        super("AUTH_INVALID_CREDENTIALS", HttpStatus.UNAUTHORIZED, message);
    }
}

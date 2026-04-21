package com.humanad.makit.common;

import org.springframework.http.HttpStatus;

public class ValidationException extends MarKITException {
    public ValidationException(String message) {
        super("VALIDATION_FAILED", HttpStatus.BAD_REQUEST, message);
    }
    public ValidationException(String errorCode, String message) {
        super(errorCode, HttpStatus.BAD_REQUEST, message);
    }
}

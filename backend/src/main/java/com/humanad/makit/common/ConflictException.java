package com.humanad.makit.common;

import org.springframework.http.HttpStatus;

public class ConflictException extends MarKITException {
    public ConflictException(String message) {
        super("RESOURCE_CONFLICT", HttpStatus.CONFLICT, message);
    }
    public ConflictException(String errorCode, String message) {
        super(errorCode, HttpStatus.CONFLICT, message);
    }
}

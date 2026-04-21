package com.humanad.makit.common;

import org.springframework.http.HttpStatus;

public abstract class MarKITException extends RuntimeException {

    private final String errorCode;
    private final HttpStatus status;

    protected MarKITException(String errorCode, HttpStatus status, String message) {
        super(message);
        this.errorCode = errorCode;
        this.status = status;
    }

    protected MarKITException(String errorCode, HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.status = status;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public HttpStatus getStatus() {
        return status;
    }
}

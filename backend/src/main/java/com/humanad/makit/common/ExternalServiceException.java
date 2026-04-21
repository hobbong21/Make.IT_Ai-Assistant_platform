package com.humanad.makit.common;

import org.springframework.http.HttpStatus;

public class ExternalServiceException extends MarKITException {
    public ExternalServiceException(String errorCode, String message) {
        super(errorCode, HttpStatus.BAD_GATEWAY, message);
    }
    public ExternalServiceException(String errorCode, String message, Throwable cause) {
        super(errorCode, HttpStatus.BAD_GATEWAY, message, cause);
    }
}

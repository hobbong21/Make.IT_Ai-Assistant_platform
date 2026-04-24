package com.humanad.makit.common;

import org.springframework.http.HttpStatus;

public class ResourceNotFoundException extends MarKITException {
    public ResourceNotFoundException(String resource, Object id) {
        super("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND, resource + " with id=" + id + " not found");
    }
    public ResourceNotFoundException(String message) {
        super("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND, message);
    }
}

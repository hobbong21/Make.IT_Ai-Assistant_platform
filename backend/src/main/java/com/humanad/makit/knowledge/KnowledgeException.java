package com.humanad.makit.knowledge;

import com.humanad.makit.common.MarKITException;
import org.springframework.http.HttpStatus;

public class KnowledgeException extends MarKITException {

    public KnowledgeException(String code, HttpStatus status, String message) {
        super(code, status, message);
    }

    public static KnowledgeException notFound(String what) {
        return new KnowledgeException("KNOWLEDGE_NOT_FOUND", HttpStatus.NOT_FOUND, what + " not found");
    }

    public static KnowledgeException forbidden(String what) {
        return new KnowledgeException("KNOWLEDGE_FORBIDDEN", HttpStatus.FORBIDDEN, what);
    }

    public static KnowledgeException badRequest(String message) {
        return new KnowledgeException("KNOWLEDGE_BAD_REQUEST", HttpStatus.BAD_REQUEST, message);
    }
}

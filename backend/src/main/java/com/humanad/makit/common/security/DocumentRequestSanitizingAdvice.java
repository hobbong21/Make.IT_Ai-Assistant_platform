package com.humanad.makit.common.security;

import com.humanad.makit.officehub.DocumentWriteRequest;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.RequestBodyAdvice;

import java.lang.reflect.Type;

/**
 * Replaces every {@link DocumentWriteRequest} request body with a sanitized
 * copy after JSON deserialization, so any controller accepting the DTO sees
 * only safe input. Belt-and-braces with explicit service-layer sanitization.
 */
@ControllerAdvice
public class DocumentRequestSanitizingAdvice implements RequestBodyAdvice {

    private final DocumentSanitizer sanitizer;

    public DocumentRequestSanitizingAdvice(DocumentSanitizer sanitizer) {
        this.sanitizer = sanitizer;
    }

    @Override
    public boolean supports(MethodParameter methodParameter,
                            Type targetType,
                            Class<? extends HttpMessageConverter<?>> converterType) {
        return DocumentWriteRequest.class.equals(targetType);
    }

    @Override
    public HttpInputMessage beforeBodyRead(HttpInputMessage inputMessage,
                                           MethodParameter parameter,
                                           Type targetType,
                                           Class<? extends HttpMessageConverter<?>> converterType) {
        return inputMessage;
    }

    @Override
    public Object afterBodyRead(Object body,
                                HttpInputMessage inputMessage,
                                MethodParameter parameter,
                                Type targetType,
                                Class<? extends HttpMessageConverter<?>> converterType) {
        if (body instanceof DocumentWriteRequest req) {
            return sanitizer.sanitize(req);
        }
        return body;
    }

    @Override
    public Object handleEmptyBody(Object body,
                                  HttpInputMessage inputMessage,
                                  MethodParameter parameter,
                                  Type targetType,
                                  Class<? extends HttpMessageConverter<?>> converterType) {
        return body;
    }
}

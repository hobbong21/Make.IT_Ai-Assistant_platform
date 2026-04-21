package com.humanad.makit.common;

import org.springframework.data.domain.Page;

import java.util.List;

public record PageResponse<T>(
        int page,
        int size,
        long totalElements,
        int totalPages,
        List<T> content
) {
    public static <T> PageResponse<T> from(Page<T> p) {
        return new PageResponse<>(
                p.getNumber(),
                p.getSize(),
                p.getTotalElements(),
                p.getTotalPages(),
                p.getContent()
        );
    }
}

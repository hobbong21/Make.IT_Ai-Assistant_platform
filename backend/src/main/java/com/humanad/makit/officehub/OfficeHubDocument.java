package com.humanad.makit.officehub;

import java.time.Instant;
import java.util.List;

/**
 * In-memory representation of a sanitized AX Office Hub document. Phase 2 will
 * back this with a JPA entity; the shape is what controllers and the
 * sanitization layer agree on today.
 */
public record OfficeHubDocument(
        String id,
        String title,
        List<String> tags,
        String bodyMarkdown,
        Instant updatedAt
) {
}

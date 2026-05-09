package com.humanad.makit.officehub;

import java.util.List;

/**
 * Request payload for AX Office Hub document create/update endpoints.
 *
 * @param title         document title (plain text)
 * @param tags          tag labels (plain text)
 * @param bodyMarkdown  Markdown source; inline HTML is filtered by
 *                      {@link com.humanad.makit.common.security.DocumentSanitizer}
 */
public record DocumentWriteRequest(
        String title,
        List<String> tags,
        String bodyMarkdown
) {
}

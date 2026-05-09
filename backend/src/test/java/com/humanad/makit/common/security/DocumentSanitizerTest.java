package com.humanad.makit.common.security;

import com.humanad.makit.officehub.DocumentWriteRequest;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the server-side sanitization policy enforced by {@link DocumentSanitizer}
 * for AX Office Hub document fields. These tests are the executable contract for the
 * policy documented in {@code docs/DOCUMENT_SANITIZATION_POLICY.md} and must stay in
 * sync with the frontend DOMPurify profile used in
 * {@code frontend/js/pages/ax-office-hub.js}.
 */
class DocumentSanitizerTest {

    private final DocumentSanitizer sanitizer = new DocumentSanitizer();

    // ------------------------------------------------------------------ title / tags

    @Test
    void plainText_stripsAllHtmlTags() {
        String out = sanitizer.sanitizePlainText("Hello <b>World</b><script>alert(1)</script>");
        assertThat(out).isEqualTo("Hello World");
    }

    @Test
    void plainText_stripsScriptContent() {
        String out = sanitizer.sanitizePlainText("<script>alert('xss')</script>safe");
        assertThat(out).isEqualTo("safe");
    }

    @Test
    void plainText_nullReturnsEmpty() {
        assertThat(sanitizer.sanitizePlainText(null)).isEmpty();
    }

    @Test
    void plainText_doesNotDecodeEncodedTagSyntax() {
        // Regression for the original Task #16 review: a payload that arrives as
        // already-entity-encoded HTML must NOT be turned back into literal tag
        // syntax by the sanitizer's post-processing. The sanitizer parses the
        // entities as text characters; we must keep them encoded so downstream
        // consumers cannot accidentally render them as HTML.
        String out = sanitizer.sanitizePlainText("&lt;script&gt;alert(1)&lt;/script&gt;");
        assertThat(out).doesNotContain("<").doesNotContain(">");
        assertThat(out).doesNotContain("<script").doesNotContain("</script");
    }

    @Test
    void plainText_doesNotDecodeNumericTagEntity() {
        // &#60; / &#62; are numeric entity forms of '<' / '>'; the sanitizer
        // canonicalizes them to &lt; / &gt; on output. Verify they are not
        // turned back into angle brackets.
        String out = sanitizer.sanitizePlainText("&#60;img src=x onerror=alert(1)&#62;");
        assertThat(out).doesNotContain("<").doesNotContain(">");
    }

    @Test
    void plainText_doesNotResurrectTagsViaDoubleEncodedAmpersand() {
        // Double-encoded payload: &amp;lt;script&amp;gt; — after our '&amp;'
        // decode it becomes &lt;script&gt;, which must remain encoded (no '<').
        String out = sanitizer.sanitizePlainText("&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;");
        assertThat(out).doesNotContain("<").doesNotContain(">");
    }

    @Test
    void plainText_stripsControlCharacters() {
        String out = sanitizer.sanitizePlainText("a\u0000b\u0007c");
        assertThat(out).isEqualTo("abc");
    }

    @Test
    void tags_dropsBlankEntriesAfterSanitize() {
        List<String> out = sanitizer.sanitizeTags(Arrays.asList("ok", "<script>x</script>", "  ", "<b></b>"));
        assertThat(out).containsExactly("ok");
    }

    @Test
    void tags_nullReturnsEmpty() {
        assertThat(sanitizer.sanitizeTags(null)).isEmpty();
    }

    // ------------------------------------------------------------------ markdown body

    @Test
    void body_stripsScriptTagAndKeepsMarkdown() {
        String md = "# Title\n\nHello <script>alert(1)</script> world\n\n- item 1\n- item 2";
        String out = sanitizer.sanitizeMarkdownBody(md);
        assertThat(out).doesNotContain("<script>").doesNotContain("alert(1)");
        assertThat(out).contains("# Title").contains("- item 1");
    }

    @Test
    void body_stripsIframeAndObject() {
        String md = "ok <iframe src='evil'></iframe> <object data='x'></object>";
        String out = sanitizer.sanitizeMarkdownBody(md);
        assertThat(out).doesNotContainIgnoringCase("<iframe").doesNotContainIgnoringCase("<object");
    }

    @Test
    void body_stripsOnEventHandlerAttributes() {
        String md = "<a href=\"https://example.com\" onclick=\"alert(1)\">click</a>";
        String out = sanitizer.sanitizeMarkdownBody(md);
        assertThat(out).doesNotContainIgnoringCase("onclick");
        assertThat(out).contains("https://example.com");
    }

    @Test
    void body_stripsJavascriptUrlInAnchor() {
        String md = "<a href=\"javascript:alert(1)\">x</a>";
        String out = sanitizer.sanitizeMarkdownBody(md);
        assertThat(out).doesNotContainIgnoringCase("javascript:");
    }

    @Test
    void body_stripsVbscriptUrlInAnchor() {
        String md = "<a href=\"vbscript:msgbox\">x</a>";
        String out = sanitizer.sanitizeMarkdownBody(md);
        assertThat(out).doesNotContainIgnoringCase("vbscript:");
    }

    @Test
    void body_stripsDataHtmlUrl() {
        String md = "<a href=\"data:text/html,<script>alert(1)</script>\">x</a>";
        String out = sanitizer.sanitizeMarkdownBody(md);
        assertThat(out).doesNotContain("data:text/html");
    }

    @Test
    void body_allowsSafeHttpsLink() {
        String md = "<a href=\"https://example.com/page?q=1\" title=\"go\">link</a>";
        String out = sanitizer.sanitizeMarkdownBody(md);
        // OWASP sanitizer entity-encodes '=' as &#61; in href values; check the
        // unambiguous prefix and rendered text instead of the literal raw URL.
        assertThat(out).contains("https://example.com/page");
        assertThat(out).containsIgnoringCase("rel=\"nofollow\"");
        assertThat(out).contains("link");
    }

    @Test
    void body_allowsSafeImageWithDataUriPng() {
        String md = "<img src=\"data:image/png;base64,iVBORw0KG\" alt=\"pic\">";
        String out = sanitizer.sanitizeMarkdownBody(md);
        assertThat(out).contains("data:image/png;base64,iVBORw0KG");
        assertThat(out).contains("alt=\"pic\"");
    }

    @Test
    void body_stripsImgWithJavascriptSrc() {
        String md = "<img src=\"javascript:alert(1)\" alt=\"x\">";
        String out = sanitizer.sanitizeMarkdownBody(md);
        assertThat(out).doesNotContainIgnoringCase("javascript:");
    }

    @Test
    void body_stripsInlineStyleAttribute() {
        String md = "<p style=\"background:url(javascript:alert(1))\">hi</p>";
        String out = sanitizer.sanitizeMarkdownBody(md);
        assertThat(out).doesNotContainIgnoringCase("style=");
        assertThat(out).doesNotContainIgnoringCase("javascript:");
        assertThat(out).contains("hi");
    }

    @Test
    void body_stripsFormAndInputTags() {
        String md = "<form action=\"/x\"><input name=\"a\"></form>safe";
        String out = sanitizer.sanitizeMarkdownBody(md);
        assertThat(out).doesNotContainIgnoringCase("<form").doesNotContainIgnoringCase("<input");
        assertThat(out).contains("safe");
    }

    @Test
    void body_preservesAllowedFormattingTags() {
        String md = "<p>Hello <strong>bold</strong> <em>italic</em> <code>x()</code></p>";
        String out = sanitizer.sanitizeMarkdownBody(md);
        assertThat(out).contains("<strong>").contains("<em>").contains("<code>");
    }

    @Test
    void body_nullReturnsEmpty() {
        assertThat(sanitizer.sanitizeMarkdownBody(null)).isEmpty();
    }

    // ------------------------------------------------------------------ rendered HTML

    @Test
    void renderedHtml_appliesSamePolicy() {
        String html = "<p>ok</p><script>alert(1)</script><a href=\"javascript:1\">x</a>";
        String out = sanitizer.sanitizeRenderedHtml(html);
        assertThat(out).contains("<p>ok</p>");
        assertThat(out).doesNotContain("<script>").doesNotContainIgnoringCase("javascript:");
    }

    @Test
    void renderedHtml_nullReturnsEmpty() {
        assertThat(sanitizer.sanitizeRenderedHtml(null)).isEmpty();
    }

    // ---------------------------------------------- markdown-native URL syntax

    @Test
    void body_rewritesJavascriptUrlInInlineMarkdownLink() {
        String out = sanitizer.sanitizeMarkdownBody("[click](javascript:alert(1))");
        assertThat(out).doesNotContainIgnoringCase("javascript:");
        assertThat(out).contains("about:blank");
        assertThat(out).contains("[click](");
    }

    @Test
    void body_rewritesJavascriptUrlInImageMarkdown() {
        String out = sanitizer.sanitizeMarkdownBody("![pic](javascript:alert(1))");
        assertThat(out).doesNotContainIgnoringCase("javascript:");
        assertThat(out).contains("about:blank");
        assertThat(out).contains("![pic](");
    }

    @Test
    void body_rewritesVbscriptInMarkdownLink() {
        String out = sanitizer.sanitizeMarkdownBody("[x](vbscript:msgbox)");
        assertThat(out).doesNotContainIgnoringCase("vbscript:");
        assertThat(out).contains("about:blank");
    }

    @Test
    void body_rewritesDataUrlInMarkdownLink() {
        String out = sanitizer.sanitizeMarkdownBody("[x](data:text/html,<script>alert(1)</script>)");
        assertThat(out).doesNotContainIgnoringCase("data:text/html");
        assertThat(out).contains("about:blank");
    }

    @Test
    void body_rewritesObfuscatedJavascriptScheme() {
        // Mixed case, leading whitespace, HTML entity for ':' — all should be caught.
        String out = sanitizer.sanitizeMarkdownBody("[a](  JaVaScRiPt&#58;alert(1))");
        assertThat(out).doesNotContainIgnoringCase("javascript");
        assertThat(out).contains("about:blank");
    }

    @Test
    void body_rewritesReferenceStyleDefinition() {
        String md = "See [docs][d1]\n\n[d1]: javascript:alert(1)\n";
        String out = sanitizer.sanitizeMarkdownBody(md);
        assertThat(out).doesNotContainIgnoringCase("javascript:");
        assertThat(out).contains("about:blank");
    }

    @Test
    void body_preservesSafeMarkdownLink() {
        String out = sanitizer.sanitizeMarkdownBody("[home](https://example.com/x)");
        assertThat(out).contains("https://example.com/x");
    }

    @Test
    void body_preservesProtocolRelativeMarkdownLink() {
        String out = sanitizer.sanitizeMarkdownBody("[x](//cdn.example.com/a)");
        assertThat(out).contains("//cdn.example.com/a");
    }

    // ----------------------------------------------------- DocumentWriteRequest

    @Test
    void writeRequest_sanitizesAllFields() {
        DocumentWriteRequest in = new DocumentWriteRequest(
                "<script>x</script>Title",
                List.of("<b>tag</b>", "<script>y</script>", "  "),
                "# H\n<a href=\"javascript:1\" onclick=\"x()\">k</a><script>z</script>\nbody"
        );
        DocumentWriteRequest out = sanitizer.sanitize(in);
        assertThat(out.title()).isEqualTo("Title");
        assertThat(out.tags()).containsExactly("tag");
        assertThat(out.bodyMarkdown()).doesNotContain("<script>")
                .doesNotContainIgnoringCase("javascript:")
                .doesNotContainIgnoringCase("onclick")
                .contains("# H")
                .contains("body");
    }

    @Test
    void writeRequest_nullReturnsNull() {
        assertThat(sanitizer.sanitize((DocumentWriteRequest) null)).isNull();
    }
}

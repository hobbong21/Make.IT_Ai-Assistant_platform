package com.humanad.makit.common.security;

import com.humanad.makit.officehub.DocumentWriteRequest;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Sanitizer for AX Office Hub document fields. See
 * {@code docs/DOCUMENT_SANITIZATION_POLICY.md} for the policy.
 *
 * <ul>
 *   <li>{@code title}, {@code tags}: HTML stripped, plain text.</li>
 *   <li>{@code body} (Markdown): inline HTML filtered against the allowlist, and
 *       Markdown link/image URLs with dangerous schemes ({@code javascript:},
 *       {@code vbscript:}, {@code data:}, {@code file:}) rewritten to
 *       {@code about:blank}.</li>
 *   <li>Server-rendered HTML output: filter via {@link #sanitizeRenderedHtml}.</li>
 * </ul>
 *
 * <p>Allowlist is kept in sync with the frontend DOMPurify {@code USE_PROFILES: { html: true }}
 * profile used in {@code frontend/js/pages/ax-office-hub.js}.
 */
@Component
public final class DocumentSanitizer {

    /**
     * Allowlist for {@code <a href>}: http(s), mailto, tel, ftp, plus protocol-relative,
     * absolute-path-relative, query/fragment-only relative URLs. Anchored (OWASP
     * attribute matchers use {@code Matcher.matches()}, full match required).
     * Mirrors DOMPurify's default ALLOWED_URI_REGEXP behaviour. Explicitly excludes
     * {@code javascript:}, {@code vbscript:}, {@code data:}, {@code file:}.
     */
    private static final Pattern SAFE_HREF = Pattern.compile(
            "^(?:(?:https?|ftp|mailto|tel)://?[^\\s]*"
                    + "|mailto:[^\\s]+"
                    + "|tel:[^\\s]+"
                    + "|//[^\\s]+"
                    + "|/[^\\s]*"
                    + "|\\?[^\\s]*"
                    + "|#[^\\s]*"
                    + "|[A-Za-z0-9_\\-./][^\\s:]*"
                    + ")$",
            Pattern.CASE_INSENSITIVE);

    /**
     * Allowlist for {@code <img src>}: HTTPS/HTTP, protocol-relative, relative, and
     * {@code data:image/{png,jpeg,gif,webp,svg+xml};base64,...}. Anchored. Mirrors
     * DOMPurify's default {@code img[src]} handling.
     */
    private static final Pattern SAFE_IMG_SRC = Pattern.compile(
            "^(?:https?://[^\\s]+"
                    + "|//[^\\s]+"
                    + "|/[^\\s]*"
                    + "|data:image/(?:png|jpeg|gif|webp|svg\\+xml);base64,[A-Za-z0-9+/=]+"
                    + "|[A-Za-z0-9_\\-./][^\\s:]*"
                    + ")$",
            Pattern.CASE_INSENSITIVE);

    /**
     * Document body policy: formatting + structural tags from the DOMPurify HTML
     * profile, with a strict URL allowlist and no event handlers, scripts, styles,
     * forms, or framing.
     */
    public static final PolicyFactory BODY_POLICY = new HtmlPolicyBuilder()
            // Block / structural
            .allowElements("p", "div", "span", "br", "hr",
                    "h1", "h2", "h3", "h4", "h5", "h6",
                    "blockquote", "pre", "code",
                    "ul", "ol", "li",
                    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
                    "section", "article", "header", "footer", "nav", "aside", "figure", "figcaption")
            // Inline formatting
            .allowElements("a", "img",
                    "b", "strong", "i", "em", "u", "s", "strike", "del", "ins", "sub", "sup",
                    "mark", "small", "abbr", "cite", "q", "kbd", "samp", "var", "time")
            // URL scheme handling: OWASP enforces TWO independent gates — the global
            // protocol allowlist AND the per-attribute matcher. Both must accept.
            // We allow the standard protocols + tel + data, then constrain each
            // attribute via its own regex (SAFE_HREF rejects data:, SAFE_IMG_SRC
            // rejects everything but http(s)/relative/data:image/*).
            .allowStandardUrlProtocols()
            .allowUrlProtocols("tel", "data")
            .allowAttributes("href").matching(SAFE_HREF).onElements("a")
            // Safe attributes
            .allowAttributes("title").globally()
            .allowAttributes("alt").onElements("img")
            .allowAttributes("src").matching(SAFE_IMG_SRC).onElements("img")
            .allowAttributes("width", "height").matching(Pattern.compile("[0-9]+%?")).onElements("img", "td", "th", "table")
            .allowAttributes("colspan", "rowspan").matching(Pattern.compile("[0-9]+")).onElements("td", "th")
            .allowAttributes("align").matching(Pattern.compile("(?i)left|right|center|justify")).onElements("p", "td", "th", "tr")
            // Force safe link behaviour (matches DOMPurify ADD_ATTR target/rel default usage)
            .requireRelNofollowOnLinks()
            .toFactory();

    /**
     * Plain-text policy: strips ALL HTML tags. Used for title/tag fields.
     */
    public static final PolicyFactory PLAIN_TEXT_POLICY = new HtmlPolicyBuilder().toFactory();

    /**
     * Strip control characters except tab/newline/carriage return; these can be used
     * to bypass naive filters or break log integrity.
     */
    private static final Pattern CONTROL_CHARS = Pattern.compile("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]");

    /**
     * Inline Markdown link / image syntax. Captures the {@code [label](} or
     * {@code ![alt](} prefix and the URL token (with optional {@code <>} wrap).
     * Group 1 = full prefix incl. opening paren; group 2 = optional {@code <};
     * group 3 = URL token (no whitespace, no closing {@code >} or {@code )}).
     */
    private static final Pattern MD_INLINE_URL = Pattern.compile(
            "(!?\\[[^\\]]*\\]\\()(\\s*<?)([^\\s>)]+)");

    /** Reference-style definitions: {@code [label]: url "optional title"}. */
    private static final Pattern MD_REF_DEF = Pattern.compile(
            "(?m)^(\\s*\\[[^\\]]+\\]:\\s*<?)([^\\s>]+)");

    /**
     * Dangerous URL schemes for Markdown link/image targets. Tolerates leading
     * whitespace, control chars, and HTML-entity-encoded colons that the marked.js
     * frontend renderer would still resolve as a scheme.
     */
    private static final Pattern UNSAFE_MD_SCHEME = Pattern.compile(
            "^[\\s\\u0000-\\u001f]*(?:javascript|vbscript|data|file|livescript|mocha)\\s*:",
            Pattern.CASE_INSENSITIVE);

    private static final String SAFE_REPLACEMENT_URL = "about:blank";

    /**
     * Sanitize a document title or tag value to plain text. Returns the empty string
     * when the input is {@code null}.
     *
     * <p><b>Critical safety invariant:</b> we deliberately do NOT decode {@code &lt;}
     * or {@code &gt;}. The OWASP sanitizer parses input as HTML, so any pre-encoded
     * payload such as {@code &lt;script&gt;alert(1)&lt;/script&gt;} arrives in the
     * parsed DOM as a single text node containing the literal characters
     * {@code <script>alert(1)</script>}; the sanitizer's serializer re-encodes that
     * text to {@code &lt;script&gt;alert(1)&lt;/script&gt;}. Decoding those back
     * here would let the original tag syntax flow downstream as raw HTML, defeating
     * the whole defense. We only decode entities that cannot reconstruct angle-bracket
     * tag syntax: {@code &amp;}, {@code &quot;}, {@code &#39;}, {@code &apos;}.
     * Consumers that render this value into an HTML context MUST treat it as text
     * (textContent) or escape it; consumers that render it into a non-HTML context
     * (logs, JSON, plain templates) should run their own entity decode if needed.
     */
    public String sanitizePlainText(String input) {
        if (input == null) return "";
        String stripped = PLAIN_TEXT_POLICY.sanitize(input);
        // Decode only safe entities; '&amp;' must be last so we don't double-decode.
        String decoded = stripped
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&apos;", "'")
                .replace("&amp;", "&");
        return CONTROL_CHARS.matcher(decoded).replaceAll("").trim();
    }

    /**
     * Sanitize a list of plain-text tags. {@code null} input yields an empty list;
     * blank-after-sanitize entries are dropped.
     */
    public List<String> sanitizeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) return List.of();
        return tags.stream()
                .map(this::sanitizePlainText)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    /**
     * Sanitize Markdown body source. Filters embedded HTML against
     * {@link #BODY_POLICY}, rewrites dangerous URL schemes in Markdown
     * link/image syntax (inline and reference-style) to {@value #SAFE_REPLACEMENT_URL},
     * and strips control characters. Markdown text is otherwise preserved.
     */
    public String sanitizeMarkdownBody(String markdown) {
        if (markdown == null) return "";
        String cleaned = BODY_POLICY.sanitize(markdown);
        cleaned = CONTROL_CHARS.matcher(cleaned).replaceAll("");
        cleaned = rewriteUnsafeMarkdownUrls(cleaned, MD_INLINE_URL, 3);
        cleaned = rewriteUnsafeMarkdownUrls(cleaned, MD_REF_DEF, 2);
        return cleaned;
    }

    private static String rewriteUnsafeMarkdownUrls(String input, Pattern pattern, int urlGroup) {
        Matcher m = pattern.matcher(input);
        StringBuilder out = new StringBuilder(input.length());
        while (m.find()) {
            String url = m.group(urlGroup);
            String safe = isUnsafeMarkdownUrl(url) ? SAFE_REPLACEMENT_URL : url;
            StringBuilder replacement = new StringBuilder();
            for (int g = 1; g < urlGroup; g++) {
                String part = m.group(g);
                if (part != null) replacement.append(part);
            }
            replacement.append(safe);
            m.appendReplacement(out, Matcher.quoteReplacement(replacement.toString()));
        }
        m.appendTail(out);
        return out.toString();
    }

    private static boolean isUnsafeMarkdownUrl(String url) {
        if (url == null || url.isEmpty()) return false;
        // Decode HTML numeric/named entity for ':' so that 'javascript&#58;...' is caught.
        String normalized = url
                .replace("&#58;", ":").replace("&#x3a;", ":").replace("&#x3A;", ":")
                .replace("&colon;", ":");
        return UNSAFE_MD_SCHEME.matcher(normalized).find();
    }

    /**
     * Sanitize an HTML fragment (e.g. server-side Markdown render output) before
     * sending it to clients or storing it as HTML.
     */
    public String sanitizeRenderedHtml(String html) {
        if (html == null) return "";
        return BODY_POLICY.sanitize(html);
    }

    /**
     * Sanitize a full {@link DocumentWriteRequest} payload (title, tags, body).
     * Returns a fresh record; the original is left untouched.
     */
    public DocumentWriteRequest sanitize(DocumentWriteRequest req) {
        if (req == null) return null;
        return new DocumentWriteRequest(
                sanitizePlainText(req.title()),
                sanitizeTags(req.tags()),
                sanitizeMarkdownBody(req.bodyMarkdown())
        );
    }
}

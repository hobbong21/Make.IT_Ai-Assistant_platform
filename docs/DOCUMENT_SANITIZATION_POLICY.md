# Document Sanitization Policy (AX Office Hub)

**Version:** 1 (2026-05-09, Task #16)
**Owner:** backend security
**Scope:** AX Office Hub document fields (`title`, `tags`, Markdown `body`) and any
server-side rendered HTML derived from them.

## Why double sanitization

The frontend already sanitizes Markdown render output via DOMPurify in
`frontend/js/pages/ax-office-hub.js` (`sanitize()` → `DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })`).
That alone is insufficient: a client that bypasses the SPA (direct API calls, alternate
clients, future render surfaces such as RAG citations, email digests, or PDF export) can
re-introduce stored XSS. Task #16 therefore mandates a second sanitization pass at the
server boundary so that **no untrusted input is persisted, returned, or echoed without
having been filtered by the canonical server policy**.

## Where it lives

- `backend/src/main/java/com/humanad/makit/common/security/DocumentSanitizer.java` —
  the Spring `@Component` holding the policy and the four entry points (`sanitizePlainText`,
  `sanitizeTags`, `sanitizeMarkdownBody`, `sanitizeRenderedHtml`, plus a DTO-aware
  `sanitize(DocumentWriteRequest)`).
- `backend/src/main/java/com/humanad/makit/officehub/DocumentWriteRequest.java` —
  canonical write payload (title / tags / bodyMarkdown). Phase 2 controllers MUST
  accept this exact type.
- `backend/src/main/java/com/humanad/makit/common/security/DocumentRequestSanitizingAdvice.java`
  — Spring `@ControllerAdvice` implementing `RequestBodyAdvice`. Intercepts every HTTP
  request body deserialized as `DocumentWriteRequest` and replaces it with a sanitized
  copy **before** the controller method runs. This is the server-boundary enforcement;
  controllers cannot skip it because they only ever receive the sanitized object.

Read paths that ever serialize raw HTML (server-side Markdown render, RAG snippets,
etc.) must call `sanitizeRenderedHtml(...)` explicitly before returning.

Library: OWASP Java HTML Sanitizer `20240325.1`.

## Field policy

| Field            | Method                          | Behaviour                                                                 |
| ---------------- | ------------------------------- | ------------------------------------------------------------------------- |
| `title`          | `sanitizePlainText`             | Strip all HTML; selectively decode safe entities (`&amp; &quot; &#39; &apos;`) but **never** decode `&lt;`/`&gt;`/`&#60;`/`&#62;`; drop control chars; trim. |
| `tags[]`         | `sanitizeTags`                  | `sanitizePlainText` per entry; drop blank-after-sanitize entries.         |
| `body` (Markdown)| `sanitizeMarkdownBody`          | Strip embedded HTML not on the allowlist; preserve Markdown syntax.       |
| Rendered HTML    | `sanitizeRenderedHtml`          | Apply the same allowlist to any server-rendered HTML output.              |

Markdown source is stored as Markdown (not pre-rendered HTML). Markdown allows raw inline
HTML — that is the actual XSS surface — so the OWASP sanitizer is run over the source.
Markdown markers (`#`, `*`, `[x](y)`, fenced code, etc.) are plain text to the sanitizer
and pass through unchanged.

## Allowlist (synchronized with DOMPurify `USE_PROFILES: { html: true }`)

**Allowed elements**

- Block / structural: `p div span br hr h1 h2 h3 h4 h5 h6 blockquote pre code ul ol li
  table thead tbody tfoot tr th td caption section article header footer nav aside
  figure figcaption`
- Inline: `a img b strong i em u s strike del ins sub sup mark small abbr cite q kbd
  samp var time`

**Allowed attributes**

- `a[href]` — must match the safe-URL regex (see below). All anchors get `rel="nofollow"`.
- `img[src]` — must match the safe-image-src regex (http(s) or `data:image/{png,jpeg,gif,webp,svg+xml};base64,...`).
- `img[alt]`, global `[title]`.
- `width|height` (digits, optional `%`) on `img td th table`.
- `colspan|rowspan` (digits) on `td th`.
- `align` (left|right|center|justify) on `p td th tr`.

**Disallowed (always stripped)**

- `<script> <iframe> <object> <embed> <link> <meta> <style> <form> <input> <button>
  <select> <textarea> <video> <audio> <source> <track> <svg> <math>` and any tag not
  on the allowlist.
- All `on*` event handler attributes.
- `style` attribute (blocks `expression()`, `url(javascript:...)`, etc.).

**URL scheme allowlist** (mirrors DOMPurify default `ALLOWED_URI_REGEXP`)

- `a[href]`: `http https mailto tel ftp`, plus relative / fragment / protocol-relative.
- `img[src]`: `http https`, plus `data:image/{png,jpeg,gif,webp,svg+xml};base64,...`,
  plus relative.
- Explicitly blocked: `javascript:`, `vbscript:`, `data:text/html`, `file:`.

## Test contract

`backend/src/test/java/com/humanad/makit/common/security/DocumentSanitizerTest.java`
exercises the policy with the canonical XSS vectors and is the executable spec:

- `<script>` body & content → stripped.
- `<iframe>`, `<object>`, `<form>`, `<input>` → stripped.
- `on*` handler attributes (`onclick`, …) → stripped.
- `href="javascript:..."`, `href="vbscript:..."`, `href="data:text/html,..."` → stripped.
- `<img src="javascript:...">` → stripped; `<img src="data:image/png;base64,...">` → kept.
- `style="..."` attribute → stripped.
- Allowed formatting tags (`strong em code` …) → preserved.
- Plain-text fields (`title`, `tags`) → all tags stripped, control chars removed, blank
  tags dropped.

## Sync rules

When changing the allowlist:

1. Update `DocumentSanitizer` (Java) **and** the DOMPurify call site in
   `frontend/js/pages/ax-office-hub.js`.
2. Update this document and bump the version header at the top.
3. Add/adjust unit tests in `DocumentSanitizerTest`.
4. Mention the policy version bump in the commit message.

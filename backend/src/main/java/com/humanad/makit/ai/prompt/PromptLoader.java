package com.humanad.makit.ai.prompt;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Loads markdown/plaintext prompt templates from the classpath under
 * {@code resources/prompts/} and substitutes {{placeholders}}.
 *
 * <h2>Versioning</h2>
 * Prompts may ship multiple versions alongside each other:
 * <pre>
 *   prompts/commerce/rag_system.md       (default — = latest)
 *   prompts/commerce/rag_system.v1.md
 *   prompts/commerce/rag_system.v2.md
 * </pre>
 * Callers resolve the "default" by passing the unversioned key
 * {@code commerce/rag_system.md}. Operators override via
 * {@link PromptVariantProperties#variants()} in {@code application.yml}:
 * <pre>
 *   aws.bedrock.rag.promptVariants:
 *     commerce/rag_system: v2
 * </pre>
 * The file may declare its own version via an HTML comment on line 1, e.g.
 * {@code <!-- version: 2.1 ... -->} — that string is captured in
 * {@link LoadedPrompt#version()} and surfaced as a Micrometer tag.
 *
 * <h2>Cache</h2>
 * Loaded prompts are cached in a ConcurrentHashMap; restart required
 * to pick up edits in prod. In dev, set the system property
 * {@code -Dmakit.prompts.reload=true} to bypass the cache.
 *
 * <h2>Placeholder syntax</h2>
 * {@code {{variable_name}}} — replaced with String.valueOf(value).
 * Missing placeholders render as an empty string and log a warning.
 */
@Component
public class PromptLoader {

    private static final Logger log = LoggerFactory.getLogger(PromptLoader.class);
    private static final String ROOT = "prompts/";
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_.-]+)\\s*}}");
    private static final Pattern VERSION_HEADER =
            Pattern.compile("<!--\\s*version\\s*:\\s*([A-Za-z0-9._-]+)", Pattern.CASE_INSENSITIVE);

    private final Map<String, String> cache = new ConcurrentHashMap<>();
    private final Map<String, String> versionCache = new ConcurrentHashMap<>();
    private final boolean reload = Boolean.getBoolean("makit.prompts.reload");

    private final PromptVariantProperties variantProps;

    public PromptLoader(PromptVariantProperties variantProps) {
        this.variantProps = variantProps != null ? variantProps : PromptVariantProperties.empty();
    }

    /**
     * Load prompt with placeholders substituted.
     *
     * @param key relative path under {@code resources/prompts/}, e.g. "data/nlp/sentiment.md".
     */
    public String load(String key, Map<String, Object> vars) {
        return loadVersioned(key, vars).text();
    }

    /**
     * Like {@link #load(String, Map)} but returns both the rendered text and the
     * detected version. Prefer this in code paths that record metrics.
     */
    public LoadedPrompt loadVersioned(String key, Map<String, Object> vars) {
        String resolvedKey = resolveKeyWithVariant(key);
        String template = loadRaw(resolvedKey);
        String version = versionCache.getOrDefault(resolvedKey, "unknown");
        String rendered = substitute(template, vars == null ? Map.of() : vars);
        return new LoadedPrompt(rendered, version, resolvedKey);
    }

    public String loadRaw(String key) {
        if (!reload) {
            String cached = cache.get(key);
            if (cached != null) return cached;
        }
        try (var in = new ClassPathResource(ROOT + key).getInputStream()) {
            String text = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            cache.put(key, text);
            versionCache.put(key, extractVersion(text));
            return text;
        } catch (IOException e) {
            throw new IllegalArgumentException("Prompt not found on classpath: " + ROOT + key, e);
        }
    }

    public String substitute(String template, Map<String, Object> vars) {
        Matcher m = PLACEHOLDER.matcher(template);
        StringBuilder sb = new StringBuilder(template.length());
        while (m.find()) {
            String name = m.group(1);
            Object v = vars.get(name);
            if (v == null) {
                log.warn("Prompt variable missing: {}", name);
                m.appendReplacement(sb, "");
            } else {
                m.appendReplacement(sb, Matcher.quoteReplacement(String.valueOf(v)));
            }
        }
        m.appendTail(sb);
        return sb.toString();
    }

    // ------------------------------------------------------------ versioning

    /**
     * Resolve a "logical" prompt key (with or without ".md") against the
     * configured variant map. If no override applies, return the key as-is.
     *
     * <p>Examples — with {@code promptVariants: {commerce/rag_system: v2}}:
     * <pre>
     *   commerce/rag_system.md        -&gt; commerce/rag_system.v2.md
     *   commerce/rag_system            -&gt; commerce/rag_system.v2.md
     *   data/nlp/sentiment.md         -&gt; data/nlp/sentiment.md   (no override)
     * </pre>
     */
    String resolveKeyWithVariant(String key) {
        String normalizedBase = stripMdSuffix(key);
        String variant = variantProps.variants().get(normalizedBase);
        if (variant == null || variant.isBlank() || "latest".equalsIgnoreCase(variant)) {
            // If caller passed bare key ensure .md suffix.
            return key.endsWith(".md") ? key : key + ".md";
        }
        return normalizedBase + "." + variant + ".md";
    }

    private static String stripMdSuffix(String key) {
        return key.endsWith(".md") ? key.substring(0, key.length() - 3) : key;
    }

    private static String extractVersion(String text) {
        if (text == null || text.isEmpty()) return "unknown";
        // Search only the first 256 chars for speed
        String head = text.length() > 256 ? text.substring(0, 256) : text;
        Matcher m = VERSION_HEADER.matcher(head);
        return m.find() ? m.group(1) : "unknown";
    }

    // ------------------------------------------------------------- records

    /** Loaded prompt plus discovered version metadata. */
    public record LoadedPrompt(String text, String version, String resolvedKey) {
        public LoadedPrompt {
            Objects.requireNonNull(text, "text");
            Objects.requireNonNull(version, "version");
            Objects.requireNonNull(resolvedKey, "resolvedKey");
        }
    }
}

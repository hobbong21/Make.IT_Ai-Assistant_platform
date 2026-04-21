package com.humanad.makit.ai.rag;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Simple recursive character splitter. Prefers splitting on paragraph breaks,
 * then newlines, then whitespace. Not language-aware; good enough for v1 FAQ/policy docs.
 *
 * For more robust Korean-aware splitting, swap this out for LangChain4j's RecursiveCharacterSplitter.
 */
@Component
public class TextChunker {

    public List<String> split(String text, int chunkSize, int overlap) {
        List<String> out = new ArrayList<>();
        if (text == null || text.isBlank()) return out;
        String t = text.trim();
        if (t.length() <= chunkSize) {
            out.add(t);
            return out;
        }

        int pos = 0;
        while (pos < t.length()) {
            int end = Math.min(pos + chunkSize, t.length());
            // Try to back up to a nicer break
            int breakPos = preferredBreak(t, pos, end);
            String piece = t.substring(pos, breakPos).trim();
            if (!piece.isEmpty()) out.add(piece);
            if (breakPos >= t.length()) break;
            pos = Math.max(breakPos - overlap, pos + 1);
        }
        return out;
    }

    private int preferredBreak(String t, int start, int end) {
        if (end >= t.length()) return t.length();
        int searchStart = Math.max(start + (end - start) / 2, start + 1);
        int idx = t.lastIndexOf("\n\n", end);
        if (idx >= searchStart) return idx + 2;
        idx = t.lastIndexOf('\n', end);
        if (idx >= searchStart) return idx + 1;
        idx = t.lastIndexOf('.', end);
        if (idx >= searchStart) return idx + 1;
        idx = t.lastIndexOf(' ', end);
        if (idx >= searchStart) return idx + 1;
        return end;
    }
}

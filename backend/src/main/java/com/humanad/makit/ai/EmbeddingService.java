package com.humanad.makit.ai;

import java.util.List;

/**
 * Embedding contract. Titan Embed v2 is the v1 implementation (1024 dims).
 * Any change of dimension forces a re-index — see ADR-001.
 */
public interface EmbeddingService {

    float[] embed(String text);

    List<float[]> embedBatch(List<String> texts);

    int dimension();

    String modelId();
}

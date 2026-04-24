package com.humanad.makit.ai.embedding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.humanad.makit.ai.EmbeddingService;
import com.humanad.makit.ai.bedrock.BedrockClient;
import com.humanad.makit.ai.bedrock.BedrockInvocation;
import com.humanad.makit.ai.bedrock.BedrockInvocationException;
import com.humanad.makit.ai.bedrock.BedrockProperties;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Titan Embed v2 — 1024 dimensions. Batch calls are issued sequentially because
 * the Bedrock embedding endpoint accepts one input per call. Outer callers should
 * parallelize via the aiExecutor if they need throughput.
 */
@Service
public class TitanEmbeddingService implements EmbeddingService {

    private static final int DIMENSION = 1024;

    private final BedrockClient bedrock;
    private final BedrockProperties props;
    private final ObjectMapper om = new ObjectMapper();

    public TitanEmbeddingService(BedrockClient bedrock, BedrockProperties props) {
        this.bedrock = bedrock;
        this.props = props;
    }

    @Override
    public float[] embed(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("text must not be blank");
        }
        BedrockInvocation inv = bedrock.invokeEmbedding(props.models().titanEmbed(), text);
        return parseVector(inv.rawResponseJson());
    }

    @Override
    public List<float[]> embedBatch(List<String> texts) {
        List<float[]> out = new ArrayList<>(texts.size());
        for (String t : texts) {
            out.add(embed(t));
        }
        return out;
    }

    @Override
    public int dimension() {
        return DIMENSION;
    }

    @Override
    public String modelId() {
        return props.models().titanEmbed();
    }

    private float[] parseVector(String rawJson) {
        try {
            JsonNode root = om.readTree(rawJson);
            JsonNode arr = root.path("embedding");
            if (!arr.isArray() || arr.isEmpty()) {
                throw new BedrockInvocationException("Titan embedding response missing 'embedding': " + rawJson);
            }
            float[] vec = new float[arr.size()];
            for (int i = 0; i < arr.size(); i++) {
                vec[i] = (float) arr.get(i).asDouble();
            }
            if (vec.length != DIMENSION) {
                throw new BedrockInvocationException(
                        "Titan embedding dim=" + vec.length + " != expected " + DIMENSION);
            }
            return vec;
        } catch (BedrockInvocationException e) {
            throw e;
        } catch (Exception e) {
            throw new BedrockInvocationException("Failed to parse embedding response", e);
        }
    }
}

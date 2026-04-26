package com.humanad.makit.admin.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class FeatureManifestDto {
    private String name;
    private String displayName;
    private String version;
    private String category;
    private String status;
    private List<String> owners;
    private String description;

    @JsonProperty("fileCount")
    private FileCountDto fileCount;

    @JsonProperty("endpointCount")
    private int endpointCount;

    @JsonProperty("lastTouchedRound")
    private String lastTouchedRound;

    @Data
    @Builder
    public static class FileCountDto {
        private int backend;
        private int frontend;
        private int tests;
        private int docs;
        private int migrations;
    }
}

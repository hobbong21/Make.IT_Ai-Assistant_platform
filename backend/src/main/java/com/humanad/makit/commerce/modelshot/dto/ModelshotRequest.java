package com.humanad.makit.commerce.modelshot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ModelshotRequest(
        @NotBlank String productImageUrl,
        @NotNull ModelAttributes modelAttributes,
        Background background,
        String customPrompt,
        Resolution resolution
) {
    public enum Background { STUDIO_WHITE, OUTDOOR, LIFESTYLE, CUSTOM }
    public enum Resolution {
        R512("512x512"), R1024("1024x1024"), R1024_1792("1024x1792");
        private final String label;
        Resolution(String l) { this.label = l; }
        public String label() { return label; }
    }
    public record ModelAttributes(String gender, String ageRange, String ethnicity, String pose) {}
}

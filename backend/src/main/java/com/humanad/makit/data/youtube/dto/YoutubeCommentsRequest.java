package com.humanad.makit.data.youtube.dto;

import jakarta.validation.constraints.NotBlank;

public record YoutubeCommentsRequest(
        @NotBlank String videoUrl,
        Integer maxComments,
        Boolean async
) {}

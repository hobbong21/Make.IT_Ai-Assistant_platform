package com.humanad.makit.data.youtube.dto;

import jakarta.validation.constraints.NotBlank;

public record YoutubeInfluenceRequest(
        @NotBlank String channelId,
        Integer windowDays
) {}

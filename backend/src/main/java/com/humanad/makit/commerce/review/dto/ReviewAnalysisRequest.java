package com.humanad.makit.commerce.review.dto;

import java.time.LocalDate;

public record ReviewAnalysisRequest(
        LocalDate since,
        Boolean includeImprovementPoints
) {}

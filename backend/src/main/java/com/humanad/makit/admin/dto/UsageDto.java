package com.humanad.makit.admin.dto;

public record UsageDto(
    String date,
    long requests,
    long jobs,
    long errors
) {}

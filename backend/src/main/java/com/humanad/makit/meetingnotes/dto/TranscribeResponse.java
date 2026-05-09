package com.humanad.makit.meetingnotes.dto;

/**
 * Response payload for {@code POST /api/meeting-notes/transcribe}.
 *
 * @param transcript    plain transcribed text (UTF-8); never null but may be empty
 * @param languageCode  BCP-47 language code that was used (echoes the request)
 * @param durationSec   audio duration in seconds (best-effort; -1 if unknown)
 * @param provider      backend provider tag, e.g. "aws-transcribe"
 */
public record TranscribeResponse(
        String transcript,
        String languageCode,
        long durationSec,
        String provider
) {
}

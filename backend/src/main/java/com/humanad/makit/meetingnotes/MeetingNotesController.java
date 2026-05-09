package com.humanad.makit.meetingnotes;

import com.humanad.makit.meetingnotes.dto.TranscribeResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.Set;

/**
 * Meeting-notes REST endpoints.
 *
 * <p>Currently exposes server-side transcription (AWS Transcribe). The
 * {@code /summarize} endpoint expected by the frontend lives elsewhere /
 * is tracked separately.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/meeting-notes")
@RequiredArgsConstructor
@Tag(name = "meeting-notes")
public class MeetingNotesController {

    private static final Set<String> SUPPORTED_LANGS = Set.of("ko-KR", "en-US", "ja-JP");
    private static final long MAX_AUDIO_BYTES = 50L * 1024 * 1024; // 50 MB hard cap

    private final TranscribeService transcribeService;

    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TranscribeResponse transcribe(
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "languageCode", required = false, defaultValue = "ko-KR") String languageCode
    ) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "audio file is required");
        }
        if (file.getSize() > MAX_AUDIO_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "audio exceeds 50 MB limit (" + file.getSize() + " bytes)");
        }
        String lang = SUPPORTED_LANGS.contains(languageCode) ? languageCode : "ko-KR";
        log.info("transcribe request: bytes={} contentType={} lang={}",
                file.getSize(), file.getContentType(), lang);
        return transcribeService.transcribe(file, lang);
    }
}

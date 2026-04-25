package com.humanad.makit.marketing;

import com.humanad.makit.audit.Auditable;
import com.humanad.makit.marketing.feed.FeedGenerationService;
import com.humanad.makit.marketing.feed.dto.InstagramFeedRequest;
import com.humanad.makit.marketing.image.BackgroundRemovalService;
import com.humanad.makit.marketing.image.dto.ImageResultResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/marketing")
@RequiredArgsConstructor
@Tag(name = "marketing")
public class MarketingIntelligenceController {

    private final FeedGenerationService feedGenerationService;
    private final BackgroundRemovalService backgroundRemovalService;

    @PostMapping("/feed/generate")
    @Auditable(resource = "feed-generate")
    public ResponseEntity<?> generateFeed(@Valid @RequestBody InstagramFeedRequest req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UUID userId = auth == null ? UUID.randomUUID() : UUID.fromString(auth.getName());
        return feedGenerationService.generate(req, userId);
    }

    @PostMapping(value = "/image/remove-bg", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Auditable(resource = "remove-bg")
    public ImageResultResponse removeBackground(
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "outputFormat", required = false, defaultValue = "png") String outputFormat
    ) {
        return backgroundRemovalService.removeBackground(file, outputFormat);
    }
}

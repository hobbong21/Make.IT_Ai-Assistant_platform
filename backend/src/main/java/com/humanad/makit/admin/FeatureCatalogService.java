package com.humanad.makit.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.humanad.makit.admin.dto.FeatureManifestDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class FeatureCatalogService {

    private final ObjectMapper objectMapper;

    @Value("${app.features.dir:#{null}}")
    private String configuredFeaturesDir;

    public List<FeatureManifestDto> listFeatures() {
        List<FeatureManifestDto> features = new ArrayList<>();
        Path featuresDir = getFeaturesDir();

        if (!Files.exists(featuresDir)) {
            log.warn("Features directory does not exist: {}", featuresDir);
            return features;
        }

        try {
            Files.list(featuresDir)
                .filter(Files::isDirectory)
                .filter(p -> !p.getFileName().toString().startsWith("_"))
                .forEach(featureDir -> {
                    try {
                        Path manifestPath = featureDir.resolve("manifest.json");
                        if (Files.exists(manifestPath)) {
                            FeatureManifestDto dto = parseManifest(manifestPath, featureDir);
                            if (dto != null) {
                                features.add(dto);
                            }
                        }
                    } catch (Exception e) {
                        log.warn("Failed to parse manifest for {}: {}", featureDir.getFileName(), e.getMessage());
                    }
                });
        } catch (IOException e) {
            log.error("Error listing features directory", e);
        }

        return features.stream()
            .sorted(Comparator.comparing(FeatureManifestDto::getName))
            .collect(Collectors.toList());
    }

    public Map<String, Object> getFeatureDetail(String name) {
        Path featuresDir = getFeaturesDir();
        Path featureDir = featuresDir.resolve(name);

        if (!Files.exists(featureDir)) {
            throw new IllegalArgumentException("Feature not found: " + name);
        }

        Map<String, Object> detail = new HashMap<>();

        try {
            Path manifestPath = featureDir.resolve("manifest.json");
            if (Files.exists(manifestPath)) {
                String manifestJson = Files.readString(manifestPath);
                Map<String, Object> manifest = objectMapper.readValue(manifestJson, Map.class);
                detail.put("manifest", manifest);
            }

            Path readmePath = featureDir.resolve("README.md");
            if (Files.exists(readmePath)) {
                String readme = Files.readString(readmePath);
                detail.put("readme", readme);
            }

            Path changelogPath = featureDir.resolve("changelog.md");
            if (Files.exists(changelogPath)) {
                String changelog = Files.readString(changelogPath);
                detail.put("changelog", changelog);
            }

            Path apiPath = featureDir.resolve("api.md");
            if (Files.exists(apiPath)) {
                String api = Files.readString(apiPath);
                detail.put("api", api);
            }

        } catch (IOException e) {
            log.error("Error reading feature detail: {}", name, e);
            throw new RuntimeException("Failed to read feature detail: " + name);
        }

        return detail;
    }

    private FeatureManifestDto parseManifest(Path manifestPath, Path featureDir) throws IOException {
        String json = Files.readString(manifestPath);
        Map<String, Object> data = objectMapper.readValue(json, Map.class);

        String name = (String) data.get("name");
        String displayName = (String) data.get("displayName");
        String version = (String) data.get("version");
        String category = (String) data.get("category");
        String status = (String) data.get("status");
        String description = (String) data.get("description");
        List<String> owners = (List<String>) data.getOrDefault("owners", new ArrayList<>());

        int endpointCount = 0;
        List<Map<String, Object>> endpoints = (List<Map<String, Object>>) data.get("endpoints");
        if (endpoints != null) {
            endpointCount = endpoints.size();
        }

        Map<String, List<String>> files = (Map<String, List<String>>) data.getOrDefault("files", new HashMap<>());
        FeatureManifestDto.FileCountDto fileCount = FeatureManifestDto.FileCountDto.builder()
            .backend(countFiles(files, "backend"))
            .frontend(countFiles(files, "frontend"))
            .tests(countFiles(files, "tests"))
            .docs(countFiles(files, "docs"))
            .migrations(countFiles(files, "migrations"))
            .build();

        List<Map<String, Object>> roundHistory = (List<Map<String, Object>>) data.getOrDefault("roundHistory", new ArrayList<>());
        String lastTouchedRound = roundHistory.isEmpty() ? "N/A" : (String) roundHistory.get(roundHistory.size() - 1).get("round");

        return FeatureManifestDto.builder()
            .name(name)
            .displayName(displayName)
            .version(version)
            .category(category)
            .status(status)
            .owners(owners)
            .description(description)
            .fileCount(fileCount)
            .endpointCount(endpointCount)
            .lastTouchedRound(lastTouchedRound)
            .build();
    }

    private int countFiles(Map<String, List<String>> files, String key) {
        List<String> list = files.get(key);
        return list != null ? list.size() : 0;
    }

    public void updateFeatureStatus(String featureName, String newStatus) {
        Path featuresDir = getFeaturesDir();
        Path featureDir = featuresDir.resolve(featureName);
        Path manifestPath = featureDir.resolve("manifest.json");

        if (!Files.exists(manifestPath)) {
            throw new IllegalArgumentException("Feature not found: " + featureName);
        }

        try {
            // Read current manifest
            String json = Files.readString(manifestPath);
            Map<String, Object> manifest = objectMapper.readValue(json, Map.class);
            String oldStatus = (String) manifest.getOrDefault("status", "unknown");

            // Update status
            manifest.put("status", newStatus);

            // Write to temp file first, then rename (atomic)
            Path tempPath = manifestPath.resolveSibling("manifest.json.tmp");
            String updatedJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(manifest);
            Files.writeString(tempPath, updatedJson);
            Files.move(tempPath, manifestPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);

            log.info("Feature {} status changed from {} to {}", featureName, oldStatus, newStatus);
        } catch (IOException ex) {
            log.error("Failed to update feature status for {}: {}", featureName, ex.getMessage(), ex);
            throw new RuntimeException("Failed to update feature status: " + ex.getMessage(), ex);
        }
    }

    private Path getFeaturesDir() {
        if (configuredFeaturesDir != null && !configuredFeaturesDir.isEmpty()) {
            return Paths.get(configuredFeaturesDir);
        }

        String userDir = System.getProperty("user.dir");
        return Paths.get(userDir, "features");
    }
}

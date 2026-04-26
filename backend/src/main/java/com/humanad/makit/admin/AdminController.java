package com.humanad.makit.admin;

import com.humanad.makit.admin.dto.AdminOverviewDto;
import com.humanad.makit.admin.dto.AdminUserDto;
import com.humanad.makit.admin.dto.NotificationBreakdownDto;
import com.humanad.makit.admin.dto.UsageDto;
import com.humanad.makit.audit.Auditable;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/stats/overview")
    @Auditable(resource = "admin-stats", action = "VIEW")
    public AdminOverviewDto getOverview() {
        return adminService.getOverview();
    }

    @GetMapping("/users")
    @Auditable(resource = "admin-users", action = "VIEW")
    public ResponseEntity<Page<AdminUserDto>> getUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (size > 100) size = 100;
        Page<AdminUserDto> result = adminService.getUsers(page, size);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/usage")
    @Auditable(resource = "admin-usage", action = "VIEW")
    public List<UsageDto> getUsage(
            @RequestParam(defaultValue = "30") int days) {
        if (days < 1 || days > 365) days = 30;
        return adminService.getUsage(days);
    }

    @GetMapping("/notifications/breakdown")
    @Auditable(resource = "admin-notifications", action = "VIEW")
    public NotificationBreakdownDto getNotificationBreakdown(
            @RequestParam(defaultValue = "7") int days) {
        if (days < 1 || days > 365) days = 7;
        return adminService.getNotificationBreakdown(days);
    }

    @GetMapping("/features")
    @Auditable(resource = "admin-features", action = "VIEW")
    public List<?> listFeatures() {
        return adminService.listFeatures();
    }

    @GetMapping("/features/{name}")
    @Auditable(resource = "admin-features", action = "VIEW")
    public ResponseEntity<?> getFeatureDetail(@PathVariable String name) {
        return ResponseEntity.ok(adminService.getFeatureDetail(name));
    }

    @PatchMapping("/features/{name}/status")
    @Auditable(resource = "feature-lifecycle", action = "STATUS_CHANGE")
    public ResponseEntity<?> updateFeatureStatus(
            @PathVariable String name,
            @RequestBody java.util.Map<String, String> body) {
        String newStatus = body.get("status");
        if (newStatus == null || !java.util.Set.of("experimental", "beta", "stable", "deprecated").contains(newStatus)) {
            throw new IllegalArgumentException("INVALID_STATUS: " + newStatus);
        }
        adminService.updateFeatureStatus(name, newStatus);
        return ResponseEntity.ok(java.util.Map.of("name", name, "status", newStatus));
    }
}

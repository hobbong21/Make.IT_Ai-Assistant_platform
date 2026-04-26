package com.humanad.makit.admin;

import com.humanad.makit.admin.dto.AdminOverviewDto;
import com.humanad.makit.admin.dto.AdminUserDto;
import com.humanad.makit.admin.dto.NotificationBreakdownDto;
import com.humanad.makit.admin.dto.UsageDto;
import org.springframework.data.domain.Page;

import java.util.List;

public interface AdminService {
    AdminOverviewDto getOverview();
    Page<AdminUserDto> getUsers(int page, int size);
    List<UsageDto> getUsage(int days);
    NotificationBreakdownDto getNotificationBreakdown(int days);
}

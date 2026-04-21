package com.humanad.makit;

import org.springframework.boot.Banner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@SpringBootApplication
@EnableAsync
@EnableCaching
@EnableTransactionManagement
public class MaKITApplication {

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(MaKITApplication.class);
        app.setBannerMode(Banner.Mode.OFF);
        app.run(args);
    }
}

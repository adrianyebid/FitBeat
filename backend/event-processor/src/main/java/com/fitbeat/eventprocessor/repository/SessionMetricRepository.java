package com.fitbeat.eventprocessor.repository;

import com.fitbeat.eventprocessor.domain.SessionMetric;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessionMetricRepository extends JpaRepository<SessionMetric, String> {
    long countByUserIdAndFinishedAtIsNotNull(String userId);
}

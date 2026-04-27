package com.fitbeat.eventprocessor.repository;

import com.fitbeat.eventprocessor.domain.WeeklyUserStat;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WeeklyUserStatRepository extends JpaRepository<WeeklyUserStat, Long> {
    Optional<WeeklyUserStat> findByUserIdAndWeekStart(String userId, LocalDate weekStart);
}

package com.fitbeat.eventprocessor.repository;

import com.fitbeat.eventprocessor.domain.EmittedBusinessEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmittedBusinessEventRepository extends JpaRepository<EmittedBusinessEvent, String> {}

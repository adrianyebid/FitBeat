package com.fitbeat.eventprocessor.service;

import com.fitbeat.eventprocessor.config.AppProperties;
import com.fitbeat.eventprocessor.messaging.OutboundEventEnvelope;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

@Component
public class BusinessEventPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final AppProperties appProperties;

    public BusinessEventPublisher(RabbitTemplate rabbitTemplate, AppProperties appProperties) {
        this.rabbitTemplate = rabbitTemplate;
        this.appProperties = appProperties;
    }

    public void publish(String eventType, Object payload) {
        OutboundEventEnvelope envelope =
                OutboundEventEnvelope.from(eventType, appProperties.getMessaging().getSource(), payload);
        rabbitTemplate.convertAndSend(appProperties.getMessaging().getExchange(), eventType, envelope);
    }
}

package com.fitbeat.eventprocessor.messaging;

import com.fitbeat.eventprocessor.service.EventProcessingService;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class EventListener {

    private final EventProcessingService eventProcessingService;

    public EventListener(EventProcessingService eventProcessingService) {
        this.eventProcessingService = eventProcessingService;
    }

    @RabbitListener(queues = "${app.messaging.queue}")
    public void onEvent(InboundEventEnvelope envelope) {
        eventProcessingService.process(envelope);
    }
}

package com.fitbeat.eventprocessor.config;

import java.util.Map;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableRabbit
@EnableConfigurationProperties(AppProperties.class)
public class RabbitConfig {

    @Bean
    public Jackson2JsonMessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public Declarables messagingTopology(AppProperties props) {
        TopicExchange exchange = new TopicExchange(props.getMessaging().getExchange(), true, false);
        TopicExchange dlx = new TopicExchange(props.getMessaging().getExchange() + ".dlx", true, false);

        Queue queue = new Queue(
                props.getMessaging().getQueue(),
                true,
                false,
                false,
                Map.of(
                        "x-dead-letter-exchange", dlx.getName(),
                        "x-dead-letter-routing-key", props.getMessaging().getDlq()));

        Queue dlq = new Queue(props.getMessaging().getDlq(), true);

        Binding allEvents = BindingBuilder.bind(queue).to(exchange).with("#");
        Binding dlqBinding = BindingBuilder.bind(dlq).to(dlx).with(props.getMessaging().getDlq());

        return new Declarables(exchange, dlx, queue, dlq, allEvents, dlqBinding);
    }
}

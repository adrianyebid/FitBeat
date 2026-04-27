package com.fitbeat.eventprocessor.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private final Messaging messaging = new Messaging();
    private final Goals goals = new Goals();

    public Messaging getMessaging() {
        return messaging;
    }

    public Goals getGoals() {
        return goals;
    }

    public static class Messaging {
        private String exchange;
        private String queue;
        private String dlq;
        private String source = "event-processor";

        public String getExchange() {
            return exchange;
        }

        public void setExchange(String exchange) {
            this.exchange = exchange;
        }

        public String getQueue() {
            return queue;
        }

        public void setQueue(String queue) {
            this.queue = queue;
        }

        public String getDlq() {
            return dlq;
        }

        public void setDlq(String dlq) {
            this.dlq = dlq;
        }

        public String getSource() {
            return source;
        }

        public void setSource(String source) {
            this.source = source;
        }
    }

    public static class Goals {
        private int weeklySessions = 3;

        public int getWeeklySessions() {
            return weeklySessions;
        }

        public void setWeeklySessions(int weeklySessions) {
            this.weeklySessions = weeklySessions;
        }
    }
}

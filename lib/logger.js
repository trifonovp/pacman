'use strict';
const winston = require('winston');
const { trace, context } = require('@opentelemetry/api');

// The trace context injector
const otelFormat = winston.format((info) => {
  const span = trace.getSpan(context.active());
  if (span) {
    const spanContext = span.spanContext();
    // Splunk O11y uses these exact field names for auto-linking
    info.trace_id = spanContext.traceId;
    info.span_id = spanContext.spanId;
  }
  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    otelFormat(), // Apply OTel correlation
    winston.format.json() // Mandatory for structured O11y logging
  ),
  defaultMeta: { 
    service: 'pacman-nodejs-k8s',
    environment: 'o11y2lab' 
  },
  transports: [new winston.transports.Console()],
});

module.exports = logger;

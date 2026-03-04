# Observability Module

## Purpose

Defines observability standards: health checks, metrics, and distributed tracing.

## Contracts

- `health-check.schema.json` — Standard health check response format

## Three Pillars

### 1. Logging
See the `logging` module.

### 2. Metrics
All services should expose metrics in Prometheus-compatible format:
- Request count, latency, error rate (RED metrics)
- Resource utilization (USE metrics)
- Business-specific counters

### 3. Tracing
All services must propagate trace context using W3C Trace Context headers:
- `traceparent`
- `tracestate`

## Health Check Endpoints

Every service must expose:
- `GET /health` — Liveness probe
- `GET /health/ready` — Readiness probe (includes dependency checks)

## Stack-Specific Notes

| Stack | Recommended |
|-------|------------|
| Java/Spring | Micrometer + Spring Actuator |
| .NET | HealthChecks + OpenTelemetry |
| Node.js | OpenTelemetry SDK |
| Go | OpenTelemetry SDK |

# Logging Module

## Purpose

Defines structured logging standards for all platform services.

## Contract

All services must emit logs following `log-entry.schema.json`.

## Requirements

1. **Structured JSON** — All logs must be structured JSON, never plain text
2. **Correlation** — All logs must include `trace_id` when available
3. **Levels** — Use standard levels: DEBUG, INFO, WARN, ERROR, FATAL
4. **No PII** — Never log personally identifiable information
5. **Context** — Include relevant context without sensitive data

## Stack-Specific Notes

| Stack | Recommended Library |
|-------|-------------------|
| Java/Spring | SLF4J + Logback |
| .NET | Serilog |
| Node.js | Pino / Winston |
| Go | Zap / Zerolog |
| PHP | Monolog |

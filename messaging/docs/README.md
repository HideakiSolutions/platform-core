# Messaging Module

## Purpose

Defines event-driven messaging contracts for the platform.

## Contracts

- `event-envelope.schema.json` — Standard event envelope wrapping all messages

## Guidelines

1. **All events must use the envelope** — No raw payloads on message buses
2. **Event naming** — Use dot notation: `{domain}.{entity}.{action}` (e.g., `banking.account.created`)
3. **Idempotency** — Consumers must handle duplicate events gracefully using `event_id`
4. **Versioning** — Include schema version; support backward-compatible evolution
5. **Correlation** — Always propagate `correlation_id` for distributed tracing

## Supported Patterns

- Pub/Sub (events)
- Request/Reply (commands)
- Event Sourcing (where applicable)

## Stack-Specific Notes

| Stack | Recommended |
|-------|------------|
| Java/Spring | Spring Cloud Stream / Kafka |
| .NET | MassTransit / NServiceBus |
| Node.js | BullMQ / KafkaJS |
| Go | Watermill / Sarama |

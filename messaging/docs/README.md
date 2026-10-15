# Messaging Module

## Purpose

Defines event-driven messaging contracts for the platform.

## Contracts

- `event-envelope.schema.json` — **Deprecated stub.** The event envelope contract is owned by ECP as the capability
  `messaging.event-envelope` (version 0.1.0, ECP `contracts-v0.3.0`). The stub keeps the legacy id
  `platform-core/messaging/event-envelope` and points at the ECP schema
  (`https://contracts.hideakisolutions.local/capabilities/messaging.event-envelope/event-envelope.schema.json`).
  New work must consume the ECP contract; conformance vectors live in ECP.

Consuming a stub: the legacy id resolves to the ECP schema only when the consumer (1) can resolve the ECP `$id` (the ECP
schema must be registered or fetchable) and (2) accepts `x-superseded-by`. Strict validators such as Ajv strict mode
reject it as an unknown keyword unless it is registered as an annotation keyword
(`ajv.addKeyword({ keyword: "x-superseded-by", schemaType: "string" })`); ECP Decision 0006 section 5 lists it as an
extension. `scripts/test-contract-stubs.mjs` proves both conditions against test doubles of the ECP schemas.

### Deprecation notice

Superseded by `messaging.event-envelope@0.1.0` (ECP). No sunset date is set in this repository: the stub is removed
only after the compatibility window defined by the ECP deprecation block, following ECP Decision 0006 sections 6 and 9
(`documentation/decisions/0006-contract-authority-and-kinds.md` in the enterprise-capability-platform repository).

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

## Proposed delivery coordination

[Delivery leases v1](delivery-v1.md) adds a neutral behavioral proposal and corpus.
It does not replace the ECP envelope or claim durable transport support.

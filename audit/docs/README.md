# Audit

Canonical, tamper-evident **audit trail** contract for every platform service.

`contracts/audit-event.schema.json` defines one audit entry shape so governance,
compliance and forensic review read the same record regardless of which service or
stack produced it. Closes the gap where each product invented its own audit table.

## Principles

- **Append-only.** Audit entries are never updated or deleted (enforce with DB
  privileges: `REVOKE UPDATE, DELETE`).
- **Tamper-evident.** Each entry carries `hash = SHA-256(prev_hash + canonical(entry))`,
  forming a chain; altering any entry breaks every subsequent hash. (Pattern proven
  in `events-platform` ADR-0008.)
- **Who/what/outcome.** Every entry records `actor`, `action`, `outcome` and `source`.
- **Correlated.** `correlation_id` ties the entry to the request/trace
  (`platform-core/logging` `trace_id`, `platform-core/messaging` `correlation_id`).

## Reference implementations

- .NET: `Hideakisolutions.Platform.Auditing` (`backend-core/dotnet`) — model,
  hash-chain and `IAuditTrail`.
- Go: `intent-os` `sdk-go/auditpub` (ACID audit within the writer transaction).

## Required fields

`audit_id`, `timestamp`, `actor {id,type}`, `action`, `outcome`, `source`.

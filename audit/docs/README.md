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

## Audit retention profile 2.0.0

Behavioral profile accepted in [ADR-011](../../docs/adr/ADR-011-audit-retention-authority.md)
on 2026-10-14. Provider and consumer admission remain required before use.
The legacy event schema and source-pinned behavior are not replaced. Profile
`platform-core/audit/retention/2.0.0` is a separate, explicit behavioral contract
using the canonical event shape. A provider/consumer must admit this profile by
identity, immutable source revision and digest; omission is not an opt-in. No PII
composition is admitted by the owner decision until its finite policy and provider
conformance are proven. This profile does not grant any client a
delete API and does not attest an installed provider.

Under the globally governed Data Governance & LGPD Standard DG-31/DG-63,
PII-access and security audit events use a five-year retention policy. DG-32
requires automatic enforcement and DG-33 covers every copy. A different period
requires the specific DPO approval or legal-basis ADR required by DG-31.
Retention starts at the original event timestamp; append retries, rotation and
service reinstallation never restart it. The admitted policy defines calendar
arithmetic and legal holds explicitly. An absent basis, provider or executor is
not verification of retention.

The event remains immutable throughout retention. Every event keeps its individual
retention_until computed from its original timestamp. Admit only singleton cohorts
or layouts with one effective expiry shared by every member. Reject mixed-expiry
batching that delays an older event or deletes a younger event early. Rotation,
closure, queueing and batching never change the expiry. At expiry, authorization
ends even if physical retirement is overdue; the delay is reported as overdue,
not approved retention extension.

Retire only a closed cohort
whose complete event set is eligible under the current admitted policy; a mixed
cohort cannot discard unexpired events. The retention identity is distinct from
applications, readers and the append pipeline and can retire only those eligible
cohorts. It cannot modify entries, reorder a live chain, erase an unexpired head
or turn an unresolved deletion into success. Do not grant an application
permission to invoke retirement.

Policy and protected inventory cover entries, indexes, identifiers, key metadata,
replicas, backups, exports and caches. Automatic retirement requires observed
coverage and restart-safe progress. Soft deletion, denied reads, expired tokens
and key loss alone do not prove physical/global deletion. Unverified copies stay
explicitly pending; they never extend an application's read authorization.

Integrity proofs distinguish authorized retirement from tampering: pin cohort
boundaries, sequence/head and the applicable policy before retirement, retain
only the separately classified and finite evidence that the governing policy
authorizes, and validate the successor chain without silently resetting genesis.
Tokens, hashes and retirement evidence are not presumed anonymous. No indefinite
PII tombstone is required or authorized by this contract.

Audit retention is independent of a producing service's business or
administrative data lifetime. Erasing a business/admin key does not erase an
audit cohort still subject to its own admitted legal basis. Access to retained
audit data remains separately authorized, protected and audited.

### Version and migration

Profile major 2 introduces finite retirement relative to the legacy never-delete
behavior. JSON compatibility is not behavioral compatibility. This profile is
additive and explicitly opt-in; it never replaces a legacy source pin or silently
changes an existing stream's guarantee. Its adoption is a new admission after
owner approval, provider conformance, consumer impact inventory and finite policy
verification. Publish under the owning repository's SemVer release process
(ADR-001); no production availability is implied by the accepted profile.

Inventory legacy readers, stores, backups and legal holds before any migration.
Validate the original timestamp/policy of every existing record and all copies;
unknown provenance blocks migration/admission. Do not reset retention at cutover,
copy old audit records under a fresh timestamp or immediately delete historical
records based on this proposal. Admit new streams separately; transfer a legacy
stream only through an approved, rehearsed migration with consumer and provider
evidence. Rollback blocks new admissions and restores a compatible artifact and
protected inventory; it cannot resurrect lawfully retired data or weaken policy.

No legacy removal is proposed. If later removal is requested, ADR-007 and the
global Deprecation & Sunset Policy require the recorded notices, at least two
minor releases before the next-major removal and a migration guide. Existing
source pins are preserved as provenance, never as an exception to DG-31–33.

## Proposed versioned hashing profile

[JCS profile v1](jcs-v1.md) and [ADR-013](../../docs/adr/ADR-013-audit-jcs-profile.md)
provide a separately versioned proposal and executable corpus. They do not change
existing hashing APIs, readers, retention decisions or production admission.

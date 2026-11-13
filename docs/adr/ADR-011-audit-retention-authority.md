# ADR-011: Separate Audit Append Authority from Finite Retention

## Status

Accepted on 2026-10-14 by the platform owner. The explicit owner decision approves
profile `platform-core/audit/retention/2.0.0` with separate retirement authority,
five-year retention and legacy behavior preserved. Acceptance does not admit a
provider, migrate consumers or approve production. Consumers must still pin the
versioned source and satisfy the adoption and conformance requirements below.

## Context

The current audit contract says entries are never deleted. The globally governed
HSEOS Data Governance & LGPD Standard (producer revision
`2b4d6f37caf748947cca8195f16b8534b5c8ab9e`, DG-31–33/DG-63) instead requires
a finite five-year audit policy, automatic enforcement and coverage of all copies.
The AEW CAP-12 sensitive composition needs an admitted interpretation of both
immutability and retention before contracting its PII-access audit integration.
Its business/admin TTL cannot substitute for the separate audit retention policy.

## Decision

Define an explicit opt-in behavioral profile `platform-core/audit/retention/2.0.0`,
separate from the legacy never-delete guarantee. Preserve the existing event schema
including its source-pinned description; shape compatibility is not behavioral
compatibility. No legacy consumer/stream is migrated or admitted by declaration.
The new profile is additive; adopting its major2 behavior requires owner approval,
provider conformance and the version/migration procedure in the audit README.

Preserve the existing language-neutral AuditEvent shape and all
immutability requirements. Producing applications, consumers and the append
pipeline cannot update or delete events. A separately admitted, least-privilege
retention authority may automatically retire only closed cohorts for which all
events are eligible under the governing finite policy. Admit only singleton/same-expiry cohort layouts; individual expiry never shifts
because another record is younger. Expiry denies access even if physical cleanup
is overdue, which is not an approved extension. The policy and observed
inventory include every copy, token/association and protected integrity state.

This clarifies the scope of append-only; it does not authorize per-entry editing,
application deletion, a new provider, infrastructure provisioning, silent chain
reset, indefinite evidence or a weaker legal/security policy. The behavioral
contract details cohort eligibility, protected boundaries and truthful deletion
results. A differing retention requires exactly the approval required by DG-31.

## Consequences

- The legacy event schema is byte-for-byte unchanged. The major2 behavioral profile
  needs a newly reviewed immutable source pin; consumers must not substitute it
  into prior conformance receipts.
- Providers must prove separate role enforcement, automatic lifecycle, restart
  recovery, tamper detection across admitted retirement and coverage of copies.
  In-memory references and configuration declarations do not satisfy these gates.
- Consumers integrate PII-access audit through the existing canonical event, with
  owner-admitted metadata profiles and provider acknowledgement semantics. This
  ADR does not publish such a provider or claim existing projections implement it.
- Retained audit associations keep their own classification, protection and
  finite legal basis. Business/admin erasure never claims global deletion of
  lawfully retained audit data, nor extends the original content authority.

## Alternatives

Retain audit forever: conflicts with DG-31–33 unless the distinct legal-basis ADR
and approval actually authorize it; it is not the proposal. Allow producing
services to delete individual entries: weakens the audit invariant and is rejected.
Omit PII-access audit or downgrade PII to INTERNAL: violates DG-61 and the approved
CAP-12 sensitive scope. Adoption still requires the versioned source and provider/consumer conformance;
the owner decision does not substitute for those observations.

# ADR-012 — delivery coordination protocol v1

Status: Accepted; ownership/admission and durable implementations pending.
Date: 2026-10-15. Program baseline SHA-256:
`f7063d52c829eec8c48200ec9bde6e8661f4aecaab0896b9f1bc9535f24a2645`.
Accepted: 2026-10-23.

The normalization program authorizes a reviewable neutral lease/transaction boundary,
while preserving legacy formats, interfaces and ECP authority. Existing outbox ports
have no fenced claim. Candidate backend revision
`a6e6c2a39a80d7f4cf7f45d485077a805869ce14` adds a separate Inbox lease interface and
in-memory implementation, but keys only message+consumer and supplies no transactional
business effect. It is a candidate for selective reconciliation, not durability evidence.

Exact discovery inspected platform `.platform/capability-graph.fragment.json` at
`a3151c3` and the backend contract distribution `contracts/vendor/ecp/0.4.0`, including
`capabilities/messaging.event-envelope/capability.yaml` and its schema. The platform
fragment searched for messaging/outbox/inbox/lease does not register this
boundary; this is bounded discovery, not a claim that it is absent enterprise-wide.
ECP declares `messaging.event-envelope@0.1.0`, owner platform architecture and alias
`platform-core/messaging/event-envelope`. Platform's existing stub remains authoritative
only as the documented compatibility pointer. Global HSEOS graph policy/registry and
Constitution §2.6 from distribution `2b4d6f37caf748947cca8195f16b8534b5c8ab9e` apply.
Axon semantic capsule for inbox/outbox/lease returned unrelated aggregated code; the
coverage was insufficient, so exact source inspection provided the evidence. AEW
activation/enforcement is not verified by this ADR.

Decision: define a language-independent delivery lease contract and executable
positive/negative/compatibility corpus under platform messaging. Backend extends the
existing inbox boundary additively with .NET V2 ports and a reference that composes the
candidate state machine. Tenant/consumer/message identity and immutable envelope-byte
fingerprint are explicit. ECP envelope data definitions are reused, never redeclared.
Application ingress verifies tenant provenance and canonical envelope; application
composition chooses legacy or V2 directly. No feature flags or SDK families are added.

The reference does not implement the transactional effect port. PostgreSQL and broker
adapters and installation evidence remain separate deliveries; all ten matrix cells
remain BLOCKED. Native transaction contexts and confirmations belong to adapters.
The owner must review graph intake/admission and the extension point before promotion.
No canonical graph relations are generated or changed automatically by this ADR.

Compatibility: IInboxStore and outbox signatures remain byte-for-byte unchanged.
The unmerged candidate lease API is preserved. V2 is opt-in via explicit type/composition;
its ASCII identifier and integer-millisecond profiles reject unsupported input without
coercion. Planned package version: additive next minor, subject to release review;
this change creates no tag, publication, deployment or consumer migration.

Rollback: remove the additive V2 composition registrations, retain legacy interfaces and
historical evidence. Do not rewrite or rehash existing messages. Confirmation-crash and
external side effects remain at-least-once concerns with application idempotency.

Validation: platform strict structural gates plus required-case/byte-integrity reference
runner; .NET executes the same corpus from a pinned vendored copy, candidate regressions,
expiry/fence/payload/tenant tests. An independent skeptical review is required. None of
these proofs upgrades a durable cell, transaction or installation state to PASS.

## Amendment 1 — 2026-11-04

Decision: owner decision D-C (2026-11-04), "amend ADR-012 and close the hole".

Problem: `messaging/contracts/delivery-lease-v1.schema.json` expressed `message_id` as
`format: uuid` plus `not: {const: "00000000-0000-0000-0000-000000000000"}`. Under this
repository's validator (Ajv 2020 with ajv-formats), `format: uuid` also accepts the
`urn:uuid:` prefix (case-insensitive), so `urn:uuid:00000000-0000-0000-0000-000000000000`
and `URN:UUID:00000000-0000-0000-0000-000000000000` passed: the nil UUID was admitted in
URN form because the `const` exclusion compares only the canonical text.

Change: `message_id` keeps `type: string` and `format: uuid` and replaces `not` with the
`pattern` already used by the ECP copy (`messaging.delivery-lease`
`schema.delivery-lease-request.json`). Only the canonical hex 8-4-4-4-12 form (lowercase or
uppercase) is accepted; the nil UUID, `urn:uuid:` and braced forms are rejected. Negative
fixtures cover the nil URN (lowercase and uppercase prefix), a non-nil URN and a braced id.

Compatibility: producers that emit URN or braced ids now fail validation; canonical ids,
including the existing example and the conformance corpus, are unaffected. The contract
stays at `contract_version` 1.0.0: ADR-001 and ADR-007 require a major bump for breaking
changes of released contracts, but this contract is accepted and not admitted (no graph
admission, no consumer migration, no tag or publication; see `docs/CAPABILITY-MATURITY.md`),
so the change is a tightening fix of an unreleased contract. Recorded in `CHANGELOG.md`.

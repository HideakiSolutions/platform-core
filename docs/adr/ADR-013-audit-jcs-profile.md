# ADR-013: Explicit JCS audit hashing profile

## Status

Proposed. Prepared under the normalization program's instruction to propose a new
versioned SHA-256/JCS protocol. This document does not record owner acceptance or
production admission. Sources: Enterprise Constitution §§2.3, 2.6, 7–10,
Platform Capability Governance Standard, RFC 8785 and ADR-011 (retention authority).

## Context

Existing stack serializers can emit different property order, timestamp precision
and UTC representations. A historical hash cannot be replaced without destroying
the relationship between evidence and its original reader. Existing event shape
and retention authority already have owners and must remain authoritative.

## Proposed decision

Add the opt-in `audit-jcs-sha256/v1` profile specified in
[audit/docs/jcs-v1.md](../../audit/docs/jcs-v1.md), extending the current event
shape and preserving existing APIs. Hash the normalized unsigned object using JCS
and SHA-256, keeping `prev_hash` once inside that object and excluding root `hash`.
Use nine-digit UTC timestamps and an explicit safe-integer-only numeric wire
profile; exact decimals use string fields. Production composition chooses versions
explicitly. No feature flag or implicit selector changes the legacy operation.

Internal Python and Node conformance oracles and pinned vectors make the proposal
reviewable. These are not new public SDK families. Contract, behavior, adapter,
installation and adoption evidence stay separate.

## Alternatives

Rehashing historical records, relying on serializer insertion order and silently
rounding high-precision values are rejected. Supporting all IEEE-754 fractional
wire lexemes would require a separately specified input precision policy and
additional cross-runtime number-parsing evidence. The proposed narrow profile
keeps exact decimal domain values out of implicit numeric conversion.

## Consequences and risks

New production adapters must preserve timestamp text/nanoseconds and arbitrary
extension fields, detect duplicate keys before object parsing and fail explicitly
on unsupported input. Existing native DateTime/datetime interfaces may require a
new interface to meet this profile. SHA-256 alone is not author authentication;
chain verification requires a trusted anchor and independent append authority.

## Rollout and rollback

After owner review and graph/intake admission, implement the versioned projection
in each applicable stack, run common and historical corpora, test isolated
artifacts and integrate by protected PR. Until then, availability is not claimed.
Rollback stops use of the new explicit operation and selects the previous
implementation at composition, without rewriting stored evidence or retention.
Publication, deployment, product migration and tags are outside this program.

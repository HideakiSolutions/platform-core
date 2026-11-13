# ADR-CEP-003: scoped provider-access candidate aliases

Status: Proposed. No owner acceptance of this ADR, admission, publication or
product adoption is inferred from implementation of this consolidation fix.

## Context

Merging the provider candidate adds four ECP compatibility aliases. The platform
CSV and its global ECP projection remain at contracts-v0.4.0. Reclassifying those
new aliases through that admitted projection would require an unrelated global
pin change. Omitting their authority checks would weaken the existing gate.

## Proposed model and implemented candidate gate

Reuse the existing vendored-bundle-lockfile candidate snapshot. Its single lock,
`.platform/ecp/ai.provider-access.lock.json`, binds ECP ownership, the exact source
repository, a forty-character immutable source ref, candidate-unpublished state,
version 0.1.0, four canonical source hashes and exactly four compatibility alias
mappings. No second registry or authority table is introduced.

Both contract and authority validators use the same helper. It validates the
four aliases, strict stub shapes, canonical ids, refs, source hashes, paths and
uniqueness before the authority validator separates these candidates from the
legacy CSV check. Missing lock/source, changed owner/ref/hash, duplicate mapping,
path escape, unknown alias and any other schema still fail closed. The existing
stub gate and its checks remain active for all other schemas.

The CSV, global contracts-v0.4.0 pin and six unknown authorities retain their
bytes. This is source-only candidate evidence under the existing
vendored-bundle-lockfile policy; it does not create an admitted canonical entry.

## Enforcement and limits

Enforcement is deterministic through `scripts/lib/provider-access-snapshot.mjs`,
both validators, negative tests in `scripts/test-provider-access-authority.mjs`,
existing stub tests and provider snapshot mutation tests. All run in `npm run
validate`. Hashes bind local snapshot bytes; this offline gate does not prove
remote publication or source-ref provenance beyond the committed source record.
Acceptance of this ADR and any future admitted pin change remain separate.

## Integration diagnosis

Three local gate executions exposed integration fixture mismatches: the shipped
stub count, scorecard sandbox alias completeness, and a new positive fixture that
copied unrelated baseline schemas without their CSV rows. These failed runs are
retained. Independent coordination review inspected the third failure and
confirmed that production correctly rejected those baseline schemas. The
approved change of approach builds the minimal candidate fixture directly from
the existing lock paths and retains an unknown-extra-schema rejection. No
production requirement is relaxed to repair that fixture.

The current-work record is
`/build/artifacts/srm-consolidation-20261113/platform-independent-fixture-diagnosis.json`.
This diagnosis does not rewrite or retroactively approve the earlier delivery's
process history. The unit gate must pass before the complete validation chain is
executed again.

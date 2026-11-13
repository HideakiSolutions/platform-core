# ADR-CEP-002: Release policy and release ledger

## Status

Accepted (2026-11-06, platform owner).

Acceptance covers the decisions in this ADR and the owner decisions under Registry policy. It does not establish that
any release exists: the ledger is still empty. Gate G2 of the CEP program still depends on WP-03 (the capability
manifest and the cross-check against `capability-authority.csv`), so it is not closed by this acceptance. The limits
of the validator, described below, stand.

## Context

platform-core versions itself with SemVer (ADR-001), has a breaking-change policy (ADR-007) and a publishing ADR
(ADR-002) whose package scopes are illustrative. None of them answers the questions a consumer actually asks:

- Which package version carries which contract version, which commit built it, and which digest is the artifact?
- Is a branch, a tag or a green build evidence that something is released, adopted or supported?
- Who is using it, and what proves it?

Without a record, a status can be written by hand and a mutable tag can stand as the only evidence. The program rule
is that no status is promoted without proof (CEP NFR-07, NFR-11, NFR-12).

This ADR is a platform-core governance decision. It does not define contract versioning: that belongs to the
Enterprise Capability Platform (ECP).

References, by name and number only:

- ECP Decision 0006, Contract Authority, Capability Kinds and Compatibility (Accepted 2026-10-01): section 6
  (versioning and compatibility), section 7 (implementations) and section 8 (distribution).
- ADR-CEP-001, Contract authority (Accepted 2026-11-06): who owns a contract.
- ADR-001 (versioning), ADR-002 (package publishing), ADR-007 (breaking changes), all Accepted.

## Relation to existing decisions

| Decision | Relation |
|---|---|
| ECP Decision 0006 | **Consumed, not redefined.** The contract version is the ECP `capability.yaml` version (section 6). The ledger records it as `contractVersion` and never computes or classifies compatibility. Section 8 (bundle with SHA-256 and lock file) is the model for the digest and lockfile evidence required here. |
| ADR-CEP-001 | **Depends on.** `contractAuthority` in the ledger uses the same vocabulary (`ecp`, `core`). Cross-checking the ledger against `capability-authority.csv` is not done here and is left to WP-03. |
| ADR-001 | **Extended.** SemVer per artifact stays. This ADR adds that a version number is an identifier, never evidence: the evidence is the digest and the commit. The `v{major}.{minor}.{patch}` git tag is a mutable label. |
| ADR-007 | **Extended.** Its major-bump rule (from 1.0.0; in `0.x` a breaking change bumps MINOR, per the owner decision under Registry policy) and the minimum gap of 2 minor releases between deprecation and removal stay. This ADR adds where the deprecation is recorded (the ledger) and what it must carry. |
| ADR-002 | **Clarified, not superseded, not edited.** Its package scopes and groups are illustrative and already carry a status note that says so. This ADR names no scope: the registry coordinates of record are whatever a ledger entry proves (see Registry policy). ADR-002 is Accepted and is not changed by this proposal. |

This ADR supersedes nothing.

## Decision

1. **Two version axes.** `contractVersion` (owned by the ECP or by the core, per ADR-CEP-001) and the package version
   (SemVer per artifact, ADR-001) are separate. A package can be released without a contract change, and a contract
   change reaches consumers only through a package release. The ledger maps one to the other and states neither
   compatibility nor impact.

2. **Identity chain.** One ledger entry per released artifact, mapping: contract version, package coordinates
   (ecosystem, name, exact version, registry), source commit (full 40-hex SHA), artifact digest (`sha256:` plus 64 hex)
   and the consumers that resolved it, each with lockfile evidence. Package coordinates and version are immutable: a
   version is never reused. Coordinates are normalized before comparison (package name case-insensitive, SemVer build
   metadata ignored, so `1.0.0` and `1.0.0+b2` are the same version), and two entries with the same coordinates are
   rejected. The same digest under two different versions of a package is rejected, and so is
   `rollback.previousReleaseId` pointing at a release of another package.

3. **Floating references are not releases.** A version that is a range, a wildcard, a dist-tag or a moving ref
   (`latest`, `next`, `main`, `develop`, `*`, `^1.2.0`, `1.x`) is rejected anywhere a version is recorded. A commit is
   always the full SHA. A git tag may be recorded as information and is never evidence by itself: evidence lists that
   contain only mutable kinds (`git-tag`, `branch`) are rejected.

4. **Lifecycle states are derived from evidence.** The states are `candidate`, `admitted`, `published`, `adopted` and
   `supported`, plus the terminal `deprecated`. The validator computes the highest state the evidence supports, and the
   declared state must equal it: a state declared above the evidence is rejected (a false `supported` release), and a
   state declared below it is rejected as stale. Every transition carries `evidenceRefs` with at least one immutable
   item, and states advance one step at a time.

   | State | Evidence the ledger must carry |
   |---|---|
   | `candidate` | contract version, source repository and full commit SHA. A version and digest are optional here. |
   | `admitted` | an exact version, a real `sha256` digest (the all-zero digest is rejected) and an admission record: a decision reference plus evidence of kind `decision`, `test-report`, `conformance-report`, `ci-run`, `attestation` or `commit`, and evidence of kind `guarantee-declaration` (amendment (a), ratified 2026-11-06). |
   | `published` | registry coordinates, a rollback procedure and publication evidence of kind `ci-run`, `attestation` or `artifact-digest` (an `artifact-digest` ref must equal `package.digest`). |
   | `adopted` | at least one consumer whose lockfile (path and full commit) resolves exactly this version and digest, and `lockfile` evidence on the transition. |
   | `supported` | an accountable owner, a runbook, a support policy and operational evidence that contains a `conformance-report` (provider verified), a `certification-report` (consumer certified) and one of `operational-report`, `incident-report` or `recovery-test` (operational profile verified). |
   | `deprecated` | a published release plus a deprecation record: since, sunset, migration reference, replacement when one exists. |

   The evidence kinds are a closed list, and each state accepts only the kinds above (the exact sets are constants in
   `scripts/validate-release-ledger.mjs`). A kind that does not prove the state, such as a `decision` for publication,
   does not promote it. Every string must be non-blank after trimming. Except for `commit`, `artifact-digest`,
   `git-tag` and `branch`, an evidence `ref` must be an `https` URL without credentials or a pinned
   `<owner>/<repo>@<40-hex>:<path>` reference.

5. **Branch is not release.** A commit on `develop` is not proof that something is implemented, and a commit on `main`
   is not proof that it is supported. A branch head can be a `candidate` source at most. Promotion beyond `candidate`
   needs an immutable artifact (version plus digest).

6. **Breaking changes, deprecation, backport and rollback.**
   - Breaking changes: a package follows ADR-001 and ADR-007 (major bump, migration guide) from 1.0.0; in `0.x` a breaking change bumps MINOR, per the owner decision under Registry policy (2026-11-06), as in ECP Decision 0006. A breaking change to a
     contract follows ECP Decision 0006 section 6, including its migration and rollback evidence; this ADR only records
     the resulting versions.
   - Deprecation: recorded in the ledger as a `deprecation` block. The ADR-007 window for platform-core artifacts is
     unchanged.
   - Backport: a fix on an older line is a new release entry with its own version, commit and digest, linked by
     `backportOf`. An existing version is never rebuilt or retagged.
   - Rollback: returning to a previous release is done by pointing consumers back to an earlier immutable release
     (`rollback.previousReleaseId`, plus a written procedure), never by mutating, overwriting or deleting a published
     artifact. A procedure is required from `published` on.

7. **No automatic production rollout.** `rollout.production` accepts only `manual` (human approval) or `none`. Any
   other value, and any unknown rollout field, is rejected. This ADR authorizes no deploy, publish or rollout, and the
   ledger is a record, not an executor.

8. **Enforcement.** `schemas/release-ledger.schema.json` (structure, 2020-12, ECP Decision 0006 section 5 keyword
   profile) and `scripts/validate-release-ledger.mjs` (policy), run by `npm run validate` through the existing
   `validate.yml` workflow, with negative tests. The schema is a platform-core governance schema, not a capability
   contract: it lives outside `<module>/contracts/` and is not scanned by `scripts/validate-contracts.mjs`. The profile has
   no conditional keywords, so the state-dependent rules are in the validator and the schema alone is not sufficient.

## Registry policy

Record only what can be verified. This change records **no real release**: `docs/release/release-ledger.json` is an
explicit empty ledger, and the fixtures use synthetic values only. A real entry is added by the change that actually
publishes, with evidence the reviewer can check. The validator checks that evidence is present and well-formed, not that
it is true: it makes no network call and cannot confirm a digest against a registry.

Owner decisions (2026-11-06), which close the six items that were open:

1. Registry and scopes: GitHub Packages, with the scope `@hideakisolutions` for npm and the prefix `Hideakisolutions.*`
   for NuGet. PyPI, Go and pub stay open: no registry or naming is decided for them.
2. Attestation of `supported`: the platform owner attests it. The support window (how many lines are backported, and
   for how long) is deferred to WP-13 and stays open.
3. Packages in `0.x`: a breaking change bumps MINOR, as in ECP Decision 0006. The validator does not classify
   compatibility, so this is a policy for review and is not enforced by it.
4. Sources of artifact-digest evidence: closed on 2026-11-06 by accepting the section "Digest evidence sources" of `docs/security/supply-chain-profile.md`.
5. Ledger location: one ledger per repository, with a federated index. No federated index file exists yet and none is
   created by this change. Reconciling the Helix publication documentation in `design-system-core` against this policy
   is a separate pull request.
6. `deprecated` without a replacement is allowed, with a written justification. For packages, the deprecation gap is
   the ADR-007 gap (minimum 2 minor releases).

Still open: registries for PyPI, Go and pub; the support window (WP-13).

Known enforcement gaps: the validator does not check the ADR-007 gap; it stays a review rule until a later change adds
it. The justification for a deprecation without `replacedBy` is now enforced (optional `deprecation.justification`,
required by the validator when `replacedBy` is absent).

## What the validator does and does not establish

- It checks **form, closed evidence kinds and the internal consistency of the file**. It makes no network call and reads
  no git history.
- It does **not** establish that evidence is authentic: that a URL exists, that a CI run passed, that a digest matches
  the registry, or that a lockfile really contains it. Authenticity is for review and for later gates (WP-11 supply chain).
- `supported` requires a `conformance-report` ("provider verified"), a `certification-report` ("consumer certified") and
  an operational item as **required evidence kinds**. The validator proves only that such items are referenced, not that
  the provider was verified or the consumer certified. Those claims rest on the referenced documents.
- Immutability is checked **within the file only**: version and digest reuse across entries, not against git history,
  a registry or other ledgers. A version republished outside this file is not detected.

## Out of scope

- Any contract, schema or stub under `<module>/contracts/`, and any ECP content.
- A capability manifest or registry (WP-03) and any cross-check against `capability-authority.csv`.
- Tags, publication, deploy, rollout and any change of ADR-CEP-001 decisions.
- Supply-chain controls (SBOM, provenance, signing): WP-11.

## Consequences

- Positive: a status cannot be promoted by editing a field; a false `supported` fails CI. Versions, commits, digests and
  consumers are traceable in one place.
- Cost: every release needs an entry and its evidence, and the entry must be updated when the state changes.
- Limit: the validator trusts the references it is given. Authenticity is for review and for the later gates.
- No breaking change: nothing existing is modified. Rollback is a revert of this change.

## Amendments, ratified 2026-11-06

Ratified by the platform owner on 2026-11-06. The proposal was recorded earlier the same day as "Proposed amendments
(not accepted)"; the text below keeps it and its outcome.

- (a) State `admitted` and above also requires evidence of kind `guarantee-declaration` (a pinned reference to the
  `implementations.json` that declares operations and guarantees), implementing AC-03. **Ratified.** The validator
  already enforces it; this has no effect on real data because the ledger is empty. The Decision table row for
  `admitted` carries it.
- (b) The `<owner>/<repo>` part of that reference is not restricted: the validator checks form only. **Ratified.**

## Acceptance

Accepted by the platform owner on 2026-11-06, with the decisions listed under Registry policy. CI was green on the change
that introduced the schema and the validator (#35).

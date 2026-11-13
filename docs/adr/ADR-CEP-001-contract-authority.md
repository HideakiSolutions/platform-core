# ADR-CEP-001: Contract authority between the Enterprise Capability Platform and platform-core

## Status

Accepted (2026-11-06, platform owner).

Acceptance covers the decisions in this ADR. Owner confirmation or correction of the six `unknown` rows is still
pending: those rows stay `unknown`, and no authority or status claim may be made for them until decided. Gate G1 is
closed for every other row and stays blocked for those six.

## Context

Shared capability contracts exist in two places: the Enterprise Capability Platform (ECP) and the schemas under each
`<module>/contracts/` directory of this repository. ECP Decision 0006 (Accepted 2026-10-01) already settles who owns
what: ECP is the single authority for shared capability contracts, and a contract that moves leaves a deprecation stub
here. This repository applied that decision to two contracts (`messaging/event-envelope` and `auth/auth-provider`, see
`ARCHITECTURE.md`), but nothing records the rule as a platform-core decision or checks it. A table that says, per
capability, which side is authoritative did not exist, so a capability could be claimed by both sides without any gate
failing.

This ADR ratifies the existing ECP decisions for platform-core. It does not redefine them.

Sources, pinned:

- ECP Decision 0006, Contract Authority, Capability Kinds and Compatibility (Accepted 2026-10-01).
- ECP Decision 0007, Design System Contract Authority (Accepted 2026-10-01), and Decision 0009, which starts its
  migration for two capabilities.
- ECP registry at tag `contracts-v0.4.0`, commit `ab1fcc92797224c428ec6362e02ee1eaf2de8abb`
  (14 capabilities).

## Decision

1. **Precedence.** ECP is the authority for shared capability contracts (Decision 0006). platform-core is the
   governance and compatibility layer: it keeps the legacy identifiers resolvable through deprecation stubs, holds the
   contracts that have not moved, and validates that no capability has two authorities.
2. **One classification per capability.** Every capability and every platform-core contract is classified in
   `docs/architecture/contract-authority/capability-authority.csv` as exactly one of `ecp-canonical`,
   `core-canonical`, `compatibility`, `deprecated` or `unknown`. `unknown` is used whenever the sources do not settle the
   question; it is never replaced by a guess.
3. **Pinned references.** An `ecp-canonical` row carries a pinned version
   (`<x.y.z> @ contracts-vX.Y.Z (<commit>)`) or a resolution policy from a closed allowlist defined in the validator
   (`ALLOWED_POLICIES`; today the only value is `policy: vendored-bundle-lockfile`, from the lock-file rule of
   Decision 0006, and no row uses it yet). Any other `policy:` text, including a moving branch such as `develop`,
   `main`, `latest` or `HEAD`, is rejected. Every `ecp-canonical` row is checked offline against the committed
   projection `docs/architecture/contract-authority/ecp-pin.json` (tag, commit, sha256 of the registry file, and
   capability id plus version only): capability, version, tag and commit must match, and every projection entry must
   have a row.
4. **Stubs are compatibility, not authority.** A schema that is a deprecation stub (`x-superseded-by`) is classified
   `compatibility` or `deprecated`, and its `x-superseded-by` capability must have an `ecp-canonical` row. The stub shape
   remains governed by `scripts/validate-contracts.mjs`.
5. **No double authority, no unearned claim.** A capability appears in one row. A claimed status of `admitted`,
   `published` or `adopted` requires exactly one canonical source, and `supported` is rejected outright in this table: no
   capability is supported at this stage and evidence gates belong to WP-03. Stubs must be classified `compatibility`
   or `deprecated` and point at `ecp:<x-superseded-by>`. These rules are enforced by
   `scripts/validate-capability-authority.mjs`, run by `npm run validate`, with negative tests.
6. **Visual scope (ECP Decision 0007).** Visual contracts are ECP capabilities in the `design.*` family. platform-core
   holds no visual contract, so it has no row to classify for them; the two `design.*` capabilities present at the
   pinned tag are listed as `ecp-canonical` for completeness. Decision 0007 and Decision 0009 govern the remaining
   migration.

## Known limitation

platform-core is public and the ECP is not, so the ECP registry is not committed or vendored. CI verifies the rows
against the committed projection only. The authenticity of the projection against the ECP is verified only by
`node scripts/validate-capability-authority.mjs --registry <path-to-registry-file>`, run by someone with access to the
registry at the pinned tag. That mode is not part of `npm run validate`. It authenticates the registry hash and the
capability ids and versions only. It does NOT authenticate the commit SHA or the tag in `ecp-pin.json`, because the
registry bytes do not contain them: a tampered pin and CSV commit SHA would pass it. Verifying the commit and the tag
requires checking the tag against the ECP directly (for example with `gh api`), by someone with access. The validator
performs no network access.

## Out of scope

- Changing, moving or removing any contract, schema or stub in this repository, or any ECP content.
- Promoting a capability to `admitted` or `supported`, or reopening the durable-implementation cells and admissions that
  the core-normalization records keep BLOCKED or proposed.
- A capability manifest or registry (the program's WP-03 owns that; ECP is the target).
- Package release, release ledger and publication policy (WP-02).
- Classifying capabilities that exist only on ECP `develop` and not at the pinned tag. They are recorded as notes, not
  as rows, and enter the table when a newer tag is adopted.

## Consequences

- Positive: one reviewable table answers "who owns this contract"; a second authority fails CI instead of surfacing in a
  consumer. Legacy identifiers and the stub window stay as Decision 0006 defines them.
- Cost: the table must be updated when a stub is added or when the pinned ECP tag changes.
- Six rows are `unknown` today (the audit family, `logging/log-entry`, `observability/health-check`,
  `messaging/delivery-lease/v1` and the contract-less `utils` module). Closing them needs an owner decision, not
  inference.
- No breaking change: no contract, schema or stub changes. See `docs/architecture/contract-authority/MIGRATION.md`.

## Acceptance requires

Done:

- Decision of the platform owner to accept this ADR (2026-11-06).
- CI green on the change that introduced the table and validator (PR #33).

Pending:

- Owner confirmation, or correction, of each of the six `unknown` rows.

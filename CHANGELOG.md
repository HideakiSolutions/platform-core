# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- Recorded owner decisions of 2026-11-06 (documentation only): ADR-CEP-002 amendments (a) and (b) ratified (`admitted` and above requires a `guarantee-declaration`; the validator already enforced it), the digest evidence sources of the supply-chain profile accepted as the answer to ADR-CEP-002 item 4, ECP Decision 0014 recorded as Accepted, and the supply-chain checks required on `develop` (not on `main`).
- ADR-CEP-002 (release policy) accepted by the platform owner on 2026-11-06, with decisions for its six open items. PyPI/Go/pub registries, the support window (WP-13) and digest evidence sources (WP-11) stay open; gate G2 still depends on WP-03. No release is recorded and the validator is unchanged.
- ADR-CEP-001 (contract authority) accepted by the platform owner on 2026-11-06. The six `unknown` rows of the authority table remain pending an owner decision.
- Tightened `message_id` in `messaging/delivery-lease/v1` (ADR-012 amendment 1, 2026-11-04): canonical hex 8-4-4-4-12 only; the nil UUID in `urn:uuid:` form and braced ids are now rejected. The contract is accepted and not admitted, so `contract_version` stays 1.0.0; producers emitting URN or braced ids must emit the canonical form.
- Added owner-approved audit-retention profile 2.0.0 in ADR-011: preserve the legacy event schema and source pins, require individual finite expiry and a separately admitted retirement authority; provider conformance, consumer admission and migration gates remain required.

- Deprecated the `messaging/event-envelope` and `auth/auth-provider` schemas in favour of the ECP capabilities
  `messaging.event-envelope@0.1.0` and `security.authn@0.1.0` (ECP `contracts-v0.3.0`). Both files are now deprecation
  stubs that carry the legacy `$id` and `$ref` the ECP schema (strict consumers must register `x-superseded-by` as an
  annotation keyword and resolve the ECP `$id`). `validate-contracts` validates stub shape strictly (ECP-host `$ref`
  matching `x-superseded-by`) and fails examples or fixtures that target a stub; `npm run test:contract-stubs` covers
  it, including compiling the stubs under strict Ajv. No example or fixture in this repository targeted them.
- Added the reusable `capability-drift` workflow and local scorecard analyzer for the capability-reuse ratchet.
- `capability-drift` analyzer: a missing baseline now exits 2 instead of passing unchecked, and `main()` now runs when invoked through a symlink or a path with spaces (it was silently skipped with exit 0). The reusable workflow fetches the analyzer from `main`, so callers without a committed `governance/capability-drift.baseline.json` (or `inputs.baseline` path) will fail after merge; the known callers (`cambioreal/cambio-real-v3` and `cambioreal/cambio-real-platforms`, per GitHub code search in HideakiSolutions and cambioreal on 2026-11-04) already commit a baseline at the default path and are unaffected.

### Added
- Added provider-access compatibility aliases backed by pinned canonical ECP schemas, real ECP-owned intake, and integrity/owner rejection checks; local implementation note ADR-014 references the approved ECP Decision 0016.
- Capability scorecard and ledger cross-check (CEP WP-03): generated `docs/capabilities/scorecard.md` (`npm run generate:scorecard`, stale-checked by `npm run validate`; not a registry, no status field), `scripts/validate-ledger-authority.mjs` (ledger x authority table x ECP pin, with `claimed_status` derived from the ledger), a `guarantee-declaration` evidence kind that `admitted` and above now require (form only, no network; AC-03), and an optional `deprecation.justification` required when `replacedBy` is absent. No release, contract, stub, pin or classification changed; the ledger stays empty.
- Supply-chain baseline (CEP WP-11): reusable workflow `supply-chain-baseline.yml` (secret detection, npm dependency audit, SBOM, workflow policy; actions pinned by SHA, read-only token), a caller `supply-chain.yml` that runs it on pull requests, `scripts/validate-workflow-policy.mjs` with a shrink-only baseline of 8 existing violations in `capability-drift.yml` and `validate.yml` (reported, not rewritten), parsed-YAML policy checker (new pinned dev dependency `yaml` 2.9.1), a secret gate that a pull request cannot disable, synthetic-defect tests per class, and `docs/security/supply-chain-profile.md`. Image scanning, provenance and dotnet/python audit are NOT_IMPLEMENTED. Nothing is enforced on other repositories until they call the workflow; remote CI is not yet verified.
- Proposed ADR-CEP-002 (release policy), the release ledger governance schema `schemas/release-ledger.schema.json`, a fail-closed validator (`npm run validate:release-ledger`) with negative tests (`npm run test:release-ledger`), an empty `docs/release/release-ledger.json`, and a release notes template. A false `supported` release, a package without an immutable version or digest, floating versions or moving refs, self-declared transitions and automatic production rollout are rejected. No release, contract, schema under `<module>/contracts/`, tag or publication is recorded or changed, and no workflow was added: `validate.yml` already runs `npm run validate`.
- Proposed ADR-CEP-001 (contract authority between ECP and platform-core), the per-capability authority table `docs/architecture/contract-authority/capability-authority.csv` a minimal pin projection of the ECP registry and a validator (`npm run validate:capability-authority`) that fails on double authority, unpinned or mismatching ECP references, ECP-stub conflicts and any `supported` claim. No contract, schema or stub changed.
- AEW organizational ownership in capability intake v2, with strategic-promotion and rejection fixtures validated by the existing contract gate.
- Initial repository scaffold
- Module structure: auth, configuration, logging, messaging, observability, security, feature-flags, utils
- Architecture documentation
- Contributing guidelines
- Contract format specifications

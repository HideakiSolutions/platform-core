# Changelog

## Unreleased

- Added owner-approved audit-retention profile 2.0.0 in ADR-011: preserve the legacy event schema and source pins, require individual finite expiry and a separately admitted retirement authority; provider conformance, consumer admission and migration gates remain required.

- Deprecated the `messaging/event-envelope` and `auth/auth-provider` schemas in favour of the ECP capabilities
  `messaging.event-envelope@0.1.0` and `security.authn@0.1.0` (ECP `contracts-v0.3.0`). Both files are now deprecation
  stubs that carry the legacy `$id` and `$ref` the ECP schema (strict consumers must register `x-superseded-by` as an
  annotation keyword and resolve the ECP `$id`). `validate-contracts` validates stub shape strictly (ECP-host `$ref`
  matching `x-superseded-by`) and fails examples or fixtures that target a stub; `npm run test:contract-stubs` covers
  it, including compiling the stubs under strict Ajv. No example or fixture in this repository targeted them.
- Added the reusable `capability-drift` workflow and local scorecard analyzer for the capability-reuse ratchet.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- AEW organizational ownership in capability intake v2, with strategic-promotion and rejection fixtures validated by the existing contract gate.
- Initial repository scaffold
- Module structure: auth, configuration, logging, messaging, observability, security, feature-flags, utils
- Architecture documentation
- Contributing guidelines
- Contract format specifications

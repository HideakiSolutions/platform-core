# Release notes: <package name> <exact version>

Copy this file for each release. Fill every field from the ledger entry; do not write a state here that the ledger does
not derive. Keep real hosts, internal paths and logs out: this repository is public.

| Field | Value |
|---|---|
| Ledger entry id | `<release id>` |
| Capability | `<capability>` (authority: `ecp` or `core`) |
| Contract version | `<exact SemVer>` (versioning owned by the ECP or the core; recorded, not defined, here) |
| Package | `<ecosystem>` `<name>` `<exact version>` |
| Registry | `<https registry URL>` |
| Source commit | `<full 40-hex SHA>` in `<owner/repository>` |
| Artifact digest | `sha256:<64 hex>` |
| State in the ledger | `candidate` / `admitted` / `published` / `adopted` / `supported` / `deprecated` |
| Date | `<YYYY-MM-DD>` |

A tag, branch name or `latest` is not an identifier of this release. Use the version, commit and digest above.

## Changes

- Added: 
- Changed: 
- Fixed: 
- Deprecated: 

## Compatibility

- Breaking change: yes / no. If yes: the migration guide reference and the contract migration evidence (ECP Decision 0006
  section 6 for contracts; ADR-007 for packages).
- Backport of: `<release id>` or none.

## Upgrade

1. Pin the exact version and digest in the lockfile of the consumer.
2. Build and test the consumer.
3. Record the consumer in the ledger entry (`consumers`, with lockfile path and commit) once it resolves this release.

## Rollback

- Previous release: `<release id>` (or none for a first release).
- Procedure: `<reference>`. Roll back by pointing consumers at the previous immutable release. Never overwrite or
  delete this one.

## Rollout

Production rollout: `manual` or `none`. Approval reference: `<reference>`. There is no automatic production rollout.

## Evidence

- Admission: 
- Publication: 
- Consumer lockfile(s): 
- Support (owner, runbook, support policy, operational evidence): 

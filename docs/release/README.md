# Release ledger

The release ledger records, per released artifact, the chain **contract version -> package coordinates and version ->
source commit -> artifact digest -> consumers**, with a lifecycle state that is derived from evidence. The policy is in
[ADR-CEP-002](../adr/ADR-CEP-002-release-policy.md) (Accepted 2026-11-06). This directory holds no real release: the committed
`release-ledger.json` is an explicit empty ledger.

- Schema (structure): [`schemas/release-ledger.schema.json`](../../schemas/release-ledger.schema.json)
- Validator (policy): [`scripts/validate-release-ledger.mjs`](../../scripts/validate-release-ledger.mjs)
- Synthetic examples, one release per state: `scripts/fixtures/release-ledger/positive.fixture.json`
- Release notes template: [`release-notes-template.md`](release-notes-template.md)

## Validate

```bash
npm run validate:release-ledger          # validates docs/release/release-ledger.json
node scripts/validate-release-ledger.mjs path/to/other-ledger.json
npm run test:release-ledger              # negative and positive tests
```

`npm run validate` runs both. A missing, empty or non-JSON file fails; so does any unknown field. An explicit
`"releases": []` is valid (no release recorded).

## Add or change an entry

Add an entry only in the change that actually publishes, with evidence a reviewer can check. Never invent a digest.

1. Start at `candidate`: `id`, `capability`, `contractAuthority`, `contractVersion`, `package` (`ecosystem`, `name`),
   `source` (`repository` and the **full 40-hex** `commit`), `rollout`, and one transition `none -> candidate`.
2. To reach `admitted`, add the exact `package.version`, the `package.digest` (`sha256:` plus 64 hex) and an `admission`
   record.
3. To reach `published`, add `package.registry`, a `publication` record and a `rollback.procedureRef`.
4. To reach `adopted`, add `consumers` whose `resolvedVersion` and `resolvedDigest` equal the release and that point at
   the consumer's lockfile and commit.
5. To reach `supported`, add `support` (`owner`, `runbookRef`, `supportPolicyRef`, `operationalEvidenceRefs`).
6. To retire, add a `deprecation` record and the transition to `deprecated`.

Evidence kinds accepted per state (closed lists, defined in the validator):

| State or step | Required evidence kinds |
|---|---|
| `admitted` (admission) | one of `decision`, `test-report`, `conformance-report`, `ci-run`, `attestation`, `commit` |
| `published` (publication) | one of `ci-run`, `attestation`, `artifact-digest` (an `artifact-digest` ref equals `package.digest`) |
| `adopted` | consumer lockfile (path, full commit) plus `lockfile` evidence on the transition |
| `supported` (operational) | `conformance-report` and `certification-report` and one of `operational-report`, `incident-report`, `recovery-test` |

Outside `commit`, `artifact-digest`, `git-tag` and `branch`, an evidence `ref` is an `https` URL without credentials or
`<owner>/<repo>@<40-hex>:<path>`. Strings that are blank after trimming are rejected everywhere.

Rules the validator enforces:

- The declared `state` must equal the state the evidence derives. Do not set a state to get ahead of the evidence.
- Every transition lists `evidenceRefs`, and at least one must be immutable. A `git-tag` or `branch` ref is a label,
  never evidence on its own.
- Versions are exact SemVer. `latest`, `main`, `develop`, `*`, ranges and wildcards are rejected, as are abbreviated SHAs.
- `rollout.production` is `manual` or `none`. Automatic production rollout does not exist.
- A version is never reused: duplicate coordinates are rejected after normalizing (name case-insensitive, build
  metadata ignored). The same digest under two versions of one package, and the all-zero digest, are rejected.
- `rollback.previousReleaseId` must be an existing entry for the same package.
- Evidence references must not be absolute or local paths (this repository is public).

The validator checks form, closed evidence kinds and the internal consistency of the file. It does not verify that a
digest matches a registry, that a referenced run passed, or that a URL exists, and it does not check immutability
against git history. `supported` needs a conformance report and a certification report as evidence kinds; their
content is not validated.

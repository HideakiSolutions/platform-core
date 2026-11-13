# Contract authority migration report (ADR-CEP-001)

Status: follows the ADR (Accepted, 2026-11-06). This change adds governance artifacts only.

## What changes

Added: `capability-authority.csv` (39 rows), `ecp-pin.json` (minimal projection of the pinned ECP registry: tag, commit,
sha256 and capability id plus version), `scripts/validate-capability-authority.mjs`, its tests, and a pointer in
`ARCHITECTURE.md`. `npm run validate` now also runs the new check and its tests.

Not changed: every contract, schema, stub, example and fixture; every other validator; the CI workflow.

## Stubs in place (unchanged)

| Legacy id | File | Superseded by | Pinned ECP row |
|---|---|---|---|
| `platform-core/messaging/event-envelope` | `messaging/contracts/event-envelope.schema.json` | `messaging.event-envelope@0.1.0` | `contracts-v0.4.0` |
| `platform-core/auth/auth-provider` | `auth/contracts/auth-provider.schema.json` | `security.authn@0.1.0` | `contracts-v0.4.0` |

Both stubs were read directly: `$ref` targets the ECP schema id, `deprecated: true`, and `x-superseded-by` matches the
`$ref` capability. `auth.authenticate` is a different ECP service capability and is not the stub target.

## Legacy contracts labelled

17 active schemas are `core-canonical` (no ECP counterpart at the pinned tag). Six rows are `unknown` and need an owner
decision: `audit/audit-event`, `audit/audit-chain-jcs/v1`, `logging/log-entry`, `observability/health-check`,
`messaging/delivery-lease/v1`, and `utils` (no contract). Several of them have similarly named capabilities on ECP
`develop` (contracts 0.5.0, not pinned): `audit.record`, `logging.entry`, `observability.health`,
`messaging.inbox-lease`, `messaging.outbox-lease`; others there (`http.correlation-id`, `messaging.consumer`,
`messaging.publish`, `resilience.http`) have no platform-core counterpart. None is a row until a newer tag is adopted.

Counts: 14 `ecp-canonical`, 17 `core-canonical`, 2 `compatibility`, 6 `unknown`, 0 `deprecated`.

## Limitation of the pin

The ECP is private and this repository is public, so the registry is not committed. CI checks the rows against the
committed projection `ecp-pin.json`. Whether the projection matches the ECP is verified only with
`node scripts/validate-capability-authority.mjs --registry <path>` by someone with access, and that mode is not run in CI.
It authenticates only the registry hash and the capability ids and versions. It does not authenticate the commit SHA or
the tag in `ecp-pin.json` (the registry bytes do not contain them); that requires checking the tag against the ECP
directly (`gh api`), by someone with access. The validator performs no network access.

## Consumers affected

None at runtime. Contributors who add or move a schema, or change a stub, must update the table or `npm run validate`
fails. Consumers of the stub ids are unaffected.

## Breaking changes

None expected. The new check fails only on the repository's own table and schema files.

## Rollback

Revert the commit (`git revert`). That removes the table, validator, tests, the `package.json` entries and the
pointer. No data, contract or published artifact is involved.

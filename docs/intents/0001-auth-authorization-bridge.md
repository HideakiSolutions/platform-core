# Intent 0001 — Auth/Authorization Bridge and Provider/Verifier Split

## Status

Proposed

## Context

A maturity audit of `platform-core` (2026-08-26) found the vault description
("spec-only, no module has a library yet") was false — `backend-core` has real,
tested Go/Python/Node implementations for most modules. But it also found real
drift specific to `auth`:

1. **`auth/contracts/auth-provider.schema.json` models the wrong primary use
   case.** It specifies an OAuth2 token-endpoint provider (`authenticate` /
   `validate_token`), but this platform delegates authentication to an
   external OIDC provider (the shared Keycloak — see the platform's Keycloak
   neutral-hostname guidance). No service in this workspace actually
   implements a password-grant/token-issuing endpoint from this contract.
2. **What every stack projection actually implements — bearer token
   verification — has no canonical schema in `platform-core/auth/` at all.**
   It lives, undocumented at this level, in
   `backend-core/security/contracts/auth-middleware.schema.json`
   (`backend-core/security/auth-middleware`), with matching Go
   (`golang/auth`: `Verifier.Verify` → `Principal{Subject,TenantID,Roles,Scopes}`),
   Python (`hideakisolutions_platform.auth`, whose own docstring literally
   says it covers *two* contracts — the middleware config and the provider
   interface — because there was nowhere better to point to), and Node/TS
   projections, all cross-referencing each other in comments as
   "wire-compatible" but never landing in `platform-core`.
3. **No bridge exists between `auth` and the newer, more mature
   `authorization/contracts/decision.schema.json`** (RBAC+ABAC+ReBAC unified
   decisions with OPA/Cedar/OpenFGA compatibility). `decision.schema.json`
   already models a `step_up_auth` obligation and a `subject.roles` RBAC
   input, but nothing in `auth/` says where `roles` comes from or how a caller
   is supposed to react to `step_up_auth`.
4. `auth-provider.schema.json` also has no PKCE (RFC 7636) or token revocation
   (RFC 7009) — both needed for the platform's actual clients (mobile/SPA
   public clients doing `authorization_code` + PKCE against Keycloak).

This closes the "silence, not a decision" gap the audit called out: whether
`backend-core`'s auth modules should `$ref` `platform-core` or keep their own
namespace was previously undecided by omission. This Intent makes an explicit,
narrower decision instead of resolving the whole question at once.

## Decision

1. **Add `auth/contracts/token-verifier.schema.json`** as a new, additive
   schema in `platform-core/auth/`. Its `middleware_config` block is a
   field-for-field mirror of `backend-core/security/auth-middleware`'s
   `authentication` shape (same property names, same enums, same defaults) —
   not a redesign. Its `verify` operation documents the `Principal` shape
   (`subject`/`tenant_id`/`roles`/`scopes`) that the Go/Python/Node
   projections already return, again without inventing new field names.
   `backend-core/security/contracts/auth-middleware.schema.json` is left
   exactly as-is — this is additive documentation of an existing reality at
   the higher (`platform-core`) layer, not a replacement.
2. **Extend `auth-provider.schema.json` additively** (no renames, no required
   fields changed): `authenticate.input` gains optional `code_verifier`
   (PKCE) and `acr_values` (step-up request); a new top-level `revoke`
   operation is added (RFC 7009 shape); `validate_token.output` gains an
   optional `principal` field `$ref`-ing the same normalized shape as
   `token-verifier`'s `verify.output`.
3. **Document the bridge explicitly** in both `auth/docs/README.md` and
   `authorization/docs/README.md`: `token-verifier`'s `roles` feeds
   `decision.schema.json`'s `subject.roles`; a `step_up_auth` obligation is
   enforced by retrying `authenticate` with `acr_values` set from the
   obligation's `detail`.
4. **Explicitly deferred, not silently skipped:** migrating
   `backend-core`'s Go/Python/Node/TS auth modules to actually `$ref`
   `platform-core/auth/*` (instead of their own `backend-core/security/...`
   and ad-hoc `$id`s) is real, valuable work — but it touches tested
   production code in three languages and deserves its own reviewed change,
   not a rider on a contract-only Intent. Tracked as a named follow-up (see
   Completion Checklist), not left as ambient silence.

## Consequences

**Easier:**
- `platform-core/auth/` is now a complete, self-contained reference for both
  halves of the real problem (provider *and* verifier) instead of only the
  half nobody implements.
- The `auth` ↔ `authorization` relationship (roles in, step-up obligations
  out) is now a documented contract instead of tribal knowledge spread across
  three language-specific code comments.
- Any future consumer implementing bearer verification from scratch (a new
  stack, a new service) has one canonical schema to read instead of needing
  to discover `backend-core/security/auth-middleware` by accident.

**More complex / explicitly deferred:**
- `backend-core`'s three stack projections still don't `$ref` `platform-core`
  — this Intent documents and mirrors their real shape but does not refactor
  them. Follow-up work item, not resolved here.
- `validate_token.output.principal` duplicates `token-verifier`'s `verify.output`
  shape inline rather than `$ref`-ing it: `scripts/validate-contracts.mjs`
  only rewrites (and thus only resolves) `$ref` values that are a bare, whole
  schema `$id` — it does not handle JSON-pointer fragments into another
  schema. Confirmed by running the validator (see Validation below). The two
  copies must be kept in sync by hand until this repo's validator supports
  fragment refs.
- No `.platform-capability.json` entry was added for these new files; the
  audit did not find evidence this is required at the individual-contract
  level (only at module level for the 9 new domains) — confirm with a
  `governance/` maintainer if the capability graph expects one.

## Reversibility

Easy — every schema change is additive (new file, new optional properties, new
operation). Nothing existing was renamed or made required. If the
`token-verifier` split turns out to be wrong, it can be deprecated the same
way `CONTRIBUTING.md` prescribes for any token: add new, deprecate old, never
silently remove.

## Completion Checklist

- [x] `auth/contracts/token-verifier.schema.json` added.
- [x] `auth-provider.schema.json` extended (PKCE, `acr_values`, `revoke`,
      `principal`).
- [x] `auth/docs/README.md` and `authorization/docs/README.md` document the
      bridge.
- [x] `CHANGELOG.md` updated.
- [x] `npm run validate:contracts` passes.
- [ ] Follow-up ticket: migrate `backend-core` Go/Python/Node/TS auth modules
      to `$ref` `platform-core/auth/*` instead of their own namespace — not
      done in this Intent, tracked here so it isn't silent again.
- [ ] Follow-up: confirm with `governance/` maintainers whether
      `.platform-capability.json` is required per-contract or only per-module.
- [ ] Pilot in a real consumer (Fase 2 of the platform-core maturity plan,
      2026-08-26 audit) — out of scope for this Intent.

## Validation

```bash
cd cores/platform-core
npm run validate:contracts
```

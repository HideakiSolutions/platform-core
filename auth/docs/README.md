# Auth Module

## Purpose

Defines authentication and authorization contracts for the platform.

## Contracts

- `auth-provider.schema.json` — **Deprecated stub.** The authentication provider contract is owned by ECP as the
  capability `security.authn` (version 0.1.0, ECP `contracts-v0.3.0`). The stub keeps the legacy id
  `platform-core/auth/auth-provider` and points at the ECP schema
  (`https://contracts.hideakisolutions.local/capabilities/security.authn/auth-provider.schema.json`).
  New work must consume the ECP contract; conformance vectors live in ECP.

Consuming a stub: the legacy id resolves to the ECP schema only when the consumer (1) can resolve the ECP `$id` (the ECP
schema must be registered or fetchable) and (2) accepts `x-superseded-by`. Strict validators such as Ajv strict mode
reject it as an unknown keyword unless it is registered as an annotation keyword
(`ajv.addKeyword({ keyword: "x-superseded-by", schemaType: "string" })`); ECP Decision 0006 section 5 lists it as an
extension. `scripts/test-contract-stubs.mjs` proves both conditions against test doubles of the ECP schemas.

### Deprecation notice

Superseded by `security.authn@0.1.0` (ECP). No sunset date is set in this repository: the stub is removed only after
the compatibility window defined by the ECP deprecation block, following ECP Decision 0006 sections 6 and 9
(`documentation/decisions/0006-contract-authority-and-kinds.md` in the enterprise-capability-platform repository).

## Supported Grant Types

> **Non-normative.** `auth-provider.schema.json` is a deprecation stub and the authority for authentication is the ECP capability `security.authn@0.1.0`. The list below is legacy, informational guidance and does not define or constrain the contract; consult the ECP contract for the normative grant types.

- `password` — Resource owner password credentials
- `refresh_token` — Token refresh
- `client_credentials` — Machine-to-machine
- `authorization_code` — OAuth2 authorization code flow

## Implementation Guidelines

1. All implementations must follow the contracts defined in `contracts/`
2. Token format should be JWT unless otherwise specified
3. Refresh tokens must be stored securely (not in localStorage for web)
4. All auth endpoints must enforce rate limiting
5. Failed authentication attempts must be logged for observability

## Stack-Specific Notes

| Stack | Recommended Library |
|-------|-------------------|
| Java/Spring | Spring Security |
| .NET | ASP.NET Identity / IdentityServer |
| Node.js | Passport.js / jose |
| Go | golang-jwt |
| PHP | Laravel Sanctum / Passport |

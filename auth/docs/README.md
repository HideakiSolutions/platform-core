# Auth Module

## Purpose

Defines authentication and authorization contracts for the platform.

## Provider vs. Verifier — read this first

This platform delegates authentication to an external OIDC provider (the shared
Keycloak — see the platform's Keycloak neutral-hostname guidance). In practice:

- **`auth-provider.schema.json`** models the OAuth2/OIDC token-endpoint contract
  (issuing/refreshing/revoking tokens). Most services never implement this
  directly — Keycloak is the provider. It stays useful for a BFF/gateway that
  proxies the token exchange (e.g. a mobile PKCE flow) or for any service that
  genuinely issues its own tokens.
- **`token-verifier.schema.json`** models what almost every service actually
  does: validate a bearer token issued elsewhere and normalize it into a
  `Principal`. This is the contract `backend-core`'s Go/Python/Node projections
  already implement — it was undocumented at this level until Intent 0001.

If you're protecting an API with bearer tokens, you want `token-verifier`, not
`auth-provider`.

## Contracts

- `auth-provider.schema.json` — Authentication provider interface specification (token issuance/refresh/revocation, PKCE, step-up).
- `token-verifier.schema.json` — Bearer token verification middleware config + normalized Principal output (mirrors `backend-core/security/contracts/auth-middleware.schema.json`).

## Bridge to `authorization/`

`authorization/contracts/decision.schema.json` can return an `obligations[]`
entry with `type: "step_up_auth"`. The caller enforces that obligation by
retrying `authenticate` with `acr_values` set from the obligation's `detail`
(see `auth-provider.schema.json#properties.authenticate.properties.input.properties.acr_values`).
The `roles` normalized by `token-verifier`'s `verify` output feed directly into
`authorization/decision.schema.json#properties.request.properties.subject.properties.roles`
for RBAC decisions.

## Supported Grant Types

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

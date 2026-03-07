# Auth Module

## Purpose

Defines authentication and authorization contracts for the platform.

## Contracts

- `auth-provider.schema.json` — Authentication provider interface specification

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

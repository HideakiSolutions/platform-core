# Configuration Module

## Purpose

Defines configuration management standards for platform services.

## Guidelines

1. **Environment-based** — Use environment variables as the primary config source
2. **Layered** — Support config layering: defaults → env-specific → env vars → secrets
3. **No secrets in code** — Use secret managers (Vault, AWS Secrets Manager, etc.)
4. **Validated on startup** — Fail fast if required configuration is missing
5. **Typed** — Configuration should be strongly typed, not raw strings

## Configuration Hierarchy (highest priority wins)

```
1. Environment variables
2. Secret manager
3. Environment-specific config file
4. Default config file
```

## Naming Convention

Environment variables: `APP_DATABASE_HOST`, `APP_LOG_LEVEL`
Pattern: `APP_{SECTION}_{KEY}` in SCREAMING_SNAKE_CASE

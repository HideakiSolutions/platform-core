# Feature Flags Module

## Purpose

Defines the abstraction for feature flag management across the platform.

## Guidelines

1. **Provider-agnostic** — Support LaunchDarkly, Unleash, or custom providers
2. **Typed flags** — Boolean, string, number, and JSON flags
3. **Context-aware** — Evaluate flags based on user, tenant, environment
4. **Default values** — Always provide safe defaults for when the provider is unavailable
5. **Audit trail** — Log flag evaluations for debugging

## Flag Naming Convention

```
{domain}.{feature}.{variant}
```

Examples:
- `banking.pix.instant_transfer`
- `platform.ui.dark_mode`
- `auth.mfa.sms_enabled`

# ADR-003: Token Ownership

## Status

Accepted

## Context

Design tokens (colors, spacing, typography, shadows, borders, z-index) are consumed by multiple platforms (web, mobile, native). Without a clear ownership model, tokens risk being duplicated or overridden inconsistently across repositories, leading to visual drift and maintenance burden.

## Decision

design-system-core is the single source of truth for all base design tokens. Consumer repositories (frontend-core, mobile-core) may add platform-specific tokens (e.g., CSS breakpoints, platform safe area insets) but MUST NOT duplicate or override base tokens. All base tokens flow unidirectionally: design-system-core to consumers. Any change to base tokens originates in design-system-core and propagates via published packages.

## Consequences

- Visual consistency is enforced at the source — one place to update, all platforms reflect the change
- Platform-specific tokens are clearly separated from base tokens, reducing confusion
- Consumer teams cannot "quick fix" a color or spacing value locally — they must propose changes upstream
- design-system-core becomes a critical dependency; its release cadence affects all consumers
- Token transformation pipeline (see ADR-010) must run in design-system-core CI to produce per-platform outputs

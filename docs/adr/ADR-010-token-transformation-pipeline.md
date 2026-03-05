# ADR-010: Token Transformation Pipeline

## Status

Proposed

## Context

Design tokens in design-system-core (see ADR-003) are stored in a platform-agnostic format but must be consumed by multiple platforms (web, React/React Native, Flutter, Android native, iOS native). Each platform requires tokens in a different format. A manual transformation process would be error-prone and slow.

## Decision

Design tokens are stored as JSON in design-system-core. Style Dictionary (by Amazon) transforms tokens into platform-specific outputs: CSS custom properties (web), TypeScript constants (React/React Native), Dart ThemeData extensions (Flutter), XML resources (Android native), and Swift constants (iOS native). The transformation pipeline runs in design-system-core CI on every merge to main. Each platform output is published as a separate package (e.g., `@srm-banking/tokens-css`, `@srm-banking/tokens-ts`, `com.srm.banking:tokens-android`).

## Consequences

- Token changes propagate automatically to all platforms via CI, eliminating manual translation
- Style Dictionary is a mature, widely-adopted tool with an active community and extensible architecture
- Per-platform packages allow consumers to depend only on the format they need
- The pipeline adds a build step to design-system-core CI — failures in transformation block all token releases
- Custom Style Dictionary transforms may be needed for non-standard formats, adding maintenance complexity
- All platform teams must adopt the generated packages rather than hand-maintaining token values

# ADR-009: React Native and Frontend Boundary

## Status

Accepted

## Context

Both frontend-core (web) and mobile-core/react-native share the React ecosystem, which creates ambiguity about where certain patterns, components, and utilities should live. Without a clear boundary, code may be duplicated or misplaced, leading to maintenance overhead and confusion.

## Decision

frontend-core owns web-specific patterns: layouts, CSS-based theming, web routing (React Router), and browser API abstractions. mobile-core/react-native owns mobile-specific patterns: native navigation (React Navigation), secure storage, push notifications, biometric auth, and OTA updates. Shared concerns — React hooks, state management patterns (see ADR-005), and API client abstractions — live in their respective core repos with aligned interfaces but independent implementations. design-system-core tokens are consumed by both independently via the token transformation pipeline (see ADR-010).

## Consequences

- Clear ownership prevents duplication and misplaced code
- Shared patterns use aligned interfaces, enabling developers to move between web and mobile with minimal friction
- No shared runtime package between web and mobile — code sharing is at the pattern level, not the package level
- Teams must coordinate when evolving shared interfaces (hooks, API clients) to keep them aligned
- design-system-core remains the single integration point for visual consistency across both platforms

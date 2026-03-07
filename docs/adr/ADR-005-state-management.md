# ADR-005: State Management

## Status

Accepted

## Context

The platform supports multiple frontend stacks (React web, React Native, Flutter, Angular). Prescribing a single state management library would not be practical given the diversity of frameworks. However, teams need guidance to avoid fragmentation within a given stack.

## Decision

State management is not prescriptive at the platform level — each stack standard recommends options. React (web and React Native): Zustand for client state, React Query (TanStack Query) for server state. Flutter: Riverpod or Bloc, chosen per project by the team. Angular: NgRx. Core repositories provide patterns and examples but do not enforce a specific library. Teams may deviate with justification documented in a project-level ADR.

## Consequences

- Teams have flexibility to choose the best tool for their context within recommended boundaries
- Patterns and examples in core repos reduce onboarding time and promote consistency within a stack
- Cross-stack code sharing for state management is explicitly not a goal
- Deviations require documentation, preventing silent drift from recommendations
- Core repos must maintain examples for each recommended option, increasing maintenance surface

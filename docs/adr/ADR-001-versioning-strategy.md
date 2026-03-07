# ADR-001: Versioning Strategy

## Status

Accepted

## Context

The SRM Banking platform is composed of multiple core repositories (platform-core, backend-core, frontend-core, mobile-core, design-system-core). Each repository evolves at its own pace and is consumed independently by downstream projects. A consistent versioning strategy is needed to communicate change impact clearly and enable reliable dependency management across the ecosystem.

## Decision

All core repositories use Semantic Versioning (SemVer 2.0). Each repository versions independently — there is no coordinated "platform version." CHANGELOG.md in each repo follows the Keep a Changelog format. Git tags use the pattern `v{major}.{minor}.{patch}` (e.g., `v1.2.3`). Pre-release versions use SemVer pre-release identifiers (e.g., `v1.2.3-beta.1`).

## Consequences

- Consumers can rely on SemVer guarantees to assess upgrade risk
- Independent versioning allows repos to release at different cadences without artificial coupling
- CHANGELOG.md provides a human-readable history of changes per release
- Teams must be disciplined about bumping major versions for breaking changes
- Tooling (CI/CD) must enforce that tags match the declared version in package manifests

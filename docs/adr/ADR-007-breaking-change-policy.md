# ADR-007: Breaking Change Policy

## Status

Accepted

## Context

Core repositories are consumed by multiple downstream projects. Unannounced breaking changes can cause widespread build failures and erode trust in the platform. A formal policy is needed to manage the lifecycle of breaking changes predictably.

## Decision

Breaking changes require a major version bump (per SemVer, see ADR-001). Deprecation notices must be introduced in a minor release, and the deprecated feature may only be removed in the next major release with a minimum gap of 2 minor releases between deprecation and removal. Migration guides are required for all breaking changes and must be included in the CHANGELOG and/or a dedicated `MIGRATION.md`. CI checks enforce backward compatibility on contracts (JSON Schema, OpenAPI) by comparing the current version against the previous release.

## Consequences

- Consumers have a predictable window to migrate away from deprecated features
- Migration guides reduce the cost of upgrading to new major versions
- CI-enforced contract compatibility catches accidental breaking changes before release
- The 2-minor-release gap slows down removal of legacy APIs, which may increase maintenance burden
- Teams must invest in writing clear migration documentation for every breaking change

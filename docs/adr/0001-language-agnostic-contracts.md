# ADR-0001: Language-Agnostic Contracts

## Status

Accepted

## Context

The platform supports multiple technology stacks (.NET, Java, Node.js, Go, PHP). Core contracts must be consumable by any stack without coupling to a specific runtime or language.

## Decision

Use JSON Schema for data contracts, OpenAPI for API specifications, and AsyncAPI for messaging contracts. Behavioral contracts are documented in Markdown with clear specifications.

## Consequences

- Contracts are universally readable and validatable
- No runtime dependency on core repositories
- Implementations must create their own adapters
- Validation tooling exists for JSON Schema in all target languages

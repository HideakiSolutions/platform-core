# ADR-002: Package Publishing

## Status

Accepted

## Context

Core repositories produce artifacts consumed by multiple technology stacks (JavaScript/TypeScript, Java, Go). A clear publishing strategy is needed so that consumers can reliably depend on these artifacts through standard package managers without requiring a monorepo orchestration tool.

## Decision

npm packages are published under the `@srm-banking/` scope. Java artifacts are published via Maven Central under the `com.srm.banking` group. Go modules are versioned via Git tags following Go module conventions. Each core repository publishes independently through its own CI/CD pipeline. No monorepo tool (Lerna, Nx, Turborepo) is required — each repo is self-contained.

## Consequences

- Consumers install packages through standard tooling (npm, Maven, go get) with no special configuration beyond scope/group
- Independent publishing allows each repo to release without coordinating with others
- CI/CD pipelines are simpler since each repo owns its full build-test-publish lifecycle
- Teams must ensure version consistency manually when cross-repo dependencies exist
- The `@srm-banking/` scope and `com.srm.banking` group must be registered and access-controlled

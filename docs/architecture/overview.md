# Platform Core — Architecture Overview

## Purpose

Platform-core is the foundational layer of the platform technology stack. It provides language-agnostic contracts and specifications that all other core repos and product repos must follow.

## Module Map

| Module | Responsibility | Contract Format | Status |
|--------|---------------|-----------------|--------|
| ai | AI token usage, guardrail result, MCP tool descriptor | JSON Schema | active |
| approval | Approval request and decision state | JSON Schema | active |
| audit | Audit event; retention profile 2.0.0 (ADR-011); JCS v1 profile (ADR-013, proposed) | JSON Schema + behavioral docs | active (legacy schema); JCS proposed |
| auth | Authentication provider | JSON Schema | deprecation stub, superseded by ECP `security.authn` |
| authorization | Authorization decision (RBAC/ABAC/ReBAC) | JSON Schema | active |
| configuration | Environment and runtime configuration | JSON Schema | active |
| data | Data contract (owner, classification, lineage) | JSON Schema | active |
| directory | Organization nodes and memberships | JSON Schema | active |
| feature-flags | Feature flag evaluation interface | JSON Schema | active |
| governance | Capability intake contracts | JSON Schema | active |
| logging | Structured logging standards | JSON Schema | active |
| messaging | Event envelope; delivery lease v1 (ADR-012, proposed) | JSON Schema + behavioral docs | envelope: deprecation stub, superseded by ECP `messaging.event-envelope`; lease: proposed |
| multi-tenancy | Tenant context | JSON Schema | active |
| notifications | Notification intent and delivery result | JSON Schema | active |
| observability | Health checks (metrics/tracing as guidance) | JSON Schema | active |
| secrets | Secret reference (never values) | JSON Schema | active |
| security | Security headers and baseline protections | JSON Schema | active |
| utils | Shared utilities (no contracts, pure helpers) | N/A | docs only |

"Active" means the contract exists without a supersession notice; it does not imply publication or product adoption. See [CAPABILITY-MATURITY](../CAPABILITY-MATURITY.md).

## Dependency Rule

Platform-core depends on **nothing**. All other repos depend on platform-core.

## Contract Evolution

Contracts follow semantic versioning. Breaking changes require a major version bump and an ADR documenting the rationale and migration path.

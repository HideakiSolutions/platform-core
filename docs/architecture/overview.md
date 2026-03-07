# Platform Core — Architecture Overview

## Purpose

Platform-core is the foundational layer of the SRM Banking technology stack. It provides language-agnostic contracts and specifications that all other core repos and product repos must follow.

## Module Map

| Module | Responsibility | Contract Format |
|--------|---------------|-----------------|
| auth | Authentication and authorization abstractions | JSON Schema |
| configuration | Environment and runtime configuration | JSON Schema |
| feature-flags | Feature flag evaluation interface | JSON Schema |
| logging | Structured logging standards | JSON Schema |
| messaging | Event-driven communication envelope | JSON Schema |
| observability | Metrics, tracing, and health checks | JSON Schema |
| security | Security headers and baseline protections | JSON Schema |
| utils | Shared utilities (no contracts — pure helpers) | N/A |

## Dependency Rule

Platform-core depends on **nothing**. All other repos depend on platform-core.

## Contract Evolution

Contracts follow semantic versioning. Breaking changes require a major version bump and an ADR documenting the rationale and migration path.

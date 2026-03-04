# Architecture — platform-core

## Overview

platform-core is the foundational layer of the platform. It provides cross-cutting infrastructure abstractions that are consumed by all other core repositories and product implementations.

This repository is **language-agnostic** by design. It defines contracts, specifications, and guidelines that can be implemented in any technology stack (.NET, Java, Node.js, Go, PHP, etc.).

## Architecture Principles

1. **Language Agnosticism** — Contracts are defined as specifications, not tied to any runtime
2. **Dependency Inversion** — All modules define abstractions, never concrete implementations
3. **Low Coupling** — Each module is independent and can be adopted individually
4. **High Cohesion** — Each module groups related concerns together
5. **Observability First** — Every module considers logging, tracing, and metrics
6. **Security by Default** — Security primitives are embedded, not bolted on

## Module Overview

```
platform-core
├── auth/                  # Authentication & authorization contracts
│   ├── contracts/         # Interface definitions, schemas, specs
│   └── docs/              # Module-specific documentation
├── configuration/         # Configuration management patterns
│   ├── contracts/
│   └── docs/
├── logging/               # Structured logging standards
│   ├── contracts/
│   └── docs/
├── messaging/             # Event-driven messaging contracts
│   ├── contracts/
│   └── docs/
├── observability/         # Metrics, tracing, health check specs
│   ├── contracts/
│   └── docs/
├── security/              # Security primitives and policies
│   ├── contracts/
│   └── docs/
├── feature-flags/         # Feature flag abstraction
│   ├── contracts/
│   └── docs/
├── utils/                 # Shared utilities and helpers
│   └── docs/
├── docs/                  # Repository-wide documentation
│   ├── architecture/      # Architectural decisions and diagrams
│   ├── guidelines/        # Engineering guidelines
│   └── adr/               # Architecture Decision Records
└── templates/             # Templates for new modules
```

## Dependency Rules

```
platform-core is the ROOT of the dependency tree.

platform-core → depends on NOTHING
backend-core  → depends on platform-core
frontend-core → depends on platform-core (selectively)
mobile-core   → depends on platform-core (selectively)
design-system → depends on NOTHING (visual layer only)

Products → depend on core repositories
Core     → NEVER depends on products
```

## Contract Format

Contracts in this repository are defined using:

- **JSON Schema** for data structures and validation
- **OpenAPI fragments** for API contract patterns
- **AsyncAPI fragments** for messaging contracts
- **Markdown specifications** for behavioral contracts

Each module's `contracts/` folder contains the source of truth for that module's interface.

## How Products Consume platform-core

Products should treat platform-core as a specification source:

1. Read the contracts and specifications
2. Implement adapters in their own stack
3. Follow the guidelines documented in each module
4. Validate compliance using provided schemas

## ADR (Architecture Decision Records)

All significant architectural decisions are documented in `docs/adr/` following the format:

```
docs/adr/
├── 0001-use-json-schema-for-contracts.md
├── 0002-language-agnostic-design.md
└── template.md
```

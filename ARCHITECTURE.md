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

Each module directory holds `contracts/` (JSON Schema) and `docs/`. Modules with extra material: `audit/` and `messaging/` (`conformance/`), `governance/` (`examples/`, `fixtures/`). `utils/` has `docs/` only.

```
platform-core
├── ai/ approval/ audit/ auth/ authorization/ configuration/ data/
├── directory/ feature-flags/ governance/ logging/ messaging/
├── multi-tenancy/ notifications/ observability/ secrets/ security/
├── utils/                 # documentation only, no contracts
├── docs/
│   ├── adr/               # Architecture Decision Records
│   ├── architecture/      # Architecture overview
│   ├── guidelines/        # Engineering guidelines
│   └── implementation/    # Normalization program records
├── scripts/  tools/       # Contract validation and capability-drift tooling
└── templates/             # Template for new modules
```

`auth` and `messaging` contain deprecation stubs (see Contract Format below). Per-module status and maturity: [docs/CAPABILITY-MATURITY.md](docs/CAPABILITY-MATURITY.md).

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

Each module's `contracts/` folder contains the source of truth for that module's interface, with one exception:
contracts that moved to the Enterprise Capability Platform (ECP) are owned there (ECP Decision 0006). Their schema files
here are deprecation stubs (`$ref` to the ECP schema id, `deprecated: true`, `x-superseded-by: <capability>@<version>`)
that carry the legacy ids and delegate to the ECP schema. A strict consumer must register `x-superseded-by` as an
annotation keyword (ECP Decision 0006 section 5 lists it as an extension) and make the ECP `$id` resolvable, or the stub
will not compile. Today `messaging/contracts/event-envelope.schema.json` (ECP
`messaging.event-envelope`) and `auth/contracts/auth-provider.schema.json` (ECP `security.authn`) are stubs.
`scripts/validate-contracts.mjs` validates a stub's shape strictly (the `$ref` must be an ECP schema id whose capability
matches `x-superseded-by`) and does not resolve it; the ECP conformance vectors validate the content, and examples or
negative fixtures that target a stub fail validation and belong in those vectors.

## How Products Consume platform-core

Products must follow the Platform-first intake before implementing a cross-cutting
need:

1. Query the versioned federated Platform Capability Graph by capability, contract,
   package and owner; then run semantic discovery for adjacent or duplicate nodes.
2. Consume the immutable, verified package for the product stack when available.
3. Extend through documented ports or adapters while product and provider semantics
   remain local.
4. If no projection exists, propose it in the owning core and prove conformance to
   the same contract. Do not create a parallel product-owned standard.
5. Record the decision using `platform-core/governance/capability-intake/v2` and include
   exact graph evidence, semantic discovery, compatibility,
   deterministic verification, failure mode and rollback evidence.

Contract readiness, package readiness, publication and product adoption are separate
states. Passing core tests never implies that a product has adopted a capability.

## ADR (Architecture Decision Records)

All significant architectural decisions are documented in `docs/adr/` following the format:

```
docs/adr/
├── 0001-language-agnostic-contracts.md
├── ADR-001-versioning-strategy.md
├── ADR-002-package-publishing.md
├── ADR-003-token-ownership.md
├── ADR-004-multi-tenancy.md
├── ADR-005-state-management.md
├── ADR-006-offline-first-mobile.md
├── ADR-007-breaking-change-policy.md
├── ADR-008-documentation-language.md
├── ADR-009-react-native-frontend-boundary.md
├── ADR-010-token-transformation-pipeline.md
├── ADR-011-audit-retention-authority.md
├── ADR-012-delivery-lease-protocol-proposal.md
├── ADR-013-audit-jcs-profile.md
└── template.md
```

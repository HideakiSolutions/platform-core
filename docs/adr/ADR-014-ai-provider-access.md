# ADR-014: Explicit vendor access modes for AI inference

Status: proposed. Date: 2026-11-13.

Historical candidate identifiers: ADR-012 and ADR-PA-001. Renumbered to the next
available numeric slot during integration to avoid
colliding with the existing delivery coordination ADR-012; its proposal and
acceptance status are unchanged.

## Context

The requested platform capability covers Claude, Codex/ChatGPT, Gemini and Ollama through both
native subscription accounts and API credentials. These billing paths are not interchangeable:
OAuth does not universally mean included usage. See the source-backed
[provider access specification](../../ai/docs/provider-access.md).

Discovery used the pinned HSEOS capability registry and its local fragment, the platform
fragment, existing token-metering/guardrail/MCP metadata, and Axon semantic discovery. Adjacent
AI capabilities exist. The pinned remote federation is not locally composed and is not claimed
absent. HSEOS `model-providers` already owns normalized kernel streaming, and `runtime-providers`
already implements native Claude/Codex drivers. We extend those native driver boundaries rather
than creating another CLI transport for these vendors. No project HSEOS adoption is implied.

## Proposed decision

Canonicalize billing/configuration contracts in ECP `ai.provider-access` per
Decision 0006 and retain platform-core schema aliases. Project Node and net10 adapters in
backend-core, compose existing guardrails/token telemetry, and register this capability as
proposed until conformance and deployment evidence are reviewed. Each connection has exactly
one vendor and one access mode; no fallback changes billing modes. API credentials are references
resolved by an application-owned secret port. Native clients own subscription login and refresh.

Account paid-overage settings are not exposed as an enforceable cross-vendor API. Explicitly
record the operator's included-only configuration and reject API routes under that policy.
This account-setting evidence is **NÃO DETERMINÍSTICO** in the current integration: the operator
owns verification, compensated by account identity checks, native quota rejection and no paid
fallback. Do not claim stronger cost guarantees than native account controls can provide.

Ollama additionally supports signed local-daemon cloud routing and direct cloud API keys.
Included-only daemon admission requires positive included allowance and no purchased balance;
automatic paid top-ups remain an account setting. Gemini explicitly enforces native
`billing.overageStrategy: never`. These vendor controls supplement the common connection policy.

## Alternatives

Direct extraction/replay of native OAuth tokens or private browser endpoints would duplicate
credential lifecycle and does not establish included-only billing. The Hermes Anthropic OAuth
route documented today requires additional credits. OpenAI's registered SIWC path is a possible
separate official adapter, subject to its eligibility and preview contract.

## Verification and rollout

Schema and Node conformance tests block malformed configuration, cross-mode routing, unverified
account identity, quota failures, missing completions, oversized output and unbounded secret
resolution. Native process fixtures exercise environment/configuration isolation and cleanup.
Real gateway smokes passed for Claude Max, ChatGPT/Codex and Ollama local after compatibility
fixes in the owning HSEOS driver package. Gemini 0.68.0 catalog retrieval succeeded, but headless
inference returned `auth_required`; the owner explicitly instructed recording that pending
validation and proceeding. Ollama cloud and API-key protocols have fixture evidence only.
Remote billing ledgers and tenant isolation still require deployment evidence.
Additional stack projections and registered SIWC are not delivered by this initial Node change.

Publish only through the owning package's existing release gate after review. There are no
published-version or consumer-adoption edges. Roll back by removing named connection registration
from application composition; existing consumers and existing AI contracts are unchanged.

Governing references: HSEOS Constitution §2.6; Platform Capability Governance Standard;
Hexagonal & Clean Architecture Standard; SOLID Principles & Software Craftsmanship Standard;
producer distribution `25e673ff9c7e9dee99ef88a554cc9144d99c5b40`.

Canonical strategic approval is tracked in ECP
[Decision 0017](https://github.com/HideakiSolutions/enterprise-capability-platform/blob/1dbbbd1964138b7fb41cb14a0f99f8792600fca1/documentation/decisions/0017-ai-provider-access.md) (approved by the owner). This local draft
does not approve that decision. The former AI identifier
[Decision 0016 at ECP `23a4ffb`](https://github.com/HideakiSolutions/enterprise-capability-platform/blob/23a4ffb1f4b7708ef03b38f6c2e91e3fd5fecbfd/documentation/decisions/0016-ai-provider-access.md)
is retained as historical provenance; the original decision body and owner
approval are preserved by the ECP rename, not replaced by this local proposal. The two stack adapters and their tests are not
two consumers. The reference banking Copilot is one planned real consumer.

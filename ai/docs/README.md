# AI

Cross-cutting **AI capability contracts** for the platform. Per workspace
ADR-0003 (external workspace precedent, not versioned in this repository), the legacy AI
contracts remain in this lane. ECP Decision 0006 owns the canonical provider-access library;
backend-core supplies its stack projections.


## Contracts

- `contracts/{provider-connection,inference-request,inference-response,provider-error}.schema.json` —
  compatibility aliases for ECP `ai.provider-access@0.1.0`, backed by a hash-verified candidate snapshot. See [provider access](provider-access.md)
  for research, billing semantics, adapters and verification boundaries.

- `contracts/token-usage.schema.json` — per-call LLM token usage and cost (cost in integer
  **micro-units** to avoid float drift). Source of truth for AI telemetry and cost governance;
  the first package is `Hideakisolutions.Platform.Ai.TokenMetering`.
- `contracts/guardrail-result.schema.json` — the result shape of an input/output guardrail
  (allow/block/redact/flag). The critical missing AI governance surface; gives services one shape to
  converge on before a shared runtime package exists.

## Principles

- AI usage is observable, auditable and cost-attributable (`tenant_id`, `correlation_id`, `agent`).
- Guardrails (input + output) are first-class; no AI capability ships without a guardrail decision path.
- Token cost is integer-only (micro-units) — never floating point — to keep billing exact.

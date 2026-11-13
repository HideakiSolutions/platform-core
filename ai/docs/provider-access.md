# Provider access: subscriptions, API and local inference

Status: source implementation with live smoke evidence; graph lifecycle remains proposed pending
release/consumer adoption. ECP `ai.provider-access@0.1.0` owns the canonical provider contracts;
`platform-core` preserves compatibility aliases and backend-core owns stack adapters. No HSEOS installation/adoption change.

| Vendor | Subscription account | API key | Local |
|---|---|---|---|
| OpenAI | Native Codex, ChatGPT login | Responses API, separately billed | — |
| Anthropic | Native Claude Code, claude.ai login | Messages API, separately billed | — |
| Google | Native Gemini CLI, cached Google login | Gemini generateContent, separately billed | — |
| Ollama | Signed-in local daemon, allowlisted cloud tags, included balance preflight | Direct cloud `/api/chat` with API key | Native `/api/chat`, allowlisted local models |

`provider-connection.schema.json` separates vendor from access mode. Applications select a
named connection explicitly. Authentication failure or exhausted subscription quota returns an
error; it never selects a paid API connection automatically. `inference-request.schema.json`
defines the provider-neutral conversation. Existing `token-usage` and `guardrail-result`
contracts retain ownership of telemetry and policy decisions.

Subscription usage still consumes the plan's included quota. `included_usage_only: true`
records an operator's confirmation that native account overage/additional credits are disabled.
It is not an independent billing attestation: an adapter cannot disable account billing settings
through these native interfaces. Do not advertise unlimited or guaranteed zero-cost inference.
Ollama loopback is insufficient to prove local execution because its daemon can route cloud
models. Configure the daemon with cloud disabled and supply a deployment-owned local model
allowlist. The adapter rejects cloud model suffixes and non-loopback hosts.

For native Ollama cloud subscription routing, require `cloud_models`, `included_usage_only: true`
and a loopback daemon. Its signed `/api/balance` response must show included allowance remaining
and zero purchased balance before the inference POST. Missing/malformed balance, exhausted
allowance or purchased credits fail closed. This snapshot does not reserve quota atomically;
automatic paid top-ups must remain disabled. Direct Ollama cloud API uses a separate API-key
connection and never participates in subscription fallback. Current cloud plans use included
monthly usage credits, so "no API key" does not mean a credit-free cloud product.

## Verified research, 2026-11-13

- [Hermes provider documentation](https://hermes-agent.nousresearch.com/docs/integrations/providers/)
  documents device-code ChatGPT OAuth, API keys and OpenAI-compatible local endpoints. Its
  Anthropic OAuth description explicitly requires Max plus extra usage credits; Gemini's direct
  provider requires an API key. These routes do not establish the requested included-only behavior.
- [OpenCode providers](https://opencode.ai/docs/providers/) documents ChatGPT account login.
  Authentication and plan quotas are distinct from the existence of a model adapter.
- [OpenAI authentication](https://learn.chatgpt.com/docs/auth) distinguishes ChatGPT login from
  API-key billing. The native client owns login, refresh and credential persistence.
- [Claude authentication](https://code.claude.com/docs/en/authentication) and
  [programmatic execution](https://code.claude.com/docs/en/headless) describe native account
  access and noninteractive runs. Environment keys can override subscription login.
- [Gemini authentication](https://geminicli.com/docs/get-started/authentication/) documents
  Google login and reuse of cached authentication in headless mode.
  [Native configuration](https://geminicli.com/docs/reference/configuration/) provides system
  overrides, enforced authentication, tool allowlists and customization controls.
- [Ollama chat](https://docs.ollama.com/api/chat) provides local HTTP chat;
  [cloud routing](https://docs.ollama.com/cloud) must be considered separately.
  [Authentication](https://docs.ollama.com/api/authentication) documents native sign-in and direct
  API keys. [Balance](https://docs.ollama.com/api/balance) defines included versus purchased
  credits; local daemon proxy signing is implemented by the official server's BalanceHandler.

OpenAI also documents [Sign in with ChatGPT for local/OSS applications](https://developers.openai.com/siwc/token-sharing-open-source).
That registered OAuth integration is a distinct extension; the current implementation delegates
account handling to Codex instead. It does not copy native CLI tokens into private web endpoints.

## Governance discovery and reuse

Producer: HSEOS distribution `25e673ff9c7e9dee99ef88a554cc9144d99c5b40`.
Read `.enterprise/.specs/core/_INDEX.md`, Constitution §2.6, Platform Capability Governance,
Hexagonal/Clean Architecture and SOLID standards. Queried
`.enterprise/governance/capabilities/registry.yaml`, its local enterprise fragment and this
repository's `.platform/capability-graph.fragment.json` for AI, providers, subscriptions and
token usage. The pinned federation entries point to other revisions; full remote composition
has not been verified. AEW consumer activation is also not verified.

Inspected producer `packages/model-providers` and `packages/runtime-providers`. The former is
a streaming kernel port, not this billing/configuration surface. Reuse the latter's existing
`ClaudeCliDriver` and `CodexAppServerDriver` through composition instead of duplicating their
native transports. Gemini's headless adapter is an extension in the owning backend lane.
Native tests exposed producer defects: Claude 2.1.323 sends passive `system/ui_invalidate` before
init, the Claude environment omitted TMPDIR, and Codex failed to close pre-session connections.
Corrections and regressions are isolated on HSEOS `task/provider-native-compat`; the exact runtime
patch is retained in backend-core/node/compat/hseos-runtime-providers-25e673ff.patch. Global HSEOS
installation/configuration remains unchanged. The public npm registry currently returns 404 for
`@hseos/runtime-providers@1.0.0`; do not claim a published dependency is available there.

## Verification and outstanding evidence

Deterministic gates: strict schema validation, Node typecheck/build, adapter fixtures, native
process fixture for Gemini, billing-mode rejection, quota/error handling, secret resolution
timeout, account inspection timeout, guardrails and metadata-only audits.

Live platform gateway smokes passed for Claude Max (`haiku`, native 2.1.323), ChatGPT/Codex
(`gpt-6-luna`, native 0.167.2) and local Ollama (`qwen2.5:7b`): each returned `OK` and usage.
The owner explicitly confirmed extra usage disabled for Claude and ChatGPT/Codex. Codex also
requires native backend `ordinaryUsageAllowed === true`; missing permission fails closed.
These are account-setting confirmations and live routing evidence, not an independent billing
ledger audit or an atomic quota reservation.

Gemini 0.68.0 was installed and its model catalog read successfully. After the owner's login,
the headless platform smoke returned `auth_required`. The owner explicitly directed leaving this
as a pending validation and proceeding. Native keychain metadata is accepted; authentication is
still performed by the CLI, and system `billing.overageStrategy: never` prevents credit overage.
No further Gemini inference attempts are planned for this delivery.

Still unverified: Ollama cloud account smoke, API-key live inference, native remote billing ledger,
additional stack projections, published package installation and consumer adoption. Proposed
graph status remains until release/adoption evidence is reviewed. See backend-core's verification
record for exact local commands and smoke correlation IDs.

## Canonical contract migration — candidate delivery

ECP `capabilities/ai.provider-access` now defines the library connection, request,
response and safe error shapes. The `platform-core/ai/*` identifiers remain
compatibility stubs. `.platform/ecp/ai.provider-access.lock.json` pins the vendored
candidate schemas; `scripts/validate-contracts.mjs` rejects missing/changed bytes.
The real intake is `governance/intakes/ai.provider-access.json`; the strategic
promotion decision is ECP `documentation/decisions/0016-ai-provider-access.md`.
The intake v2 owner enum now explicitly admits `enterprise-capability-platform`;
the actual record identifies ECP as canonical owner and backend-core as projection source.

The federated capability and contracts move to the ECP fragment, preserving their
identifiers. No second capability owner is retained in the platform-core fragment.
Candidate discovery, publication, verified installation and actual adoption are
independent evidence. None is inferred from these compatibility stubs.

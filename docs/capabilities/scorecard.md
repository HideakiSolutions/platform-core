# Capability scorecard

> GENERATED FILE. Do not edit. Regenerate with `npm run generate:scorecard`; `npm run validate` fails when this file is stale.
> This is a read-only projection, **not a registry** and it adds **no status field**: the facts live in
> `docs/architecture/contract-authority/capability-authority.csv`, `docs/architecture/contract-authority/ecp-pin.json`,
> `docs/release/release-ledger.json` and `.platform/capability-graph.fragment.json`. Where they disagree with this file, they win.

- ECP pin: `contracts-v0.4.0` (`ab1fcc92797224c428ec6362e02ee1eaf2de8abb`). The scorecard never changes the pin.
- Ledger releases recorded: 0. Capabilities with a release: 0 of 39.
- Owner `not_verified`: 37 of 39. An owner is shown only when the capability graph fragment maps the contract to an Owner node; ECP rows never copy private owner data.

Columns. **Version**: the ECP pinned version for `ecp-canonical`; otherwise the ledger `contractVersion` when a release exists, else `-`.
**Derived state**: the highest state the ledger evidence supports (never a declared value), or `no release recorded`. **Evidence**: distinct evidence refs across the capability's releases.
**Blocked reason**: for a capability with a release, what is missing for its next state; otherwise why nothing is recorded. It is computed, not written.

| Capability | Classification | Canonical source | Version | Derived state | Evidence | Owner | Blocked reason |
|---|---|---|---|---|---|---|---|
| ai/guardrail-result | core-canonical | platform-core:ai/contracts/guardrail-result.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| ai/mcp-tool-descriptor | core-canonical | platform-core:ai/contracts/mcp-tool-descriptor.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| ai/token-usage | core-canonical | platform-core:ai/contracts/token-usage.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| approval/approval-request | core-canonical | platform-core:approval/contracts/approval-request.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| audit/audit-chain-jcs/v1 | unknown | - | - | no release recorded | 0 | not_verified | classification unknown: no settled authority, cannot go beyond candidate |
| audit/audit-event | unknown | - | - | no release recorded | 0 | not_verified | classification unknown: no settled authority, cannot go beyond candidate |
| auth.authenticate | ecp-canonical | ecp:auth.authenticate@0.1.0 | 0.1.0 | no release recorded | 0 | not_verified | no release recorded |
| auth/auth-provider | compatibility | ecp:security.authn@0.1.0 | - | no release recorded | 0 | not_verified | compatibility stub; not releasable, authority is ecp:security.authn@0.1.0 |
| authorization/decision | core-canonical | platform-core:authorization/contracts/decision.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| cache.typed | ecp-canonical | ecp:cache.typed@0.1.0 | 0.1.0 | no release recorded | 0 | not_verified | no release recorded |
| calendar.event.create | ecp-canonical | ecp:calendar.event.create@0.1.0 | 0.1.0 | no release recorded | 0 | not_verified | no release recorded |
| configuration/config-provider | core-canonical | platform-core:configuration/contracts/config-provider.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| data.query | ecp-canonical | ecp:data.query@0.1.0 | 0.1.0 | no release recorded | 0 | not_verified | no release recorded |
| data/data-contract | core-canonical | platform-core:data/contracts/data-contract.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| design.login-pattern | ecp-canonical | ecp:design.login-pattern@0.1.0 | 0.1.0 | no release recorded | 0 | not_verified | no release recorded |
| design.mobile-tokens | ecp-canonical | ecp:design.mobile-tokens@0.1.0 | 0.1.0 | no release recorded | 0 | not_verified | no release recorded |
| directory/membership | core-canonical | platform-core:directory/contracts/membership.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| directory/org-node | core-canonical | platform-core:directory/contracts/org-node.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| drive.file.upload | ecp-canonical | ecp:drive.file.upload@0.1.0 | 0.1.0 | no release recorded | 0 | not_verified | no release recorded |
| feature-flags/feature-flag | core-canonical | platform-core:feature-flags/contracts/feature-flag.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| governance/capability-intake | core-canonical | platform-core:governance/contracts/capability-intake.schema.json | - | no release recorded | 0 | Platform Architecture Owners | no release recorded |
| governance/capability-intake/v2 | core-canonical | platform-core:governance/contracts/capability-intake-v2.schema.json | - | no release recorded | 0 | Platform Architecture Owners | no release recorded |
| llm.generate | ecp-canonical | ecp:llm.generate@0.1.0 | 0.1.0 | no release recorded | 0 | not_verified | no release recorded |
| logging/log-entry | unknown | - | - | no release recorded | 0 | not_verified | classification unknown: no settled authority, cannot go beyond candidate |
| mcp.invoke | ecp-canonical | ecp:mcp.invoke@0.1.0 | 0.1.0 | no release recorded | 0 | not_verified | no release recorded |
| messaging.event-envelope | ecp-canonical | ecp:messaging.event-envelope@0.1.0 | 0.1.0 | no release recorded | 0 | not_verified | no release recorded |
| messaging/delivery-lease/v1 | unknown | - | - | no release recorded | 0 | not_verified | classification unknown: no settled authority, cannot go beyond candidate |
| messaging/event-envelope | compatibility | ecp:messaging.event-envelope@0.1.0 | - | no release recorded | 0 | not_verified | compatibility stub; not releasable, authority is ecp:messaging.event-envelope@0.1.0 |
| multi-tenancy/tenant-context | core-canonical | platform-core:multi-tenancy/contracts/tenant-context.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| notification.send | ecp-canonical | ecp:notification.send@0.1.0 | 0.1.0 | no release recorded | 0 | not_verified | no release recorded |
| notifications/delivery-result | core-canonical | platform-core:notifications/contracts/delivery-result.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| notifications/notification-intent | core-canonical | platform-core:notifications/contracts/notification-intent.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| observability/health-check | unknown | - | - | no release recorded | 0 | not_verified | classification unknown: no settled authority, cannot go beyond candidate |
| secrets/secret-reference | core-canonical | platform-core:secrets/contracts/secret-reference.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| security.authn | ecp-canonical | ecp:security.authn@0.1.0 | 0.1.0 | no release recorded | 0 | not_verified | no release recorded |
| security/security-headers | core-canonical | platform-core:security/contracts/security-headers.schema.json | - | no release recorded | 0 | not_verified | no release recorded |
| telemetry.publish | ecp-canonical | ecp:telemetry.publish@0.1.0 | 0.1.0 | no release recorded | 0 | not_verified | no release recorded |
| utils | unknown | - | - | no release recorded | 0 | not_verified | classification unknown: no settled authority, cannot go beyond candidate |
| workflow.execute | ecp-canonical | ecp:workflow.execute@0.1.0 | 0.1.0 | no release recorded | 0 | not_verified | no release recorded |

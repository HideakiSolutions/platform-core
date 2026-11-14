# Componentes SRM e superfícies adicionais

Matriz de rastreabilidade, sem transformar aceite histórico em novo smoke. Os estados remotos atuais estão em [consolidação integrada](consolidation.md).

| Origem SRM | Intake registrado | Contrato governante | Implementação histórica | Publicação / adoção |
| --- | --- | --- | --- | --- |
| shared-kernel | extend | utils + existing Result/TimeProvider | verified | not-published / not-claimed |
| config | extend | configuration/config-provider | verified | not-published / not-claimed |
| logger | extend | logging/log-entry (authority unknown) | verified | not-published / not-claimed |
| observability | extend | observability/health-check (authority unknown); OTel extension | verified | not-published / not-claimed |
| audit | extend | audit/audit-event; JCS authority unknown | verified | not-published / not-claimed |
| approvals | extend | approval/approval-request | verified | not-published / not-claimed |
| rbac | extend | authorization/decision | verified | not-published / not-claimed |
| abac | extend | authorization/decision | verified | not-published / not-claimed |
| authz | extend | authorization/decision | verified | not-published / not-claimed |
| entra-auth | extend | ecp:security.authn@0.1.0 | verified | not-published / not-claimed |
| entra-graph | extend | directory/org-node + directory/membership | verified | not-published / not-claimed |
| mfa | extend | ecp:security.authn + authorization step_up_auth | verified | not-published / not-claimed |
| notifications | extend | notifications intent/result distinct from ecp:notification.send | verified | not-published / not-claimed |
| jira | promotion-proposal | ECP workitem.query@0.1.0 and workitem.command@0.1.0; admitted local surface in contracts bundle 0.6.0; unpublished | verified | not-published / not-claimed |
| ui-kit | extend | Helix existing primitives/forms/layout/feedback | verified | not-published / not-claimed |
| login-ui | extend | ecp:design.login-pattern@0.1.0 | verified | not-published / not-claimed |
| sample-app | reference-scenarios | composition only, no source runtime copied | verified | not-published / not-claimed |

Os caminhos de implementação dos 17 pacotes foram conferidos no filesystem. Os 120 módulos de origem e seis autoridades desconhecidas são preservados. Paths, limites por componente e digests estão em [component-matrix.json](component-matrix.json).

## Superfícies adicionais e revisão

- **ai.provider-access@0.1.0** — Union with upstream PR58/backend PR96; same schemas and native provider runtime reused. ADR AI0017 renumbered with approved body preserved; source-only bindings do not publish packages.

- **workitem.query / workitem.command@0.1.0** — Owner-accepted local admission0.6; one Jira engine/provider; canonical and explicit draft profiles retain separate journal/fingerprint namespaces.

- **SQS adapters and inbox acquisition** — Header propagation and typed terminal mismatch handling fixed; local source/installed regressions PASS. Focused real SDK emulator test passed in both directions with four headers and independently confirmed cleanup; inbox in memory. Historical durable scenarios are not inferred as rerun.

- **Identity SAML / PKCE / TOTP** — Original real shared-Keycloak proofs remain bound to historical packages; no new IdP production test claimed by consolidation.

- **Checkbox / LoginProviderActions** — Existing Checkbox integrated by ancestry, no repeated changeset; Storybook aliases and governed presentation-helper coverage exception passed PR112 CI.

- **JVM historical package provenance** — Retired historical source identity, not a current SDK. Strict existing helper validates exact package, immutable source hashes and absence of current paths/publication/adoption. Final union changes only governance/metadata inputs.

- **Deprecated event-envelope graph identities** — Upstream PR43 retains historical graph identities for compatibility, without changing active runtimes, global contract pin or six unknown authorities.

As cinco correções do backend, as validações instaladas e os gates focados posteriores são separados por revisão nos receipts. Jira escrita e novos smokes externos Graph/Teams continuam dispensados, nunca PASS. Graph/Teams/Jira doubles da jornada anterior continuam identificados.

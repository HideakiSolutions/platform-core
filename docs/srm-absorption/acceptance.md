# Executable delivery criteria

All additions remain experimental until their own admission requirements are met.
The implementation user request authorizes isolated work and verification. It does
not authorize publishing, merging, deploying, changing contract ownership or
asserting customer adoption.

## Scope and compatibility

Extend the owning existing package/engine/port. Keycloak remains the default;
local policy, direct SAML and transactional MFA are optional composition choices.
Use TimeProvider and the existing Result in .NET. Node ports must not expose Pino,
Zod, AWS, SAML or OpenTelemetry SDK types. Provider service implementations exist
once in ECP; clients map the distinct core and ECP envelopes explicitly.

Retain wire field names/enums. Security behavior changes in experimental Node
surfaces use an explicit experimental package revision and migration documentation.
No ZIP `.env`, avatars, brand, demo policy or singleton runtime is delivered.

## Required checks

1. Compile/typecheck/lint and focused regression tests for each changed package.
2. Common positive/negative fixtures across stacks (authorization, directory,
   MFA context hashes and signed SAML fixtures).
3. Pack/install in isolated consumers; local tarballs/NuGets demonstrate installation
   compatibility, not registry publication or adoption.
4. Applicable dependency/secret/static checks without weakening policy.
5. Independent skeptical review: blind pass, claims/evidence confrontation, corrections
   owned by executor, at most three rounds before diagnostic/change of approach.
6. Identified shared/test service smokes, preserving live evidence independently
   from mocks and source tests. An unavailable required live target is BLOCKED, not PASS. The three owner-accepted dispensations below are distinct WAIVED decisions, never live PASS.

## Negative regression mapping

| Reproduced ZIP behavior | Deterministic regression |
|---|---|
| JWT with no expiry accepted | Node `test/srm-session.test.ts`; required claims/context, optional application session |
| Unknown RBAC route allowed | Shared local authorization fixture; default deny |
| Bearer token sent to arbitrary Graph origin | Node `test/directory-graph.test.ts`, .NET Graph tests; hostile nextLink denied before token |
| OTP accepted twice concurrently | Node MFA tests plus shared Redis multi-process smoke; .NET installed consumer concurrent20 |
| Stateful global RegExp alternates decision | Local authorization repeated-predicate fixture/tests |
| Zero approval threshold immediately approved | Existing engine validation tests in both stacks |

## Live evidence and unresolved gates

Receipts live under `/build/artifacts/srm-absorption/evidence/` and are tied to the
actual source/package state tested. Their path is not a publication claim.

- PostgreSQL Jira journal: eight processes, one claim, restart, plan conflict,
  uncertainty handling; disposable schema removed.
- PostgreSQL approval: eight processes, one CAS winner, durable audit/execution
  enqueue, outbox fencing, atomic rollback; verified TLS; disposable schema removed.
- Redis Node: eight-process OTP and four-process TOTP, expiry, attempts, context and
  cooldown; owned keys removed. .NET installed consumer: concurrent20 each, one winner,
  verified custom CA/SNI; residual keys expire within120s.
- SMTP: identified shared Mailpit, verified TLS/auth, synthetic `.invalid` recipient,
  run `198ee8b5-fe49-4567-a741-1b35d62c0b99` accepted. No external mailbox used.
- Installed work-item clients: real loopback HTTP + shared PostgreSQL with **recording
  Jira double**. Both stacks reuse one creation; Node partial backlog resumes through
  .NET; estimate and actual-work remain distinct; all dry-runs have zero provider/journal
  effects; audit context persists and forced audit failure rolls back journal begin.
  Receipt `evidence/work-items-installed-http-postgres.json`. This is not live Jira.
- Jira real: `cambio-real/jira-api-token` and `4smart/confluence-api-token` both passed
  provider and neutral get/search/transitions checks, GET-only with zero mutations.
  Receipts `evidence/jira-live-readonly-cambioreal.json` and
  `evidence/jira-live-readonly-4smart.json`; initial failed projections are retained as
  `*-attempt1.json`. Missing nested parent project was diagnosed independently and
  resolved through an authorized bounded metadata GET with exact identity/project checks.
  No command/write smoke is authorized or claimed.
- Revised owner plan explicitly waives new Graph/Teams external smokes and Jira
  writes, with productive origin of Graph/Teams **reported by the owner**. No new
  production validation is claimed. Decisions are pinned in acceptance-decisions.json.
- SQS must use an ephemeral digest-pinned LocalStack with installed .NET/Node
  consumers and cleanup; this is emulator integration, not managed AWS.
- Identity must use the shared Keycloak with an exclusive disposable realm and
  real PKCE, TOTP step-up, signed SAML and replay/correlation checks. This is not waived.
- The integrated reference journey must connect authenticated context/authorization,
  SQS, durable PostgreSQL, Redis and Mailpit. Separate smokes alone cannot prove it.
- Canonical work-item contracts are locally registered after explicit owner
  acceptance of strategic ADR0016. Catalog implementation metadata stays planned
  until publication/HTTPS CI evidence under Decision0013; local implementation
  and installation remain recorded in supplemental evidence. Gateway/default
  dispatch remain optional and work-item execution is not publicly exposed.

The live PostgreSQL port-forward reset is tracked in INFRA-0034; the documented
LAN NodePort is the successful mitigation. The frontend frozen-install issue is
tracked in INFRA-0044: the final frozen install succeeded with cache/supply-chain
checks intact; remote private-registry credentials were not causally verified.

## Rollback and handoff

Remove only explicit experimental composition/package references. Existing APIs
remain available. Drain SQS consumers before removing adapters. Preserve durable
approval/journal/outbox records until their owners reconcile uncertain effects;
never reset them to manufacture a retry. Schema migration is an application-owned,
reviewed action; libraries do not create shared database services at startup.

A final delivery report must state implementation, publication, installation and
adoption separately, list failed/blocked acceptance gates, and reference source
revisions/package hashes. No overall completion claim until every matrix row and required gate is resolved.
Only the three explicit owner decisions can be WAIVED. Implementation, strategic
admission, publication and adoption are reported separately.

## Owner decisions and process conformance in this continuation

The owner instructed keeping current HSEOS configuration without installation.
ECP retains its existing adoption; no HSEOS install occurred in the cores. The
owner also authorized inclusion of exact marciohideaki@gmail.com in ECP's existing
allowed-author configuration in addition to @hideakisolutions.local (including admin).
The original gate failure is retained; no author identity was impersonated.

Identity harness development exceeded the three-round correction limit before an
independent diagnosis was recorded. This is a **process nonconformance**, not a
waived criterion or retroactive compliance. Ten attempts and their cleanup evidence
are retained. Independent review diagnosed bundling, selectors/actionability,
manual encoded TOTP seed and SAML role-list duplicate attributes; the adapter denied
duplicate attributes correctly. The changed approach preserves IdP protocol/MFA,
uses native submit/manual Base32 and an identity-only SAML client in the disposable
realm. It does not prove default Keycloak role mapping. Final receipts and review
must distinguish functional results from this process deviation.

## Autorização explícita de admissão e fechamento excepcional

O proprietário respondeu “Autorizado!” à pergunta que solicitou conjuntamente o
aceite da ADR0016 e autorização de fechamento excepcional desta entrega com o
desvio registrado. O registro ECP `proposals/work-items/owner-acceptance.json`
preserva a instrução literal, escopo e digest da ADR revisada. O histórico continua
NONCONFORMANT; o gate específico recebe ACCEPTED_EXCEPTION, exige aprovação
vinculada por hash e não conta como teste aprovado ou dispensa de outro requisito.
A exceção vale só para esta entrega, sem alterar a política geral.

Admissão local: capabilities workitem.query/command0.1.0, contracts/VERSION0.6.0,
registry25 e coverage regenerados; compatibilidade e policy de implementações
verificadas. Implementações planned continuam separando prova de instalação local
de publicação/CI HTTPS. Gateway/CLI/MCP não expõem execução desses contratos.
Publicação, release, merge, deploy e adoção continuam separados e não executados.

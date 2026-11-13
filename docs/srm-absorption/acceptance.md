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
   from mocks and source tests. An unavailable live target is BLOCKED, not PASS.

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
- Graph/Jira/Teams/SQS/IdP: credentials may exist in pass, but those test targets are
  not yet identified for this execution. Do not infer permission for a customer
  tenant, Jira project, external recipient or channel merely from a credential name.

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
revisions/package hashes. No overall completion claim until every matrix row and
required live gate has passed.

# Capability maturity

Single table of maturity per capability in this repository. Each cell is derived from files in the repository at the time of writing; anything not evidenced is marked **NOT VERIFIED**. A contract existing here does not imply a reference implementation, a durable implementation, publication or product adoption.

Columns: **Contract** (schema/behavioral doc in this repo) | **In-memory reference** | **Durable** | **Adopted** | **BLOCKED / NOT VERIFIED**.

| Capability | Contract | In-memory reference | Durable | Adopted | BLOCKED / NOT VERIFIED |
|---|---|---|---|---|---|
| messaging / event-envelope | Deprecation stub; authority is ECP `messaging.event-envelope@0.1.0` | n/a (ECP vectors) | n/a | NOT VERIFIED | Adoption by products not evidenced here |
| messaging / delivery-lease v1 (ADR-012, `delivery-v1.md`) | **Proposed**, not admitted (schema `delivery-lease-v1.schema.json`) | Corpus and `scripts/test-delivery-leases.mjs` exercise the lease state machine only (profile `lease-state-machine-reference-only`) | No: every row of `messaging/conformance/delivery-v1/durable-matrix.json` is BLOCKED (no adapter evidence) | No | BLOCKED: durable adapters, crash/rollback and concurrency proofs, graph admission, ownership |
| audit / event (legacy schema) | Active (`audit-event.schema.json`) | .NET and Go implementations are referenced in the module README; not verified here | NOT VERIFIED | NOT VERIFIED | Append-only and tamper-evidence depend on external controls (see ADR-011) |
| audit / retention 2.0.0 (ADR-011) | Behavioral profile **accepted** by the owner on 2026-10-14 | NOT VERIFIED | NOT VERIFIED | No | Provider conformance, consumer admission, migration and retirement-authority admission still required; no PII composition admitted |
| audit / JCS v1 (ADR-013, `jcs-v1.md`) | **Proposed**, not admitted (`audit-chain-jcs-v1.schema.json`) | Two internal reference oracles (`audit/conformance/jcs-v1`), 33 pinned cases | No implementation certified for .NET, Go or Rust | No | BLOCKED: owner acceptance, graph registration/admission, interoperability and installed-artifact proof |
| auth / auth-provider | Deprecation stub; authority is ECP `security.authn@0.1.0` | n/a (ECP vectors) | n/a | NOT VERIFIED | Not normative in this repository |
| governance / capability-intake (v1, v2) | Active | Validated by `scripts/validate-contracts.mjs` fixtures | n/a | NOT VERIFIED | |
| ai, approval, authorization, configuration, data, directory, feature-flags, logging, multi-tenancy, notifications, observability, secrets, security | Active JSON Schema contract in each module | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Maturity beyond the contract was not assessed |
| utils | No contract (docs only) | n/a | n/a | n/a | |

Sources: [ADR-011](adr/ADR-011-audit-retention-authority.md), [ADR-012](adr/ADR-012-delivery-lease-protocol-proposal.md), [ADR-013](adr/ADR-013-audit-jcs-profile.md), [delivery-v1](../messaging/docs/delivery-v1.md), [jcs-v1](../audit/docs/jcs-v1.md), the [normalization program records](implementation/core-normalization/_INDEX.md) and the module READMEs. Observation of sources does not prove conformance, installation or adoption.

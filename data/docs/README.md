# Data

Canonical **data contract** for the platform. `contracts/data-contract.schema.json` makes a dataset a
governed asset: owner, classification, schema, SLA, field-level PII flags and lineage.

This is the first step toward the data-governance surface the audit found missing (no data catalog,
contracts, lineage or CDC). It is contract-first: the schema lands now; tooling/packages (catalog
registration, lineage capture, CDC) follow.

## Principles

- Every shared dataset has an owner and a classification (public / internal / confidential / restricted).
- PII is declared at field level; downstream masking/retention policies key off it.
- Lineage (`sources`) is declared so impact and provenance are traceable.

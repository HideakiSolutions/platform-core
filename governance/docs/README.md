# Capability governance

This module defines the mandatory intake contract for cross-cutting capabilities.
It turns Platform-first from a convention into a reviewable, machine-validatable
decision before implementation begins.

The decision order is:

1. query the federated Platform Capability Graph exactly by capability, contract,
   package and owner;
2. run semantic discovery for adjacent or duplicate capabilities, recording
   `unavailable` explicitly when the index cannot be reached;
3. consume an immutable, verified package when one exists;
4. extend through the documented port or adapter boundary;
5. promote to the owning core when two consumers need the same primitive, or an
   accepted strategic ADR justifies earlier promotion;
6. keep product or provider semantics local only with a reviewable, expiring
   approval record;
7. use an exception only with an explicit, expiring approval reference.

Every record must identify deterministic verification, rollback, failure mode and
risk domains. Publication, product adoption, security-policy changes, migrations,
deployments and external writes remain separately human-gated.

`capability-intake-v2.schema.json` is the active contract. It requires exact graph
query evidence, semantic discovery evidence, and a graph-update plan for promotion.
The v1 schema remains only for compatibility and is deprecated by the repository's
`.platform/capability-graph.fragment.json`.

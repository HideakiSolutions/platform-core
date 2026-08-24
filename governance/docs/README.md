# Capability governance

This module defines the mandatory intake contract for cross-cutting capabilities.
It turns Platform-first from a convention into a reviewable, machine-validatable
decision before implementation begins.

The decision order is:

1. query the platform capability registry;
2. consume an immutable, verified package when one exists;
3. extend through the documented port or adapter boundary;
4. promote to the owning core when two consumers need the same primitive, or an
   accepted strategic ADR justifies earlier promotion;
5. keep product or provider semantics local when they are not transversal;
6. use an exception only with an explicit approval reference.

Every record must identify deterministic verification, rollback, failure mode and
risk domains. Publication, product adoption, security-policy changes, migrations,
deployments and external writes remain separately human-gated.


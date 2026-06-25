# Multi-Tenancy

Canonical **tenant context** contract for the platform. `contracts/tenant-context.schema.json`
defines the ambient tenant identity carried through a request, used to enforce isolation.

## Principles

- **DB-enforced isolation is the goal** (Postgres Row-Level Security via `SET app.tenant_id`),
  proven by `events-platform` — application-layer `WHERE tenant_id = ` is a weaker fallback.
- Tenant context flows with the request (ambient accessor) and is set on the DB connection per
  transaction, never passed ad hoc.
- The first package is `Hideakisolutions.Platform.MultiTenancy` (.NET): `TenantContext`,
  `ITenantContextAccessor`, and an RLS helper that emits the `SET LOCAL app.tenant_id` parameter.

## Reference

`events-platform` `RlsDbConnectionInterceptor` + `RlsIsolationTests` (DB-enforced cross-tenant block).

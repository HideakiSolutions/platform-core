# ADR-004: Multi-Tenancy

## Status

Proposed

## Context

SRM Banking platform may serve multiple tenants (brands, white-label partners, internal business units). The authentication and data access layers need a consistent approach to tenant isolation without requiring separate infrastructure per tenant.

## Decision

The platform-core auth contract includes an optional `tenant_id` claim in JWT token payloads. Services extract tenant context from the JWT on each request. Data isolation is achieved via row-level security using a `tenant_id` column in tenant-scoped tables. Feature flags support tenant-scoped evaluation, allowing features to be enabled or disabled per tenant. When `tenant_id` is absent, the system operates in single-tenant mode with no behavioral change.

## Consequences

- Tenant isolation is enforced at the data layer, reducing the risk of cross-tenant data leaks
- Single-tenant deployments work without modification since `tenant_id` is optional
- Row-level security adds query overhead and requires careful indexing
- All new tables with tenant-scoped data must include the `tenant_id` column from the start
- Feature flag infrastructure must support tenant-scoped rules in addition to global and user-scoped rules
- Migration from single-tenant to multi-tenant requires backfilling `tenant_id` on existing data

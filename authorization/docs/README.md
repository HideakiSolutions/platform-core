# Authorization contracts

Engine-neutral authorization decision contracts for RBAC, ABAC and ReBAC. Product
policy, obligations and enforcement remain owned by the consuming boundary.

## Bridge to `auth/`

`decision.schema.json#properties.request.properties.subject.properties.roles`
is normally populated from `../../auth/contracts/token-verifier.schema.json#properties.verify.properties.output.properties.roles`
(the Principal produced when verifying the caller's bearer token). When a
decision's `result.obligations[]` includes `type: "step_up_auth"`, the caller
enforces it via `../../auth/contracts/auth-provider.schema.json#properties.authenticate` —
retry with `acr_values` set from the obligation's `detail`. See
`docs/intents/0001-auth-authorization-bridge.md` at the repo root.


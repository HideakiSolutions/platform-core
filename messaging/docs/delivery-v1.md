# Delivery leases v1 — proposed behavioral contract

Contract `platform-core/messaging/delivery-lease/v1`, version `1.0.0`, is a proposed
extension boundary for Outbox/Inbox coordination. It is not an envelope replacement,
a durable adapter, an admitted graph capability or an exactly-once claim.
The ECP authority remains `messaging.event-envelope@0.1.0`; its legacy platform stub
is unchanged. See [ADR-012](../../docs/adr/ADR-012-delivery-lease-protocol-proposal.md).

## Identity and immutable bytes

Deduplication identity is the ordinal tuple `(tenant, consumer, message_id)`. Tenant
provenance must be verified at authenticated ingress; propagation is explicit for
each request/message. Core does not invent a default tenant or authorize business
operations. V1 identifiers use `[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}` and are never
trimmed or case-folded. Unsupported values fail explicitly; legacy identifiers and
readers retain their existing interfaces. Message ID is a nonempty UUID matching
the ECP envelope `event_id`. Adapters validate the full ECP schema at ingress.

`envelope_sha256` is lowercase SHA-256 of the exact immutable UTF-8 envelope bytes
persisted on first ingest, not a hash of a parsed/reserialized object. Redelivery
must retain those bytes. Different whitespace or extension fields produce a
different fingerprint. The store computes the digest from bytes; a producer's
unverified digest cannot override it. Mismatch for an existing identity fails
before returning duplicate, completed, terminal or busy. This contract does not
impose a second envelope schema or recalculate historical messages.

## Lease state machine

Store time is authoritative, UTC, with integer millisecond lease durations
`1..86400000`. A lease is current only when `now < expires_at` and the identity,
opaque acquisition token and monotonically increasing per-identity fence match.
Expiry is exclusive: at exactly `expires_at` renew/complete/fail reject the owner,
even before another worker claims. Caller expiry timestamps are hints, not authority.
An expired owner cannot modify an effect or message through a durable adapter.

- Claim atomically inserts or recovers one identity, returning `acquired` plus token,
  fence starting at 1, and expiry. Concurrent contenders receive `busy` while current.
- Renewal retains token/fence and sets expiry to `store_now + duration`.
- Completion changes processing to completed; completed redelivery is a duplicate.
- Failure records a bounded operational failure code, never payload/error secrets.
  A retryable failure is deferred until the application-supplied retry time; a
  terminal failure never reclaims. Terminal plus retry time is invalid.
- Recovery is a new claim at/after expiry or retry availability, with a new token
  and strictly larger fence. No separate reset may resurrect an old token.
- The application supplies `max_attempts` in `1..10000`, immutable for that identity.
  Attempts count successful acquisitions, including abandoned processing. After
  the last allowed attempt fails/expires, the identity becomes terminal. No extra
  acquisition is granted. Extending a budget requires a new explicit contract policy.

The corpus has 18 cases / 58 steps spanning positive, negative and compatibility
vectors. Fences are asserted separately from opaque tokens: each new identity starts
at 1 and each recovery increments that identity independently. Fractional renewal
durations and terminal failure plus retry time are explicit rejection vectors. Its clock starts at
an arbitrary UTC epoch; `now_ms` offsets are per-case monotonic. `payloads` contains
exact UTF-8 strings, named by claim steps; `message_id` is constant per isolated
case. Lease aliases are runner-local references to returned tokens. `legacy-surface`
characterizes the old one-consumer duplicate flow without pretending V1 had tenant,
transaction or durability guarantees.

## Transaction and broker boundaries

Outbox adapters persist domain fact and immutable envelope in the SAME transaction.
Only committed messages are claimable. Publish happens after commit; a confirmed
broker receipt must precede fenced dispatch completion. Crash after confirmation
may publish again; consumers deduplicate. The transaction context is explicit,
adapter-owned, and cannot be silently opened on another connection.

Inbox adapters persist deduplication identity, the business effect and completion
in ONE transaction. The versioned transactional port accepts a transaction-scoped
effect callback. It must check ownership before invoking the callback and again
at commit/through a held transactional ownership lock. Stale claim, callback
exception, cancellation or commit failure rolls back BOTH effect and completion.
A side effect outside that transaction requires its own idempotency or compensation.
The in-memory lease reference deliberately does not implement this transactional port.

RabbitMQ: publisher confirms plus unroutable/return handling; consumer ACK after
persistent commit. Kafka: confirmed publication and explicit partition/offset
handling; commit offsets after persistent effect commit. Ordering is declared per
key/partition; no global ordering or global exactly-once promise. Retry choice and
classification remain application decisions, with a bounded budget.

Durable adapters must retain fence generations and deduplication across restarts,
use transactionally isolated claims between processes, and reject stale owners at
all mutations. The process-local reference does not prove any of those properties.

## Evidence and observability

Expose aggregate attempts, queue age, expired claims, duplicate deliveries and
terminal messages without payload or sensitive failure text. Structural validation,
reference behavior, durable adapter integration and artifact installation are
separate dimensions. `PASS` for the corpus proves only reference behavior. Every
PostgreSQL × RabbitMQ/Kafka cell across .NET/Node/Python/Go/Rust remains BLOCKED in
`../conformance/delivery-v1/durable-matrix.json` until its own crash/rollback,
process-concurrency, restart, lease-loss, confirmation-crash, redelivery and recovery
proofs pass. Unavailable dependencies block; no skip is approval. Shared services
must not be stopped or replaced. Use isolated test resources per policy.

Reproduce: `npm run test:delivery-leases` and `node scripts/test-delivery-leases.mjs`.
Missing, empty, changed or zero-case corpus fails; the manifest records hashes,
expected cases/steps and profile. Run with an explicit corpus directory outside
this checkout to verify location independence. No registry installation is claimed.

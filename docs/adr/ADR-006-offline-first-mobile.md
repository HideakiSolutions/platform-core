# ADR-006: Offline-First Mobile

## Status

Proposed

## Context

Mobile banking users frequently experience intermittent connectivity. Operations initiated offline must not be lost, and the user experience should remain responsive regardless of network state. A consistent offline strategy is needed across mobile platforms.

## Decision

Mobile apps implement optimistic UI with background sync. An offline queue uses FIFO (first-in, first-out) strategy by default. The networking contract in mobile-core defines queue configuration (max queue size, retry policy, TTL per operation type). Sync triggers automatically on connectivity restoration. Conflict resolution uses last-write-wins by default; critical operations (e.g., transfers, payments) support custom conflict resolvers defined per use case.

## Consequences

- Users perceive the app as responsive even without connectivity
- FIFO ordering preserves the user's intended sequence of operations
- Last-write-wins is simple but may cause data loss in edge cases — critical operations need explicit resolver implementations
- Queue persistence must survive app termination and device restart
- Testing offline scenarios becomes a required part of the mobile QA process
- Networking contract in mobile-core must define clear interfaces for queue configuration and conflict resolution

# SRM consolidation — 2026-11-13

This integration preserves the earlier SRM acceptance as historical evidence and
records subsequent source changes separately. It does not publish packages or
assert a new acceptance of the consolidated delivery.

## Preserved acceptance

Commit `9ad193c55983ee3783594d7529698ffb3d2f7a0d` versions the eleven original
pending SRM files without changing their bytes. The external comparison receipt
is `/build/artifacts/srm-consolidation-20261113/platform-snapshot-proof.json`;
the original manifest is `platform-snapshot-hashes.json` in that directory.
`evidence-summary.json`, `continuation-review.json`, `acceptance-decisions.json`
and the admission receipt retain their original hashes and original evidence
paths. These receipts refer to the earlier source state. Subsequent changes do
not make those receipts evidence for new source bytes.

The recorded process nonconformance and the owner's delivery-specific exception
remain intact. Dispensed external smoke tests remain dispensations, not passes.

## Integrated changes

- Provider contracts: merge `2121c441e5852e9d785865760fa11bb3192d4aae`
  incorporates frozen candidate `0d4cbb70b0a870ccc360e100b1a582c7395917c8`.
  ECP owns `ai.provider-access@0.1.0`; platform aliases use the vendored,
  hash-verified candidate snapshot. Existing stub validation, the full validation
  pipeline, YAML dependency, AEW ownership and intake extension requirements are
  preserved. The isolated alias fixture includes the validator's stub support.
  The existing snapshot lock also binds exactly four candidate aliases through a
  shared contract/authority validator helper; the admitted CSV/global pin remain
  byte-identical. See [ADR-CEP-003 (Proposed)](../adr/ADR-CEP-003-provider-access-candidate-aliases.md).
  The provider proposal is [ADR-014](../adr/ADR-014-ai-provider-access.md),
  renamed from its colliding candidate identifier without changing its status.
- Jira traceability: `governing_contract` now names admitted local
  `workitem.query@0.1.0` and `workitem.command@0.1.0` in bundle `0.6.0`.
  A regression gate rejects the obsolete proposed/not-admitted description when
  admission is recorded as passed. The original intake outcome remains historical.
- Frontend: merge `fe04748db8f0f794617d28b21057178fc3c07c0e` records Checkbox
  ancestry. Its tree equals its first parent's tree; primitives stay at `0.13.0`
  and the consumed changeset is not repeated. Focused primitives tests (38),
  primitives typecheck, contract snapshot and schema checks passed.

The global platform ECP pin remains `contracts-v0.4.0` at
`ab1fcc92797224c428ec6362e02ee1eaf2de8abb`; the six unresolved authorities and
capability-authority table are unchanged. Additional work-items admission does
not broaden that global pin or resolve an unknown authority.

## Verification and remaining review

Current execution receipts live under
`/build/artifacts/srm-consolidation-20261113/`: `frontend-merge.json`,
`frontend-gates-direct.log`, `platform-merge.json`,
`platform-consolidated-full-final.log`, `platform-scoped-authority-unit-final.log`,
and `platform-snapshot-proof.json`. Earlier failed runs and their independent
fixture diagnosis remain alongside these final receipts.
Platform acceptance regression tests cover ten cases, including contradictory
Jira admission state. The platform merge gate runs contracts, existing stubs,
capability graph, provider alias negative tests and the complete validation chain.
The complete local validation chain passed, as did ten acceptance regressions
and the eighteen focused candidate-authority tests. Six existing secret-scanner
cases report NOT_VERIFIED locally because GITLEAKS_BIN was not set; they are not
counted as passed. The receipts record actual outcomes and this document does
not replace them.

The consolidated ECP/backend revisions, new package hashes and independent review
results must be bound in a separate current-state receipt after their own gates
finish. Their earlier acceptance hashes must not be rewritten to hide source
drift. Until that binding and review, consolidated delivery approval remains
pending. No publication, remote merge, deployment or new external smoke is
performed by this consolidation.

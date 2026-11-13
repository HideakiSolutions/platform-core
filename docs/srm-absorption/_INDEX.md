# SRM capability absorption

This is an implementation intake and acceptance ledger, not an availability or
publication declaration. Read `traceability.json` for each selected source package,
implementation projection and remaining acceptance criterion. Source-module hashes
cover the 120 `src/` files in the pinned archive; this does not copy their APIs or
customer policy into the platform.

- [Entrega, uso e fechamento autorizado](delivery.md)
- [Índice de evidências](evidence-summary.json)
- [Traceability and source hashes](traceability.json)
- [Acceptance and validation](acceptance.md)
- [Independent review](independent-review.md)
- [Owner-accepted dispensations](acceptance-decisions.json)
- [Revisão da continuação e bloqueio formal](continuation-review.json)
- [Shared directory conformance fixture](../../directory/conformance/graph-manager-chain.json)

Run the deterministic validator with the four isolated checkouts and original ZIP:

```bash
python3 scripts/validate-srm-absorption.py \
  --archive ../../references/platform-packages-2026-07-09.zip \
  --backend ../srm-backend --frontend ../srm-frontend --ecp ../srm-ecp
```

`--require-complete` additionally fails while a delivery or live gate remains open.
A successful traceability check is not completion of the whole absorption.

Governance producer: `enterprise-hseos@25e673ff9c7e9dee99ef88a554cc9144d99c5b40`,
Constitution §2.6, Platform Capability Governance §7, ADR-CEP-001 and ADR-CEP-002.
The current ECP code base and platform-core's pinned authority snapshot are distinct.
The ECP pin, six unknown authorities and adoption bindings are not changed.
AEW activation and consumer enforcement remain **NOT VERIFIED**; global tool availability
is not proof of project adoption. No HSEOS installation was performed.

Owner-authorized closeout: ADR0016 accepted; two0.1.0 work-item contracts
registered in local ECP bundle0.6.0, registry25; --require-complete approved.
The delivery-specific process exception is accepted, preserving NONCONFORMANT history. Existing HSEOS setup retained by owner instruction; no installation.

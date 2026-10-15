# Proposed audit JCS profile v1

Status: **proposed, not admitted**. Type: behavioral contract and conformance
reference. Owner boundary: platform-core audit; stack implementations belong to
backend-core. This proposal implements the new-protocol portion of the approved
normalization program. It does not certify a production adapter.

Contract identity: `platform-core/audit/audit-chain-jcs/v1`.
Wire discriminator: `protocol: "audit-jcs-sha256/v1"`.
Canonical base: `audit-event.schema.json` at platform revision
`a3151c3092981ee67276927cefda455f0b7a104a`; schema hashes and corpus integrity
are pinned in `../conformance/jcs-v1/corpus.lock.json`.

## Observable rules

1. A producer constructs a **new unsigned** record and explicitly chooses this
   version. Existing audit hash APIs, readers, bytes and evidence are preserved.
   A signing input containing root `hash` is rejected. A legacy record without
   this protocol is never guessed, upgraded or recalculated.
2. Structural validation against the base event and versioned schema is mandatory
   and separate from behavioral validation. The supplied reference tools exercise
   the behavioral profile; `structural.mjs` checks positive persisted projections.
   References are test oracles, not general-purpose production validators/SDKs.
3. Before signing, timestamps are normalized to UTC with exactly nine fractional
   digits. Offset conversion operates on whole seconds; fractional digits are
   preserved and padded, never rounded or truncated. Dates must be real calendar
   dates, years 0001–9999. Leap seconds, unknown `-00:00` offset, no timezone,
   non-uppercase ISO separators and precision above nine digits are rejected.
   Persisted verification requires canonical UTC input and never normalizes it.
4. The numeric wire profile accepts only integer lexemes in
   `[-9007199254740991,9007199254740991]`. Fractions and exponents are explicitly
   rejected **before** a runtime can round them. Exact decimals or larger integers
   use JSON strings in string/extension fields, preserving their text. This is a
   restrictive, versioned subset of JCS, not a claim that JCS itself rejects all
   fractional IEEE-754 values. Monetary scale, rounding and domain interpretation
   belong to the application.
5. Canonicalization follows [RFC 8785 §§3.1–3.2](https://www.rfc-editor.org/rfc/rfc8785.txt):
   deterministic UTF-16 property ordering, JSON primitive escaping, no extra
   whitespace and UTF-8 bytes. Duplicate keys and unpaired Unicode surrogates fail.
   Unicode strings are retained without normalization. Array order is retained.
6. `prev_hash` is required: explicit `null` for genesis or lowercase 64-digit SHA-256
   for a successor. Missing, null and empty string are distinct. Root `hash` is
   excluded from the canonical object; root `prev_hash` remains **once** in that
   object. No predecessor prefix is appended. Extension fields, including nested
   fields named `hash` or `prev_hash`, remain in the hashed object.
7. `hash = lowercase_hex(SHA256(UTF8(JCS(unsigned_normalized_entry))))`.
   Unknown protocol or outcome enums fail. Optional-field absence, null and empty
   values remain distinct. Unknown extension properties allowed by the canonical
   structural schema are preserved and participate in the digest.
8. Entry verification recalculates content and compares hashes; chain verification
   additionally compares each predecessor to the previous verified digest.
   The genesis expectation and trusted checkpoint/head come from application
   composition/storage. Unkeyed hashes do not prove an author's identity and an
   attacker able to replace an entire chain can recalculate it; trusted anchors
   and append authority remain mandatory external controls.

The profile changes neither retention nor authority. ADR-011's separately
accepted retention profile and the legacy retention guarantee remain independently
selected and governed. No historical record receives a new timestamp or TTL.

## Evidence and reproduction

```sh
python3 audit/conformance/jcs-v1/reference.py
node audit/conformance/jcs-v1/reference.mjs
node audit/conformance/jcs-v1/structural.mjs
python3 -m unittest discover -s audit/conformance/jcs-v1 -p 'test_*.py' -v
```

There are 33 pinned sign/verify/chain cases, including negative and compatibility
cases. Two independent internal oracles produce the same expected bytes and
hashes. Corpus absence, empty selection and altered bytes fail with a failure
receipt. Structural projection is a separate dimension. Tests exercise a copy
outside the checkout and test corruption, Unicode ordering, precision, predecessor
inclusion, extension preservation and legacy refusal.

No .NET, Go or Rust implementation of this new profile is certified here. Current
production .NET/Python audit APIs remain unchanged. Interoperability of the new
production implementations, fresh characterization against all current revisions,
registration/admission of the capability, owner review, installed production
artifacts and integrated-revision proof remain open. This proposal is **not** a
closure of behavioral normalization.

## Governance and admission lookup

Producer: `2b4d6f37caf748947cca8195f16b8534b5c8ab9e`; Constitution §§2.3,
2.6, 7–10; Platform Capability Governance Standard; Data Contracts & Schema
Evolution; governance-discovery and automated-validation policies. See ADR-013.

Exact lookup inspected the platform fragment at `a3151c3` and its audit schema,
README and ADR-011; existing audit hashing APIs in backend main `b6931b9` and
ECP 0.4.0 registry (pinned in the reconciled backend distribution) were read.
Existing audit shape and retention authority are reused. No new ECP operation or
concurrent definition of its envelope/error/context capabilities is introduced.
The inspected platform fragment only exposes governance intake nodes; therefore
**graph registration/admission for this new profile is not verified**. This is a
bounded finding about these sources, not an assertion of portfolio-wide absence.
No discovery modified canonical graph relations. Final intake, graph registration
and owner acceptance remain required before admission or production availability.

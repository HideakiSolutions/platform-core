# Typed evidence metadata migration

The clean consolidation retains the exact functional tree of commit
83d50b809e0a04889768fdad854ab6e93533bbcc. Its history starts at develop and safely
integrates the frozen provider candidate; the earlier consolidation remains
available on its original branch and in bundles.

`evidence-summary.json.v1.gz` preserves the exact original JSON bytes, SHA-256
`sha256:2087d89e8d8a7425c474cda06ab7a4850c49040f697282693e40c93ca51b0365`.
`independent-review.md.v1.gz` likewise preserves the exact original review;
`manifest.json` records both original and archive checksums. Gzip uses a fixed
zero timestamp for reproducibility.

The current summary uses `srm-evidence-summary/v2`: filepath-to-raw-digest maps
become typed artifact-digest records with algorithm and hex fields. The helper
`scripts/verify-srm-evidence-migration.py` reads v1/v2, reconstructs the original
semantic model and verifies it against the exact archived bytes. The current
review changes only its frontend auth tarball checksum into a sha256 URI.

This represents checksum metadata accurately. All eleven previous scanner
results were independently proven to equal actual source/artifact SHA-256
checksums. No credential is being encoded or hidden. Scanner policy, default
rules, ignore behavior and historical acceptance statuses remain unchanged.
Earlier consolidation documentation describes the preserved original branch;
its original evidence-summary bytes are now explicitly the archived v1 record.

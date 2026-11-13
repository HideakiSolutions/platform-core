"""Verify lossless v1 archive and typed v2 metadata without changing evidence."""
import gzip
import hashlib
import json
from pathlib import Path
import re


# Computed from immutable Git blobs at 83d50b809e0a04889768fdad854ab6e93533bbcc.
# Mutable archive manifests cannot redefine the historical source being preserved.
ORIGINAL_SHA256 = {
    "evidence-summary.json": "2087d89e8d8a7425c474cda06ab7a4850c49040f697282693e40c93ca51b0365",
    "independent-review.md": "a368498fc49e28954c6cc26502fe2b9b5ffe448c03a569bc2785cd875c2acbbb",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def restore(value):
    if isinstance(value, dict):
        if value.get("record_type") == "artifact-digests/v2":
            entries = value["entries"]
            result = {}
            for entry in entries:
                digest = entry["digest"]
                if digest["algorithm"] != "sha256" or not re.fullmatch("[0-9a-f]{64}", digest["hex"]):
                    raise ValueError("Invalid typed digest")
                if entry["path"] in result:
                    raise ValueError("Duplicate artifact path")
                result[entry["path"]] = digest["hex"]
            return result
        return {key: restore(item) for key, item in value.items()}
    if isinstance(value, list):
        return [restore(item) for item in value]
    return value


def read_summary(path):
    raw = path.read_bytes()
    data = json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)
    if data.get("schema_version") == "srm-evidence-summary/v2":
        return restore(data["payload"])
    return data  # Existing v1 archives/readers keep the original semantic model.


def verify(root):
    directory = root / "docs/srm-absorption"
    manifest = json.loads((directory / "history/manifest.json").read_text())
    require(set(manifest) == set(ORIGINAL_SHA256), "Unexpected historical archive set")
    originals = {}
    for name, record in manifest.items():
        archive = (directory / record["path"]).read_bytes()
        raw = gzip.decompress(archive)
        require(hashlib.sha256(archive).hexdigest() == record["archive_sha256"], "Archive checksum mismatch: " + name)
        require(hashlib.sha256(raw).hexdigest() == ORIGINAL_SHA256[name], "Original archive differs from frozen source: " + name)
        require(hashlib.sha256(raw).hexdigest() == record["original_sha256"], "Original checksum manifest mismatch: " + name)
        originals[name] = raw

    summary = directory / "evidence-summary.json"
    require(read_summary(summary) == json.loads(originals["evidence-summary.json"]), "Evidence summary roundtrip mismatch")
    require(read_summary(directory / manifest["evidence-summary.json"]["path"]) == read_summary(summary), "Archive reader roundtrip mismatch")
    require(json.loads(summary.read_text())["original"] == manifest["evidence-summary.json"], "Summary archive binding mismatch")
    old = originals["independent-review.md"].decode()
    current = (directory / "independent-review.md").read_text()
    marker = "SHA256 final do tarball auth:"
    begin = old.index("`", old.index(marker)) + 1
    require(current == old[:begin] + "sha256:" + old[begin:], "Review migration mismatch")
    print(json.dumps({"status": "PASS", "archives_exact": 2, "v2_to_v1_semantic_roundtrip": True,
                      "review_change": "single typed sha256 URI", "historical_statuses_unchanged": True}))


if __name__ == "__main__":
    verify(Path(__file__).resolve().parents[1])

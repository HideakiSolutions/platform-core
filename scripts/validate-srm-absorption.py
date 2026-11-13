#!/usr/bin/env python3
"""Deterministic SRM intake/source coverage and authority guard; not a delivery verdict."""
import argparse
import csv
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import sys
import zipfile


def validate(args):
    root = Path(__file__).resolve().parents[1]
    matrix = json.loads((root / "docs/srm-absorption/traceability.json").read_text())
    archive_bytes = args.archive.read_bytes()
    if hashlib.sha256(archive_bytes).hexdigest() != matrix["source_sha256"]:
        raise ValueError("source archive checksum mismatch")
    pin = json.loads((root / "docs/architecture/contract-authority/ecp-pin.json").read_text())
    if (pin["tag"], pin["commit"]) != (matrix["contract_pin"]["tag"], matrix["contract_pin"]["commit"]):
        raise ValueError("authority snapshot changed")
    authority_file = "docs/architecture/contract-authority/capability-authority.csv"
    baseline = subprocess.run(["git", "show", f"{matrix['bases']['platform-core']}:{authority_file}"],
        cwd=root, text=True, capture_output=True, check=True).stdout
    current = (root / authority_file).read_text()
    if baseline != current:
        raise ValueError("authority matrix must remain unchanged by this absorption")
    unknown = [row["capability"] for row in csv.DictReader(current.splitlines()) if row["classification"] == "unknown"]
    if unknown != matrix["authority_unknown_preserved"]:
        raise ValueError("unresolved authority changed")
    records = matrix["deliveries"]
    names = [row["source_package"] for row in records]
    if len(names) != len(set(names)) or len(names) != 17:
        raise ValueError("expected exactly 17 distinct selected source packages")
    paths = {}
    with zipfile.ZipFile(args.archive) as archive:
        for entry in archive.infolist():
            name = entry.filename.replace("\\", "/")
            if entry.is_dir() or "/src/" not in name:
                continue
            parts = PurePosixPath(name).parts
            if any(part.startswith(".env") or part in ("avatars", "node_modules", ".git") for part in parts):
                continue
            if ".." in parts or name.startswith("/"):
                raise ValueError("unsafe source path")
            paths[name] = hashlib.sha256(archive.read(entry)).hexdigest()
    recorded = matrix["source_traceability"]
    if len(recorded) != len({entry["source_path"] for entry in recorded}):
        raise ValueError("duplicate source traceability entry")
    if paths != {entry["source_path"]: entry["sha256"] for entry in recorded}:
        raise ValueError("source module coverage/hash mismatch")
    if any(entry["delivery"] not in names for entry in recorded):
        raise ValueError("source module does not map to selected delivery")
    checkouts = {"node": args.backend, "dotnet": args.backend, "react": args.frontend, "ecp": args.ecp}
    checked = 0
    for row in records:
        if row["publication_state"] != "not-published" or row["adoption_state"] != "not-claimed":
            raise ValueError("publication/adoption requires separate evidence and review")
        for stack, entries in row["implementation_paths"].items():
            for relative in entries:
                path = PurePosixPath(relative)
                if path.is_absolute() or ".." in path.parts:
                    raise ValueError("unsafe implementation path")
                if not (checkouts[stack] / path).exists():
                    raise ValueError(f"missing mapped implementation: {stack}:{relative}")
                checked += 1
    fixture = root / "directory/conformance/graph-manager-chain.json"
    if fixture.read_bytes() != (args.backend / "node/test/fixtures/directory-manager-chain.json").read_bytes():
        raise ValueError("directory conformance fixture drift")
    incomplete = [row["source_package"] for row in records if row["remaining_acceptance"] or row["implementation_state"] != "verified"]
    open_gates = [gate["id"] for gate in matrix["global_open_gates"] if gate["status"] != "PASS"]
    result = {"traceability": "PASS", "packages": len(records), "source_modules": len(paths),
        "mapped_paths": checked, "authority_unknown_preserved": len(unknown),
        "whole_delivery": "INCOMPLETE" if incomplete or open_gates else "COMPLETE", "open_deliveries": incomplete, "open_global_gates": open_gates}
    print(json.dumps(result, indent=2))
    return 1 if args.require_complete and (incomplete or open_gates) else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("archive", "backend", "frontend", "ecp"):
        parser.add_argument(f"--{name}", type=Path, required=True)
    parser.add_argument("--require-complete", action="store_true")
    try:
        sys.exit(validate(parser.parse_args()))
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as exc:
        print(f"SRM traceability FAIL: {exc}", file=sys.stderr)
        sys.exit(1)

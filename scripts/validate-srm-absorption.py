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


DISPENSABLE_GATES = frozenset({"jira-write-smoke", "graph-external-smoke", "teams-external-smoke"})


def verify_evidence(entries):
    if not entries:
        raise ValueError("passed gate requires hash-bound evidence")
    for entry in entries:
        path = Path(entry["path"])
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != entry["sha256"]:
            raise ValueError("passed gate evidence missing or altered")


def unresolved_gates(gates, decisions):
    accepted = {entry["gate"]: entry for entry in decisions["decisions"]}
    unresolved = []
    waived = []
    ids = [gate["id"] for gate in gates]
    required = DISPENSABLE_GATES | {"sqs-emulator", "identity-live", "canonical-clients", "integrated-reference",
                                    "shared-conformance", "independent-review", "cleanup", "work-items-admission"}
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate acceptance gate")
    if set(ids) != required:
        raise ValueError("required acceptance gate missing or unknown gate added")
    for gate in gates:
        status = gate["status"]
        if status == "WAIVED":
            entry = accepted.get(gate["id"])
            if (gate["id"] not in DISPENSABLE_GATES or not entry or entry.get("status") != "WAIVED"
                or entry.get("test_executed") is not False or not entry.get("basis")
                or gate.get("decision_ref") != "docs/srm-absorption/acceptance-decisions.json"):
                raise ValueError("unauthorized dispensation")
            waived.append(gate["id"])
        elif status == "ACCEPTED_EXCEPTION":
            approved = [entry for entry in decisions.get("closure_authorizations", [])
                        if entry.get("gate") == gate["id"] and entry.get("status") == status]
            if (gate["id"] != "independent-review" or len(approved) != 1
                or gate.get("technical_review") != "COMPLETE" or gate.get("technical_findings") != "CLOSED"
                or gate.get("historical_process_status") != "NONCONFORMANT"
                or approved[0].get("historical_process_status") != "NONCONFORMANT"):
                raise ValueError("accepted exception requires explicit owner approval and preserved history")
            verify_evidence([approved[0]["approval_record"]])
            approval = json.loads(Path(approved[0]["approval_record"]["path"]).read_text())
            if (approval.get("exceptional_closeout_accepted") is not True or not approval.get("instruction")
                or not approval.get("owner") or approval.get("historical_process_status") != "NONCONFORMANT"):
                raise ValueError("accepted exception requires explicit owner approval and preserved history")
            verify_evidence(gate.get("evidence", []))
        elif status == "PASS":
            verify_evidence(gate.get("evidence", []))
        elif status in ("PENDING", "BLOCKED", "FAIL"):
            unresolved.append(gate["id"])
        else:
            raise ValueError("invalid acceptance gate status")
    return unresolved, waived


def require_recorded_admission(record):
    if (record.get("status") != "accepted" or not record.get("owner_acceptance")
        or not record.get("human_instruction_reference") or record.get("activation") != "reviewed"):
        raise ValueError("strategic admission requires recorded owner acceptance and reviewed activation")


def verify_admitted_surface(ecp, admission):
    require_recorded_admission(admission)
    reference = Path(admission["human_instruction_reference"])
    if reference.is_absolute() or ".." in reference.parts:
        raise ValueError("invalid owner approval reference")
    approval_path = ecp / reference
    if hashlib.sha256(approval_path.read_bytes()).hexdigest() != admission["owner_acceptance_sha256"]:
        raise ValueError("owner approval record changed")
    approval = json.loads(approval_path.read_text())
    if approval.get("adr_accepted") is not True or not approval.get("instruction"):
        raise ValueError("strategic ADR owner approval missing")
    if not (ecp / admission["adr"]).is_file():
        raise ValueError("accepted strategic ADR missing")
    version = (ecp / "contracts/VERSION").read_text().strip()
    registry = json.loads((ecp / "catalog/capability-registry.json").read_text())
    if version != admission["contracts_version"] or registry["generated_from"]["contracts_version"] != version:
        raise ValueError("admitted contract registry version mismatch")
    entries = {item["name"]: item for item in registry["capabilities"]}
    for name in ("workitem.query", "workitem.command"):
        entry = entries.get(name)
        if not entry or entry["version"] != "0.1.0" or entry["kind"] != "service":
            raise ValueError("admitted work-item contract missing")
        verify_evidence([{"path": str(ecp / item["path"]), "sha256": item["sha256"]} for item in entry["files"]])


def verify_jira_governing_contract(matrix):
    if not any(item["id"] == "work-items-admission" and item["status"] == "PASS"
               for item in matrix["global_open_gates"]):
        return
    jira = [row for row in matrix["deliveries"] if row["source_package"] == "jira"]
    value = jira[0]["governing_contract"] if len(jira) == 1 else ""
    expected = ("workitem.query@0.1.0", "workitem.command@0.1.0", "0.6.0")
    if any(token not in value for token in expected) or "not admitted" in value or "proposed" in value:
        raise ValueError("Jira governing contract must match the admitted work-items surface")


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
    verify_jira_governing_contract(matrix)
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
    decisions = json.loads((root / "docs/srm-absorption/acceptance-decisions.json").read_text())
    open_gates, waived = unresolved_gates(matrix["global_open_gates"], decisions)
    if any(gate["id"] == "work-items-admission" and gate["status"] == "PASS" for gate in matrix["global_open_gates"]):
        admission = json.loads((args.ecp / "proposals/work-items/admission.json").read_text())
        verify_admitted_surface(args.ecp, admission)
    implementation_open = [gate["id"] for gate in matrix["global_open_gates"]
                           if gate["id"] in open_gates and gate.get("category") != "admission"]
    result = {"traceability": "PASS", "packages": len(records), "source_modules": len(paths),
        "mapped_paths": checked, "authority_unknown_preserved": len(unknown),
        "implementation": "INCOMPLETE" if incomplete or implementation_open else "COMPLETE",
        "accepted_dispensations_not_test_passes": waived,
        "accepted_process_exceptions_not_test_passes": [gate["id"] for gate in matrix["global_open_gates"] if gate["status"] == "ACCEPTED_EXCEPTION"],
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

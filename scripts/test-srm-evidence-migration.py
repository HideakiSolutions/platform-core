"""Historical migration gates remain active under Python optimization."""
import ast
import gzip
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "scripts/verify-srm-evidence-migration.py"


class MigrationGateTest(unittest.TestCase):
    def invoke(self, change=None, optimized=False):
        with tempfile.TemporaryDirectory(prefix="srm-migration-test-", dir=os.environ["TMPDIR"]) as scratch:
            root = Path(scratch)
            directory = root / "docs/srm-absorption"
            directory.mkdir(parents=True)
            for name in ("evidence-summary.json", "independent-review.md"):
                shutil.copy2(ROOT / "docs/srm-absorption" / name, directory / name)
            shutil.copytree(ROOT / "docs/srm-absorption/history", directory / "history")
            if change:
                change(directory)
            command = [sys.executable]
            if optimized:
                command.append("-O")
            command += ["-c", "from pathlib import Path; import runpy,sys; m=runpy.run_path(sys.argv[1]); m['require'](sys.flags.optimize == int(sys.argv[3]), 'Unexpected optimization level'); m['verify'](Path(sys.argv[2]))", str(HELPER), str(root), "1" if optimized else "0"]
            env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
            env.pop("PYTHONOPTIMIZE", None)
            if optimized:
                env["PYTHONOPTIMIZE"] = "1"
            return subprocess.run(command, capture_output=True, text=True, env=env)

    def test_no_assert_gate_in_production_helper(self):
        self.assertFalse(any(isinstance(node, ast.Assert) for node in ast.walk(ast.parse(HELPER.read_text()))))

    def test_valid_roundtrip_normal(self):
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "PASS")

    def test_valid_roundtrip_optimized(self):
        result = self.invoke(optimized=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "PASS")

    def test_modified_compressed_archive_rejected_optimized(self):
        def change(directory):
            archive = directory / "history/evidence-summary.json.v1.gz"
            data = bytearray(archive.read_bytes())
            data[4] ^= 1  # Valid gzip with different mtime; raw payload unchanged.
            archive.write_bytes(data)
        result = self.invoke(change, optimized=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Archive checksum mismatch", result.stderr)
        self.assertNotIn('"status": "PASS"', result.stdout)

    def test_modified_typed_metadata_rejected_optimized(self):
        def change(directory):
            file = directory / "evidence-summary.json"
            data = json.loads(file.read_text())
            def corrupt(value):
                if isinstance(value, dict):
                    if value.get("record_type") == "artifact-digests/v2":
                        value["entries"][0]["digest"]["hex"] = "0" * 64
                        return True
                    return any(corrupt(child) for child in value.values())
                if isinstance(value, list):
                    return any(corrupt(child) for child in value)
                return False
            if not corrupt(data):
                raise ValueError("Fixture has no typed digest map")
            file.write_text(json.dumps(data))
        result = self.invoke(change, optimized=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Evidence summary roundtrip mismatch", result.stderr)
        self.assertNotIn('"status": "PASS"', result.stdout)

    def test_coherent_review_archive_manifest_and_current_tamper_rejected_optimized(self):
        def change(directory):
            path = directory / "history/manifest.json"
            manifest = json.loads(path.read_text())
            archive = directory / manifest["independent-review.md"]["path"]
            raw = gzip.decompress(archive.read_bytes()) + b"\ncoherently changed historical text\n"
            archive.write_bytes(gzip.compress(raw, mtime=0))
            manifest["independent-review.md"]["original_sha256"] = hashlib.sha256(raw).hexdigest()
            manifest["independent-review.md"]["archive_sha256"] = hashlib.sha256(archive.read_bytes()).hexdigest()
            path.write_text(json.dumps(manifest))
            review = directory / "independent-review.md"
            review.write_bytes(review.read_bytes() + b"\ncoherently changed historical text\n")
        result = self.invoke(change, optimized=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Original archive differs from frozen source", result.stderr)
        self.assertNotIn('"status": "PASS"', result.stdout)


if __name__ == "__main__":
    unittest.main()

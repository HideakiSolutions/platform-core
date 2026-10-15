import copy
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location('audit_reference', HERE / 'reference.py')
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)


class ProtocolTests(unittest.TestCase):
    def test_independent_executors_match_all_pinned_bytes_and_digests(self):
        receipts = []
        for command in ([sys.executable, str(HERE / 'reference.py')], ['node', str(HERE / 'reference.mjs')]):
            result = subprocess.run(command, cwd=os.environ.get('TMPDIR', '/build/tmp'), capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = json.loads(result.stdout)
            self.assertEqual(receipt['status'], 'PASS')
            self.assertGreater(receipt['cases_expected'], 0)
            self.assertEqual(receipt['cases_expected'], receipt['cases_executed'])
            self.assertEqual(receipt['skips'], 0)
            receipts.append(receipt)
        self.assertEqual(receipts[0]['corpus_sha256'], receipts[1]['corpus_sha256'])
        self.assertEqual(receipts[0]['results'], receipts[1]['results'])

    def test_utf16_sort_order_and_no_unicode_normalization(self):
        # UTF-16 compares the surrogate pair of the astral code point before U+E000.
        self.assertEqual(reference.canonical({'\ue000': 'bmp', '😀': 'astral', '2': 2, '10': 10}), '{"10":10,"2":2,"😀":"astral","\ue000":"bmp"}')
        self.assertNotEqual(reference.canonical('é'), reference.canonical('e\u0301'))

    def test_previous_hash_once_and_nested_hash_is_not_removed(self):
        vector = next(item for item in json.loads((HERE / 'vectors.json').read_bytes()) if item['id'] == 'exact-decimal-string-and-nested-hash')
        result = reference.sign(vector['raw'])
        self.assertIn('"hash":"nested-is-included"', result['canonical_utf8'])
        self.assertEqual(result['canonical_utf8'].count('"prev_hash":null'), 1)
        self.assertEqual(reference.verify(json.dumps(result['entry'])), True)
        altered = copy.deepcopy(result['entry'])
        altered['metadata']['hash'] = 'altered'
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):
            reference.verify(json.dumps(altered))

    def test_missing_null_and_empty_extensions_are_observably_distinct(self):
        vectors = json.loads((HERE / 'vectors.json').read_bytes())
        hashes = [item['hash'] for item in vectors if item['id'] in ('utc-genesis', 'extension-null', 'extension-empty', 'extension-empty-object', 'extension-empty-list')]
        self.assertEqual(len(hashes), 5)
        self.assertEqual(len(set(hashes)), 5)

    def test_corpus_tampering_empty_and_missing_fail_outside_checkout(self):
        for mutation in ('tamper', 'empty', 'missing'):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory(prefix='audit-profile-', dir=os.environ.get('TMPDIR', '/build/tmp')) as scratch:
                target = Path(scratch)
                shutil.copytree(ROOT / 'audit', target / 'audit', ignore=shutil.ignore_patterns('__pycache__'))
                corpus = target / 'audit/conformance/jcs-v1/vectors.json'
                if mutation == 'missing':
                    corpus.unlink()
                else:
                    corpus.write_text('[]' if mutation == 'empty' else corpus.read_text() + '\n')
                for executable, name in ((sys.executable, 'reference.py'), ('node', 'reference.mjs')):
                    result = subprocess.run([executable, str(corpus.with_name(name))], cwd=target, capture_output=True, text=True)
                    self.assertNotEqual(result.returncode, 0)
                    receipt = json.loads(result.stdout)
                    self.assertEqual(receipt['status'], 'FAIL')
                    self.assertEqual(receipt['cases_executed'], 0)
                    self.assertIn('runtime', receipt)


if __name__ == '__main__':
    unittest.main()

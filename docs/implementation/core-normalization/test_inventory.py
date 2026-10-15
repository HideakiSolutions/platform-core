import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('inventory', Path(__file__).with_name('inventory.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class InventoryTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix='core-inventory-', dir=os.environ.get('TMPDIR', '/build/tmp'))
        self.repo = Path(self.scratch.name)
        self.run_git('init', '-b', 'main')
        self.run_git('config', 'user.name', 'Inventory Test')
        self.run_git('config', 'user.email', 'inventory@example.invalid')

    def tearDown(self):
        self.scratch.cleanup()

    def run_git(self, *args):
        return subprocess.run(['git', '-C', str(self.repo), *args], check=True, capture_output=True).stdout.decode().strip()

    def commit(self, content='one'):
        (self.repo / 'file').write_text(content)
        self.run_git('add', 'file')
        self.run_git('commit', '-m', 'test: fixture')
        return self.run_git('rev-parse', 'HEAD')

    def official(self):
        self.run_git('update-ref', 'refs/remotes/origin/main', 'HEAD')
        self.run_git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main')

    def test_unborn_and_no_remote_are_explicit(self):
        result = module.inventory(self.repo)
        self.assertIsNone(result['head'])
        self.assertIsNone(result['official_commit'])
        self.assertEqual(result['remotes'], [])
        self.assertEqual(result['refs'], [])

    def test_dirty_untracked_and_staged_are_hashed_without_contents(self):
        self.commit()
        (self.repo / 'file').write_text('secret changed')
        (self.repo / 'new').write_text('secret untracked')
        result = module.worktree(self.repo)
        self.assertTrue(result['dirty'])
        self.assertEqual({r['path'] for r in result['changes']}, {'file', 'new'})
        self.assertNotIn('secret', str(result))
        self.assertEqual(next(r for r in result['changes'] if r['path'] == 'new')['sha256'], module.sha(b'secret untracked'))
        before = result['staged_diff_sha256']
        self.run_git('add', 'file')
        self.assertNotEqual(before, module.worktree(self.repo)['staged_diff_sha256'])

    def test_ancestor_and_same_commit_refs_do_not_imply_duplicate_delivery(self):
        first = self.commit()
        self.run_git('branch', 'old')
        self.commit('two')
        self.official()
        self.run_git('branch', 'alias')
        result = module.inventory(self.repo)
        refs = {r['ref']: r for r in result['refs']}
        self.assertEqual(refs['refs/heads/old']['commit'], first)
        self.assertEqual(refs['refs/heads/old']['classification'], 'integrated')
        self.assertIn('refs/heads/main', refs['refs/heads/alias']['same_commit_refs'])
        self.run_git('checkout', '-b', 'feature')
        self.commit('three')
        result = module.inventory(self.repo)
        feature = next(r for r in result['refs'] if r['ref'] == 'refs/heads/feature')
        self.assertEqual(feature['classification'], 'candidate')

    def test_missing_repository_does_not_resolve_to_parent(self):
        child = self.repo / 'child'
        child.mkdir()
        self.assertEqual(module.inventory(child)['state'], 'blocked')

    def test_symlink_is_hashed_without_reading_external_target(self):
        (self.repo / 'link').symlink_to('/unreadable/external/target')
        record = module.file_record(self.repo, Path('link'))
        self.assertEqual(record['kind'], 'symlink')
        self.assertEqual(record['sha256'], module.sha(b'/unreadable/external/target'))

    def test_declared_version_exports_only_root_version(self):
        (self.repo / 'package.json').write_text('{"dependencies":{"x":{"version":"9.9.9"}},"version":"1.2.3-beta+7","secret":"hidden"}')
        record = module.file_record(self.repo, Path('package.json'))
        self.assertEqual(record['declared_version'], '1.2.3-beta+7')
        self.assertNotIn('hidden', str(record))

    def test_detached_worktree_is_included(self):
        self.commit()
        destination = self.repo / 'isolated'
        self.run_git('worktree', 'add', '--detach', str(destination))
        result = module.inventory(self.repo)
        detached = next(w for w in result['worktrees'] if w['path'] == str(destination))
        self.assertIsNone(detached['branch'])
        self.assertIsNotNone(detached['head'])

if __name__ == '__main__':
    unittest.main()

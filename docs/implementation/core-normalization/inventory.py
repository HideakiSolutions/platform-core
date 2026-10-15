#!/usr/bin/env python3
"""Read-only Git provenance census. No network, checkout, or content export."""
import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
from pathlib import Path
import subprocess

REPOSITORIES = ('platform-core', 'design-system-core', 'backend-core', 'frontend-core', 'mobile-core', 'repo-template', 'repository-template')
MANIFESTS = {'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'pubspec.yaml', 'pubspec.lock', 'Cargo.toml', 'Cargo.lock', 'go.mod', 'go.sum', 'pyproject.toml', 'Directory.Build.props', 'Directory.Packages.props', 'global.json', 'repository-contract.yaml'}
ARTIFACT_SUFFIXES = ('.nupkg', '.snupkg', '.tgz', '.whl', '.crate', '.aar')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def git(path, *args, check=True):
    result = subprocess.run(['git', '-C', str(path), *args], capture_output=True)
    if check and result.returncode:
        raise RuntimeError('git command failed: ' + ' '.join(args))
    return result

def value(path, *args):
    result = git(path, *args, check=False)
    return result.stdout.decode(errors='surrogateescape').strip() if result.returncode == 0 else None

def file_record(root, relative):
    target = root / relative
    try:
        if target.is_symlink():
            data = os.fsencode(os.readlink(target))
            kind = 'symlink'
        else:
            data = target.read_bytes()
            kind = 'file'
        result = {'path': str(relative), 'kind': kind, 'bytes': len(data), 'sha256': sha(data)}
        if kind == 'file' and relative.name == 'package.json':
            try:
                version = json.loads(data).get('version')
                result['declared_version'] = version if isinstance(version, str) and re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+[a-zA-Z0-9.+-]*', version) else None
            except (ValueError, AttributeError):
                result['declared_version'] = None
        elif kind == 'file' and relative.name == 'pubspec.yaml':
            match = re.search(rb'^version:\s*["\']?([0-9]+\.[0-9]+\.[0-9]+[a-zA-Z0-9.+-]*)', data, re.MULTILINE)
            result['declared_version'] = match.group(1).decode() if match else None
        return result
    except (OSError, ValueError):
        return {'path': str(relative), 'state': 'unreadable_or_deleted'}

def worktree(path):
    root = Path(path)
    if not root.is_dir():
        return {'path': str(root), 'state': 'unavailable'}
    status = git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all').stdout
    # Hash every dirty/untracked path; rename records carry an additional source path.
    parts = status.split(b'\0')
    files = []
    index = 0
    while index < len(parts):
        entry = parts[index]
        index += 1
        if not entry:
            continue
        state, raw = entry[:2].decode(), entry[3:]
        record = file_record(root, Path(os.fsdecode(raw)))
        record['git_status'] = state
        if 'R' in state or 'C' in state:
            record['source_path'] = os.fsdecode(parts[index])
            index += 1
        files.append(record)
    return {'path': str(root), 'head': value(root, 'rev-parse', '--verify', 'HEAD'),
            'branch': value(root, 'symbolic-ref', '-q', 'HEAD'), 'dirty': bool(status),
            'status_sha256': sha(status), 'changes': files,
            'unstaged_diff_sha256': sha(git(root, 'diff', '--binary', '--no-ext-diff', '--no-textconv').stdout),
            'staged_diff_sha256': sha(git(root, 'diff', '--cached', '--binary', '--no-ext-diff', '--no-textconv').stdout)}

def inventory(path):
    path = Path(path)
    if value(path, 'rev-parse', '--show-toplevel') != str(path.resolve()):
        return {'path': str(path), 'state': 'blocked', 'reason': 'not_repository_root'}
    official = value(path, 'symbolic-ref', '-q', 'refs/remotes/origin/HEAD')
    official_sha = value(path, 'rev-parse', '--verify', official + '^{commit}') if official else None
    refs = []
    for row in git(path, 'for-each-ref', '--format=%(refname)%09%(objectname)', 'refs/heads', 'refs/remotes', 'refs/tags').stdout.decode().splitlines():
        ref, object_id = row.split('\t')
        commit = value(path, 'rev-parse', '--verify', ref + '^{commit}')
        integrated = commit and official_sha and git(path, 'merge-base', '--is-ancestor', commit, official_sha, check=False).returncode == 0
        refs.append({'ref': ref, 'object': object_id, 'commit': commit,
                     'classification': 'integrated' if integrated else ('candidate' if official_sha and commit else 'blocked'),
                     'destination': 'preserve_integrated' if integrated else 'review_by_capability',
                     'reason': 'ancestor_of_official' if integrated else ('not_ancestor_of_official' if official_sha and commit else 'official_or_commit_unverified')})
    by_commit = {}
    for ref in refs:
        if ref['commit']:
            by_commit.setdefault(ref['commit'], []).append(ref['ref'])
    for ref in refs:
        ref['same_commit_refs'] = [r for r in by_commit.get(ref['commit'], []) if r != ref['ref']]
    roots = [line[len('worktree '):] for line in git(path, 'worktree', 'list', '--porcelain').stdout.decode().splitlines() if line.startswith('worktree ')]
    observed = []
    for raw in git(path, 'ls-files', '--cached', '--others', '--exclude-standard', '-z').stdout.split(b'\0'):
        if not raw:
            continue
        relative = Path(os.fsdecode(raw))
        if relative.name in MANIFESTS or relative.suffix in ('.csproj', '.fsproj') or str(relative).endswith(ARTIFACT_SUFFIXES):
            observed.append(file_record(path, relative))
    remotes = git(path, 'remote').stdout.decode().splitlines()  # URLs intentionally excluded.
    return {'path': str(path), 'state': 'observed', 'head': value(path, 'rev-parse', '--verify', 'HEAD'),
            'remotes': remotes, 'remote_urls': 'not_exported', 'official_ref': official,
            'official_commit': official_sha, 'refs': refs, 'worktrees': [worktree(p) for p in roots],
            'manifests_and_artifacts': observed, 'artifact_scope': 'git tracked and nonignored untracked paths; ignored build outputs not scanned',
            'remote_freshness': 'not_verified_no_fetch'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--historical-root', type=Path)
    args = parser.parse_args()
    history = {'reported_records': 330, 'status': 'historical_claim_not_revalidated'}
    if args.historical_root:
        history['path'] = str(args.historical_root)
        history['exists'] = args.historical_root.is_dir()
        source = Path('cores/platform-core/docs/implementation/core-consolidation/catalog/source-inventory.json')
        history['evidence'] = [file_record(args.historical_root, source)]
        try:
            historical = json.loads((args.historical_root / source).read_text())
            history['source_counts'] = {key: len(historical[key]) for key in ('families', 'repositories', 'candidates')}
            history['source_scope'] = historical.get('scope')
        except (OSError, ValueError, KeyError, TypeError):
            history['source_counts'] = 'not_verified'
    runtimes = {}
    for tool in ('python3', 'node', 'dotnet', 'flutter', 'dart', 'go', 'rustc', 'cargo'):
        executable = shutil.which(tool)
        runtimes[tool] = {'executable': executable, 'availability': 'detected_on_path' if executable else 'not_detected_on_path',
                          'execution': 'not_tested', 'version': 'not_verified'}
    report = {'schema_version': 1, 'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'scope': 'local refs only; no runtime, installation, adoption or enforcement attestation',
              'runtimes': runtimes,
              'repositories': {name: inventory(args.root / name) for name in REPOSITORIES}, 'history': history}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=True) + '\n')
    print(json.dumps({'output': str(args.output), 'sha256': sha(args.output.read_bytes()), 'repositories': len(report['repositories'])}))

if __name__ == '__main__':
    main()

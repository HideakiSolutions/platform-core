import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const analyzer = path.join(path.dirname(fileURLToPath(import.meta.url)), 'analyze.mjs');

function fixture(parent) {
  const root = fs.mkdtempSync(path.join(parent, 'cd-cli-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'a.tsx'), 'export const A = () => <x style={{}} />;\n');
  fs.mkdirSync(path.join(root, 'governance'));
  // Baseline of 0 inline styles: the fixture above is a regression.
  fs.writeFileSync(path.join(root, 'governance', 'capability-drift.baseline.json'), JSON.stringify({ metrics: { inline_style_attributes: 0 } }));
  return root;
}

function run(script, root, extra = []) {
  return spawnSync(process.execPath, [script, '--root', root, '--paths', 'src', ...extra], { encoding: 'utf8' });
}

test('runs main directly and reports a regression', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-direct-'));
  try {
    const result = run(analyzer, fixture(dir));
    assert.equal(result.status, 1, result.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runs main when invoked through a symlink', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-link-'));
  try {
    const link = path.join(dir, 'link.mjs');
    fs.symlinkSync(analyzer, link);
    const result = run(link, fixture(dir));
    assert.equal(result.status, 1, `main must run through a symlink: ${result.stderr}`);
    assert.match(result.stdout, /inline_style_attributes/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runs main from a path containing a space', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd space-'));
  try {
    const spaced = path.join(dir, 'with space');
    fs.mkdirSync(spaced);
    const copy = path.join(spaced, 'analyze.mjs');
    fs.copyFileSync(analyzer, copy);
    const result = run(copy, fixture(dir));
    assert.equal(result.status, 1, `main must run from a spaced path: ${result.stderr}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('missing baseline exits 2 and never passes silently', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-nobase-'));
  try {
    const root = fixture(dir);
    fs.rmSync(path.join(root, 'governance'), { recursive: true });
    const result = run(analyzer, root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /baseline not found/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

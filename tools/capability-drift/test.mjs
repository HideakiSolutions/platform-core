import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyze, compare } from './analyze.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capability-drift-'));
try {
  fs.mkdirSync(path.join(root, 'apps', 'one'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages', 'ui'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps', 'one', 'Button.tsx'), 'export function Button(value) { return <x style={{}} variant="solid" />; }\n');
  fs.writeFileSync(path.join(root, 'packages', 'ui', 'Button.tsx'), 'export function Button(value) { return <x />; }\n');
  const report = analyze(root, 'node', ['apps', 'packages']);
  assert.equal(report.metrics.app_package_homonyms, 1);
  assert.equal(report.metrics.duplicate_exported_symbols, 1);
  assert.equal(report.metrics.inline_style_attributes, 1);
  assert.equal(report.metrics.literal_jsx_enums, 1);
  assert.equal(compare(report, { metrics: report.metrics }).length, 0, 'equal baseline passes');
  assert.equal(compare(report, { metrics: { ...report.metrics, inline_style_attributes: 0 } }).length, 1, 'increase fails');
  assert.equal(compare(report, { metrics: { ...report.metrics, inline_style_attributes: 2 } }).length, 0, 'reduction passes');
  console.log('PASS capability-drift node fixture');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

const dotnetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'capability-drift-dotnet-'));
try {
  fs.mkdirSync(path.join(dotnetRoot, 'src', 'Services'), { recursive: true });
  fs.mkdirSync(path.join(dotnetRoot, 'src', 'BuildingBlocks.Web'), { recursive: true });
  fs.writeFileSync(path.join(dotnetRoot, 'src', 'Services', 'Audit.cs'), 'public static class Audit { public static void Record(string id) {} }\n');
  fs.writeFileSync(path.join(dotnetRoot, 'src', 'BuildingBlocks.Web', 'Audit.cs'), 'public static class Audit { public static void Record(string id) {} }\n');
  assert.equal(analyze(dotnetRoot, 'dotnet', ['src']).metrics.dotnet_service_buildingblocks_helpers, 1);
  console.log('PASS capability-drift dotnet fixture');
} finally {
  fs.rmSync(dotnetRoot, { recursive: true, force: true });
}

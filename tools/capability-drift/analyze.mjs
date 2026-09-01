#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ignored = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.cs']);

function files(root, entries = [], depth = 0) {
  if (depth > 12 || !fs.existsSync(root)) return entries;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files(full, entries, depth + 1);
    else if (extensions.has(path.extname(entry.name))) entries.push(full);
  }
  return entries;
}

function increment(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function countDuplicateGroups(groups) {
  return Object.values(groups).filter((count) => count > 1).length;
}

export function analyze(root, stack = 'node', paths = ['.']) {
  const allFiles = paths.flatMap((item) => files(path.resolve(root, item)));
  const symbols = {};
  const moduleNames = {};
  const dotnetHelpers = {};
  const cloneWindows = {};
  let inlineStyles = 0;
  let literalJsxEnums = 0;

  for (const file of allFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file);
    inlineStyles += (text.match(/style\s*=\s*\{\{/g) || []).length;
    literalJsxEnums += (text.match(/\b(?:variant|size|tone|status|color)\s*=\s*["']/g) || []).length;
    const scope = relative.includes('/apps/') || relative.startsWith('apps/') ? 'app' : relative.includes('/packages/') || relative.startsWith('packages/') ? 'package' : 'other';
    if (scope !== 'other') increment(moduleNames, `${scope}:${path.basename(file, path.extname(file))}`);

    for (const match of text.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|interface|type)\s+([A-Za-z_$][\w$]*)([^\n{;]*)/g)) {
      increment(symbols, `${match[1]} ${match[2].trim()}`);
    }
    if (stack === 'dotnet' || path.extname(file) === '.cs') {
      for (const match of text.matchAll(/public\s+(?:static\s+)?(?:[\w<>\[\]?]+)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g)) {
        const side = relative.includes('BuildingBlocks') ? 'building-block' : relative.includes('src/Services/') ? 'service' : 'other';
        if (side !== 'other') increment(dotnetHelpers, `${side}:${match[1]}(${match[2].replace(/\s+/g, ' ').trim()})`);
      }
    }
    const lines = text.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter((line) => line.length > 24);
    for (let index = 0; index + 2 < lines.length; index += 1) increment(cloneWindows, lines.slice(index, index + 3).join('\n'));
  }

  const homonymNames = new Set();
  for (const key of Object.keys(moduleNames)) {
    const [, name] = key.split(':');
    if (moduleNames[`app:${name}`] && moduleNames[`package:${name}`]) homonymNames.add(name);
  }
  const helperNames = new Set();
  for (const key of Object.keys(dotnetHelpers)) {
    const [, signature] = key.split(':');
    if (dotnetHelpers[`service:${signature}`] && dotnetHelpers[`building-block:${signature}`]) helperNames.add(signature);
  }

  return {
    schema_version: 'capability-drift/v1',
    metrics: {
      app_package_homonyms: homonymNames.size,
      duplicate_exported_symbols: countDuplicateGroups(symbols),
      inline_style_attributes: inlineStyles,
      literal_jsx_enums: literalJsxEnums,
      dotnet_service_buildingblocks_helpers: helperNames.size,
      jscpd_clone_windows: countDuplicateGroups(cloneWindows),
    },
  };
}

export function compare(actual, baseline) {
  const regressions = [];
  for (const [metric, value] of Object.entries(actual.metrics)) {
    const prior = baseline.metrics?.[metric];
    if (typeof prior === 'number' && value > prior) regressions.push({ metric, baseline: prior, actual: value });
  }
  return regressions;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const value = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
  const root = path.resolve(value('--root', process.cwd()));
  const baselinePath = value('--baseline', 'governance/capability-drift.baseline.json');
  const stack = value('--stack', 'node');
  const selected = value('--paths', '.').split(',').filter(Boolean);
  const result = analyze(root, stack, selected);
  const baselineFile = path.resolve(root, baselinePath);
  const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : { metrics: {} };
  const regressions = compare(result, baseline);
  const reductions = Object.entries(result.metrics).filter(([metric, value]) => typeof baseline.metrics?.[metric] === 'number' && value < baseline.metrics[metric]);
  const output = { ...result, baseline: path.relative(root, baselineFile), regressions };
  fs.writeFileSync(path.join(root, 'capability-drift.json'), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output, null, 2));
  if (regressions.length) process.exitCode = 1;
  else if (reductions.length) console.log('Metrics reduced; consider updating the baseline explicitly.');
}

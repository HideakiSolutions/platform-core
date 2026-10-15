// Internal independent JS oracle for this profile's integer-only JCS subset.
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, isAbsolute } from 'node:path';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const protocol = 'audit-jcs-sha256/v1';
const digest = /^[0-9a-f]{64}$/;
function fail(message) { throw new Error(message); }
function unicode(text) {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const low = text.charCodeAt(++i);
      if (!(low >= 0xdc00 && low <= 0xdfff)) fail('Unpaired Unicode surrogate');
    } else if (code >= 0xdc00 && code <= 0xdfff) fail('Unpaired Unicode surrogate');
  }
  return text;
}
function parse(raw) {
  let i = 0;
  const space = () => { while (/^[\x20\t\n\r]$/.test(raw[i] ?? '')) i++; };
  function string() {
    const expression = /"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y;
    expression.lastIndex = i;
    const match = expression.exec(raw);
    if (!match) fail('Invalid JSON string');
    i = expression.lastIndex;
    return unicode(JSON.parse(match[0]));
  }
  function value() {
    space();
    if (raw[i] === '"') return string();
    if (raw[i] === '{') {
      i++; space(); const result = Object.create(null);
      if (raw[i] === '}') { i++; return result; }
      while (true) {
        space(); const key = string(); space();
        if (raw[i++] !== ':') fail('Expected colon');
        if (Object.hasOwn(result, key)) fail('Duplicate JSON property');
        result[key] = value(); space();
        const next = raw[i++];
        if (next === '}') return result;
        if (next !== ',') fail('Expected comma');
      }
    }
    if (raw[i] === '[') {
      i++; space(); const result = [];
      if (raw[i] === ']') { i++; return result; }
      while (true) {
        result.push(value()); space(); const next = raw[i++];
        if (next === ']') return result;
        if (next !== ',') fail('Expected comma');
      }
    }
    for (const [literal, result] of [['true', true], ['false', false], ['null', null]]) {
      if (raw.startsWith(literal, i)) { i += literal.length; return result; }
    }
    const number = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    number.lastIndex = i; const match = number.exec(raw);
    if (!match || !/^-?(0|[1-9]\d*)$/.test(match[0])) fail('Unsupported numeric lexeme');
    i = number.lastIndex;
    const result = Number(match[0]);
    if (!Number.isSafeInteger(result)) fail('Integer outside profile');
    return result;
  }
  const result = value(); space();
  if (i !== raw.length || !result || typeof result !== 'object' || Array.isArray(result)) fail('Invalid audit JSON object');
  return result;
}
function timestamp(value) {
  const match = typeof value === 'string' && value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/);
  if (!match || match[4] === '-00:00') fail('Timestamp offset/precision invalid');
  const [, day, clock, fraction = '', zone] = match;
  const utc = Date.parse(`${day}T${clock}Z`);
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 19) !== `${day}T${clock}` || day.startsWith('0000')) fail('Invalid calendar date');
  let offset = 0;
  if (zone !== 'Z') {
    const hours = +zone.slice(1, 3), minutes = +zone.slice(4);
    if (hours > 23 || minutes > 59) fail('Invalid offset');
    offset = (hours * 60 + minutes) * (zone[0] === '-' ? -1 : 1);
  }
  const normalized = new Date(utc - offset * 60000).toISOString();
  if (!/^\d{4}-/.test(normalized) || normalized.startsWith('0000')) fail('Calendar outside profile');
  return `${normalized.slice(0, 19)}.${fraction.padEnd(9, '0')}Z`;
}
function required(value) {
  if (value.protocol !== protocol) fail('Unsupported explicit protocol');
  for (const key of ['audit_id', 'action', 'source']) if (typeof value[key] !== 'string' || !value[key]) fail('Missing required field');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.audit_id)) fail('Invalid canonical UUID');
  if (!value.actor || typeof value.actor !== 'object' || typeof value.actor.id !== 'string' || !value.actor.id || !['user', 'service', 'system'].includes(value.actor.type)) fail('Invalid actor');
  if (!['success', 'failure', 'denied'].includes(value.outcome)) fail('Unknown outcome');
  if (!Object.hasOwn(value, 'prev_hash') || (value.prev_hash !== null && (typeof value.prev_hash !== 'string' || !digest.test(value.prev_hash)))) fail('Invalid predecessor');
}
// Sorting is UTF-16 code-unit order; do not build another object (integer keys reorder).
function canonical(value) {
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}
export function sign(raw) {
  const value = parse(raw);
  if (Object.hasOwn(value, 'hash')) fail('Signing requires a new unsigned entry');
  required(value); value.timestamp = timestamp(value.timestamp);
  const content = canonical(value); value.hash = hash(Buffer.from(content, 'utf8'));
  return { entry: value, canonical_utf8: content, canonical_hex: Buffer.from(content, 'utf8').toString('hex'), hash: value.hash };
}
export function verify(raw) {
  const value = parse(raw); required(value);
  if (value.timestamp !== timestamp(value.timestamp)) fail('Persisted timestamp must be canonical');
  const expected = value.hash; delete value.hash;
  if (typeof expected !== 'string' || !digest.test(expected) || hash(Buffer.from(canonical(value), 'utf8')) !== expected) fail('Audit hash mismatch');
  return true;
}
export function verifyChain(entries) {
  if (!Array.isArray(entries) || !entries.length) fail('A chain requires at least one entry');
  let previous = null;
  for (const raw of entries) {
    verify(raw); const value = parse(raw);
    if (value.prev_hash !== previous) fail('Predecessor mismatch');
    previous = value.hash;
  }
  return true;
}
export function loadCorpus(corpusPath = new URL('./vectors.json', import.meta.url)) {
  const bytes = readFileSync(corpusPath);
  const lock = JSON.parse(readFileSync(new URL('./corpus.lock.json', import.meta.url)));
  const identities = {
    'audit/contracts/audit-event.schema.json': 'platform-core/audit/audit-event',
    'audit/contracts/audit-chain-jcs-v1.schema.json': 'platform-core/audit/audit-chain-jcs/v1',
  };
  if (lock.schema_version !== 1 || lock.protocol !== protocol || !/^[0-9a-f]{40}$/.test(lock.canonical_base_revision ?? '') || !lock.schemas || Array.isArray(lock.schemas) || Object.keys(lock.schemas).sort().join(',') !== Object.keys(identities).sort().join(',') || !digest.test(lock.corpus_sha256 ?? '')) fail('Mandatory audit corpus identities and pins are incomplete');
  if (hash(bytes) !== lock.corpus_sha256) fail('Mandatory audit corpus integrity mismatch');
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  for (const [relative, digest] of Object.entries(lock.schemas)) {
    let current = root;
    for (const segment of relative.split('/')) {
      current = resolve(current, segment);
      if (lstatSync(current).isSymbolicLink()) fail('Audit source symlinks are forbidden');
    }
    const source = readFileSync(resolve(root, relative));
    if (typeof digest !== 'string' || !/^[0-9a-f]{64}$/.test(digest) || isAbsolute(relative) || relative.split(/[\\/]/).includes('..') || hash(source) !== digest) fail('Audit contract identity/integrity mismatch');
    const schema = JSON.parse(source);
    if (schema.$id !== identities[relative] || schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') fail('Unexpected audit contract identity');
  }
  const cases = JSON.parse(bytes);
  if (!cases.length || new Set(cases.map(item => item.id)).size !== cases.length) fail('Mandatory corpus empty or duplicate case identity');
  for (const item of cases) {
    if (!['sign', 'verify', 'chain'].includes(item.operation) || !['valid', 'invalid'].includes(item.verdict)) fail('Unsupported case operation/verdict');
    if (item.operation === 'chain' ? !Array.isArray(item.raw) : typeof item.raw !== 'string') fail('Malformed case input');
    if (item.operation === 'sign' && item.verdict === 'valid' && !['hash', 'canonical_utf8', 'canonical_hex'].every(key => typeof item[key] === 'string')) fail('Missing canonical-byte oracle');
  }
  return { bytes, cases, lock };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
 try {
  const { bytes, cases } = loadCorpus(process.argv[2]);
  const results = cases.map(item => {
    let passed = false;
    try {
      const result = item.operation === 'sign' ? sign(item.raw) : item.operation === 'verify' ? verify(item.raw) : item.operation === 'chain' ? verifyChain(item.raw) : fail('Unknown operation');
      passed = item.verdict === 'valid' && (item.operation !== 'sign' || ['hash', 'canonical_utf8', 'canonical_hex'].every(key => result[key] === item[key]));
    } catch { passed = item.verdict === 'invalid'; }
    return { id: item.id, passed };
  });
  const receipt = { protocol, dimension: 'behavioral-reference', status: results.every(item => item.passed) ? 'PASS' : 'FAIL', runtime: process.version, corpus_sha256: hash(bytes), cases_expected: cases.length, cases_executed: results.length, skips: 0, results };
  console.log(JSON.stringify(receipt, null, 2));
  if (receipt.status !== 'PASS') process.exitCode = 1;
 } catch (error) {
   console.log(JSON.stringify({ protocol, dimension: 'behavioral-reference', status: 'FAIL', runtime: process.version, corpus_sha256: null, cases_expected: null, cases_executed: 0, skips: 0, results: [], error: error.message }));
   process.exitCode = 1;
 }
}

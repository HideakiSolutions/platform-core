import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export const requiredCases = ['complete-and-duplicate','tenant-consumer-isolation','expiry-and-recovery','renewal','retry-deferred','terminal-failure','payload-mismatch-busy','payload-mismatch-completed','payload-mismatch-terminal','bounded-expiry','bounded-failure','reject-empty-tenant','reject-zero-lease','reject-changed-retry-budget','legacy-surface'];
const sha = text => createHash('sha256').update(text).digest('hex');
export function verifyCorpus(folder) {
  const manifest = JSON.parse(readFileSync(resolve(folder, 'manifest.json')));
  const bytes = readFileSync(resolve(folder, 'corpus.json'));
  assert.equal(sha(bytes), manifest.files['corpus.json'], 'corpus integrity');
  const corpus = JSON.parse(bytes);
  assert.equal(corpus.contract_id, 'platform-core/messaging/delivery-lease/v1');
  assert.equal(corpus.contract_version, '1.0.0');
  assert.deepEqual(corpus.cases.map(c => c.id).sort(), [...requiredCases].sort(), 'required cases');
  assert.equal(corpus.cases.length, manifest.expected_cases);
  assert(corpus.cases.every(c => c.steps.length > 0), 'zero steps');
  assert.equal(corpus.cases.reduce((n,c) => n + c.steps.length,0), manifest.expected_steps);
  assert.deepEqual(new Set(corpus.cases.map(c => c.kind)), new Set(['positive','negative','compatibility']));
  for (const [name, payload] of Object.entries(corpus.payloads)) assert.equal(sha(payload), corpus.payload_sha256[name]);
  let executed = 0;
  for (const test of corpus.cases) {
    const entries = new Map(), leases = new Map(); let token = 0, previousNow = -1;
    for (const step of test.steps) {
      const now = step.now_ms;
      assert(Number.isSafeInteger(now) && now >= previousNow); previousNow = now;
      let decision, lease;
      if (step.operation === 'claim') {
        const key = JSON.stringify([step.tenant,step.consumer,corpus.message_id]), entry = entries.get(key);
        const payloadHash = corpus.payload_sha256[step.payload];
        if (![step.tenant,step.consumer].every(s => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(s)) || !Number.isInteger(step.lease_ms) || step.lease_ms < 1 || step.lease_ms > 86400000 || !Number.isInteger(step.max_attempts) || step.max_attempts < 1 || step.max_attempts > 10000 || !payloadHash || (entry && entry.budget !== step.max_attempts)) decision = 'invalid';
        else if (entry && entry.hash !== payloadHash) decision = 'payload-mismatch';
        else if (entry?.state === 'completed') decision = 'completed';
        else if (entry?.state === 'dead-lettered') decision = 'dead-lettered';
        else if (entry?.state === 'processing' && entry.expires > now) decision = 'busy';
        else if (entry?.attempt >= step.max_attempts) {entry.state = 'dead-lettered'; decision = 'dead-lettered';}
        else if (entry?.state === 'failed' && entry.retry > now) decision = 'deferred';
        else {
          lease = {key,token:++token,attempt:(entry?.attempt ?? 0)+1,expires:now+step.lease_ms};
          entries.set(key,{...lease,hash:payloadHash,budget:step.max_attempts,state:'processing'});
          decision = 'acquired';
        }
      } else if (['renew','complete','fail'].includes(step.operation)) {
        const owned = leases.get(step.lease); assert(owned,'unknown lease alias');
        const entry = entries.get(owned.key);
        if (!entry || entry.state !== 'processing' || entry.token !== owned.token || entry.expires <= now) decision = 'stale';
        else {
          decision = 'accepted';
          if (step.operation === 'renew') { assert(step.lease_ms > 0 && step.lease_ms <= 86400000); entry.expires = now+step.lease_ms; lease = {...owned,expires:entry.expires}; }
          if (step.operation === 'complete') entry.state = 'completed';
          if (step.operation === 'fail') {entry.state = step.terminal || entry.attempt >= entry.budget ? 'dead-lettered':'failed'; entry.retry = step.retry_at_ms ?? now;}
        }
      } else throw Error(`unknown operation ${step.operation}`);
      assert.equal(decision,step.expected,`${test.id}/${executed}`);
      if (step.save_as && lease) leases.set(step.save_as,lease);
      if (step.attempt) assert.equal(lease?.attempt,step.attempt,test.id);
      if (step.expires_at_ms) assert.equal(lease?.expires,step.expires_at_ms,test.id);
      executed++;
    }
  }
  return {contract:corpus.contract_id,version:corpus.contract_version,corpus_sha256:sha(bytes),runtime:process.version,profile:manifest.profile,expected_cases:manifest.expected_cases,executed_cases:corpus.cases.length,expected_steps:manifest.expected_steps,executed_steps:executed,skips:0,result:'PASS',scope:'reference state machine only; no adapter, installation or durability evidence'};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const folder = process.argv[2] ?? fileURLToPath(new URL('../messaging/conformance/delivery-v1',import.meta.url));
  console.log(JSON.stringify(verifyCorpus(folder),null,2));
}

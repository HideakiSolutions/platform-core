import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyCorpus } from './test-delivery-leases.mjs';
const folder = fileURLToPath(new URL('../messaging/conformance/delivery-v1',import.meta.url));
test('reference corpus executes every required positive, negative and compatibility case',()=>{
  const receipt = verifyCorpus(folder); assert.equal(receipt.executed_cases,18); assert.equal(receipt.skips,0);
});
test('missing, empty, tampered and zero-case corpora cannot pass',()=>{
  assert(process.env.TMPDIR && !process.env.TMPDIR.startsWith('/tmp'),'disk TMPDIR required');
  const scratch = mkdtempSync(resolve(process.env.TMPDIR,'delivery-corpus-'));
  try {
    assert.throws(()=>verifyCorpus(scratch));
    for (const file of ['manifest.json','corpus.json']) writeFileSync(resolve(scratch,file),readFileSync(resolve(folder,file)));
    writeFileSync(resolve(scratch,'corpus.json'),''); assert.throws(()=>verifyCorpus(scratch));
    const corpus = JSON.parse(readFileSync(resolve(folder,'corpus.json')));corpus.cases=[];
    writeFileSync(resolve(scratch,'corpus.json'),JSON.stringify(corpus));assert.throws(()=>verifyCorpus(scratch));
    mkdirSync(resolve(scratch,'independent'));for (const file of ['manifest.json','corpus.json']) writeFileSync(resolve(scratch,'independent',file),readFileSync(resolve(folder,file)));
    assert.equal(verifyCorpus(resolve(scratch,'independent')).result,'PASS');
  } finally {rmSync(scratch,{recursive:true,force:true});}
});
test('all ten durable cells retain explicit independent blockers',()=>{
  const matrix = JSON.parse(readFileSync(resolve(folder,'durable-matrix.json')));
  assert.equal(matrix.rows.length,10);assert.equal(new Set(matrix.rows.map(r=>`${r.stack}/${r.database}/${r.transport}`)).size,10);
  for (const stack of ['dotnet','node','python','go','rust']) for (const transport of ['rabbitmq','kafka']) {
    const row = matrix.rows.find(r=>r.stack===stack && r.transport===transport && r.database==='postgresql');
    assert(row);assert.equal(row.status,'BLOCKED');assert.deepEqual(row.evidence,[]);assert.equal(row.required_scenarios.length,7);assert(row.blocker.length>0);
  }
});

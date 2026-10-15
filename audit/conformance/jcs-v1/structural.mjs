// Structural dimension, deliberately separate from the behavioral oracles.
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { sign, loadCorpus } from './reference.mjs';
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const base = 'https://schemas.hideakisolutions.local/';
const legacy = JSON.parse(readFileSync(new URL('../../contracts/audit-event.schema.json', import.meta.url)));
const schema = JSON.parse(readFileSync(new URL('../../contracts/audit-chain-jcs-v1.schema.json', import.meta.url)));
legacy.$id = base + legacy.$id;
schema.$id = base + schema.$id;
schema.allOf[0].$ref = base + schema.allOf[0].$ref;
ajv.addSchema(legacy);
const validate = ajv.compile(schema);
const { cases: vectors } = loadCorpus();
let executed = 0;
for (const item of vectors) {
  if (item.verdict !== 'valid') continue;
  const entries = item.operation === 'chain' ? item.raw.map(raw => JSON.parse(raw)) : [item.operation === 'sign' ? sign(item.raw).entry : JSON.parse(item.raw)];
  for (const entry of entries) {
    if (!validate(entry)) throw new Error(`${item.id}: ${JSON.stringify(validate.errors)}`);
    executed++;
  }
}
if (!executed) throw new Error('No structural projections selected');
console.log(JSON.stringify({ dimension: 'structural', status: 'PASS', runtime: process.version, cases_expected: executed, cases_executed: executed, skips: 0 }));

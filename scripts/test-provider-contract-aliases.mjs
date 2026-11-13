import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const source = process.cwd();
const scratch = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), "provider-aliases-"));
try {
  for (const relative of ["ai/contracts", "ai/docs", ".platform/ecp", "governance/contracts", "governance/docs", "governance/intakes", "scripts/validate-contracts.mjs", "scripts/lib"]) {
    const target = path.join(scratch, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(path.join(source, relative), target, { recursive: true });
  }
  symlinkSync(path.join(source, "node_modules"), path.join(scratch, "node_modules"), "dir");
  const run = () => spawnSync(process.execPath, ["scripts/validate-contracts.mjs"], {
    cwd: scratch, encoding: "utf8", env: process.env,
  });
  const positive = run();
  assert.equal(positive.status, 0, positive.stderr);
  const intakePath = path.join(scratch, "governance/intakes/ai.provider-access.json");
  const intake = JSON.parse(readFileSync(intakePath));
  assert.equal(intake.target.owner, "enterprise-capability-platform");
  intake.target.owner = "unregistered-owner";
  writeFileSync(intakePath, JSON.stringify(intake));
  const badOwner = run();
  assert.equal(badOwner.status, 1);
  assert.match(badOwner.stderr, /target\/owner must be equal to one of the allowed values/);
  intake.target.owner = "enterprise-capability-platform";
  writeFileSync(intakePath, JSON.stringify(intake));
  const lock = JSON.parse(readFileSync(path.join(scratch, ".platform/ecp/ai.provider-access.lock.json")));
  const schema = path.join(scratch, lock.files[0].path);
  const original = readFileSync(schema);
  writeFileSync(schema, Buffer.concat([original, Buffer.from(" ")]));
  const corrupt = run();
  assert.equal(corrupt.status, 1);
  assert.match(corrupt.stderr, /snapshot hash mismatch/);
  writeFileSync(schema, original);
  rmSync(schema);
  const missing = run();
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /ECP provider-access snapshot/);
  console.log("Provider aliases: canonical ECP owner accepted; unknown owner, changed hash and missing schema rejected.");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

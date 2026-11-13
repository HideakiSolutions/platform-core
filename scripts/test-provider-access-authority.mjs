import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkAuthority, loadRepository } from "./validate-capability-authority.mjs";
import { PROVIDER_LOCK } from "./lib/provider-access-snapshot.mjs";

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function fixture(run) {
  const root = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), "provider-authority-"));
  try {
    const lock = JSON.parse(readFileSync(path.join(source, PROVIDER_LOCK)));
    // Model only the candidate projection; unrelated baseline schemas retain
    // their own CSV requirements and are exercised separately below.
    for (const relative of [PROVIDER_LOCK, ...lock.files.map((entry) => entry.path), ...lock.aliases.map((entry) => entry.path)]) {
      mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
      cpSync(path.join(source, relative), path.join(root, relative));
    }
    mkdirSync(path.join(root, "docs/architecture/contract-authority"), { recursive: true });
    writeFileSync(path.join(root, "docs/architecture/contract-authority/capability-authority.csv"),
      "capability,classification,canonical_source,version_or_resolution_policy,legacy_identifiers,claimed_status,evidence,notes\n");
    const editLock = (change) => {
      const file = path.join(root, PROVIDER_LOCK);
      const lock = JSON.parse(readFileSync(file)); change(lock);
      writeFileSync(file, JSON.stringify(lock));
    };
    run(root, editLock);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const validate = (root) => checkAuthority(loadRepository(root));
test("four verified candidate aliases need no modification of the admitted CSV or global pin", () => fixture((root) => {
  assert.deepEqual(validate(root), []);
  const repo = loadRepository(root);
  assert.equal(repo.pin, undefined);
  assert.equal(repo.rows.length, 0);
}));
for (const [name, mutation] of [
  ["owner", (lock) => { lock.owner = "other"; }],
  ["repository", (lock) => { lock.source = "other/enterprise-capability-platform"; }],
  ["floating ref", (lock) => { lock.ref = "main"; }],
  ["version", (lock) => { lock.version = "0.2.0"; }],
  ["noncandidate state", (lock) => { lock.state = "admitted"; }],
  ["unknown alias", (lock) => { lock.aliases[0].path = "ai/contracts/unregistered.schema.json"; }],
  ["alias canonical id", (lock) => { lock.aliases[0].target += "/other"; }],
  ["duplicate alias", (lock) => { lock.aliases[1] = lock.aliases[0]; }],
  ["duplicate source", (lock) => { lock.files[1] = lock.files[0]; }],
  ["source path escape", (lock) => { lock.files[0].path = "../outside.schema.json"; }],
  ["source hash", (lock) => { lock.files[0].sha256 = "0".repeat(64); }],
]) test(`rejects candidate lock ${name}`, () => fixture((root, editLock) => {
  editLock(mutation); assert.throws(() => validate(root));
}));
test("missing lock fails closed", () => fixture((root) => {
  unlinkSync(path.join(root, PROVIDER_LOCK)); assert.throws(() => validate(root));
}));
test("missing alias fails closed", () => fixture((root) => {
  unlinkSync(path.join(root, "ai/contracts/provider-error.schema.json")); assert.throws(() => validate(root));
}));
test("changed alias owner/target fails closed", () => fixture((root) => {
  const file = path.join(root, "ai/contracts/provider-error.schema.json");
  const schema = JSON.parse(readFileSync(file)); schema.$ref = "https://other.invalid/error.schema.json";
  writeFileSync(file, JSON.stringify(schema)); assert.throws(() => validate(root));
}));
test("a source symlink outside its owned snapshot fails closed", () => fixture((root) => {
  const relative = ".platform/ecp/ai.provider-access/schema.provider-error.json";
  const target = path.join(root, relative); const outside = path.join(root, "outside.json");
  cpSync(target, outside); unlinkSync(target); symlinkSync(outside, target);
  assert.throws(() => validate(root), /escapes/);
}));
test("an unknown additional AI alias is not excluded from the legacy authority gate", () => fixture((root) => {
  const file = path.join(root, "ai/contracts/unregistered.schema.json");
  writeFileSync(file, JSON.stringify({ $id: "platform-core/ai/unregistered", type: "object" }));
  assert.match(validate(root).join("\n"), /unregistered.*no row/);
}));

test("a self-consistent source hash cannot authorize a different canonical schema id", () => fixture((root, editLock) => {
  const relative = ".platform/ecp/ai.provider-access/schema.provider-error.json";
  const file = path.join(root, relative);
  const schema = JSON.parse(readFileSync(file)); schema.$id = "https://other.invalid/schema.json";
  const bytes = JSON.stringify(schema); writeFileSync(file, bytes);
  editLock((lock) => { lock.files.find((entry) => entry.path === relative).sha256 = createHash("sha256").update(bytes).digest("hex"); });
  assert.throws(() => validate(root), /unexpected ECP schema authority/);
}));

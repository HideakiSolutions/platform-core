import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { crossCheck, expectedClaim, main } from "./validate-ledger-authority.mjs";
import { loadRepository } from "./validate-capability-authority.mjs";
import { validateLedger } from "./validate-release-ledger.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = path.join(repoRoot, "scripts", "fixtures", "release-ledger", "positive.fixture.json");
const CAP = "example.synthetic-capability";
const PIN = { tag: "contracts-v0.4.0", commit: "a".repeat(40), capabilities: [{ id: CAP, version: "0.1.0" }] };
const row = (over = {}) => ({ capability: CAP, classification: "ecp-canonical", canonical_source: `ecp:${CAP}@0.1.0`, version_or_resolution_policy: "", legacy_identifiers: "", claimed_status: "supported", evidence: "e", notes: "", ...over });
const ledger = (mutate = () => {}) => { const d = JSON.parse(readFileSync(FIXTURE, "utf8")); mutate(d); return d; };
const check = (over = {}, mutate, rows) => crossCheck({ ledger: ledger(mutate), rows: rows ?? [row(over)], pin: PIN });
const has = (problems, text) => assert.ok(problems.some((p) => p.includes(text)), `expected '${text}' in ${JSON.stringify(problems)}`);
const cli = (root) => { const e = console.error, l = console.log; const seen = []; console.error = (m) => seen.push(m); console.log = () => {}; try { return { code: main(root, []), seen: seen.join("\n") }; } finally { console.error = e; console.log = l; } };
const byState = (d, s) => d.releases.find((r) => r.state === s);

describe("ledger x authority: consistent input", () => {
  it("accepts a synthetic ledger that agrees with its row", () => assert.deepEqual(check(), []));
  it("accepts an empty ledger when every claim is none", () => assert.deepEqual(crossCheck({ ledger: { schemaVersion: "1", releases: [] }, rows: [row({ claimed_status: "none" })], pin: PIN }), []));
  it("accepts the committed repository state through the CLI", () => {
    const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "validate-ledger-authority.mjs")], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  });
  it("is clean on the committed table against an empty ledger", () => {
    assert.deepEqual(crossCheck({ ledger: { schemaVersion: "1", releases: [] }, ...loadRepository(repoRoot) }), []);
  });
});

describe("ledger x authority: negatives", () => {
  it("rejects a capability with no row in the table", () => has(check({ capability: "other.thing" }), "no row in the authority table"));
  it("rejects contractAuthority that disagrees with the classification", () => {
    has(check({}, (d) => { byState(d, "candidate").contractAuthority = "core"; }), "expects 'ecp'");
    has(check({ classification: "core-canonical", canonical_source: "platform-core:x/contracts/y.schema.json" }), "expects 'core'");
  });
  it("rejects any release of an unknown row beyond candidate", () => {
    has(check({ classification: "unknown", canonical_source: "", claimed_status: "supported" }), "cannot go beyond 'candidate'");
  });
  it("allows an unknown row at candidate", () => {
    const only = (d) => { d.releases = [byState(d, "candidate")]; };
    assert.deepEqual(check({ classification: "unknown", canonical_source: "", claimed_status: "candidate" }, only), []);
  });
  it("rejects a release of a compatibility or deprecated stub", () => {
    for (const classification of ["compatibility", "deprecated"]) has(check({ classification }), "cannot be released as canonical");
  });
  it("rejects a release under a legacy identifier of a canonical row", () => {
    const rows = [row({ capability: "x.y", canonical_source: "ecp:x.y@0.1.0", legacy_identifiers: `platform-core/${CAP.replace(".", "/")}`, claimed_status: "none" })];
    has(crossCheck({ ledger: ledger((d) => { d.releases = [{ ...byState(d, "candidate"), capability: CAP.replace(".", "/") }]; }), rows, pin: PIN }), "legacy identifier of 'x.y'");
  });
  it("rejects an ecp-canonical contractVersion that differs from the pin", () => {
    has(check({}, (d) => { byState(d, "candidate").contractVersion = "0.2.0"; }), "differs from the version pinned in contracts-v0.4.0");
  });
  it("rejects an ecp-canonical release whose capability is not in the pin", () => {
    has(crossCheck({ ledger: ledger(), rows: [row()], pin: { ...PIN, capabilities: [{ id: "other.cap", version: "0.1.0" }] } }), "not in the pinned ECP registry");
  });
  it("rejects a claim above what the ledger derives", () => has(check({ claimed_status: "supported" }, (d) => { d.releases = [byState(d, "admitted")]; }), "derives 'admitted'"));
  it("rejects a stale claim below what the ledger derives", () => has(check({ claimed_status: "candidate" }), "derives 'supported'"));
  it("rejects a claim when no release is recorded", () => {
    has(crossCheck({ ledger: { schemaVersion: "1", releases: [] }, rows: [row({ claimed_status: "published" })], pin: PIN }), "no release recorded");
  });
  it("derives the claim from evidence, not from the declared state", () => {
    const d = ledger((x) => { const r = byState(x, "supported"); r.support.operationalEvidenceRefs = [r.support.operationalEvidenceRefs[0]]; });
    assert.ok(validateLedger(d).length > 0, "the ledger itself must also reject the false state");
    assert.equal(expectedClaim(d.releases.filter((r) => r.state === "supported")), "adopted");
  });
});

describe("ledger x authority: reuses the existing parsers", () => {
  it("fails closed through the CLI on a missing ledger", () => {
    const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "validate-ledger-authority.mjs"), "does-not-exist.json"], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /not found/);
  });
});

describe("ledger x authority: inputs fail closed even with an empty ledger", () => {
  const empty = { schemaVersion: "1", releases: [] };
  it("rejects a missing or malformed pin", () => {
    for (const pin of [undefined, null, {}, { ...PIN, capabilities: [] }, { ...PIN, commit: "abc" }, { ...PIN, capabilities: "x" }]) {
      has(crossCheck({ ledger: empty, rows: [row({ claimed_status: "none" })], pin }), "pin projection is missing or malformed");
    }
  });
  it("rejects a missing or empty table", () => {
    for (const rows of [undefined, []]) has(crossCheck({ ledger: empty, rows, pin: PIN }), "authority table is missing");
  });
  it("fails the CLI when the pin or the table is absent from the repository", () => {
    const root = mkdtempSync(path.join(process.env.TMPDIR, "la-"));
    try {
      cpSync(path.join(repoRoot, "docs"), path.join(root, "docs"), { recursive: true });
      rmSync(path.join(root, "docs/architecture/contract-authority/ecp-pin.json"));
      let r = cli(root); assert.equal(r.code, 1); assert.match(r.seen, /pin projection is missing|no ECP pin/);
      cpSync(path.join(repoRoot, "docs/architecture/contract-authority/ecp-pin.json"), path.join(root, "docs/architecture/contract-authority/ecp-pin.json"));
      writeFileSync(path.join(root, "docs/architecture/contract-authority/ecp-pin.json"), "{");
      r = cli(root); assert.equal(r.code, 1); assert.match(r.seen, /JSON|position/i);
      rmSync(path.join(root, "docs/architecture/contract-authority/capability-authority.csv"));
      r = cli(root); assert.equal(r.code, 1); assert.match(r.seen, /not found/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

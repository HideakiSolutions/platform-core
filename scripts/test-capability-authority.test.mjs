import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { COLUMNS, CSV_PATH, checkAuthority, checkRegistry, loadRepository, parseCsv } from "./validate-capability-authority.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(repoRoot, "scripts", "validate-capability-authority.mjs");
const SHA = "ab1fcc92797224c428ec6362e02ee1eaf2de8abb";
const PIN_OBJ = { tag: "contracts-v0.4.0", commit: SHA, registry_sha256: "0".repeat(64), capabilities: [{ id: "x.y", version: "0.1.0" }] };
const PIN_ZW = { ...PIN_OBJ, capabilities: [...PIN_OBJ.capabilities, { id: "z.w", version: "0.1.0" }] };
const PIN = "0.1.0 @ contracts-v0.4.0 (ab1fcc92797224c428ec6362e02ee1eaf2de8abb)";

const row = (over) => ({
  capability: "x.y", classification: "ecp-canonical", canonical_source: "ecp:x.y@0.1.0",
  version_or_resolution_policy: PIN, legacy_identifiers: "", claimed_status: "none", evidence: "e", notes: "", ...over,
});
const stub = (over = {}) => ({
  key: "demo/legacy", file: "demo/contracts/legacy.schema.json",
  schema: { $id: "platform-core/demo/legacy", $ref: "https://contracts.hideakisolutions.local/capabilities/x.y/l.schema.json", deprecated: true, "x-superseded-by": "x.y@0.1.0", ...over },
});
const live = (key = "demo/live") => ({ key, file: `${key.split("/")[0]}/contracts/${key.split("/")[1]}.schema.json`, schema: { $id: `platform-core/${key}`, type: "object" } });
const stubRow = (over) => row({ capability: "demo/legacy", classification: "compatibility", canonical_source: "ecp:x.y@0.1.0", version_or_resolution_policy: "", ...over });
const liveRow = (over) => row({ capability: "demo/live", classification: "core-canonical", canonical_source: "platform-core:demo/contracts/live.schema.json", version_or_resolution_policy: "in-repo", ...over });
const check = (rows, schemas = [], moduleDirs = new Set(["demo"]), pin = PIN_OBJ) => checkAuthority({ header: COLUMNS, rows, schemas, moduleDirs, pin });
const has = (problems, text) => assert.ok(problems.some((p) => p.includes(text)), `expected a problem containing '${text}', got: ${JSON.stringify(problems)}`);

describe("capability authority: positive baseline", () => {
  it("accepts a consistent table", () => {
    assert.deepEqual(check([row(), stubRow(), liveRow()], [stub(), live()]), []);
  });
  it("accepts an explicit resolution policy instead of a pin", () => {
    assert.deepEqual(check([row({ version_or_resolution_policy: "policy: vendored-bundle-lockfile" })]), []);
  });
});

describe("capability authority: negative cases", () => {
  it("rejects a duplicate capability row (double authority)", () => {
    has(check([row(), row({ classification: "core-canonical", canonical_source: "platform-core:x" })]), "duplicate capability row");
  });
  it("rejects an invalid classification", () => {
    has(check([row({ classification: "canonical" })]), "invalid classification");
  });
  it("rejects ecp-canonical without a pin or policy", () => {
    has(check([row({ version_or_resolution_policy: "" })]), "pinned version");
    has(check([row({ version_or_resolution_policy: "0.1.0 @ develop" })]), "pinned version");
  });
  it("rejects a canonical row with two sources", () => {
    has(check([row({ canonical_source: "ecp:x.y@0.1.0; platform-core:x/y" })]), "exactly one canonical_source");
  });
  it("rejects a core-canonical row whose schema is an ECP stub", () => {
    const problems = check([row(), stubRow({ classification: "core-canonical", canonical_source: "platform-core:demo/contracts/legacy.schema.json", version_or_resolution_policy: "in-repo" })], [stub()]);
    has(problems, "double authority");
  });
  it("rejects a stub whose x-superseded-by has no ecp-canonical row", () => {
    has(check([stubRow()], [stub()]), "has no ecp-canonical row");
    has(check([row({ classification: "unknown", canonical_source: "", version_or_resolution_policy: "" }), stubRow()], [stub()]), "has no ecp-canonical row");
  });
  it("rejects a legacy identifier owned by an ecp-canonical and a core-canonical row", () => {
    has(check([row({ legacy_identifiers: "platform-core/demo/live" }), liveRow()], [live()]), "double authority");
  });
  it("rejects a legacy identifier claimed by two canonical rows", () => {
    has(check([row({ legacy_identifiers: "old" }), row({ capability: "z.w", canonical_source: "ecp:z.w@0.1.0", legacy_identifiers: "old" })], [], new Set(), PIN_ZW), "claimed by two canonical rows");
  });
  it("rejects supported outright and admitted-or-higher claims without exactly one canonical source", () => {
    has(check([row({ classification: "unknown", canonical_source: "", version_or_resolution_policy: "", claimed_status: "admitted" })]), "requires exactly one canonical source");
    has(check([row({ classification: "compatibility", claimed_status: "adopted" })]), "requires exactly one canonical source");
    has(check([row({ claimed_status: "published", canonical_source: "ecp:a.b@0.1.0, platform-core:a/b" })]), "requires exactly one canonical source");
    has(check([row({ claimed_status: "supported" })]), "'supported' is rejected");
    has(check([row({ classification: "unknown", canonical_source: "", version_or_resolution_policy: "", claimed_status: "admitted" })]), "requires exactly one canonical source");
  });
  it("rejects any resolution policy outside the allowlist", () => {
    for (const text of ["policy: track develop", "policy: track MAIN", "policy: latest", "policy: track origin/dev", "policy: nightly"]) {
      has(check([row({ version_or_resolution_policy: text })]), "moving or unknown policies are rejected");
    }
    assert.deepEqual(check([row({ version_or_resolution_policy: "policy: vendored-bundle-lockfile" })]), []);
  });
  it("rejects a row whose cell count differs from the header", () => {
    const { header, rows } = parseCsv(`${COLUMNS.join(",")}\nx.y,ecp-canonical,ecp:x.y@0.1.0,"${PIN}",,none,e\n`);
    has(checkAuthority({ header, rows, schemas: [], pin: PIN_OBJ }), "cells, expected 8");
  });
  it("rejects a stub classified unknown, or pointing at another capability", () => {
    has(check([row(), stubRow({ classification: "unknown" })], [stub()]), "must be classified compatibility or deprecated");
    has(check([row(), row({ capability: "cache.typed", canonical_source: "ecp:cache.typed@0.1.0" }), stubRow({ canonical_source: "ecp:cache.typed@0.1.0" })], [stub()], new Set(["demo"]), { ...PIN_OBJ, capabilities: [...PIN_OBJ.capabilities, { id: "cache.typed", version: "0.1.0" }] }), "stub canonical_source must be");
  });
  it("rejects ecp rows that disagree with the pinned projection", () => {
    has(check([row({ version_or_resolution_policy: `0.1.0 @ contracts-v0.4.0 (${"0".repeat(40)})` })]), "differs from pinned");
    has(check([row({ canonical_source: "ecp:x.y@9.9.9", version_or_resolution_policy: `9.9.9 @ contracts-v0.4.0 (${SHA})` })]), "differs from pinned");
    has(check([row({ capability: "foo.bar", canonical_source: "ecp:foo.bar@0.1.0" }), row({ capability: "z.w", canonical_source: "ecp:z.w@0.1.0" })]), "not in the pinned ECP registry");
    has(check([row({ version_or_resolution_policy: `0.1.0 @ contracts-v0.9.0 (${SHA})` })]), "differs from pinned contracts-v0.4.0");
  });
  it("rejects a pinned capability that has no row", () => {
    has(check([row()], [], new Set(), PIN_ZW), "z.w: pinned ECP capability has no ecp-canonical row");
  });
  it("rejects extra columns", () => {
    has(checkAuthority({ header: [...COLUMNS, "owner"], rows: [], schemas: [], pin: PIN_OBJ }), "unexpected column");
  });
  it("checkRegistry fails on a tampered registry file", () => {
    const bytes = Buffer.from(JSON.stringify({ capabilities: [{ name: "x.y", version: "0.1.0" }] }));
    const problems = checkRegistry({ ...PIN_OBJ, capabilities: [{ id: "x.y", version: "0.2.0" }] }, bytes);
    has(problems, "sha256");
    has(problems, "differs from the projection");
  });
  it("rejects a schema without a row, and a row without a schema", () => {
    has(check([], [live()]), "has no row");
    has(check([liveRow()]), "no schema file");
  });
  it("rejects a non-stub schema labelled compatibility", () => {
    has(check([liveRow({ classification: "compatibility", canonical_source: "ecp:x.y@0.1.0" }), row()], [live()]), "is not a stub");
  });
  it("rejects a missing column", () => {
    has(checkAuthority({ header: COLUMNS.slice(1), rows: [], schemas: [] }), "missing column");
  });
});

describe("capability authority: repository and CLI", () => {
  const temps = [];
  after(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));
  const run = (cwd) => spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });

  it("passes on this repository", () => {
    const result = run(repoRoot);
    assert.equal(result.status, 0, result.stderr);
  });
  it("parses quoted CSV fields", () => {
    const { rows } = parseCsv('a,b\n"x,1","he said ""hi"""\n');
    assert.deepEqual(rows, [{ a: "x,1", b: 'he said "hi"', _cells: 2 }]);
  });
  it("fails the CLI when the committed table gets a duplicate row", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cap-authority-"));
    temps.push(dir);
    for (const name of ["auth", "messaging"]) cpSync(path.join(repoRoot, name, "contracts"), path.join(dir, name, "contracts"), { recursive: true });
    const real = readFileSync(path.join(repoRoot, CSV_PATH), "utf8").trimEnd().split("\n");
    mkdirSync(path.dirname(path.join(dir, CSV_PATH)), { recursive: true });
    writeFileSync(path.join(dir, CSV_PATH), [...real, real[1]].join("\n") + "\n");
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /duplicate capability row/);
  });
  it("loads every schema of this repository", () => {
    assert.ok(loadRepository(repoRoot).schemas.length >= 24);
  });
});

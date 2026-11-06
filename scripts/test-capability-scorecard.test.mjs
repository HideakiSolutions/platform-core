import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { loadRepository } from "./validate-capability-authority.mjs";
import { NOT_VERIFIED, NO_RELEASE, SCORECARD_PATH, main, ownerOf, renderScorecard } from "./generate-capability-scorecard.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = process.env.TMPDIR;
assert.ok(tmp && tmp !== "/tmp", "TMPDIR must be set outside /tmp");
const scratch = mkdtempSync(path.join(tmp, "scorecard-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const repo = loadRepository(repoRoot);
const fragment = JSON.parse(readFileSync(path.join(repoRoot, ".platform", "capability-graph.fragment.json"), "utf8"));
const empty = { schemaVersion: "1", releases: [] };
const cli = (root, ...args) => { let code; const err = console.error; const out = console.log; console.error = () => {}; console.log = () => {}; try { code = main(root, args); } finally { console.error = err; console.log = out; } return code; };
const sandbox = () => {
  const root = mkdtempSync(path.join(scratch, "repo-"));
  for (const f of ["docs/architecture/contract-authority", "docs/release", ".platform"]) cpSync(path.join(repoRoot, f), path.join(root, f), { recursive: true });
  mkdirSync(path.join(root, "docs/capabilities"), { recursive: true });
  return root;
};

describe("scorecard: honest output with an empty ledger", () => {
  const { text, total, withRelease } = renderScorecard({ ...repo, ledger: empty, fragment });
  it("states it is not a registry and adds no status field", () => {
    assert.match(text, /not a registry/);
    assert.match(text, /no status field/);
  });
  it("reports nothing above 'no release recorded'", () => {
    assert.equal(withRelease, 0);
    const states = text.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| Capability")).map((l) => l.split(" | ")[4]);
    assert.equal(states.length, total);
    assert.ok(states.every((s) => s === NO_RELEASE), states.join());
  });
  it("is deterministic and carries no timestamps", () => {
    assert.equal(renderScorecard({ ...repo, ledger: empty, fragment }).text, text);
    assert.doesNotMatch(text, /\b20\d\d-\d\d-\d\d\b|T\d\d:\d\d/);
  });
  it("lists every row of the authority table exactly once", () => {
    assert.equal(total, repo.rows.length);
    for (const r of repo.rows) assert.equal(text.split(`| ${r.capability} |`).length - 1, 1, r.capability);
  });
  it("derives an owner only from the graph fragment and never guesses", () => {
    const intake = repo.rows.find((r) => r.capability === "governance/capability-intake");
    assert.equal(ownerOf(intake, fragment), "Platform Architecture Owners");
    assert.equal(ownerOf(repo.rows.find((r) => r.classification === "ecp-canonical"), fragment), NOT_VERIFIED);
    assert.equal(ownerOf(repo.rows.find((r) => r.classification === "unknown"), fragment), NOT_VERIFIED);
    assert.equal(ownerOf(intake, undefined), NOT_VERIFIED);
  });
});

describe("scorecard: derived state comes from evidence", () => {
  it("shows the derived state, the evidence count and the blocked reason of a release", () => {
    const rows = [{ capability: "x.y", classification: "ecp-canonical", canonical_source: "ecp:x.y@0.1.0", version_or_resolution_policy: "", legacy_identifiers: "", claimed_status: "candidate", evidence: "", notes: "" }];
    const pin = { tag: "contracts-v0.4.0", commit: "a".repeat(40), capabilities: [{ id: "x.y", version: "0.1.0" }] };
    const ledger = JSON.parse(readFileSync(path.join(repoRoot, "scripts/fixtures/release-ledger/positive.fixture.json"), "utf8"));
    const r = ledger.releases.find((x) => x.state === "candidate");
    const { text } = renderScorecard({ rows, pin, ledger: { schemaVersion: "1", releases: [{ ...r, capability: "x.y" }] }, fragment });
    const line = text.split("\n").find((l) => l.startsWith("| x.y |"));
    assert.match(line, /\| candidate \| 1 \| not_verified \| .*package\.version/);
  });
});

describe("scorecard: --check", () => {
  it("passes on the committed file", () => assert.equal(cli(repoRoot, "--check"), 0));
  it("fails when the file is missing or stale, and does not write in check mode", () => {
    const root = sandbox();
    assert.equal(cli(root, "--check"), 1);
    assert.equal(cli(root), 0);
    assert.equal(cli(root, "--check"), 0);
    const file = path.join(root, SCORECARD_PATH);
    writeFileSync(file, readFileSync(file, "utf8").replace("| Capability |", "| Capability (edited) |"));
    assert.equal(cli(root, "--check"), 1);
    assert.match(readFileSync(file, "utf8"), /edited/);
    assert.equal(cli(root), 0);
    assert.equal(cli(root, "--check"), 0);
  });
  it("refuses to render a ledger whose claim the table does not follow", () => {
    const root = sandbox();
    assert.equal(cli(root), 0);
    const fixture = JSON.parse(readFileSync(path.join(repoRoot, "scripts/fixtures/release-ledger/positive.fixture.json"), "utf8"));
    const ledgerFile = path.join(root, "docs/release/release-ledger.json");
    writeFileSync(ledgerFile, JSON.stringify({ schemaVersion: "1", releases: [{ ...fixture.releases[0], capability: "auth.authenticate" }] }));
    // claimed_status is still 'none': the cross-check must refuse to render rather than produce a lying scorecard.
    assert.equal(cli(root, "--check"), 1);
  });
  it("refuses to render from an invalid ledger", () => {
    const root = sandbox();
    writeFileSync(path.join(root, "docs/release/release-ledger.json"), "");
    assert.equal(cli(root), 1);
  });
  it("rejects unknown arguments", () => assert.equal(cli(repoRoot, "--write"), 1));
  it("runs through the CLI", () => {
    const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts/generate-capability-scorecard.mjs"), "--check"], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  });
});

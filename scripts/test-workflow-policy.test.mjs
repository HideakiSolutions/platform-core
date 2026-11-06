import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { applyBaseline, checkWorkflow, scanDir } from "./validate-workflow-policy.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(repoRoot, "scripts", "validate-workflow-policy.mjs");
const scratch = mkdtempSync(path.join(tmpdir(), "workflow-policy-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

// All fixtures are synthetic. The "pinned" ref is an obviously fake all-"a" hash; no token-shaped value appears anywhere.
const PIN = "a".repeat(40);
const OK_USES = `actions/checkout@${PIN} # v1.0.0`;
const rules = (text) => checkWorkflow(text).map((f) => f.rule);
const has = (text, rule) => assert.ok(rules(text).includes(rule), `expected ${rule}, got ${JSON.stringify(checkWorkflow(text))}`);
const lacks = (text, rule) => assert.ok(!rules(text).includes(rule), `unexpected ${rule}: ${JSON.stringify(checkWorkflow(text))}`);
/** Workflow with block-style steps. */
const wf = (steps, { top = "permissions:\n  contents: read\n", on = "on: push\n", job = "" } = {}) =>
  `name: t\n${on}${top}jobs:\n  j:\n    runs-on: ubuntu-latest\n${job}    steps:\n${steps}`;
const GOOD = `      - uses: ${OK_USES}\n`;

describe("clean workflow", () => {
  it("accepts SHA pins with a version comment, read-only permissions and local actions", () =>
    assert.deepEqual(checkWorkflow(wf(GOOD + "      - uses: ./.github/actions/x\n      - run: echo hello\n")), []));
  it("accepts a docker reference pinned by digest", () => assert.deepEqual(checkWorkflow(wf(`      - uses: docker://alpine@sha256:${"b".repeat(64)}\n`)), []));
  it("accepts a reusable-workflow job pinned by SHA", () =>
    assert.deepEqual(checkWorkflow(`name: t\non: push\npermissions: read-all\njobs:\n  c:\n    uses: o/r/.github/workflows/x.yml@${PIN} # v1\n`), []));
});

describe("unparseable input fails closed", () => {
  it("rejects invalid YAML", () => has("a: [unclosed\n", "yaml-invalid"));
  it("rejects duplicate keys (a second `permissions:` could hide the first)", () => has("name: t\non: push\npermissions: write-all\npermissions:\n  contents: read\njobs: {}\n", "yaml-invalid"));
});

describe("unpinned actions", () => {
  for (const ref of ["main", "v4", "v4.1.2", "abc1234", "a".repeat(39), "A".repeat(40)]) {
    it(`rejects @${ref.length > 12 ? ref.slice(0, 8) + "..." : ref}`, () => has(wf(`      - uses: actions/checkout@${ref} # v1\n`), "unpinned-action"));
  }
  it("rejects a missing ref", () => has(wf("      - uses: actions/checkout\n"), "unpinned-action"));
  it("rejects a SHA pin without the version comment", () => has(wf(`      - uses: actions/checkout@${PIN}\n`), "unpinned-action"));
  it("rejects a reusable workflow called by branch", () => has(`name: t\non: push\npermissions: read-all\njobs:\n  c:\n    uses: o/r/.github/workflows/x.yml@main\n`, "unpinned-action"));
  it("rejects a docker reference by tag", () => has(wf("      - uses: docker://alpine:3\n"), "unpinned-action"));
  // regression: forms the line regex missed
  it("rejects flow-style `{uses: a/b@v4}`", () => has(wf("      - {uses: actions/checkout@v4}\n"), "unpinned-action"));
  it("rejects a quoted key", () => has(wf('      - "uses": actions/checkout@v4\n'), "unpinned-action"));
  it("rejects a quoted value", () => has(wf("      - uses: 'actions/checkout@v4'\n"), "unpinned-action"));
  it("rejects a flow-style SHA pin (it cannot carry the version comment)", () => has(wf(`      - {uses: actions/checkout@${PIN}}\n`), "unpinned-action"));
  it("rejects an unpinned `uses` reached through a YAML anchor", () =>
    has(wf(`      - &s\n        uses: actions/checkout@v4\n      - *s\n`), "unpinned-action"));
  it("rejects an unpinned job `uses` in flow style", () => has(`name: t\non: push\npermissions: read-all\njobs: {c: {uses: "o/r/.github/workflows/x.yml@v1"}}\n`, "unpinned-action"));
});

describe("permissions", () => {
  it("rejects a missing top-level block", () => has(wf(GOOD, { top: "" }), "permissions-missing"));
  it("rejects top-level write-all", () => has(wf(GOOD, { top: "permissions: write-all\n" }), "permissions-write-all"));
  it("rejects a top-level write scope", () => has(wf(GOOD, { top: "permissions:\n  contents: write\n" }), "permissions-write-all"));
  it("rejects a top-level write scope in flow style", () => has(wf(GOOD, { top: "permissions: {contents: write}\n" }), "permissions-write-all"));
  it("does not mistake a job-level block for the top-level one", () => has(wf(GOOD, { top: "", job: "    permissions:\n      contents: read\n" }), "permissions-missing"));
  // regression: job level was invisible to the line regex
  it("rejects job-level write-all", () => has(wf(GOOD, { job: "    permissions: write-all\n" }), "job-permissions-write"));
  it("rejects a job-level write scope", () => has(wf(GOOD, { job: "    permissions:\n      contents: write\n" }), "job-permissions-write"));
  it("rejects a job-level write scope in flow style with quoted keys", () => has(wf(GOOD, { job: '    "permissions": {"contents": "write"}\n' }), "job-permissions-write"));
  it("rejects a job-level write scope introduced by an anchor and merge key", () =>
    has(`name: t\non: push\npermissions: read-all\nx-perm: &p\n  contents: write\njobs:\n  j:\n    runs-on: x\n    permissions:\n      <<: *p\n    steps:\n${GOOD}`, "job-permissions-write"));
  it("allows job-level read", () => lacks(wf(GOOD, { job: "    permissions:\n      contents: read\n" }), "job-permissions-write"));
});

describe("pull_request_target", () => {
  const prt = "on: pull_request_target\n";
  const withRef = (k, v) => `${GOOD}        with:\n          ${k}: ${v}\n`;
  it("rejects checkout of the PR head ref", () => has(wf(withRef("ref", "${{ github.event.pull_request.head.sha }}"), { on: prt }), "prt-head-checkout"));
  it("rejects checkout of a head repository", () => has(wf(withRef("repository", "${{ github.event.pull_request.head.repo.full_name }}"), { on: prt }), "prt-head-checkout"));
  it("rejects refs/pull/*/merge", () => has(wf(withRef("ref", "refs/pull/1/merge"), { on: prt }), "prt-head-checkout"));
  it("rejects the trigger declared in a list", () => has(wf(withRef("ref", "${{ github.head_ref }}"), { on: "on: [push, pull_request_target]\n" }), "prt-head-checkout"));
  it("rejects the trigger declared in flow style", () => has(wf(withRef("ref", "${{ github.head_ref }}"), { on: "on: {pull_request_target: {types: [opened]}}\n" }), "prt-head-checkout"));
  // regression: flow-style with, shell checkout, env indirection
  it("rejects a flow-style `with`", () => has(wf(`      - {uses: actions/checkout@${PIN}, with: {ref: "\${{ github.event.pull_request.head.sha }}"}}\n`, { on: prt }), "prt-head-checkout"));
  it("rejects `git checkout` in run", () => has(wf(`${GOOD}      - run: git fetch origin pull/1/head && git checkout FETCH_HEAD\n`, { on: prt }), "prt-head-checkout"));
  it("rejects `gh pr checkout` in run", () => has(wf(`${GOOD}      - run: gh pr checkout 1\n`, { on: prt }), "prt-head-checkout"));
  it("rejects a checkout whose ref comes from env indirection", () =>
    has(wf(withRef("ref", "${{ env.TARGET }}"), { on: prt, top: "permissions:\n  contents: read\nenv:\n  TARGET: ${{ github.event.pull_request.head.sha }}\n" }), "prt-head-checkout"));
  it("rejects a checkout whose ref comes from a step output", () => has(wf(withRef("ref", "${{ steps.x.outputs.ref }}"), { on: prt }), "prt-head-checkout"));
  it("allows pull_request_target that only checks out the base", () => lacks(wf(GOOD, { on: prt }), "prt-head-checkout"));
  it("does not flag a head checkout under plain pull_request", () => lacks(wf(withRef("ref", "${{ github.event.pull_request.head.sha }}"), { on: "on: pull_request\n" }), "prt-head-checkout"));
});

describe("secrets in run steps", () => {
  const run = (cmd, env = "") => wf(`${GOOD}      - ${env}run: ${cmd}\n`);
  const envStep = (cmd) => wf(`${GOOD}      - env:\n          V: \${{ secrets.X }}\n        run: ${cmd}\n`);
  for (const cmd of ['echo "${{ secrets.DEPLOY_VALUE }}"', "curl -d ${{ secrets.X }} https://example.invalid", "./deploy.sh ${{ secrets.X }}"]) {
    it(`rejects a secrets expression inside run: ${cmd}`, () => has(run(cmd), "secret-in-run"));
  }
  for (const cmd of ["echo $V", 'echo "v=${V}"', "printf '%s' \"$V\"", "cat <<< $V", "curl -d \"$V\" https://example.invalid", "echo $V | tee out.txt", "env", "set -x"]) {
    it(`rejects an env value mapped from a secret and printed: ${cmd}`, () => has(envStep(cmd), "secret-echo"));
  }
  it("rejects a secret-mapped env var printed from a heredoc body", () => has(envStep("|\n          cat <<EOF\n          v=$V\n          EOF"), "secret-echo"));
  it("sees a secret mapped at job level", () =>
    has(wf(`${GOOD}      - run: echo $V\n`, { job: "    env:\n      V: ${{ secrets.X }}\n" }), "secret-echo"));
  it("sees a secret mapped at workflow level and aliased through an anchor", () =>
    has(`name: t\non: push\npermissions: read-all\nenv: &e\n  V: \${{ secrets.X }}\njobs:\n  j:\n    runs-on: x\n    env: *e\n    steps:\n      - run: echo $V\n`, "secret-echo"));
  it("rejects a credential-named variable printed", () => has(run('echo "value=$API_TOKEN"'), "secret-echo"));
  it("allows passing a secret through env to a command that does not print it", () => lacks(envStep("./deploy.sh"), "secret-echo"));
  it("allows an env-mapped secret that is not referenced by a printing command", () => lacks(envStep('./tool --token-env V'), "secret-echo"));
  it("does not flag unrelated echo", () => lacks(run('echo "TMPDIR=$RUNNER_TEMP" >> "$GITHUB_ENV"'), "secret-echo"));
});

describe("baseline ratchet", () => {
  const f = (n) => Array.from({ length: n }, () => ({ file: "a.yml", rule: "unpinned-action", match: "x/y@v1", where: "w", detail: "d" }));
  const entry = { file: "a.yml", rule: "unpinned-action", match: "x/y@v1", reason: "legacy workflow, tracked for pinning" };
  it("fails a violation that is not baselined", () => assert.equal(applyBaseline(f(1), { entries: [] }).problems.length, 1));
  it("tolerates a baselined violation", () => assert.deepEqual(applyBaseline(f(1), { entries: [entry] }).problems, []));
  it("fails a stale entry so the baseline only shrinks", () => assert.match(applyBaseline([], { entries: [entry] }).problems[0], /stale entry/));
  it("fails an entry without a written reason", () => assert.match(applyBaseline(f(1), { entries: [{ ...entry, reason: "" }] }).problems.join("\n"), /needs a written reason/));
  it("fails a duplicate entry", () => assert.match(applyBaseline(f(1), { entries: [entry, entry] }).problems.join("\n"), /duplicate entry/));
  it("counts occurrences exactly: a second occurrence of a baselined violation fails", () =>
    assert.match(applyBaseline(f(2), { entries: [entry] }).problems.join("\n"), /new occurrences are not allowed/));
  it("counts occurrences exactly: a recorded count above the live count fails", () =>
    assert.match(applyBaseline(f(1), { entries: [{ ...entry, count: 2 }] }).problems.join("\n"), /lower the count/));
  it("accepts the exact count", () => assert.deepEqual(applyBaseline(f(2), { entries: [{ ...entry, count: 2 }] }).problems, []));
  it("fails an entry that is new relative to the base baseline", () => assert.match(applyBaseline(f(1), { entries: [entry] }, { entries: [] }).problems[0], /may not grow/));
  it("fails a count that grew relative to the base baseline", () =>
    assert.match(applyBaseline(f(2), { entries: [{ ...entry, count: 2 }] }, { entries: [entry] }).problems[0], /count grew/));
  it("accepts an entry already present in the base baseline", () => assert.deepEqual(applyBaseline(f(1), { entries: [entry] }, { entries: [entry] }).problems, []));
  it("allows a job-level write only through a baseline entry with a reason", () => {
    const found = checkWorkflow(wf(GOOD, { job: "    permissions:\n      contents: write\n" })).map((x) => ({ file: "w.yml", ...x }));
    assert.ok(applyBaseline(found, { entries: [] }).problems.length > 0);
    const e = { file: "w.yml", rule: "job-permissions-write", match: "jobs.j:contents", reason: "release job publishes the package" };
    assert.deepEqual(applyBaseline(found, { entries: [e] }).problems, []);
  });
});

describe("this repository", () => {
  it("passes the committed baseline", () => {
    const r = spawnSync(process.execPath, [script], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  });
  it("applies to the new workflows with no baseline entry", () => {
    const entries = JSON.parse(readFileSync(path.join(repoRoot, ".github/workflow-policy.baseline.json"), "utf8")).entries;
    assert.ok(!entries.some((e) => /supply-chain/.test(e.file)));
    assert.ok(!scanDir(repoRoot).some((x) => /supply-chain/.test(x.file)));
  });
  it("fails the CLI when a bad workflow is added and the baseline is not touched", () => {
    const root = path.join(scratch, "cli");
    mkdirSync(path.join(root, ".github/workflows"), { recursive: true });
    writeFileSync(path.join(root, ".github/workflows/bad.yml"), wf("      - uses: actions/checkout@main\n", { top: "" }));
    const r = spawnSync(process.execPath, [script, "--root", root], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /unpinned-action/);
    assert.match(r.stderr, /permissions-missing/);
  });
});

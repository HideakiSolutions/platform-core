// AC-11 (CEP WP-11): one synthetic defect per implemented class must be rejected by its gate.
// Classes: secret detection (gitleaks + canary rule), dependency audit (npm), SBOM, workflow policy.
// External tools are never skipped silently: without them the test is reported as skipped with the reason, and with
// REQUIRE_GATE_TOOLS=1 (set by the CI self-test job) a missing tool or an unreachable advisory service is a failure.
//
// No credential and no token-shaped literal is stored. The canary is assembled from fragments at run time and exists only
// inside a throwaway git repository under the OS temp directory (TMPDIR).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { checkPolicyConfig, findRepoOverrides } from "./check-secret-gate-config.mjs";
import { checkSbom } from "./validate-sbom.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRE = process.env.REQUIRE_GATE_TOOLS === "1";
const scratch = mkdtempSync(path.join(tmpdir(), "supply-chain-gates-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

/** Skip with an explicit reason, or fail when the tool is mandatory. */
const needs = (t, ok, reason) => {
  if (ok) return false;
  if (REQUIRE) assert.fail(`required gate tool unavailable: ${reason}`);
  t.skip(`NOT_VERIFIED locally: ${reason}`);
  return true;
};

describe("SBOM gate", () => {
  const cdx = (components) => JSON.stringify({ bomFormat: "CycloneDX", specVersion: "1.5", components });
  it("accepts a CycloneDX SBOM with components", () => assert.deepEqual(checkSbom(cdx([{ type: "library", name: "x", version: "1.0.0" }])), []));
  it("rejects an empty SBOM (synthetic defect)", () => assert.ok(checkSbom(cdx([])).length > 0));
  it("rejects invalid JSON", () => assert.ok(checkSbom("{not json").length > 0));
  it("rejects an unknown format", () => assert.ok(checkSbom(JSON.stringify({ hello: "world" })).length > 0));
});

describe("secret detection gate", () => {
  const bin = process.env.GITLEAKS_BIN;
  const config = path.join(repoRoot, "tools/supply-chain/gitleaks.toml");
  const noIgnoreDir = path.join(scratch, "no-ignore");
  mkdirSync(noIgnoreDir, { recursive: true });
  // Synthetic canary, never stored whole: matches only the custom `cep-synthetic-canary` rule.
  const canary = ["CEPSYNTH", "A1B2C3D4E5F6G7H8I9J0", "NOTREAL"].join("_");
  // Provider-shaped sample (GitHub personal-access-token shape) built at run time; it exists only in a throwaway repo
  // under TMPDIR and is never written to this repository. Proves the DEFAULT ruleset is active, not only the canary.
  const providerShaped = ["gh", "p_", "aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xYz"].join("");
  const usable = () => bin && existsSync(bin);
  const MISSING = "GITLEAKS_BIN not set; see tools/supply-chain/install-gitleaks.sh";

  const git = (dir, ...a) => spawnSync("git", ["-c", "user.name=gate-test", "-c", "user.email=gate-test@example.invalid", "-c", "commit.gpgsign=false", ...a], { cwd: dir, encoding: "utf8" });
  const commitAll = (dir, files, msg) => {
    for (const [rel, content] of Object.entries(files)) { mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); writeFileSync(path.join(dir, rel), content); }
    git(dir, "add", ".");
    const c = git(dir, "commit", "-q", "-m", msg);
    assert.equal(c.status, 0, c.stderr);
  };
  /** Throwaway repo; `files` is { relativePath: content }. */
  const repoWith = (name, files) => {
    const dir = path.join(scratch, name);
    mkdirSync(dir, { recursive: true });
    git(dir, "init", "-q");
    commitAll(dir, files, "fixture");
    return dir;
  };
  const run = (dir, extra, cwd) => {
    const report = path.join(scratch, `${path.basename(dir)}-${Math.random().toString(36).slice(2)}.json`);
    const r = spawnSync(bin, ["git", "--config", config, "--redact", "--no-banner", "--exit-code", "1", "--report-format", "json", "--report-path", report, ...extra, dir], { encoding: "utf8", cwd });
    return { status: r.status, findings: existsSync(report) ? JSON.parse(readFileSync(report, "utf8")) : [] };
  };
  // Mirrors the CI step; a test below pins the workflow text to these flags.
  const HARDENED = ["--ignore-gitleaks-allow", "--gitleaks-ignore-path", noIgnoreDir];
  // Mirrors the CI step: scan a bare mirror (no worktree, so no .gitleaksignore is read) from a neutral cwd.
  const scan = (dir) => {
    const mirror = path.join(scratch, `${path.basename(dir)}-mirror.git`);
    const c = spawnSync("git", ["clone", "--mirror", "--no-local", "-q", dir, mirror], { encoding: "utf8" });
    assert.equal(c.status, 0, c.stderr);
    return run(mirror, HARDENED, scratch);
  };
  const ids = (r) => r.findings.map((f) => f.RuleID);

  it("passes a clean repository (positive control)", (t) => {
    if (needs(t, usable(), MISSING)) return;
    assert.equal(scan(repoWith("clean", { "notes.txt": "nothing sensitive here\n" })).status, 0);
  });
  it("blocks the synthetic canary committed to history", (t) => {
    if (needs(t, usable(), MISSING)) return;
    const r = scan(repoWith("dirty", { "notes.txt": `value = ${canary}\n` }));
    assert.equal(r.status, 1);
    assert.ok(ids(r).includes("cep-synthetic-canary"), JSON.stringify(ids(r)));
  });
  it("keeps the default ruleset active (provider-shaped sample built at run time)", (t) => {
    if (needs(t, usable(), MISSING)) return;
    const r = scan(repoWith("provider", { "notes.txt": `token = ${providerShaped}\n` }));
    assert.equal(r.status, 1);
    assert.ok(ids(r).some((id) => id !== "cep-synthetic-canary"), `default rules did not fire: ${JSON.stringify(ids(r))}`);
  });

  describe("a pull request cannot switch the gate off", () => {
    it("`.gitleaksignore` suppresses the finding without hardening, and not with it", (t) => {
      if (needs(t, usable(), MISSING)) return;
      const dir = repoWith("ign", { "notes.txt": `value = ${canary}\n` });
      const leaked = git(dir, "rev-parse", "HEAD").stdout.trim();
      commitAll(dir, { ".gitleaksignore": `${leaked}:notes.txt:cep-synthetic-canary:1\n` }, "add ignore file");
      assert.equal(run(dir, []).status, 0, "control: the unhardened scan must be bypassable, or this test proves nothing");
      const r = scan(dir);
      assert.equal(r.status, 1);
      assert.ok(ids(r).includes("cep-synthetic-canary"));
    });
    it("`gitleaks:allow` suppresses the finding without hardening, and not with it", (t) => {
      if (needs(t, usable(), MISSING)) return;
      const dir = repoWith("inline", { "notes.txt": `value = ${canary} # gitleaks:allow\n` });
      assert.equal(run(dir, []).status, 0, "control: the unhardened scan must be bypassable, or this test proves nothing");
      assert.equal(scan(dir).status, 1);
    });
    it("a repository `.gitleaks.toml` that allowlists everything is ignored by the explicit --config", (t) => {
      if (needs(t, usable(), MISSING)) return;
      const dir = repoWith("repo-config", { "notes.txt": `value = ${canary}\n`, ".gitleaks.toml": "[extend]\nuseDefault = true\n[allowlist]\nregexes = ['.*']\n" });
      assert.equal(scan(dir).status, 1);
    });
    it("the config check refuses a repository override file", () => {
      for (const name of [".gitleaksignore", ".gitleaks.toml", "gitleaks.toml", "sub/.gitleaksignore"]) {
        const dir = repoWith(`ov-${name.replace(/\W/g, "_")}`, { [name]: "x\n", "a.txt": "a\n" });
        assert.deepEqual(findRepoOverrides(dir), [name], name);
      }
      assert.deepEqual(findRepoOverrides(repoWith("ov-none", { "a.txt": "a\n", "tools/supply-chain/gitleaks.toml": "x\n" })), []);
    });
    it("the config check refuses a policy config that grows an allowlist or loses the defaults", () => {
      const good = readFileSync(config, "utf8");
      assert.deepEqual(checkPolicyConfig(good), []);
      assert.ok(checkPolicyConfig(`${good}\n[allowlist]\nregexes = ['x']\n`).length > 0);
      assert.ok(checkPolicyConfig(`${good}\n[[rules.allowlists]]\nregexes = ['x']\n`).length > 0);
      assert.ok(checkPolicyConfig(good.replace("useDefault = true", "useDefault = false")).length > 0);
      assert.ok(checkPolicyConfig(good.replace('"cep-synthetic-canary"', '"renamed"')).length > 0);
    });
    it("the CI workflow passes the hardening flags and runs the config check", () => {
      const wf = readFileSync(path.join(repoRoot, ".github/workflows/supply-chain-baseline.yml"), "utf8");
      assert.match(wf, /--ignore-gitleaks-allow/);
      assert.match(wf, /--gitleaks-ignore-path "\$RUNNER_TEMP\/no-ignore"/);
      assert.match(wf, /git clone --mirror/);
      assert.match(wf, /check-secret-gate-config\.mjs/);
    });
  });
});

describe("dependency audit gate", () => {
  const lock = (packages) => JSON.stringify({ name: "synthetic", version: "1.0.0", lockfileVersion: 3, requires: true, packages });
  const audit = (name, packages) => {
    const dir = path.join(scratch, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "synthetic", version: "1.0.0", private: true, dependencies: Object.fromEntries(Object.entries(packages).filter(([k]) => k).map(([k, v]) => [k.replace("node_modules/", ""), v.version])) }));
    writeFileSync(path.join(dir, "package-lock.json"), lock(packages));
    const r = spawnSync("npm", ["audit", "--package-lock-only", "--audit-level=low", "--json"], { cwd: dir, encoding: "utf8" });
    let json; try { json = JSON.parse(r.stdout); } catch { json = {}; }
    return { status: r.status, json, unreachable: !!json.error || !json.metadata };
  };
  const clean = { "": { name: "synthetic", version: "1.0.0" } };
  // Synthetic defect: an old, publicly advisory-listed release of a common library.
  const vulnerable = { "": { name: "synthetic", version: "1.0.0", dependencies: { lodash: "4.17.15" } }, "node_modules/lodash": { version: "4.17.15", resolved: "https://registry.npmjs.org/lodash/-/lodash-4.17.15.tgz" } };

  it("passes a lockfile with no dependencies (positive control)", (t) => {
    const r = audit("sca-clean", clean);
    if (needs(t, !r.unreachable, "npm advisory service unreachable")) return;
    assert.equal(r.status, 0);
  });
  it("blocks a lockfile with a known-vulnerable dependency", (t) => {
    const r = audit("sca-vuln", vulnerable);
    if (needs(t, !r.unreachable, "npm advisory service unreachable")) return;
    assert.equal(r.status, 1);
    assert.ok(r.json.metadata.vulnerabilities.total > 0);
  });
});

describe("workflow policy gate", () => {
  it("blocks a synthetic unpinned, permissionless workflow", () => {
    const root = path.join(scratch, "wfp");
    mkdirSync(path.join(root, ".github/workflows"), { recursive: true });
    writeFileSync(path.join(root, ".github/workflows/bad.yml"), "name: t\non: push\njobs:\n  j:\n    runs-on: x\n    steps:\n      - uses: actions/checkout@v4\n");
    const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts/validate-workflow-policy.mjs"), "--root", root], { encoding: "utf8" });
    assert.equal(r.status, 1);
  });
});

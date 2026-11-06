import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { DEFAULT_LEDGER, SCHEMA_PATH, loadLedgerFile, validateLedger } from "./validate-release-ledger.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(repoRoot, "scripts", "validate-release-ledger.mjs");
const FIXTURE = path.join(repoRoot, "scripts", "fixtures", "release-ledger", "positive.fixture.json");
const scratch = mkdtempSync(path.join(tmpdir(), "release-ledger-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const base = () => JSON.parse(readFileSync(FIXTURE, "utf8"));
const byState = (doc, state) => doc.releases.find((r) => r.state === state);
const has = (problems, text) => assert.ok(problems.some((p) => p.includes(text)), `expected a problem containing '${text}', got: ${JSON.stringify(problems)}`);
/** Mutate a clone of the synthetic ledger and require a problem containing `text`. */
const rejects = (mutate, text) => {
  const doc = base();
  mutate(doc);
  has(validateLedger(doc), text);
};
const ev = (kind, ref) => ({ kind, ref });
const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: repoRoot, encoding: "utf8" });
const write = (name, content) => { const p = path.join(scratch, name); writeFileSync(p, content); return p; };

describe("release ledger: positive baseline", () => {
  it("accepts the synthetic ledger covering every state", () => {
    assert.deepEqual(validateLedger(base()), []);
    assert.deepEqual(base().releases.map((r) => r.state), ["candidate", "admitted", "published", "adopted", "supported", "deprecated"]);
  });
  it("accepts an explicit empty ledger", () => {
    assert.deepEqual(validateLedger({ schemaVersion: "1", releases: [] }), []);
  });
  it("accepts the committed ledger through the CLI", () => {
    const r = run();
    assert.equal(r.status, 0, r.stderr);
  });
  it("keeps the schema and fixtures out of the contract validator's reach", () => {
    assert.ok(!SCHEMA_PATH.split("/").includes("contracts"), "schema must not live under a contracts/ directory");
    assert.ok(!FIXTURE.endsWith(".example.json") && !FIXTURE.endsWith(".invalid.json"));
    assert.ok(!DEFAULT_LEDGER.endsWith(".example.json") && !DEFAULT_LEDGER.endsWith(".invalid.json"));
  });
});

describe("release ledger: fail closed on input", () => {
  it("rejects a missing file", () => {
    has(loadLedgerFile(path.join(scratch, "nope.json")).problems, "not found");
    assert.equal(run(path.join(scratch, "nope.json")).status, 1);
  });
  it("rejects empty and whitespace-only input", () => {
    has(loadLedgerFile(write("empty.json", "")).problems, "empty");
    has(loadLedgerFile(write("blank.json", "  \n\t\n")).problems, "empty");
    assert.equal(run(write("empty2.json", "")).status, 1);
  });
  it("rejects invalid JSON and non-object roots", () => {
    has(loadLedgerFile(write("bad.json", "{")).problems, "invalid JSON");
    has(validateLedger([]), "must be object");
    has(validateLedger(null), "must be object");
  });
  it("rejects unknown fields at every level", () => {
    rejects((d) => { d.extra = 1; }, "additional properties");
    rejects((d) => { d.releases[0].extra = 1; }, "additional properties");
    rejects((d) => { d.releases[0].package.extra = 1; }, "additional properties");
    rejects((d) => { d.releases[0].source.extra = 1; }, "additional properties");
    rejects((d) => { d.releases[0].transitions[0].extra = 1; }, "additional properties");
  });
  it("fails the CLI on a ledger with problems", () => {
    const d = base(); d.releases[0].package.version = "latest";
    const r = run(write("floating.json", JSON.stringify(d)));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /floating/);
  });
});

describe("release ledger: required fields", () => {
  for (const field of ["id", "capability", "contractAuthority", "contractVersion", "package", "source", "state", "transitions", "rollout"]) {
    it(`rejects a release without ${field}`, () => rejects((d) => { delete d.releases[0][field]; }, "required property"));
  }
  it("rejects a ledger without schemaVersion or releases", () => {
    rejects((d) => { delete d.schemaVersion; }, "required property");
    rejects((d) => { delete d.releases; }, "required property");
  });
  it("rejects a package without ecosystem or name, and a source without commit", () => {
    rejects((d) => { delete d.releases[0].package.name; }, "required property");
    rejects((d) => { delete d.releases[0].package.ecosystem; }, "required property");
    rejects((d) => { delete d.releases[0].source.commit; }, "required property");
  });
});

describe("release ledger: false supported (AC-02)", () => {
  it("rejects supported without a support block", () => rejects((d) => { delete byState(d, "supported").support; }, "derives 'adopted'"));
  it("rejects supported without owner, runbook or support policy", () => {
    for (const f of ["owner", "runbookRef", "supportPolicyRef", "operationalEvidenceRefs"]) {
      rejects((d) => { delete byState(d, "supported").support[f]; }, f);
    }
  });
  it("rejects supported with empty operational evidence", () => rejects((d) => { byState(d, "supported").support.operationalEvidenceRefs = []; }, "operationalEvidenceRefs"));
  it("rejects supported whose operational evidence is only a mutable ref", () => rejects((d) => { byState(d, "supported").support.operationalEvidenceRefs = [ev("git-tag", "v1.0.0")]; }, "mutable"));
  it("rejects supported without any consumer", () => rejects((d) => { delete byState(d, "supported").consumers; }, "derives"));
  it("rejects supported that was never adopted or published", () => rejects((d) => { const r = byState(d, "supported"); delete r.publication; }, "derives"));
  it("rejects a state higher than the evidence derives", () => {
    rejects((d) => { byState(d, "admitted").state = "supported"; }, "derives 'admitted'");
    rejects((d) => { delete byState(d, "admitted").admission; }, "derives 'candidate'");
  });
  it("rejects a state lower than the evidence derives (state is derived, not declared)", () => rejects((d) => { byState(d, "adopted").state = "published"; }, "derives 'adopted'"));
});

describe("release ledger: immutable version and digest gate promotion", () => {
  it("rejects promotion without an immutable version", () => rejects((d) => { delete byState(d, "admitted").package.version; }, "immutable version"));
  it("rejects promotion without a digest", () => {
    rejects((d) => { delete byState(d, "admitted").package.digest; }, "digest");
    rejects((d) => { delete byState(d, "published").package.digest; }, "digest");
  });
  it("rejects a malformed digest", () => {
    rejects((d) => { byState(d, "published").package.digest = "sha256:abc"; }, "pattern");
    rejects((d) => { byState(d, "published").package.digest = "md5:" + "a".repeat(32); }, "pattern");
  });
  it("rejects published without registry coordinates or publication evidence", () => {
    rejects((d) => { delete byState(d, "published").package.registry; }, "registry");
    rejects((d) => { delete byState(d, "published").publication; }, "derives");
  });
  it("rejects published without a rollback procedure", () => rejects((d) => { delete byState(d, "published").rollback; }, "rollback"));
  it("allows a candidate with no version or digest yet", () => {
    const d = base(); const c = byState(d, "candidate");
    assert.equal(c.package.version, undefined);
    assert.deepEqual(validateLedger(d), []);
  });
});

describe("release ledger: floating versions and moving refs", () => {
  for (const v of ["latest", "next", "main", "master", "develop", "HEAD", "*", "x", "^1.0.0", "~1.0.0", ">=1.0.0", "<2.0.0", "1.x", "1.2.*", "1.0.0 || 2.0.0", "1.0.0 - 2.0.0", "v1.0.0", "1.0", ""]) {
    it(`rejects package version '${v}'`, () => rejects((d) => { byState(d, "admitted").package.version = v; }, "floating"));
  }
  it("rejects a candidate that already carries a floating version", () => rejects((d) => { byState(d, "candidate").package.version = "latest"; }, "floating"));
  it("rejects floating contractVersion, consumer version and source tag", () => {
    rejects((d) => { byState(d, "admitted").contractVersion = "^0.1.0"; }, "floating");
    rejects((d) => { byState(d, "adopted").consumers[0].resolvedVersion = "latest"; }, "floating");
    rejects((d) => { byState(d, "admitted").source.tag = "latest"; }, "floating");
    rejects((d) => { byState(d, "admitted").source.tag = "main"; }, "floating");
  });
  it("rejects a moving ref where a commit SHA is required", () => {
    rejects((d) => { byState(d, "admitted").source.commit = "main"; }, "pattern");
    rejects((d) => { byState(d, "admitted").source.commit = "refs/heads/develop"; }, "pattern");
  });
});

describe("release ledger: full 40-hex commit SHA", () => {
  for (const [name, sha] of [["abbreviated", "0123456"], ["uppercase", "0123456789ABCDEF0123456789ABCDEF01234567"], ["41 chars", "0123456789abcdef0123456789abcdef012345678"], ["empty", ""]]) {
    it(`rejects a ${name} source commit`, () => rejects((d) => { byState(d, "admitted").source.commit = sha; }, "pattern"));
  }
  it("rejects an abbreviated consumer lockfile commit", () => rejects((d) => { byState(d, "adopted").consumers[0].lockfile.commit = "abc1234"; }, "pattern"));
  it("rejects a commit evidence ref that is not a full SHA", () => rejects((d) => { byState(d, "candidate").transitions[0].evidenceRefs = [ev("commit", "abc1234")]; }, "40-hex"));
  it("rejects an artifact-digest evidence ref that is not a sha256 digest", () => rejects((d) => { byState(d, "published").publication.evidenceRefs = [ev("artifact-digest", "latest")]; }, "digest"));
});

describe("release ledger: adopted needs consumer lockfile evidence", () => {
  it("rejects adopted without consumers", () => {
    rejects((d) => { delete byState(d, "adopted").consumers; }, "derives");
    rejects((d) => { byState(d, "adopted").consumers = []; }, "derives");
  });
  it("rejects a consumer without lockfile evidence", () => rejects((d) => { delete byState(d, "adopted").consumers[0].lockfile; }, "lockfile"));
  it("rejects a consumer that resolved another version or digest than the release", () => {
    rejects((d) => { byState(d, "adopted").consumers[0].resolvedVersion = "9.9.9"; }, "derives");
    rejects((d) => { byState(d, "adopted").consumers[0].resolvedDigest = "sha256:" + "e".repeat(64); }, "derives");
  });
});

describe("release ledger: transitions cannot be self-declared", () => {
  it("rejects a transition without evidenceRefs", () => {
    rejects((d) => { delete byState(d, "admitted").transitions[1].evidenceRefs; }, "evidenceRefs");
    rejects((d) => { byState(d, "admitted").transitions[1].evidenceRefs = []; }, "evidenceRefs");
  });
  it("rejects a transition whose only evidence is a mutable ref", () => {
    rejects((d) => { byState(d, "admitted").transitions[1].evidenceRefs = [ev("git-tag", "v1.0.0")]; }, "mutable");
    rejects((d) => { byState(d, "admitted").transitions[1].evidenceRefs = [ev("branch", "main"), ev("git-tag", "v1")]; }, "mutable");
  });
  it("accepts mutable refs next to immutable evidence", () => {
    const d = base(); byState(d, "admitted").transitions[1].evidenceRefs.push(ev("git-tag", "v1.0.0"));
    assert.deepEqual(validateLedger(d), []);
  });
  it("rejects publication or admission evidence that is only a mutable ref", () => {
    rejects((d) => { byState(d, "published").publication.evidenceRefs = [ev("git-tag", "v1.0.0")]; }, "mutable");
    rejects((d) => { byState(d, "admitted").admission.evidenceRefs = [ev("branch", "develop")]; }, "mutable");
  });
  it("rejects a skipped state", () => rejects((d) => { const t = byState(d, "published").transitions; t.splice(1, 1); t[1].from = "candidate"; }, "transition"));
  it("rejects a chain that does not start at none -> candidate", () => rejects((d) => { byState(d, "admitted").transitions[0].from = "candidate"; }, "transition"));
  it("rejects a broken chain and a final transition that disagrees with the state", () => {
    rejects((d) => { byState(d, "adopted").transitions[2].from = "candidate"; }, "transition");
    rejects((d) => { byState(d, "adopted").transitions.pop(); }, "transition");
  });
  it("rejects a backwards transition and out-of-order dates", () => {
    rejects((d) => { byState(d, "admitted").transitions[1].at = "1999-12-31"; }, "transition");
    rejects((d) => { const t = byState(d, "admitted").transitions; t[1].from = "admitted"; t[1].to = "candidate"; }, "transition");
  });
  it("rejects a date that is not a real calendar day", () => {
    rejects((d) => { byState(d, "admitted").transitions[1].at = "2000-02-31"; }, "calendar");
    rejects((d) => { byState(d, "admitted").admission.admittedAt = "2001-02-29"; }, "calendar");
  });
});

describe("release ledger: no automatic production rollout", () => {
  for (const mode of ["automatic", "auto", "continuous", "canary", "progressive", true, ""]) {
    it(`rejects rollout.production '${mode}'`, () => rejects((d) => { byState(d, "supported").rollout.production = mode; }, "production rollout"));
  }
  it("rejects an unknown auto-rollout flag", () => rejects((d) => { byState(d, "supported").rollout.autoRollout = true; }, "additional properties"));
  it("rejects a release without a rollout block", () => rejects((d) => { delete byState(d, "supported").rollout; }, "required property"));
  it("accepts manual and none", () => {
    const d = base(); byState(d, "supported").rollout.production = "none";
    assert.deepEqual(validateLedger(d), []);
  });
});

describe("release ledger: deprecation, uniqueness and references", () => {
  it("rejects deprecated without a deprecation block, and a block on a non-deprecated release", () => {
    rejects((d) => { delete byState(d, "deprecated").deprecation; }, "deprecation");
    rejects((d) => { byState(d, "supported").deprecation = { since: "2000-02-01", sunset: "2000-08-01", migrationRef: "m" }; }, "deprecation");
  });
  it("rejects deprecated that was never published", () => rejects((d) => { const r = byState(d, "deprecated"); delete r.publication; }, "deprecated"));
  it("rejects a sunset before the deprecation date", () => rejects((d) => { byState(d, "deprecated").deprecation.sunset = "1999-01-01"; }, "sunset"));
  it("rejects duplicate release ids", () => rejects((d) => { d.releases[1].id = d.releases[0].id; }, "duplicate"));
  it("rejects reuse of an immutable version (same package coordinates)", () => rejects((d) => { d.releases[2].package.name = d.releases[1].package.name; }, "duplicate package coordinates"));
  it("rejects dangling rollback and backport references", () => {
    rejects((d) => { byState(d, "published").rollback.previousReleaseId = "no-such-release"; }, "unknown release");
    rejects((d) => { byState(d, "published").backportOf = "no-such-release"; }, "unknown release");
  });
  it("rejects a release that references itself", () => rejects((d) => { const r = byState(d, "published"); r.rollback.previousReleaseId = r.id; }, "itself"));
  it("rejects absolute or local-path evidence refs (public repository)", () => {
    rejects((d) => { byState(d, "admitted").admission.decisionRef = "/home/someone/decision.md"; }, "local path");
    rejects((d) => { byState(d, "admitted").admission.evidenceRefs = [ev("test-report", "../../outside.md")]; }, "local path");
    rejects((d) => { byState(d, "admitted").admission.evidenceRefs = [ev("test-report", "file:///etc/passwd")]; }, "local path");
    rejects((d) => { byState(d, "admitted").admission.evidenceRefs = [ev("test-report", "C:\\\\Users\\\\x\\\\r.md")]; }, "local path");
  });
  it("rejects a registry URL with credentials or a non-https scheme", () => {
    rejects((d) => { byState(d, "published").package.registry = "http://registry.example.test/npm"; }, "pattern");
    rejects((d) => { byState(d, "published").package.registry = "https://user:pw@registry.example.test/npm"; }, "pattern");
  });
});

const PIN = "example-org/synthetic-repo@0123456789abcdef0123456789abcdef01234567:docs/x.md";
const URL1 = "https://evidence.example.test/x";
const opsOk = () => [ev("conformance-report", URL1), ev("certification-report", URL1), ev("operational-report", URL1)];

describe("release ledger (round 1): evidence kinds are closed and state-specific", () => {
  it("rejects supported whose operational evidence is only a policy ref", () => rejects((d) => { byState(d, "supported").support.operationalEvidenceRefs = [ev("policy", URL1)]; }, "derives 'adopted'"));
  it("requires conformance (provider verified), certification (consumer certified) and an operational kind", () => {
    for (const drop of ["conformance-report", "certification-report", "operational-report"]) {
      rejects((d) => { byState(d, "supported").support.operationalEvidenceRefs = opsOk().filter((e) => e.kind !== drop); }, "derives 'adopted'");
    }
  });
  it("accepts each operational kind alone as the operational item", () => {
    for (const kind of ["operational-report", "incident-report", "recovery-test"]) {
      const d = base(); byState(d, "supported").support.operationalEvidenceRefs = [ev("conformance-report", URL1), ev("certification-report", URL1), ev(kind, PIN)];
      assert.deepEqual(validateLedger(d), []);
    }
  });
  it("rejects publication evidence of a kind that does not prove publication", () => {
    rejects((d) => { byState(d, "published").publication.evidenceRefs = [ev("decision", URL1)]; }, "derives 'admitted'");
    rejects((d) => { byState(d, "published").publication.evidenceRefs = [ev("lockfile", URL1)]; }, "derives 'admitted'");
  });
  it("rejects a publication artifact-digest that differs from package.digest", () => rejects((d) => { byState(d, "published").publication.evidenceRefs = [ev("artifact-digest", "sha256:" + "e".repeat(64))]; }, "derives 'admitted'"));
  it("rejects admission evidence of a kind that does not prove admission", () => rejects((d) => { byState(d, "admitted").admission.evidenceRefs = [ev("lockfile", URL1)]; }, "derives 'candidate'"));
  it("requires lockfile evidence on the transition to adopted and publication-kind evidence on the one to published", () => {
    rejects((d) => { byState(d, "adopted").transitions[3].evidenceRefs = [ev("decision", URL1)]; }, "requires evidence of kind");
    rejects((d) => { byState(d, "published").transitions[2].evidenceRefs = [ev("decision", URL1)]; }, "requires evidence of kind");
  });
});

describe("release ledger (round 1): blank strings and ref formats", () => {
  it("rejects whitespace-only strings everywhere", () => {
    rejects((d) => { byState(d, "supported").support.owner = " "; }, "whitespace-only");
    rejects((d) => { byState(d, "supported").support.owner = " "; }, "derives 'adopted'");
    rejects((d) => { byState(d, "supported").support.runbookRef = "\t "; }, "whitespace-only");
    rejects((d) => { byState(d, "admitted").admission.evidenceRefs[0].ref = " "; }, "whitespace-only");
    rejects((d) => { byState(d, "adopted").consumers[0].lockfile.path = " "; }, "whitespace-only");
    rejects((d) => { byState(d, "adopted").consumers[0].lockfile.path = " "; }, "derives 'published'");
    rejects((d) => { byState(d, "published").rollback.procedureRef = "  "; }, "derives 'admitted'");
  });
  it("requires an https URL or a pinned reference for non-intrinsic evidence kinds", () => {
    for (const ref of ["anything", "http://evidence.example.test/x", "https://user@evidence.example.test/x", "example-org/repo@main:docs/x.md", "example-org/repo@abc1234:docs/x.md"]) {
      rejects((d) => { byState(d, "admitted").admission.evidenceRefs = [ev("test-report", ref)]; }, "https URL or a pinned");
    }
  });
  it("accepts a pinned reference", () => {
    const d = base(); byState(d, "admitted").admission.evidenceRefs.unshift(ev("test-report", PIN));
    assert.deepEqual(validateLedger(d), []);
  });
});

describe("release ledger (round 1): immutability is normalized", () => {
  it("treats build metadata as the same version", () => rejects((d) => { const p = byState(d, "published").package; const a = byState(d, "admitted").package; p.name = a.name; p.version = "1.0.0+b2"; }, "duplicate package coordinates"));
  it("compares package names case-insensitively", () => rejects((d) => { const p = byState(d, "published").package; p.name = byState(d, "admitted").package.name.toUpperCase(); }, "duplicate package coordinates"));
  it("rejects the same digest under two different versions of a package", () => rejects((d) => { const p = byState(d, "published").package; const a = byState(d, "admitted").package; p.name = a.name; p.version = "1.0.1"; }, "digest reused"));
  it("rejects the all-zero digest", () => {
    rejects((d) => { byState(d, "published").package.digest = "sha256:" + "0".repeat(64); }, "all-zero digest");
    rejects((d) => { byState(d, "adopted").consumers[0].resolvedDigest = "sha256:" + "0".repeat(64); }, "all-zero digest");
  });
  it("requires rollback.previousReleaseId to be a release of the same package", () => {
    rejects((d) => { byState(d, "published").rollback.previousReleaseId = byState(d, "admitted").id; }, "same package");
    rejects((d) => { byState(d, "published").rollback.previousReleaseId = "no-such-release"; }, "unknown release");
  });
  it("accepts a previous release of the same package", () => {
    const d = base(); const pub = byState(d, "published");
    const prev = structuredClone(byState(d, "admitted")); prev.id = "synthetic-previous-0.9.0"; prev.package = { ...pub.package, version: "0.9.0", digest: "sha256:" + "c".repeat(64) };
    prev.source.commit = "0123456789abcdef0123456789abcdef01234569"; prev.state = "admitted";
    prev.transitions = pub.transitions.slice(0, 2).map((t) => structuredClone(t));
    d.releases.push(prev); pub.rollback.previousReleaseId = prev.id;
    assert.deepEqual(validateLedger(d), []);
  });
});

describe("release ledger (WP-03): declared guarantees are required from admitted (AC-03)", () => {
  const GREF = "example-org/synthetic-contracts@0123456789abcdef0123456789abcdef0123456f:contracts/capabilities/x.y/implementations.json";
  const withoutGuarantee = (r) => { r.admission.evidenceRefs = r.admission.evidenceRefs.filter((e) => e.kind !== "guarantee-declaration"); };
  for (const state of ["admitted", "published", "adopted", "supported"]) {
    it(`rejects a declared '${state}' without guarantee-declaration evidence`, () => {
      rejects((d) => withoutGuarantee(byState(d, state)), "guarantee-declaration");
      rejects((d) => withoutGuarantee(byState(d, state)), `declared '${state}' but evidence derives 'candidate'`);
    });
  }
  it("still accepts candidate without guarantee evidence", () => {
    assert.deepEqual(validateLedger({ schemaVersion: "1", releases: [byState(base(), "candidate")] }), []);
  });
  it("does not let guarantee-declaration replace the admission evidence", () => {
    rejects((d) => { byState(d, "admitted").admission.evidenceRefs = [ev("guarantee-declaration", GREF)]; }, "derives 'candidate'");
  });
  it("rejects a malformed guarantee-declaration reference", () => {
    for (const ref of ["https://evidence.example.test/g", "example-org/r@abc:contracts/implementations.json", "example-org/r@0123456789abcdef0123456789abcdef0123456f:contracts/other.json"]) {
      rejects((d) => { byState(d, "admitted").admission.evidenceRefs = [ev("test-report", "https://evidence.example.test/t"), ev("guarantee-declaration", ref)]; }, "guarantee-declaration");
    }
  });
  it("accepts a well-formed pinned guarantee-declaration (form only, no network)", () => {
    const d = base(); byState(d, "admitted").admission.evidenceRefs.push(ev("guarantee-declaration", GREF));
    assert.deepEqual(validateLedger(d), []);
  });
});

describe("release ledger (WP-03): deprecation without replacement needs a justification", () => {
  const dep = (d) => byState(d, "deprecated").deprecation;
  it("rejects deprecation with neither replacedBy nor justification", () => rejects((d) => { delete dep(d).replacedBy; }, "justification"));
  it("rejects a blank justification", () => rejects((d) => { delete dep(d).replacedBy; dep(d).justification = "  "; }, "whitespace-only"));
  it("accepts deprecation without replacedBy when justified", () => {
    const d = base(); delete dep(d).replacedBy; dep(d).justification = "Synthetic: no successor planned";
    assert.deepEqual(validateLedger(d), []);
  });
  it("accepts deprecation with a replacement and no justification", () => assert.deepEqual(validateLedger(base()), []));
});

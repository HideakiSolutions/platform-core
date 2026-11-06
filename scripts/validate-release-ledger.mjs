// Release ledger validator (CEP WP-02, ADR-CEP-002).
// Fails closed. Step 1: structural validation against schemas/release-ledger.schema.json (JSON Schema 2020-12, Ajv strict).
// Step 2: policy checks the schema cannot express (the ECP Decision 0006 keyword profile has no conditional keywords):
// the lifecycle state is DERIVED from evidence and the declared state must equal it; transitions need immutable evidence;
// no floating versions or moving refs; no automatic production rollout; uniqueness and reference integrity across releases.
// The policy itself lives in docs/adr/ADR-CEP-002-release-policy.md. This file only enforces it.

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_LEDGER = "docs/release/release-ledger.json";
export const SCHEMA_PATH = "schemas/release-ledger.schema.json";

export const STATES = ["candidate", "admitted", "published", "adopted", "supported"];
const MUTABLE_KINDS = new Set(["git-tag", "branch"]);
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
const SHA40 = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const DATE = /^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
const MOVING_NAMES = new Set(["latest", "next", "main", "master", "develop", "head", "dev", "nightly", "stable", "canary", "edge", "*", "x"]);
// Closed, state-specific evidence kinds (ADR-CEP-002). Mutable kinds (git-tag, branch) never count.
export const ADMISSION_KINDS = new Set(["decision", "test-report", "conformance-report", "ci-run", "attestation", "commit"]);
export const PUBLICATION_KINDS = new Set(["ci-run", "attestation", "artifact-digest"]);
export const OPERATIONAL_KINDS = new Set(["operational-report", "incident-report", "recovery-test"]);
const INTRINSIC_KINDS = new Set(["commit", "artifact-digest", "git-tag", "branch"]);
const TRANSITION_KINDS = { admitted: ADMISSION_KINDS, published: PUBLICATION_KINDS, adopted: new Set(["lockfile"]) };
const URL_REF = /^https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?(\/[^\s@]*)?$/;
const PINNED_REF = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+@[0-9a-f]{40}:[A-Za-z0-9._/-]+$/;
const ZERO_DIGEST = "sha256:" + "0".repeat(64);
const LOCAL_PATH = /^([/\\~]|[A-Za-z]:[\\/]|file:)/i;

let compiled;
function schemaValidator() {
  if (!compiled) {
    const schema = JSON.parse(readFileSync(path.join(repoRoot, SCHEMA_PATH), "utf8"));
    compiled = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  }
  return compiled;
}

const nonBlank = (v) => typeof v === "string" && v.trim() !== "";
const hasKind = (list, kinds) => Array.isArray(list) && list.some((e) => isObject(e) && kinds.has(e.kind) && nonBlank(e.ref));
const pkgKey = (p) => `${p.ecosystem}:${String(p.name).toLowerCase()}`;
const baseVersion = (v) => String(v).split("+")[0];
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isRealDate = (s) => {
  const m = typeof s === "string" ? DATE.exec(s) : null;
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};
const isLocalPath = (s) => typeof s === "string" && (LOCAL_PATH.test(s) || s.split(/[\\/]/).includes(".."));

function schemaProblems(doc) {
  const validate = schemaValidator();
  if (validate(doc)) return [];
  return validate.errors.map((e) => {
    const extra = e.params?.additionalProperty ? ` ('${e.params.additionalProperty}')` : "";
    return `${e.instancePath || "(root)"}: ${e.message}${extra}`;
  });
}

function checkEvidence(list, at, problems) {
  if (!Array.isArray(list) || list.length === 0) return false;
  let immutable = false;
  list.forEach((item, i) => {
    if (!isObject(item)) return;
    const where = `${at}[${i}]`;
    if (!MUTABLE_KINDS.has(item.kind)) immutable = true;
    if (isLocalPath(item.ref)) problems.push(`${where}.ref: must not be an absolute or local path`);
    if (!INTRINSIC_KINDS.has(item.kind) && nonBlank(item.ref) && !URL_REF.test(item.ref) && !PINNED_REF.test(item.ref) && !isLocalPath(item.ref)) {
      problems.push(`${where}: evidence of kind ${item.kind} needs an https URL or a pinned '<owner>/<repo>@<40-hex>:<path>' reference`);
    }
    if (item.kind === "commit" && !SHA40.test(item.ref ?? "")) problems.push(`${where}: evidence of kind commit must be a full 40-hex SHA`);
    if (item.kind === "artifact-digest" && !DIGEST.test(item.ref ?? "")) problems.push(`${where}: evidence of kind artifact-digest must be a sha256 digest`);
  });
  if (!immutable) problems.push(`${at}: evidence consists only of mutable refs (git-tag/branch); at least one immutable evidence ref is required`);
  return immutable;
}

function checkVersion(value, at, problems) {
  if (typeof value === "string" && !SEMVER.test(value)) {
    problems.push(`${at}: '${value}' is a floating version or moving ref (or not strict SemVer); only an exact immutable version is accepted`);
  }
}

/** Requirements per lifecycle level. Returns the list of unmet requirements (empty = level satisfied). */
function unmet(r, level) {
  const p = r.package ?? {};
  const out = [];
  if (level === 1) {
    if (typeof p.version !== "string" || !SEMVER.test(p.version)) out.push("package.version (an immutable version is required to promote beyond candidate)");
    if (typeof p.digest !== "string" || !DIGEST.test(p.digest) || p.digest === ZERO_DIGEST) out.push("package.digest (a real sha256 digest is required to promote beyond candidate)");
    if (!isObject(r.admission) || !nonBlank(r.admission.decisionRef) || !hasKind(r.admission.evidenceRefs, ADMISSION_KINDS)) out.push(`admission (decision plus evidence of kind ${[...ADMISSION_KINDS].join("|")})`);
  } else if (level === 2) {
    if (!nonBlank(p.registry)) out.push("package.registry (registry coordinates)");
    const pub = r.publication?.evidenceRefs;
    const digestOk = (Array.isArray(pub) ? pub : []).every((e) => !isObject(e) || e.kind !== "artifact-digest" || e.ref === p.digest);
    if (!isObject(r.publication) || !hasKind(pub, PUBLICATION_KINDS)) out.push(`publication (evidence of kind ${[...PUBLICATION_KINDS].join("|")})`);
    else if (!digestOk) out.push("publication artifact-digest evidence must equal package.digest");
    if (!isObject(r.rollback) || !nonBlank(r.rollback.procedureRef)) out.push("rollback.procedureRef");
  } else if (level === 3) {
    const cs = r.consumers;
    if (!Array.isArray(cs) || cs.length === 0) out.push("consumers (at least one consumer with lockfile evidence)");
    else cs.forEach((c, i) => {
      if (!isObject(c) || !nonBlank(c.lockfile?.path) || !SHA40.test(c.lockfile?.commit ?? "")) out.push(`consumers[${i}].lockfile`);
      else if (c.resolvedVersion !== p.version || c.resolvedDigest !== p.digest) out.push(`consumers[${i}] resolvedVersion/resolvedDigest must equal the package version and digest`);
    });
  } else if (level === 4) {
    const s = r.support;
    if (!isObject(s)) out.push("support (owner, runbookRef, supportPolicyRef, operationalEvidenceRefs)");
    else {
      for (const f of ["owner", "runbookRef", "supportPolicyRef"]) if (!nonBlank(s[f])) out.push(`support.${f}`);
      const ops = s.operationalEvidenceRefs;
      if (!hasKind(ops, new Set(["conformance-report"]))) out.push("support.operationalEvidenceRefs needs a conformance-report (provider verified)");
      if (!hasKind(ops, new Set(["certification-report"]))) out.push("support.operationalEvidenceRefs needs a certification-report (consumer certified)");
      if (!hasKind(ops, OPERATIONAL_KINDS)) out.push(`support.operationalEvidenceRefs needs one of ${[...OPERATIONAL_KINDS].join("|")} (operational profile verified)`);
    }
  }
  return out;
}

function deriveLevel(r) {
  const missing = [];
  let level = 0;
  for (let l = 1; l <= 4; l++) {
    const m = unmet(r, l);
    if (m.length) { missing.push(...m); break; }
    level = l;
  }
  return { level, missing };
}

function checkRelease(r, at, problems) {
  if (!isObject(r)) return;
  checkVersion(r.contractVersion, `${at}.contractVersion`, problems);
  checkVersion(r.package?.version, `${at}.package.version`, problems);
  for (const [i, c] of (Array.isArray(r.consumers) ? r.consumers : []).entries()) {
    if (isObject(c)) {
      checkVersion(c.resolvedVersion, `${at}.consumers[${i}].resolvedVersion`, problems);
      if (isLocalPath(c.lockfile?.path)) problems.push(`${at}.consumers[${i}].lockfile.path: must not be an absolute or local path`);
    }
  }
  for (const [name, d] of [["package.digest", r.package?.digest], ...(Array.isArray(r.consumers) ? r.consumers : []).map((c, i) => [`consumers[${i}].resolvedDigest`, c?.resolvedDigest])]) {
    if (d === ZERO_DIGEST) problems.push(`${at}.${name}: the all-zero digest is not a real digest`);
  }
  const tag = r.source?.tag;
  if (typeof tag === "string" && (MOVING_NAMES.has(tag.toLowerCase()) || /^[\^~<>=]/.test(tag))) problems.push(`${at}.source.tag: '${tag}' is a floating version or moving ref`);

  // Production rollout is never automatic.
  if (isObject(r.rollout) && r.rollout.production !== undefined && !["manual", "none"].includes(r.rollout.production)) {
    problems.push(`${at}.rollout.production: production rollout must be 'manual' or 'none'; automatic production rollout is forbidden`);
  }

  // Free-text references must not leak local paths into a public repository.
  const refs = [
    ["admission.decisionRef", r.admission?.decisionRef], ["support.runbookRef", r.support?.runbookRef],
    ["support.supportPolicyRef", r.support?.supportPolicyRef], ["rollback.procedureRef", r.rollback?.procedureRef],
    ["deprecation.migrationRef", r.deprecation?.migrationRef], ["rollout.approvalRef", r.rollout?.approvalRef],
  ];
  for (const [name, value] of refs) if (isLocalPath(value)) problems.push(`${at}.${name}: must not be an absolute or local path`);

  // Evidence lists: immutable evidence needed everywhere; mutable refs alone are never enough.
  checkEvidence(r.admission?.evidenceRefs, `${at}.admission.evidenceRefs`, problems);
  checkEvidence(r.publication?.evidenceRefs, `${at}.publication.evidenceRefs`, problems);
  checkEvidence(r.support?.operationalEvidenceRefs, `${at}.support.operationalEvidenceRefs`, problems);

  // Dates must be real calendar days.
  const dates = [["admission.admittedAt", r.admission?.admittedAt], ["publication.publishedAt", r.publication?.publishedAt], ["deprecation.since", r.deprecation?.since], ["deprecation.sunset", r.deprecation?.sunset]];
  for (const [name, value] of dates) if (value !== undefined && typeof value === "string" && DATE.test(value) && !isRealDate(value)) problems.push(`${at}.${name}: '${value}' is not a real calendar date`);
  if (isRealDate(r.deprecation?.since) && isRealDate(r.deprecation?.sunset) && r.deprecation.sunset < r.deprecation.since) problems.push(`${at}.deprecation.sunset: must not be before deprecation.since`);

  // Transitions: a chain of one-step advances, each backed by immutable evidence.
  const ts = Array.isArray(r.transitions) ? r.transitions : [];
  ts.forEach((t, i) => {
    if (!isObject(t)) return;
    const w = `${at}.transitions[${i}]`;
    checkEvidence(t.evidenceRefs, `${w}.evidenceRefs`, problems);
    const needed = TRANSITION_KINDS[t.to];
    if (needed && Array.isArray(t.evidenceRefs) && !hasKind(t.evidenceRefs, needed)) problems.push(`${w}.evidenceRefs: a transition to '${t.to}' requires evidence of kind ${[...needed].join("|")}`);
    if (typeof t.at === "string" && DATE.test(t.at) && !isRealDate(t.at)) problems.push(`${w}.at: '${t.at}' is not a real calendar date`);
    if (i === 0) {
      if (t.from !== "none" || t.to !== "candidate") problems.push(`${w}: the first transition must be none -> candidate`);
    } else if (isObject(ts[i - 1])) {
      const prev = ts[i - 1];
      if (t.from !== prev.to) problems.push(`${w}: from '${t.from}' does not follow the previous transition, which ended at '${prev.to}'`);
      else {
        const next = STATES[STATES.indexOf(t.from) + 1];
        const retire = t.to === "deprecated" && STATES.indexOf(t.from) >= 2;
        if (t.to !== next && !retire) problems.push(`${w}: '${t.from}' -> '${t.to}' is not allowed (states advance one step at a time; deprecated only after published)`);
      }
      if (isRealDate(t.at) && isRealDate(prev.at) && t.at < prev.at) problems.push(`${w}.at: transition goes backwards in time`);
    }
  });
  const last = ts[ts.length - 1];
  if (isObject(last) && last.to !== r.state) problems.push(`${at}.transitions: the last transition ends at '${last.to}' but state is '${r.state}'`);

  // Derived state: the declared state must equal what the evidence supports.
  const { level, missing } = deriveLevel(r);
  if (r.state === "deprecated") {
    if (!isObject(r.deprecation)) problems.push(`${at}.deprecation: state 'deprecated' requires a deprecation block`);
    if (level < 2) problems.push(`${at}: a deprecated release must have been published (evidence derives '${STATES[level]}')`);
  } else if (STATES.includes(r.state)) {
    if (isObject(r.deprecation)) problems.push(`${at}.deprecation: a deprecation block is present but state is '${r.state}'`);
    if (STATES[level] !== r.state) {
      const direction = STATES.indexOf(r.state) > level ? `missing: ${missing.join("; ")}` : "state is derived from evidence and must not be declared below it";
      problems.push(`${at}.state: declared '${r.state}' but evidence derives '${STATES[level]}' (${direction})`);
    }
  }
}

/** Pure check of a parsed ledger. Returns a list of problems (empty = acceptable). */
function blankStrings(value, at, problems) {
  if (typeof value === "string") { if (value.trim() === "") problems.push(`${at}: must not be empty or whitespace-only`); }
  else if (Array.isArray(value)) value.forEach((v, i) => blankStrings(v, `${at}[${i}]`, problems));
  else if (isObject(value)) for (const [k, v] of Object.entries(value)) blankStrings(v, `${at}.${k}`, problems);
}

export function validateLedger(doc) {
  const problems = schemaProblems(doc);
  blankStrings(doc, "(root)", problems);
  if (!isObject(doc) || !Array.isArray(doc.releases)) return problems;
  const ids = new Map();
  const coordinates = new Map();
  const digests = new Map();
  doc.releases.forEach((r, i) => {
    const at = `releases[${i}]${isObject(r) && r.id ? ` (${r.id})` : ""}`;
    checkRelease(r, at, problems);
    if (!isObject(r)) return;
    if (r.id !== undefined) {
      if (ids.has(r.id)) problems.push(`${at}: duplicate release id '${r.id}'`);
      ids.set(r.id, r);
    }
    const p = r.package;
    if (isObject(p) && typeof p.version === "string") {
      const key = `${pkgKey(p)}@${baseVersion(p.version)}`;
      if (coordinates.has(key)) problems.push(`${at}: duplicate package coordinates ${key} (an immutable version cannot be reused; build metadata and name case do not make a new version)`);
      coordinates.set(key, true);
      if (typeof p.digest === "string") {
        const dk = `${pkgKey(p)}|${p.digest}`;
        if (digests.has(dk) && digests.get(dk) !== baseVersion(p.version)) problems.push(`${at}: digest reused under different versions of the same package (${digests.get(dk)} and ${baseVersion(p.version)})`);
        digests.set(dk, baseVersion(p.version));
      }
    }
  });
  doc.releases.forEach((r, i) => {
    if (!isObject(r)) return;
    const at = `releases[${i}]${r.id ? ` (${r.id})` : ""}`;
    for (const [name, target] of [["rollback.previousReleaseId", r.rollback?.previousReleaseId], ["backportOf", r.backportOf]]) {
      if (target === undefined) continue;
      if (target === r.id) problems.push(`${at}.${name}: a release cannot reference itself`);
      else if (!ids.has(target)) problems.push(`${at}.${name}: references unknown release '${target}'`);
      else if (name === "rollback.previousReleaseId" && isObject(r.package) && isObject(ids.get(target).package) && pkgKey(r.package) !== pkgKey(ids.get(target).package)) {
        problems.push(`${at}.${name}: must reference a release of the same package`);
      }
    }
  });
  return problems;
}

/** Fail-closed loader: a missing, unreadable, empty or non-JSON file is a problem, never a pass. */
export function loadLedgerFile(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    return { doc: undefined, problems: [error.code === "ENOENT" ? `file not found: ${file}` : `cannot read ${file}: ${error.message}`] };
  }
  if (text.trim() === "") return { doc: undefined, problems: [`file is empty: ${file}`] };
  try {
    return { doc: JSON.parse(text), problems: [] };
  } catch (error) {
    return { doc: undefined, problems: [`invalid JSON in ${file}: ${error.message}`] };
  }
}

export function main(argv = process.argv.slice(2)) {
  const options = argv.filter((a) => a.startsWith("-"));
  if (options.length) {
    console.error(`[release-ledger] unknown option: ${options.join(" ")}`);
    return 1;
  }
  const files = argv.length ? argv : [path.join(repoRoot, DEFAULT_LEDGER)];
  let failed = false;
  for (const file of files) {
    const loaded = loadLedgerFile(file);
    let problems = loaded.problems;
    let count = 0;
    if (!problems.length) {
      try {
        problems = validateLedger(loaded.doc);
        count = loaded.doc.releases?.length ?? 0;
      } catch (error) {
        problems = [`validator error (fail closed): ${error.message}`];
      }
    }
    if (problems.length) {
      failed = true;
      for (const p of problems) console.error(`[release-ledger] ${path.relative(process.cwd(), file) || file}: ${p}`);
    } else {
      console.log(`[release-ledger] ${path.relative(process.cwd(), file) || file}: ${count} release(s) ok`);
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();

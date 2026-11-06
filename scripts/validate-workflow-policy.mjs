// Workflow policy checker (CEP WP-11, AC-11). Workflows are parsed with the `yaml` package (YAML 1.2, merge keys on,
// duplicate keys rejected, aliases resolved), so flow style, quoted keys and anchors cannot hide a violation.
// Shell text inside `run:` is NOT parsed: the secret rules below are line-based heuristics over it (see the profile
// document for exactly what they cannot see).
//
// Rules (ids are stable; the baseline refers to them):
//   yaml-invalid           the file does not parse (this includes duplicate keys and alias bombs).
//   unpinned-action        every `uses` (step or reusable-workflow job) must be a full 40-hex SHA with a `# <version>`
//                          comment. Local `./` paths are exempt; `docker://` needs `@sha256:`.
//   permissions-missing    top-level `permissions` is required.
//   permissions-write-all  top-level `write-all` or any top-level write scope.
//   job-permissions-write  job-level `write-all` or write scope. Allowed only through a baseline entry with a reason.
//   prt-head-checkout      `pull_request_target` combined with any checkout of the PR head (see below).
//   secret-in-run          `${{ secrets.* }}` written directly inside a `run:` script.
//   secret-echo            a secret-mapped (or credential-named) env var referenced by a printing/sending command.
//
// Ratchet: existing violations are listed in .github/workflow-policy.baseline.json with a reason and an exact `count`.
// A violation not in the baseline fails; an entry whose count differs from the live count fails (stale or grown);
// duplicate entries fail. `--base-baseline <file>` also fails when an entry is new or its count grew versus that copy.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

export const RULES = ["yaml-invalid", "unpinned-action", "permissions-missing", "permissions-write-all", "job-permissions-write", "prt-head-checkout", "secret-in-run", "secret-echo"];
export const DEFAULT_BASELINE = ".github/workflow-policy.baseline.json";
const SHA40 = /^[0-9a-f]{40}$/;
const CRED_NAME = /(?:TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY)/i;
const HEAD_EXPR = /github\.event\.pull_request\.head|github\.event\.pull_request\.merge_commit|github\.head_ref|refs\/pull\/|github\.event\.workflow_run\.head/;
const INDIRECT = /\$\{\{\s*(?:env|vars|inputs|needs|steps|matrix|github\.event\.(?:inputs|client_payload))\b/;
const GIT_FETCH_CMD = /\b(?:git\s+(?:checkout|fetch|switch|pull|clone|worktree)|gh\s+pr\s+(?:checkout|diff)|gh\s+repo\s+clone)\b|refs\/pull\//;
const PRINTER = /(?:^|[\s;|&(`])(?:echo|printf|cat|tee|curl|wget|nc|ncat|print|Write-Host|Write-Output|Invoke-WebRequest|Invoke-RestMethod)\b/;
const DUMPER = /(?:^|[\s;|&(`])(?:set\s+-[a-z]*x|printenv|env|export\s+-p|declare\s+-p)(?:\s|$|;)/;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const asText = (v) => (typeof v === "string" ? v : JSON.stringify(v ?? ""));

function permissionProblems(perm) {
  // returns list of write grants: "write-all" or "<scope>"
  if (perm === "write-all") return ["write-all"];
  if (isObj(perm)) return Object.entries(perm).filter(([, v]) => String(v) === "write").map(([k]) => k);
  return [];
}

function usesInfo(text, target) {
  // returns problem string or null for one `uses` target
  if (typeof target !== "string") return "uses is not a string";
  if (target.startsWith("./")) return null;
  if (target.startsWith("docker://")) return /@sha256:[0-9a-f]{64}$/.test(target) ? null : "docker reference without @sha256 digest";
  const at = target.lastIndexOf("@");
  const ref = at < 0 ? "" : target.slice(at + 1);
  if (!SHA40.test(ref)) return `ref '${ref || "(none)"}' is not a full 40-hex commit SHA`;
  const esc = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`${esc}["']?[ \\t]+#[ \\t]*\\S`).test(text)) return "pinned by SHA but missing the `# <version>` comment on the same line";
  return null;
}

function triggers(on) {
  if (typeof on === "string") return [on];
  if (Array.isArray(on)) return on.map(String);
  if (isObj(on)) return Object.keys(on);
  return [];
}

function secretEnvNames(env) {
  const names = [];
  if (!isObj(env)) return names;
  for (const [k, v] of Object.entries(env)) if (/secrets\./.test(asText(v))) names.push(k);
  return names;
}

function scanRun(script, names, credNames) {
  // line heuristics: returns [{ name }] for printing commands that reference a secret-mapped or credential-named var
  const hits = [];
  let heredoc = null;
  const refs = (line, n) => new RegExp(`\\$\\{?${n}\\b|\\$env:${n}\\b|%${n}%|process\\.env\\.${n}\\b|ENVIRON\\["${n}"\\]|os\\.environ\\[['"]${n}['"]\\]`).test(line);
  for (const raw of String(script).split(/\r?\n/)) {
    const line = raw.replace(/^\s*#.*$/, "");
    if (heredoc) {
      if (raw.trim() === heredoc) heredoc = null;
      else for (const n of names) if (refs(raw, n)) hits.push(n);
      continue;
    }
    const printing = PRINTER.test(line);
    if (printing) {
      for (const n of names) if (refs(line, n)) hits.push(n);
      for (const m of line.matchAll(/\$\{?([A-Za-z0-9_]+)\}?/g)) if (credNames && CRED_NAME.test(m[1]) && !names.includes(m[1]) && !/^GITHUB_/.test(m[1])) hits.push(m[1]);
      const h = /<<-?\s*['"]?(\w+)['"]?/.exec(line);
      if (h) heredoc = h[1];
    }
    if (names.length && DUMPER.test(line)) hits.push("(environment dump)");
  }
  return hits;
}

/** Returns [{ rule, match, where, detail }] for one workflow text. */
export function checkWorkflow(text) {
  const out = [];
  const add = (rule, match, where, detail) => out.push({ rule, match, where, detail });
  let doc;
  try {
    const d = YAML.parseDocument(text, { merge: true, uniqueKeys: true, version: "1.2" });
    if (d.errors.length) { add("yaml-invalid", "yaml", "file", d.errors[0].message.split("\n")[0]); return out; }
    doc = d.toJS({ maxAliasCount: 100 });
  } catch (e) { add("yaml-invalid", "yaml", "file", String(e.message).split("\n")[0]); return out; }
  if (!isObj(doc)) { add("yaml-invalid", "yaml", "file", "workflow root is not a mapping"); return out; }

  // top-level permissions
  if (!("permissions" in doc)) add("permissions-missing", "permissions", "top", "no top-level `permissions`; the default token scope is not least privilege");
  else for (const s of permissionProblems(doc.permissions)) add("permissions-write-all", `top:${s}`, "top", `top-level write grant (${s}); grant it on the job that needs it`);

  const jobs = isObj(doc.jobs) ? doc.jobs : {};
  const trig = triggers(doc.on ?? doc[true]);
  const prt = trig.includes("pull_request_target");
  const wfNames = secretEnvNames(doc.env);

  for (const [jid, job] of Object.entries(jobs)) {
    if (!isObj(job)) continue;
    for (const s of permissionProblems(job.permissions)) add("job-permissions-write", `jobs.${jid}:${s}`, `jobs.${jid}`, `job-level write grant (${s}); needs a baseline entry with a reason`);
    if (job.uses !== undefined) { const p = usesInfo(text, job.uses); if (p) add("unpinned-action", String(job.uses), `jobs.${jid}`, p); }
    const jobNames = [...wfNames, ...secretEnvNames(job.env)];
    const steps = Array.isArray(job.steps) ? job.steps : [];
    steps.forEach((step, i) => {
      if (!isObj(step)) return;
      const where = `jobs.${jid}.steps[${i}]`;
      if (step.uses !== undefined) {
        const p = usesInfo(text, step.uses);
        if (p) add("unpinned-action", String(step.uses), where, p);
        if (prt && /^actions\/checkout(?:@|$)/.test(String(step.uses))) {
          const w = isObj(step.with) ? step.with : {};
          for (const k of ["ref", "repository"]) {
            const v = asText(w[k]);
            if (HEAD_EXPR.test(v)) add("prt-head-checkout", `${where}:${k}`, where, `pull_request_target checks out the pull request head through with.${k}`);
            else if (INDIRECT.test(v)) add("prt-head-checkout", `${where}:${k}`, where, `pull_request_target checkout with.${k} comes from an indirect expression that cannot be shown to avoid the head`);
          }
        }
      }
      if (typeof step.run === "string") {
        if (prt && GIT_FETCH_CMD.test(step.run)) add("prt-head-checkout", `${where}:run`, where, "pull_request_target runs git/gh commands that can fetch or check out the pull request head");
        if (/\$\{\{\s*secrets\./.test(step.run)) add("secret-in-run", `${where}`, where, "a secrets.* expression is written inside run; map it through env and do not print it");
        const names = [...jobNames, ...secretEnvNames(step.env)];
        const seen = new Set();
        for (const n of scanRun(step.run, names, true)) if (!seen.has(n)) { seen.add(n); add("secret-echo", `${where}:${n}`, where, `run prints or sends a secret-mapped/credential-named value (${n})`); }
      }
    });
  }
  return out;
}

const key = (file, rule, match) => `${file}\t${rule}\t${match}`;

/** Ratchet. `found` = [{file, rule, match, where, detail}]. Baseline entries carry an exact `count` (default 1). */
export function applyBaseline(found, baseline, baseBaseline) {
  const problems = [];
  const entries = new Map();
  for (const e of baseline.entries ?? []) {
    const k = key(e.file, e.rule, e.match);
    if (!RULES.includes(e.rule)) problems.push(`baseline: unknown rule '${e.rule}' for ${e.file}`);
    if (!e.reason || String(e.reason).trim().length < 10) problems.push(`baseline: entry ${e.file} ${e.rule} '${e.match}' needs a written reason`);
    if (e.count !== undefined && (!Number.isInteger(e.count) || e.count < 1)) problems.push(`baseline: entry ${e.file} ${e.rule} '${e.match}' has an invalid count`);
    if (entries.has(k)) problems.push(`baseline: duplicate entry ${e.file} [${e.rule}] '${e.match}'`);
    entries.set(k, { ...e, count: e.count ?? 1 });
  }
  const live = new Map();
  for (const f of found) { const k = key(f.file, f.rule, f.match); (live.get(k) ?? live.set(k, []).get(k)).push(f); }
  const tolerated = [];
  for (const [k, list] of live) {
    const e = entries.get(k);
    if (!e) { for (const f of list) problems.push(`${f.file} ${f.where} [${f.rule}] ${f.detail} (${f.match})`); continue; }
    if (list.length !== e.count) problems.push(`baseline: ${e.file} [${e.rule}] '${e.match}' occurs ${list.length}x but the baseline records ${e.count}x; ${list.length > e.count ? "new occurrences are not allowed" : "lower the count (the baseline only shrinks)"}`);
    else tolerated.push(...list);
  }
  for (const [k, e] of entries) if (!live.has(k)) problems.push(`baseline: stale entry ${e.file} [${e.rule}] '${e.match}' no longer occurs; remove it (the baseline only shrinks)`);
  if (baseBaseline) {
    const old = new Map((baseBaseline.entries ?? []).map((e) => [key(e.file, e.rule, e.match), e.count ?? 1]));
    for (const [k, e] of entries) {
      if (!old.has(k)) problems.push(`baseline: entry ${e.file} [${e.rule}] '${e.match}' is new relative to the base; the baseline may not grow`);
      else if (e.count > old.get(k)) problems.push(`baseline: entry ${e.file} [${e.rule}] '${e.match}' count grew from ${old.get(k)} to ${e.count}`);
    }
  }
  return { problems, tolerated };
}

export function scanDir(root, dir = ".github/workflows") {
  const abs = path.join(root, dir);
  if (!existsSync(abs)) return [];
  const found = [];
  for (const name of readdirSync(abs).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    const rel = `${dir}/${name}`;
    for (const f of checkWorkflow(readFileSync(path.join(abs, name), "utf8"))) found.push({ file: rel, ...f });
  }
  return found;
}

function main(argv) {
  const get = (flag, dflt) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : dflt; };
  const root = path.resolve(get("--root", "."));
  const baselinePath = path.resolve(root, get("--baseline", DEFAULT_BASELINE));
  const baseBasePath = get("--base-baseline");
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : { entries: [] };
  const base = baseBasePath && existsSync(baseBasePath) ? JSON.parse(readFileSync(baseBasePath, "utf8")) : undefined;
  const { problems, tolerated } = applyBaseline(scanDir(root), baseline, base);
  for (const t of tolerated) console.log(`baseline: ${t.file} ${t.where} [${t.rule}] ${t.match}`);
  if (problems.length) {
    for (const p of problems) console.error(`FAIL ${p}`);
    console.error(`workflow policy: ${problems.length} problem(s); ${tolerated.length} baselined`);
    return 1;
  }
  console.log(`workflow policy: OK (${tolerated.length} baselined violation(s) remain)`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));

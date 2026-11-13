// Capability scorecard generator (CEP WP-03). Output: docs/capabilities/scorecard.md. Derived, never edited.
// Inputs: the authority table, the ECP pin projection, the release ledger and the capability graph fragment.
// It refuses to render when the ledger or the ledger x authority cross-check has problems (fail closed).
//   node scripts/generate-capability-scorecard.mjs           write the file
//   node scripts/generate-capability-scorecard.mjs --check   fail if the file is missing or stale (no write)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadRepository } from "./validate-capability-authority.mjs";
import { DEFAULT_LEDGER, STATES, deriveLevel, loadLedgerFile, validateLedger } from "./validate-release-ledger.mjs";
import { crossCheck } from "./validate-ledger-authority.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SCORECARD_PATH = "docs/capabilities/scorecard.md";
export const FRAGMENT_PATH = ".platform/capability-graph.fragment.json";
export const NO_RELEASE = "no release recorded";
export const NOT_VERIFIED = "not_verified";

const cell = (v) => String(v).replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim() || "-";
const byKey = (a, b) => (a.capability < b.capability ? -1 : a.capability > b.capability ? 1 : 0);

/** Owner from the capability graph fragment, only when a Contract node's path equals the row's schema path. Never guessed. */
export function ownerOf(row, fragment) {
  const prefix = "platform-core:";
  if (row.classification !== "core-canonical" || !row.canonical_source.startsWith(prefix) || !fragment) return NOT_VERIFIED;
  const file = row.canonical_source.slice(prefix.length);
  const node = (fragment.nodes ?? []).find((n) => n.type === "Contract" && n.path === file);
  const edge = node && (fragment.edges ?? []).find((e) => e.type === "OWNED_BY" && e.from === node.id);
  const owner = edge && (fragment.nodes ?? []).find((n) => n.id === edge.to && n.type === "Owner");
  return owner?.name ?? NOT_VERIFIED;
}

function evidenceCount(releases) {
  const seen = new Set();
  const add = (list) => (Array.isArray(list) ? list : []).forEach((e) => e && seen.add(`${e.kind}|${e.ref}`));
  for (const r of releases) {
    add(r.admission?.evidenceRefs);
    add(r.publication?.evidenceRefs);
    add(r.support?.operationalEvidenceRefs);
    (r.transitions ?? []).forEach((t) => add(t.evidenceRefs));
  }
  return seen.size;
}

function blockedReason(row, releases) {
  if (row.classification === "unknown") return "classification unknown: no settled authority, cannot go beyond candidate";
  if (row.classification === "compatibility" || row.classification === "deprecated") return `${row.classification} stub; not releasable, authority is ${row.canonical_source}`;
  if (!releases.length) return NO_RELEASE;
  const best = releases.reduce((a, b) => (deriveLevel(b).level > deriveLevel(a).level ? b : a));
  const { level, missing } = deriveLevel(best);
  return level >= STATES.length - 1 ? "none" : missing.join("; ");
}

/** Pure render. Same inputs, same bytes: no timestamps, no environment. */
export function renderScorecard({ rows, pin, ledger, fragment }) {
  const releases = Array.isArray(ledger?.releases) ? ledger.releases : [];
  const sorted = [...rows].sort(byKey);
  const lines = [];
  let withRelease = 0;
  let ownerNotVerified = 0;
  for (const row of sorted) {
    const mine = releases.filter((r) => r.capability === row.capability);
    const level = mine.length ? Math.max(...mine.map((r) => deriveLevel(r).level)) : -1;
    if (mine.length) withRelease++;
    const owner = ownerOf(row, fragment);
    if (owner === NOT_VERIFIED) ownerNotVerified++;
    const pinned = row.classification === "ecp-canonical" ? pin?.capabilities?.find((c) => c.id === row.capability)?.version : undefined;
    const version = pinned ?? (mine.length ? mine[0].contractVersion : "-");
    lines.push(`| ${[row.capability, row.classification, row.canonical_source || "-", version, level < 0 ? NO_RELEASE : STATES[level], evidenceCount(mine), owner, blockedReason(row, mine)].map(cell).join(" | ")} |`);
  }
  const text = [
    "# Capability scorecard",
    "",
    "> GENERATED FILE. Do not edit. Regenerate with `npm run generate:scorecard`; `npm run validate` fails when this file is stale.",
    "> This is a read-only projection, **not a registry** and it adds **no status field**: the facts live in",
    "> `docs/architecture/contract-authority/capability-authority.csv`, `docs/architecture/contract-authority/ecp-pin.json`,",
    "> `docs/release/release-ledger.json` and `.platform/capability-graph.fragment.json`. Where they disagree with this file, they win.",
    "",
    `- ECP pin: \`${pin?.tag ?? "none"}\` (\`${pin?.commit ?? "none"}\`). The scorecard never changes the pin.`,
    `- Ledger releases recorded: ${releases.length}. Capabilities with a release: ${withRelease} of ${sorted.length}.`,
    `- Owner \`${NOT_VERIFIED}\`: ${ownerNotVerified} of ${sorted.length}. An owner is shown only when the capability graph fragment maps the contract to an Owner node; ECP rows never copy private owner data.`,
    "",
    "Columns. **Version**: the ECP pinned version for `ecp-canonical`; otherwise the ledger `contractVersion` when a release exists, else `-`.",
    `**Derived state**: the highest state the ledger evidence supports (never a declared value), or \`${NO_RELEASE}\`. **Evidence**: distinct evidence refs across the capability's releases.`,
    "**Blocked reason**: for a capability with a release, what is missing for its next state; otherwise why nothing is recorded. It is computed, not written.",
    "",
    "| Capability | Classification | Canonical source | Version | Derived state | Evidence | Owner | Blocked reason |",
    "|---|---|---|---|---|---|---|---|",
    ...lines,
    "",
  ].join("\n");
  return { text, ownerNotVerified, total: sorted.length, withRelease };
}

export function build(root = repoRoot) {
  const loaded = loadLedgerFile(path.join(root, DEFAULT_LEDGER));
  if (loaded.problems.length) return { problems: loaded.problems };
  const problems = validateLedger(loaded.doc);
  const repo = loadRepository(root);
  if (!problems.length) problems.push(...crossCheck({ ledger: loaded.doc, rows: repo.rows, pin: repo.pin }));
  if (problems.length) return { problems };
  const fragmentFile = path.join(root, FRAGMENT_PATH);
  const fragment = existsSync(fragmentFile) ? JSON.parse(readFileSync(fragmentFile, "utf8")) : undefined;
  return { problems: [], ...renderScorecard({ rows: repo.rows, pin: repo.pin, ledger: loaded.doc, fragment }) };
}

export function main(root = repoRoot, argv = process.argv.slice(2)) {
  const unknown = argv.filter((a) => a !== "--check");
  if (unknown.length) { console.error(`[scorecard] unknown argument: ${unknown.join(" ")}`); return 1; }
  const check = argv.includes("--check");
  let result;
  try {
    result = build(root);
  } catch (error) {
    result = { problems: [`generator error (fail closed): ${error.message}`] };
  }
  if (result.problems.length) {
    for (const p of result.problems) console.error(`[scorecard] ${p}`);
    return 1;
  }
  const file = path.join(root, SCORECARD_PATH);
  if (check) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : undefined;
    if (current !== result.text) {
      console.error(`[scorecard] ${SCORECARD_PATH} is ${current === undefined ? "missing" : "stale"}; run 'npm run generate:scorecard' and commit the result`);
      return 1;
    }
    console.log(`[scorecard] ${SCORECARD_PATH} is up to date (${result.total} capabilities, ${result.withRelease} with a release, owner ${NOT_VERIFIED}: ${result.ownerNotVerified})`);
    return 0;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, result.text);
  console.log(`[scorecard] wrote ${SCORECARD_PATH} (${result.total} capabilities, ${result.withRelease} with a release, owner ${NOT_VERIFIED}: ${result.ownerNotVerified})`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();

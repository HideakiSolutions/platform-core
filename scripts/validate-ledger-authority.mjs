// Ledger x authority table cross-check (CEP WP-03, ADR-CEP-001 and ADR-CEP-002).
// ADR-CEP-002 left this check to WP-03: a release must agree with the per-capability authority table.
// It reuses the two existing validators (the ledger's derived state, the table loader) and adds only the cross rules.
// Offline: it reads the committed table, the pin projection and the ledger. It cannot prove a claim is true.

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { checkAuthority, loadRepository } from "./validate-capability-authority.mjs";
import { DEFAULT_LEDGER, STATES, deriveLevel, loadLedgerFile, validateLedger } from "./validate-release-ledger.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUTHORITY_OF = { "ecp-canonical": "ecp", "core-canonical": "core" };
const ID_PREFIX = "platform-core/";
const list = (value) => (value ? value.split(";").map((v) => v.trim()).filter(Boolean) : []);

/** Highest evidence-derived state of a release, as an index into STATES. Never trusts the declared state. */
export const derivedLevel = (release) => deriveLevel(release).level;

/** State a capability's authority-table claim must match: derived from its releases, or "none". */
export function expectedClaim(releases) {
  if (!releases.length) return "none";
  return STATES[Math.max(...releases.map(derivedLevel))];
}

/**
 * Pure check. `ledger` is a parsed ledger; `rows` the rows of capability-authority.csv; `pin` the ECP pin projection.
 * Returns a list of problems (empty = consistent). Does not re-validate the ledger itself (validateLedger does).
 */
export function crossCheck({ ledger, rows, pin }) {
  const problems = [];
  // Fail closed on the inputs regardless of ledger content: an empty ledger must not hide a missing pin or table.
  if (!pin || typeof pin !== "object" || typeof pin.tag !== "string" || !/^[0-9a-f]{40}$/.test(pin.commit ?? "") || !Array.isArray(pin.capabilities) || pin.capabilities.length === 0) {
    problems.push("ECP pin projection is missing or malformed (docs/architecture/contract-authority/ecp-pin.json)");
  }
  if (!Array.isArray(rows) || rows.length === 0) problems.push("authority table is missing or has no rows (docs/architecture/contract-authority/capability-authority.csv)");
  if (problems.length) return problems;
  const releases = Array.isArray(ledger?.releases) ? ledger.releases : [];
  const byKey = new Map(rows.map((r) => [r.capability, r]));
  // Legacy identifiers owned by a canonical row. A stub's own key is covered by its classification.
  const legacyOf = new Map();
  for (const row of rows) {
    if (!AUTHORITY_OF[row.classification]) continue;
    for (const id of list(row.legacy_identifiers)) legacyOf.set(id.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : id, row.capability);
  }

  const perCapability = new Map();
  releases.forEach((r, i) => {
    if (r === null || typeof r !== "object") return;
    const at = `releases[${i}] (${r.id}): capability '${r.capability}'`;
    const row = byKey.get(r.capability);
    if (!row) {
      const owner = legacyOf.get(r.capability);
      problems.push(owner
        ? `${at} is a legacy identifier of '${owner}'; a legacy identifier cannot be released as canonical, release '${owner}' instead`
        : `${at} has no row in the authority table (${"docs/architecture/contract-authority/capability-authority.csv"})`);
      return;
    }
    if (!perCapability.has(r.capability)) perCapability.set(r.capability, []);
    perCapability.get(r.capability).push(r);

    if (row.classification === "compatibility" || row.classification === "deprecated") {
      problems.push(`${at} is a ${row.classification} stub (authority is ${row.canonical_source}); a stub cannot be released as canonical, release the canonical capability instead`);
      return;
    }
    const expected = AUTHORITY_OF[row.classification];
    if (expected && r.contractAuthority !== expected) {
      problems.push(`${at} declares contractAuthority '${r.contractAuthority}' but the table classifies it '${row.classification}' (expects '${expected}')`);
    }
    if (row.classification === "unknown") {
      const level = derivedLevel(r);
      if (level > 0 || r.state !== "candidate") {
        problems.push(`${at} is classified 'unknown' (authority unsettled): it cannot go beyond 'candidate' (declared '${r.state}', evidence derives '${STATES[level]}')`);
      }
    }
    if (row.classification === "ecp-canonical") {
      const pinned = pin?.capabilities?.find((c) => c.id === r.capability)?.version;
      if (pinned === undefined) problems.push(`${at} is not in the pinned ECP registry projection (${pin?.tag ?? "no pin"})`);
      else if (r.contractVersion !== pinned) {
        problems.push(`${at} contractVersion '${r.contractVersion}' differs from the version pinned in ${pin.tag} ('${pinned}'); update the pin through its own change, or release the pinned version`);
      }
    }
  });

  // claimed_status is derived, not free text: it must equal what the ledger evidence supports.
  for (const row of rows) {
    const want = expectedClaim(perCapability.get(row.capability) ?? []);
    if (row.claimed_status !== want) {
      problems.push(`${row.capability}: claimed_status '${row.claimed_status}' is inconsistent with the ledger, which derives '${want}'${want === "none" ? " (no release recorded)" : ""}`);
    }
  }
  return problems;
}

export function main(root = repoRoot, argv = process.argv.slice(2)) {
  const file = argv[0] ?? path.join(root, DEFAULT_LEDGER);
  let problems;
  try {
    const loaded = loadLedgerFile(file);
    problems = loaded.problems;
    if (!problems.length) {
      problems = validateLedger(loaded.doc);
      if (!problems.length) {
        const repo = loadRepository(root);
        problems = checkAuthority(repo);
        if (!problems.length) problems = crossCheck({ ledger: loaded.doc, ...repo });
      }
    }
  } catch (error) {
    problems = [`validator error (fail closed): ${error.message}`];
  }
  for (const p of problems) console.error(`[ledger-authority] ${p}`);
  if (problems.length) return 1;
  console.log("[ledger-authority] ok");
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();

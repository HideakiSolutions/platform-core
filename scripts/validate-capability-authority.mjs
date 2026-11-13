// Contract authority validator (CEP WP-01, ADR-CEP-001).
// Fails closed when docs/architecture/contract-authority/capability-authority.csv would let one capability
// have two authorities, or when the table disagrees with the schema files present in this repository.
// Only the checks are implemented here; the decision itself lives in ADR-CEP-001 and ECP Decision 0006.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { isStubCandidate, supersededCapability } from "./lib/contract-stub.mjs";

import { loadProviderAccessSnapshot } from "./lib/provider-access-snapshot.mjs";

export const CSV_PATH = "docs/architecture/contract-authority/capability-authority.csv";
export const PIN_PATH = "docs/architecture/contract-authority/ecp-pin.json";
// Closed allowlist of resolution policies (ADR-CEP-001 decision 3). Anything else is rejected.
export const ALLOWED_POLICIES = new Set(["policy: vendored-bundle-lockfile"]);
export const COLUMNS = [
  "capability",
  "classification",
  "canonical_source",
  "version_or_resolution_policy",
  "legacy_identifiers",
  "claimed_status",
  "evidence",
  "notes",
];
export const CLASSIFICATIONS = new Set(["ecp-canonical", "core-canonical", "compatibility", "deprecated", "unknown"]);
export const CLAIMS = new Set(["none", "candidate", "admitted", "published", "adopted", "supported"]);
// "supported" is rejected outright (no capability is supported at this stage; evidence gates belong to WP-03).
// Other claims above "candidate" need exactly one canonical source.
const CLAIMS_NEEDING_AUTHORITY = new Set(["admitted", "published", "adopted"]);
const ECP_PIN = /^(\d+\.\d+\.\d+) @ (contracts-v\d+\.\d+\.\d+) \(([0-9a-f]{40})\)$/;
const ECP_NAME = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*)+$/;
const ID_PREFIX = "platform-core/";

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text) {
  const records = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) records.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((v) => v !== "")) records.push(row); }
  if (!records.length) return { header: [], rows: [] };
  const [header, ...body] = records;
  return { header, rows: body.map((r) => ({ ...Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])), _cells: r.length })) };
}

const list = (value) => (value ? value.split(";").map((v) => v.trim()).filter(Boolean) : []);

/**
 * Pure check. `header` and `rows` come from the CSV; `schemas` is [{ key, file, schema }] for every
 * `<module>/contracts/*.schema.json` (key = `$id` without the platform-core/ prefix); `moduleDirs` is the set of module directories.
 */
export function checkAuthority({ header, rows, schemas, moduleDirs = new Set(), pin }) {
  const problems = [];
  for (const column of COLUMNS) if (!header.includes(column)) problems.push(`missing column: ${column}`);
  for (const column of header) if (!COLUMNS.includes(column)) problems.push(`unexpected column: ${column}`);
  if (new Set(header).size !== header.length) problems.push("duplicate column in header");
  if (problems.length) return problems;

  for (const row of rows) {
    if (row._cells !== undefined && row._cells !== header.length) problems.push(`${row.capability || "(row)"}: row has ${row._cells} cells, expected ${header.length}`);
  }

  const byKey = new Map();
  for (const row of rows) {
    const key = row.capability;
    if (!key) { problems.push("row without capability"); continue; }
    if (byKey.has(key)) problems.push(`${key}: duplicate capability row (double authority)`);
    else byKey.set(key, row);
  }

  const canonical = (row) => row.classification === "ecp-canonical" || row.classification === "core-canonical";

  for (const [key, row] of byKey) {
    const at = `${key}:`;
    if (!CLASSIFICATIONS.has(row.classification)) {
      problems.push(`${at} invalid classification '${row.classification}'`);
      continue;
    }
    if (!CLAIMS.has(row.claimed_status)) problems.push(`${at} invalid claimed_status '${row.claimed_status}'`);

    const sources = row.canonical_source.split(/[;,|]|\s+and\s+/).map((s) => s.trim()).filter(Boolean);
    if (canonical(row) && sources.length !== 1) {
      problems.push(`${at} a canonical row needs exactly one canonical_source (found ${sources.length})`);
    }
    if (row.classification === "ecp-canonical") {
      if (!ECP_NAME.test(key)) problems.push(`${at} ecp-canonical capability must be an ECP name (<family>.<name>)`);
      if (!row.canonical_source.startsWith("ecp:")) problems.push(`${at} ecp-canonical source must start with 'ecp:'`);
      const policy = row.version_or_resolution_policy;
      const m = ECP_PIN.exec(policy);
      if (!m && !ALLOWED_POLICIES.has(policy)) {
        problems.push(`${at} ecp-canonical needs a pinned version ('<x.y.z> @ contracts-vX.Y.Z (<40-hex sha>)') or an allowed resolution policy (${[...ALLOWED_POLICIES].join(", ")}); moving or unknown policies are rejected`);
      }
      const entry = pin?.capabilities?.find((c) => c.id === key);
      if (!pin) problems.push(`${at} no ECP pin projection available`);
      else if (!entry) problems.push(`${at} capability is not in the pinned ECP registry projection (${pin.tag})`);
      else {
        const declared = row.canonical_source.split("@")[1];
        if (declared !== entry.version) problems.push(`${at} canonical_source version '${declared}' differs from pinned '${entry.version}'`);
        if (m) {
          if (m[1] !== entry.version) problems.push(`${at} version ${m[1]} differs from pinned ${entry.version}`);
          if (m[2] !== pin.tag) problems.push(`${at} tag ${m[2]} differs from pinned ${pin.tag}`);
          if (m[3] !== pin.commit) problems.push(`${at} commit ${m[3]} differs from pinned ${pin.commit}`);
        }
      }
    }
    if (row.classification === "core-canonical") {
      if (!row.canonical_source.startsWith("platform-core:")) problems.push(`${at} core-canonical source must start with 'platform-core:'`);
      if (!row.version_or_resolution_policy) problems.push(`${at} core-canonical needs a version_or_resolution_policy`);
    }
    if ((row.classification === "compatibility" || row.classification === "deprecated") && !row.canonical_source) {
      problems.push(`${at} ${row.classification} row must point at its canonical_source`);
    }
    if (row.claimed_status === "supported") problems.push(`${at} claimed_status 'supported' is rejected: no capability is supported at this stage and evidence gates belong to WP-03`);
    if (CLAIMS_NEEDING_AUTHORITY.has(row.claimed_status) && !(canonical(row) && sources.length === 1)) {
      problems.push(`${at} claimed_status '${row.claimed_status}' requires exactly one canonical source (classification is '${row.classification}')`);
    }
  }

  for (const entry of pin?.capabilities ?? []) {
    if (byKey.get(entry.id)?.classification !== "ecp-canonical") problems.push(`${entry.id}: pinned ECP capability has no ecp-canonical row`);
  }

  // The same legacy identifier must not be owned by two canonical rows, nor by a canonical row and another core-canonical row.
  const legacyOwner = new Map();
  for (const [key, row] of byKey) {
    if (!canonical(row)) continue;
    for (const id of list(row.legacy_identifiers)) {
      if (legacyOwner.has(id)) problems.push(`legacy identifier '${id}' is claimed by two canonical rows: ${legacyOwner.get(id)} and ${key}`);
      else legacyOwner.set(id, key);
      const other = byKey.get(id.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : id);
      if (other && other !== row && other.classification === "core-canonical") {
        problems.push(`${key}: legacy identifier '${id}' is also a core-canonical row (double authority)`);
      }
    }
  }

  // Table versus schema files.
  const keys = new Set(schemas.map((s) => s.key));
  for (const { key, file, schema } of schemas) {
    const row = byKey.get(key);
    if (!row) { problems.push(`${file}: schema '${key}' has no row in the authority table`); continue; }
    if (isStubCandidate(schema) && "x-superseded-by" in schema) {
      if (row.classification === "core-canonical" || row.classification === "ecp-canonical") {
        problems.push(`${key}: ${file} is declared an ECP stub (x-superseded-by) but the table classifies it '${row.classification}' (double authority)`);
      }
      const capability = supersededCapability(schema);
      if (row.classification !== "compatibility" && row.classification !== "deprecated") {
        problems.push(`${key}: stub ${file} must be classified compatibility or deprecated (found '${row.classification}')`);
      }
      if (capability && row.canonical_source !== `ecp:${schema["x-superseded-by"]}`) {
        problems.push(`${key}: stub canonical_source must be 'ecp:${schema["x-superseded-by"]}' (found '${row.canonical_source}')`);
      }
      if (!capability) problems.push(`${file}: x-superseded-by is malformed`);
      else if (byKey.get(capability)?.classification !== "ecp-canonical") {
        problems.push(`${key}: x-superseded-by capability '${capability}' has no ecp-canonical row`);
      }
    } else if (row.classification === "compatibility" || row.classification === "deprecated") {
      problems.push(`${key}: ${file} is not a stub but the table classifies it '${row.classification}'`);
    }
  }
  for (const [key, row] of byKey) {
    if (key.includes("/")) {
      if (!keys.has(key)) problems.push(`${key}: row has no schema file with that $id`);
    } else if (row.classification !== "ecp-canonical" && !moduleDirs.has(key)) {
      problems.push(`${key}: row is neither an ECP capability nor a module of this repository`);
    }
  }
  return problems;
}

function walkSchemas(directory, found = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ([".git", ".worktrees", "node_modules"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walkSchemas(absolute, found);
    else if (entry.name.endsWith(".schema.json") && absolute.includes(`${path.sep}contracts${path.sep}`)) found.push(absolute);
  }
  return found;
}

/** Reads the table and the schema files of a repository checkout. */
export function loadRepository(root) {
  const csvFile = path.join(root, CSV_PATH);
  if (!existsSync(csvFile)) throw new Error(`${CSV_PATH} not found`);
  const { header, rows } = parseCsv(readFileSync(csvFile, "utf8"));
  const schemas = [];
  for (const absolute of walkSchemas(root)) {
    const schema = JSON.parse(readFileSync(absolute, "utf8"));
    const id = typeof schema.$id === "string" ? schema.$id : "";
    schemas.push({
      key: id.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : id,
      file: path.relative(root, absolute).split(path.sep).join("/"),
      schema,
    });
  }
  const moduleDirs = new Set(
    readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
      .map((e) => e.name),
  );
  const pinFile = path.join(root, PIN_PATH);
  const pin = existsSync(pinFile) ? JSON.parse(readFileSync(pinFile, "utf8")) : undefined;
  // Only these four fully verified source-only candidates live outside the
  // admitted CSV/global pin. Every other schema still needs its canonical row.
  const providerCandidate = loadProviderAccessSnapshot(root, schemas);
  return { header, rows, schemas: schemas.filter(({ schema }) => !providerCandidate.aliasIds.has(schema.$id)), moduleDirs, pin };
}

/** Offline-capable authenticity check of the committed projection against a locally obtained ECP registry file. */
export function checkRegistry(pin, bytes) {
  const problems = [];
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== pin.registry_sha256) problems.push(`registry sha256 ${sha} differs from pinned ${pin.registry_sha256}`);
  const live = JSON.parse(bytes.toString("utf8")).capabilities.map((c) => `${c.name}@${c.version}`).sort();
  const pinned = pin.capabilities.map((c) => `${c.id}@${c.version}`).sort();
  if (live.join("\n") !== pinned.join("\n")) problems.push("registry capability/version list differs from the projection");
  return problems;
}

export function main(root = process.cwd(), argv = process.argv.slice(2)) {
  let problems;
  try {
    const repo = loadRepository(root);
    const at = argv.indexOf("--registry");
    if (at >= 0) {
      if (!argv[at + 1]) throw new Error("--registry needs a path");
      problems = checkRegistry(repo.pin, readFileSync(argv[at + 1]));
      for (const problem of problems) console.error(`[capability-authority] ${problem}`);
      if (!problems.length) console.log("[capability-authority] registry matches pin projection");
      return problems.length ? 1 : 0;
    }
    problems = checkAuthority(repo);
  } catch (error) {
    problems = [error.message];
  }
  for (const problem of problems) console.error(`[capability-authority] ${problem}`);
  if (problems.length) return 1;
  console.log("[capability-authority] ok");
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();

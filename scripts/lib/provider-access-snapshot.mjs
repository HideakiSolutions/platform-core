// Source-only candidate aliases under the existing vendored-bundle-lockfile policy.
// This scoped projection does not extend the admitted global ECP registry pin.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { stubProblems } from "./contract-stub.mjs";

const capability = "ai.provider-access";
const names = ["provider-connection", "inference-request", "inference-response", "provider-error"];
const canonicalBase = "https://contracts.hideakisolutions.local/capabilities/ai.provider-access/";
export const PROVIDER_LOCK = ".platform/ecp/ai.provider-access.lock.json";
const expected = names.map((name) => ({
  path: `ai/contracts/${name}.schema.json`,
  id: `platform-core/ai/${name}`,
  target: `${canonicalBase}${name}.schema.json`,
  source_path: `.platform/ecp/ai.provider-access/schema.${name}.json`,
}));

function readOwned(root, relative, owner) {
  const file = path.resolve(root, relative);
  const rootBoundary = realpathSync(root) + path.sep;
  const boundary = realpathSync(path.resolve(root, owner)) + path.sep;
  if (!boundary.startsWith(rootBoundary) || boundary !== path.resolve(realpathSync(root), owner) + path.sep)
    throw new Error(`snapshot owner escapes repository: ${owner}`);
  if (!realpathSync(file).startsWith(boundary)) throw new Error(`snapshot path escapes owning directory: ${relative}`);
  return readFileSync(file);
}

export function loadProviderAccessSnapshot(root, schemas) {
  const candidates = schemas.filter(({ file, schema }) =>
    expected.some((item) => item.path === file || item.id === schema.$id)
    || (typeof schema["x-superseded-by"] === "string" && schema["x-superseded-by"].startsWith(`${capability}@`)));
  const lockFile = path.join(root, PROVIDER_LOCK);
  if (!candidates.length && !existsSync(lockFile)) return { records: [], aliasIds: new Set() };
  const lock = JSON.parse(readOwned(root, PROVIDER_LOCK, ".platform/ecp"));
  if (lock.capability !== capability || lock.version !== "0.1.0" || lock.owner !== "ECP"
    || lock.source !== "HideakiSolutions/enterprise-capability-platform" || lock.state !== "candidate-unpublished"
    || !/^[0-9a-f]{40}$/.test(lock.ref ?? "")) throw new Error("invalid ECP snapshot lock authority/ref");
  if (!Array.isArray(lock.files) || lock.files.length !== 4 || !Array.isArray(lock.aliases)
    || lock.aliases.length !== 4 || candidates.length !== 4) throw new Error("expected exactly four provider aliases and source schemas");
  const aliases = new Map();
  for (const entry of lock.aliases) {
    if (aliases.has(entry.path)) throw new Error("duplicate provider alias");
    const match = expected.find((item) => item.path === entry.path);
    if (!match || Object.keys(entry).sort().join() !== Object.keys(match).sort().join()
      || Object.keys(match).some((key) => match[key] !== entry[key])) throw new Error("unknown provider alias or target mapping");
    aliases.set(entry.path, entry);
  }
  const files = new Map();
  for (const entry of lock.files) {
    if (files.has(entry.path)) throw new Error("duplicate provider source schema");
    if (!expected.some((item) => item.source_path === entry.path) || !/^[0-9a-f]{64}$/.test(entry.sha256 ?? ""))
      throw new Error("unknown provider source path/hash");
    files.set(entry.path, entry);
  }
  const records = [];
  const aliasIds = new Set();
  for (const item of expected) {
    const matches = candidates.filter(({ file }) => file === item.path);
    if (matches.length !== 1 || !aliases.has(item.path) || !files.has(item.source_path)) throw new Error("missing or duplicate provider alias/source");
    const schema = matches[0].schema;
    const disk = JSON.parse(readOwned(root, item.path, "ai/contracts"));
    if (JSON.stringify(schema) !== JSON.stringify(disk) || schema.$id !== item.id || schema.$ref !== item.target
      || schema["x-superseded-by"] !== `${capability}@0.1.0`
      || stubProblems(schema, { metaSchema: "https://json-schema.org/draft/2020-12/schema", idPrefix: "platform-core/" }).length)
      throw new Error(`invalid provider alias: ${item.path}`);
    const bytes = readOwned(root, item.source_path, ".platform/ecp/ai.provider-access");
    if (createHash("sha256").update(bytes).digest("hex") !== files.get(item.source_path).sha256)
      throw new Error(`snapshot hash mismatch: ${item.source_path}`);
    const canonical = JSON.parse(bytes);
    if (canonical.$id !== item.target) throw new Error(`unexpected ECP schema authority: ${item.source_path}`);
    records.push({ relative: item.source_path, schema: canonical });
    aliasIds.add(item.id);
  }
  return { records, aliasIds };
}

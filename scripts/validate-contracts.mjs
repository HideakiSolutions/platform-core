import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = process.cwd();
const contractSuffix = `${path.sep}contracts${path.sep}`;
const expectedMetaSchema = "https://json-schema.org/draft/2020-12/schema";
const expectedIdPrefix = "platform-core/";
const validationBase = "https://schemas.hideakisolutions.local/";

function fail(message) {
  console.error(`[contracts] ${message}`);
  process.exitCode = 1;
}

function walk(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ([".git", ".worktrees", "node_modules"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else if (absolute.includes(contractSuffix) && absolute.endsWith(".schema.json")) files.push(absolute);
  }
  return files;
}

function walkExamples(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ([".git", ".worktrees", "node_modules"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walkExamples(absolute, files);
    else if (absolute.endsWith(".example.json")) files.push(absolute);
  }
  return files;
}

function walkInvalidFixtures(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ([".git", ".worktrees", "node_modules"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walkInvalidFixtures(absolute, files);
    else if (absolute.endsWith(".invalid.json")) files.push(absolute);
  }
  return files;
}

const files = walk(root).sort();
if (files.length === 0) fail("no contract schemas found");

const records = [];
const ids = new Map();
for (const file of files) {
  const relative = path.relative(root, file);
  let schema;
  try {
    schema = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${relative}: invalid JSON: ${error.message}`);
    continue;
  }

  if (schema.$schema !== expectedMetaSchema) fail(`${relative}: $schema must be JSON Schema 2020-12`);
  if (typeof schema.$id !== "string" || !schema.$id.startsWith(expectedIdPrefix)) {
    fail(`${relative}: $id must start with ${expectedIdPrefix}`);
  } else if (ids.has(schema.$id)) {
    fail(`${relative}: duplicate $id ${schema.$id} (also ${ids.get(schema.$id)})`);
  } else {
    ids.set(schema.$id, relative);
  }
  if (typeof schema.title !== "string" || schema.title.trim() === "") fail(`${relative}: title is required`);
  if (typeof schema.description !== "string" || schema.description.trim() === "") {
    fail(`${relative}: description is required`);
  }

  const moduleRoot = relative.split(path.sep)[0];
  if (!existsSync(path.join(root, moduleRoot, "docs", "README.md"))) {
    fail(`${relative}: owning module must provide ${moduleRoot}/docs/README.md`);
  }
  records.push({ relative, schema });
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const knownIds = new Set(records.map((record) => record.schema.$id));

function normalizeIdentifiers(value) {
  if (Array.isArray(value)) return value.map(normalizeIdentifiers);
  if (!value || typeof value !== "object") return value;
  const normalized = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "$id" && typeof child === "string") normalized[key] = `${validationBase}${child}`;
    else if (key === "$ref" && knownIds.has(child)) normalized[key] = `${validationBase}${child}`;
    else normalized[key] = normalizeIdentifiers(child);
  }
  return normalized;
}

for (const record of records) {
  try {
    ajv.addSchema(normalizeIdentifiers(record.schema));
  } catch (error) {
    fail(`${record.relative}: schema registration failed: ${error.message}`);
  }
}
for (const record of records) {
  try {
    if (!ajv.getSchema(`${validationBase}${record.schema.$id}`)) fail(`${record.relative}: schema did not compile`);
  } catch (error) {
    fail(`${record.relative}: schema compilation failed: ${error.message}`);
  }
}

let exampleCount = 0;
for (const file of walkExamples(root).sort()) {
  const relative = path.relative(root, file);
  let instance;
  try {
    instance = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${relative}: invalid example JSON: ${error.message}`);
    continue;
  }
  const contractId = instance.$schema;
  if (!knownIds.has(contractId)) {
    fail(`${relative}: $schema does not resolve to a local contract: ${contractId ?? "(missing)"}`);
    continue;
  }
  const validate = ajv.getSchema(`${validationBase}${contractId}`);
  if (!validate(instance)) {
    fail(`${relative}: example violates ${contractId}: ${ajv.errorsText(validate.errors)}`);
    continue;
  }
  exampleCount += 1;
}

let negativeFixtureCount = 0;
for (const file of walkInvalidFixtures(root).sort()) {
  const relative = path.relative(root, file);
  let instance;
  try {
    instance = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${relative}: invalid negative-fixture JSON: ${error.message}`);
    continue;
  }
  const contractId = instance.$schema;
  if (!knownIds.has(contractId)) {
    fail(`${relative}: negative fixture $schema does not resolve: ${contractId ?? "(missing)"}`);
    continue;
  }
  const validate = ajv.getSchema(`${validationBase}${contractId}`);
  if (validate(instance)) {
    fail(`${relative}: negative fixture was accepted by ${contractId}`);
    continue;
  }
  negativeFixtureCount += 1;
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `[contracts] ${records.length} schemas, ${exampleCount} examples and ${negativeFixtureCount} negative fixtures validated with strict JSON Schema 2020-12 rules`
);

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = process.cwd();
const documentIndex = process.argv.indexOf("--document");
if (documentIndex < 0 || !process.argv[documentIndex + 1]) {
  throw new Error("--document requires a capability intake JSON path");
}

const documentPath = path.resolve(process.argv[documentIndex + 1]);
const schemaPath = path.join(root, "governance/contracts/capability-intake-v2.schema.json");
if (!existsSync(documentPath)) throw new Error(`capability intake does not exist: ${documentPath}`);
if (!existsSync(schemaPath)) throw new Error(`canonical intake schema does not exist: ${schemaPath}`);

const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const document = JSON.parse(readFileSync(documentPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

if (!validate(document)) {
  throw new Error(`capability intake violates ${schema.$id}: ${ajv.errorsText(validate.errors)}`);
}

const invalid = structuredClone(document);
invalid.evidence.graph_query.result = "none";
if (validate(invalid)) {
  throw new Error("negative guard failed: consume/extend intake accepted without an existing graph node");
}

console.log(`[capability-intake] ${document.request_id} conforms to ${schema.$id}; negative missing-node guard rejected`);

// SBOM gate (CEP WP-11): rejects a missing, malformed or empty SBOM. Accepts CycloneDX JSON and SPDX JSON.
// Usage: node scripts/validate-sbom.mjs <sbom.json>
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export function checkSbom(text) {
  let doc;
  try { doc = JSON.parse(text); } catch { return ["SBOM is not valid JSON"]; }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return ["SBOM root must be an object"];
  if (doc.bomFormat === "CycloneDX") {
    const p = [];
    if (typeof doc.specVersion !== "string") p.push("CycloneDX: specVersion missing");
    if (!Array.isArray(doc.components) || doc.components.length === 0) p.push("CycloneDX: no components (an empty SBOM proves nothing)");
    return p;
  }
  if (typeof doc.spdxVersion === "string") {
    const p = [];
    if (!Array.isArray(doc.packages) || doc.packages.length === 0) p.push("SPDX: no packages (an empty SBOM proves nothing)");
    return p;
  }
  return ["SBOM format not recognised (expected CycloneDX or SPDX JSON)"];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error("usage: validate-sbom.mjs <sbom.json>"); process.exit(2); }
  let text;
  try { text = readFileSync(file, "utf8"); } catch { console.error(`FAIL SBOM not found: ${file}`); process.exit(1); }
  const problems = checkSbom(text);
  if (problems.length) { for (const p of problems) console.error(`FAIL ${p}`); process.exit(1); }
  console.log(`SBOM OK sha256:${createHash("sha256").update(text).digest("hex")}`);
}

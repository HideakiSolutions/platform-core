// Deprecation stubs for contracts that moved to ECP (ECP Decision 0006, section 9).
//
// A stub keeps the legacy `$id` resolvable and points at the ECP schema:
//   { "$schema", "$id": "<legacy-id>", "$ref": "<ECP $id>", "deprecated": true,
//     "x-superseded-by": "<capability>@<version>", "title", "description" }
// The external `$ref` is never resolved by validate-contracts; its content is validated by the ECP conformance vectors.
// A consumer that compiles a stub with a strict JSON Schema validator must (1) register `x-superseded-by` as an
// annotation keyword (ECP Decision 0006, section 5, lists it as an extension) and (2) make the ECP `$id` resolvable.

export const SUPERSEDED_BY = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*)+@\d+\.\d+\.\d+$/;
export const STUB_KEYS = new Set(["$schema", "$id", "$ref", "deprecated", "x-superseded-by", "title", "description"]);
// ECP schema ids: https://contracts.hideakisolutions.local/capabilities/<capability>/<file>.schema.json
export const ECP_SCHEMA_ID =
  /^https:\/\/contracts\.hideakisolutions\.local\/capabilities\/([a-z][a-z0-9]*(?:\.[a-z][a-z0-9_-]*)+)\/[A-Za-z0-9._-]+\.schema\.json$/;

/** A schema is treated as a stub candidate (and then validated strictly) when it uses any stub-only keyword. */
export function isStubCandidate(schema) {
  return Boolean(schema) && typeof schema === "object" && ("$ref" in schema || "x-superseded-by" in schema);
}

/** Returns the list of shape problems of a stub (empty when it is a valid stub). */
export function stubProblems(schema, { metaSchema, idPrefix }) {
  const problems = [];
  for (const key of Object.keys(schema)) {
    if (!STUB_KEYS.has(key)) problems.push(`stub has a keyword outside the stub shape: ${key}`);
  }
  if (schema.$schema !== metaSchema) problems.push("$schema must be JSON Schema 2020-12");
  if (typeof schema.$id !== "string" || !schema.$id.startsWith(idPrefix)) problems.push(`$id must start with ${idPrefix}`);
  const target = typeof schema.$ref === "string" ? ECP_SCHEMA_ID.exec(schema.$ref) : null;
  if (!target) {
    problems.push(
      "$ref must be an ECP schema id: https://contracts.hideakisolutions.local/capabilities/<capability>/<file>.schema.json",
    );
  }
  if (schema.deprecated !== true) problems.push("a stub must set deprecated: true");
  const supersededBy = schema["x-superseded-by"];
  if (typeof supersededBy !== "string" || !SUPERSEDED_BY.test(supersededBy)) {
    problems.push("x-superseded-by must look like <capability>@<major.minor.patch>");
  } else if (target && target[1] !== supersededBy.split("@")[0]) {
    problems.push(`x-superseded-by capability '${supersededBy.split("@")[0]}' does not match the $ref capability '${target[1]}'`);
  }
  for (const key of ["title", "description"]) {
    if (typeof schema[key] !== "string" || schema[key].trim() === "") problems.push(`${key} is required`);
  }
  return problems;
}

/** The capability named by a stub's `x-superseded-by`, or null when malformed. */
export function supersededCapability(schema) {
  const value = schema && schema["x-superseded-by"];
  return typeof value === "string" && SUPERSEDED_BY.test(value) ? value.split("@")[0] : null;
}

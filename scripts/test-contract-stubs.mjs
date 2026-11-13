import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { SUPERSEDED_BY, isStubCandidate, stubProblems } from "./lib/contract-stub.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validator = path.join(repoRoot, "scripts", "validate-contracts.mjs");
const meta = "https://json-schema.org/draft/2020-12/schema";
const options = { metaSchema: meta, idPrefix: "platform-core/" };

const goodStub = () => ({
  $schema: meta,
  $id: "platform-core/demo/legacy",
  $ref: "https://contracts.hideakisolutions.local/capabilities/demo.legacy/legacy.schema.json",
  deprecated: true,
  "x-superseded-by": "demo.legacy@0.1.0",
  title: "Legacy (deprecated)",
  description: "Deprecated: superseded by ECP demo.legacy.",
});

const liveSchema = (id, extra = {}) => ({
  $schema: meta,
  $id: id,
  title: "Live",
  description: "A live contract.",
  type: "object",
  properties: { a: { type: "string" } },
  required: ["a"],
  ...extra,
});

const temps = [];
after(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** Builds a throwaway repository with one module and runs the real validator in it. */
function validate(files) {
  const dir = mkdtempSync(path.join(tmpdir(), "contract-stubs-"));
  temps.push(dir);
  mkdirSync(path.join(dir, "demo", "docs"), { recursive: true });
  writeFileSync(path.join(dir, "demo", "docs", "README.md"), "# demo\n");
  for (const [relative, value] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true });
    writeFileSync(path.join(dir, relative), JSON.stringify(value, null, 2));
  }
  return spawnSync(process.execPath, [validator], { cwd: dir, encoding: "utf8" });
}

const stubAt = (stub) => ({ "demo/contracts/legacy.schema.json": stub });

describe("stub shape rules", () => {
  it("accepts a valid stub", () => {
    assert.deepEqual(stubProblems(goodStub(), options), []);
    assert.equal(isStubCandidate(goodStub()), true);
  });

  it("does not treat an ordinary schema as a stub", () => {
    assert.equal(isStubCandidate(liveSchema("platform-core/demo/live")), false);
  });

  it("rejects a keyword outside the stub shape", () => {
    assert.match(stubProblems({ ...goodStub(), type: "object" }, options).join(), /outside the stub shape: type/);
  });

  it("rejects a stub that is not deprecated", () => {
    const { deprecated, ...rest } = goodStub();
    assert.match(stubProblems(rest, options).join(), /deprecated: true/);
    assert.match(stubProblems({ ...goodStub(), deprecated: false }, options).join(), /deprecated: true/);
  });

  it("rejects a malformed x-superseded-by", () => {
    for (const bad of ["demo.legacy", "demo.legacy@1.0", "Demo.Legacy@1.0.0", "demo@1.0.0", "demo.legacy@v1.0.0", 7]) {
      assert.match(stubProblems({ ...goodStub(), "x-superseded-by": bad }, options).join(), /x-superseded-by/, String(bad));
    }
    assert.equal(SUPERSEDED_BY.test("security.authn@0.1.0"), true);
  });

  it("rejects a $ref that is not an ECP schema id", () => {
    const bad = [
      "platform-core/other",
      "platform-core/demo/legacy", // self reference
      "http://contracts.hideakisolutions.local/capabilities/demo.legacy/legacy.schema.json",
      "https://evil.example/capabilities/demo.legacy/legacy.schema.json", // wrong host
      "https://contracts.hideakisolutions.local.evil.example/capabilities/demo.legacy/legacy.schema.json",
      "https://contracts.hideakisolutions.local/capabilities/demo.legacy/legacy.schema.json#/defs/x",
      "https://contracts.hideakisolutions.local/capabilities/demo.legacy/legacy.json",
      "https://contracts.hideakisolutions.local/other/demo.legacy/legacy.schema.json",
      "#/defs/x",
      5,
    ];
    for (const value of bad) {
      assert.match(stubProblems({ ...goodStub(), $ref: value }, options).join(), /\$ref must be an ECP schema id/, String(value));
    }
  });

  it("rejects a $ref equal to the stub's own $id", () => {
    const stub = goodStub();
    assert.match(stubProblems({ ...stub, $ref: stub.$id }, options).join(), /\$ref must be an ECP schema id/);
  });

  it("rejects a capability mismatch between $ref and x-superseded-by", () => {
    assert.match(stubProblems({ ...goodStub(), "x-superseded-by": "other.cap@0.1.0" }, options).join(), /does not match the \$ref capability/);
  });

  it("requires title, description, $schema and a legacy $id", () => {
    const problems = stubProblems({ ...goodStub(), title: "", description: 5, $schema: "x", $id: "elsewhere/x" }, options).join();
    for (const fragment of ["title is required", "description is required", "2020-12", "$id must start with"]) assert.match(problems, new RegExp(fragment.replace("$", "\\$")));
  });
});

describe("validate-contracts with stubs", () => {
  it("passes a valid stub and reports it", () => {
    const result = validate(stubAt(goodStub()));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 deprecation stubs/);
  });

  it("fails a stub with an extra keyword", () => {
    const result = validate(stubAt({ ...goodStub(), type: "object" }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /outside the stub shape: type/);
  });

  it("fails a stub without deprecated", () => {
    const { deprecated, ...rest } = goodStub();
    const result = validate(stubAt(rest));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /deprecated: true/);
  });

  it("fails a stub with a malformed x-superseded-by", () => {
    const result = validate(stubAt({ ...goodStub(), "x-superseded-by": "demo.legacy@latest" }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /x-superseded-by/);
  });

  it("does not resolve the external $ref", () => {
    // The ECP id is unknown to this repository; a stub must still pass.
    assert.equal(validate(stubAt(goodStub())).status, 0);
  });

  it("rejects a live schema that references a stub id", () => {
    const result = validate({
      ...stubAt(goodStub()),
      "demo/contracts/live.schema.json": liveSchema("platform-core/demo/live", { properties: { x: { $ref: "platform-core/demo/legacy" } } }),
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /deprecated stub platform-core\/demo\/legacy/);
  });

  it("fails an example or negative fixture that targets a stub", () => {
    const example = validate({
      ...stubAt(goodStub()),
      "demo/examples/legacy.example.json": { $schema: "platform-core/demo/legacy", anything: true },
    });
    assert.notEqual(example.status, 0);
    assert.match(example.stderr, /demo\/examples\/legacy\.example\.json: targets the deprecated stub platform-core\/demo\/legacy; move this to the ECP conformance vectors of demo\.legacy/);

    const fixture = validate({
      ...stubAt(goodStub()),
      "demo/fixtures/legacy.invalid.json": { $schema: "platform-core/demo/legacy" },
    });
    assert.notEqual(fixture.status, 0);
    assert.match(fixture.stderr, /demo\/fixtures\/legacy\.invalid\.json: targets the deprecated stub .*conformance vectors of demo\.legacy/);
  });

  it("rejects a stub whose $ref host is not the ECP host", () => {
    const result = validate(stubAt({ ...goodStub(), $ref: "https://evil.example/capabilities/demo.legacy/legacy.schema.json" }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /\$ref must be an ECP schema id/);
  });

  it("still fully validates non-stub schemas, examples and fixtures", () => {
    const live = liveSchema("platform-core/demo/live");
    const ok = validate({
      "demo/contracts/live.schema.json": live,
      "demo/examples/live.example.json": { $schema: "platform-core/demo/live", a: "x" },
      "demo/fixtures/live.invalid.json": { $schema: "platform-core/demo/live" },
    });
    assert.equal(ok.status, 0, ok.stderr);

    const badExample = validate({
      "demo/contracts/live.schema.json": live,
      "demo/examples/live.example.json": { $schema: "platform-core/demo/live", a: 5 },
    });
    assert.notEqual(badExample.status, 0);
    assert.match(badExample.stderr, /example violates/);

    const missingTitle = validate({ "demo/contracts/live.schema.json": { ...live, title: "" } });
    assert.notEqual(missingTitle.status, 0);
    assert.match(missingTitle.stderr, /title is required/);

    const acceptedFixture = validate({
      "demo/contracts/live.schema.json": live,
      "demo/fixtures/live.invalid.json": { $schema: "platform-core/demo/live", a: "fine" },
    });
    assert.notEqual(acceptedFixture.status, 0);
    assert.match(acceptedFixture.stderr, /negative fixture was accepted/);
  });
});

describe("shipped pilot stubs", () => {
  const shipped = [
    ["messaging/contracts/event-envelope.schema.json", "platform-core/messaging/event-envelope", "messaging.event-envelope@0.1.0", "/capabilities/messaging.event-envelope/event-envelope.schema.json"],
    ["auth/contracts/auth-provider.schema.json", "platform-core/auth/auth-provider", "security.authn@0.1.0", "/capabilities/security.authn/auth-provider.schema.json"],
    ...["provider-connection", "inference-request", "inference-response", "provider-error"].map((name) => [
      `ai/contracts/${name}.schema.json`, `platform-core/ai/${name}`, "ai.provider-access@0.1.0",
      `/capabilities/ai.provider-access/${name}.schema.json`,
    ]),
  ];

  for (const [file, legacyId, supersededBy, refTail] of shipped) {
    it(`${file} is a valid stub for ${supersededBy}`, () => {
      const schema = JSON.parse(readFileSync(path.join(repoRoot, file), "utf8"));
      assert.equal(schema.$id, legacyId);
      assert.equal(schema["x-superseded-by"], supersededBy);
      assert.ok(schema.$ref.endsWith(refTail), schema.$ref);
      assert.deepEqual(stubProblems(schema, options), []);
    });
  }

  it("the repository validates with the stubs in place", () => {
    const result = spawnSync(process.execPath, [validator], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`${shipped.length} deprecation stubs`));
  });
});

describe("strict consumers compile the shipped stubs", () => {
  const schemaBase = "https://schemas.hideakisolutions.local/";
  const read = (relative) => JSON.parse(readFileSync(path.join(repoRoot, relative), "utf8"));
  const cases = [
    {
      stub: "messaging/contracts/event-envelope.schema.json",
      target: "scripts/fixtures/ecp-minimal/event-envelope.schema.json",
      valid: { event_id: "0b8f2a54-3c1d-4e0a-9d77-5a1c2f6e8b10", event_type: "a.b.c", data: {} },
      invalid: { event_type: "a.b.c", data: {} },
    },
    {
      stub: "auth/contracts/auth-provider.schema.json",
      target: "scripts/fixtures/ecp-minimal/auth-provider.schema.json",
      valid: { authenticate: { output: { access_token: "abc", token_type: "Bearer", expires_in: 3600 } } },
      invalid: { authenticate: { output: { access_token: "abc", token_type: "Bearer", expires_in: "3600" } } },
    },
  ];

  /** Same normalization validate-contracts uses: legacy ids are relative, so they get an absolute base. */
  const compile = ({ stub, target }, { registerKeyword, registerTarget }) => {
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    addFormats(ajv);
    if (registerKeyword) ajv.addKeyword({ keyword: "x-superseded-by", schemaType: "string" });
    if (registerTarget) ajv.addSchema(read(target));
    const schema = read(stub);
    schema.$id = `${schemaBase}${schema.$id}`;
    return ajv.compile(schema);
  };

  for (const entry of cases) {
    it(`${entry.stub} compiles as an annotation keyword and delegates through its $ref`, () => {
      const validate = compile(entry, { registerKeyword: true, registerTarget: true });
      assert.equal(validate(entry.valid), true, JSON.stringify(validate.errors));
      assert.equal(validate(entry.invalid), false);
    });

    it(`${entry.stub} needs x-superseded-by registered under strict Ajv`, () => {
      assert.throws(() => compile(entry, { registerKeyword: false, registerTarget: true }), /unknown keyword.*x-superseded-by/);
    });

    it(`${entry.stub} needs the ECP $id to be resolvable`, () => {
      assert.throws(() => compile(entry, { registerKeyword: true, registerTarget: false }), /can't resolve reference/);
    });
  }
});

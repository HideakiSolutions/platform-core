import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const fragmentPath = path.join(root, ".platform/capability-graph.fragment.json");
const nodeTypes = new Set([
  "Capability",
  "Contract",
  "Package",
  "ArtifactVersion",
  "Repository",
  "Project",
  "Module",
  "Consumer",
  "Adapter",
  "Provider",
  "PartnerApi",
  "ErrorCatalog",
  "Adr",
  "Owner",
  "Evidence",
  "TestSuite",
  "Exception"
]);
const edgeTypes = new Set([
  "DEFINED_BY",
  "OWNED_BY",
  "IMPLEMENTED_BY",
  "CONSUMED_BY",
  "EXTENDED_BY",
  "VALIDATED_BY",
  "PUBLISHED_AS",
  "GOVERNED_BY",
  "DEPENDS_ON",
  "SUPERSEDES",
  "EXCEPTED_BY"
]);
const ownershipRequired = new Set([
  "Capability",
  "Contract",
  "Package",
  "ArtifactVersion",
  "Repository",
  "Project",
  "Module",
  "Adapter",
  "Provider",
  "PartnerApi",
  "ErrorCatalog",
  "Adr",
  "TestSuite"
]);

function fail(message) {
  throw new Error(message);
}

function insideRoot(relative) {
  if (typeof relative !== "string" || !relative || path.isAbsolute(relative)) return false;
  const target = path.resolve(root, relative);
  return target.startsWith(`${root}${path.sep}`);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function hasDependencyCycle(edges) {
  const adjacency = new Map();
  for (const edge of edges.filter((candidate) => candidate.type === "DEPENDS_ON")) {
    const targets = adjacency.get(edge.from) ?? [];
    targets.push(edge.to);
    adjacency.set(edge.from, targets);
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (node) => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const target of adjacency.get(node) ?? []) {
      if (visit(target)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return [...adjacency.keys()].some(visit);
}

function validate(fragment) {
  if (fragment.schema_version !== "1.0.0") fail(`unsupported schema_version: ${fragment.schema_version}`);
  if (fragment.fragment_id !== "fragment.platform-core") fail("unexpected fragment_id");
  if (fragment.repository !== "repo.platform-core") fail("unexpected repository id");
  if (!Array.isArray(fragment.nodes) || !Array.isArray(fragment.edges) || !Array.isArray(fragment.findings)) {
    fail("nodes, edges and findings must be arrays");
  }

  const nodes = new Map();
  for (const node of fragment.nodes) {
    if (!node.id || nodes.has(node.id)) fail(`duplicate or missing node id: ${node.id ?? "(missing)"}`);
    if (!nodeTypes.has(node.type)) fail(`${node.id}: unsupported node type ${node.type}`);
    if (!["proposed", "available", "deprecated", "retired"].includes(node.lifecycle)) {
      fail(`${node.id}: invalid lifecycle ${node.lifecycle}`);
    }
    if (node.path) {
      if (!insideRoot(node.path)) fail(`${node.id}: path escapes repository root`);
      if (!existsSync(path.resolve(root, node.path))) fail(`${node.id}: path does not exist: ${node.path}`);
    }
    nodes.set(node.id, node);
  }

  const edges = new Map();
  for (const edge of fragment.edges) {
    if (!edge.id || edges.has(edge.id)) fail(`duplicate or missing edge id: ${edge.id ?? "(missing)"}`);
    if (!edgeTypes.has(edge.type)) fail(`${edge.id}: unsupported edge type ${edge.type}`);
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) fail(`${edge.id}: dangling edge`);
    if (edge.repository !== fragment.repository) fail(`${edge.id}: repository mismatch`);
    for (const evidence of edge.evidence ?? []) {
      if (nodes.get(evidence)?.type !== "Evidence") fail(`${edge.id}: invalid evidence ${evidence}`);
    }
    edges.set(edge.id, edge);
  }

  for (const node of nodes.values()) {
    if (ownershipRequired.has(node.type)) {
      const owners = [...edges.values()].filter((edge) => edge.type === "OWNED_BY" && edge.from === node.id);
      if (owners.length !== 1) fail(`${node.id}: expected exactly one owner, found ${owners.length}`);
    }
  }
  if (hasDependencyCycle([...edges.values()])) fail("DEPENDS_ON cycle detected");

  for (const finding of fragment.findings) {
    if (!["CandidateEdge", "DriftFinding"].includes(finding.kind)) fail(`${finding.id}: invalid finding kind`);
    if (finding.status === "promoted" && (!finding.review_evidence || !finding.promoted_edge_id)) {
      fail(`${finding.id}: semantic promotion requires review evidence and promoted edge`);
    }
  }

  const v2 = nodes.get("contract.capability-intake.v2");
  const v2Schema = readJson(path.resolve(root, v2.path));
  if (v2Schema.$id !== "platform-core/governance/capability-intake/v2" || v2Schema.properties?.schema_version?.const !== 2) {
    fail("capability intake v2 node does not resolve to the v2 contract");
  }
  return { nodes: nodes.size, edges: edges.size, findings: fragment.findings.length };
}

function expectFailure(label, mutate, pattern) {
  const candidate = structuredClone(readJson(fragmentPath));
  mutate(candidate);
  try {
    validate(candidate);
    fail(`${label}: invalid fixture was accepted`);
  } catch (error) {
    if (!pattern.test(error.message)) throw error;
  }
}

try {
  const summary = validate(readJson(fragmentPath));
  if (process.argv.includes("--self-test")) {
    expectFailure("dangling edge", (graph) => {
      graph.edges[0].to = "owner.missing";
    }, /dangling edge/);
    expectFailure("ambiguous owner", (graph) => {
      graph.nodes.push({ id: "owner.secondary", type: "Owner", name: "Secondary", lifecycle: "available" });
      graph.edges.push({
        id: "edge.repo.platform-core.owned-by.secondary",
        type: "OWNED_BY",
        from: "repo.platform-core",
        to: "owner.secondary",
        repository: "repo.platform-core"
      });
    }, /exactly one owner/);
    expectFailure("semantic auto-promotion", (graph) => {
      graph.findings.push({
        id: "finding.semantic.autopromotion",
        kind: "CandidateEdge",
        status: "promoted",
        sources: ["capability.governance.capability-intake"],
        reason: "negative fixture",
        provenance: "test"
      });
    }, /semantic promotion requires review evidence/);
    console.log("[capability-graph] 3 negative fixtures rejected");
  }
  console.log(`[capability-graph] fragment valid: ${summary.nodes} nodes, ${summary.edges} edges, ${summary.findings} findings`);
} catch (error) {
  console.error(`[capability-graph] invalid: ${error.message}`);
  process.exit(1);
}

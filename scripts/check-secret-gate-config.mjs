// Secret-gate integrity (CEP WP-11). A pull request must not be able to switch the secret gate off.
// gitleaks honours a repository `.gitleaksignore`, a repository config and inline `gitleaks:allow`; the CI job neutralises
// the first and last with flags (`--ignore-gitleaks-allow`, `--gitleaks-ignore-path <empty>`) and passes `--config`
// explicitly. This script fails closed on what remains: such files existing at all, and the policy config growing an
// allowlist or losing the default ruleset or the canary rule.
// Usage: node check-secret-gate-config.mjs --root <repo> --config <policy gitleaks.toml>

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const POLICY_CONFIG_REL = "tools/supply-chain/gitleaks.toml";
const SUSPECT = /^(?:\.gitleaksignore|\.?gitleaks(?:\.baseline)?\.(?:toml|json)|\.gitleaks\.toml)$/;

export function findRepoOverrides(root) {
  const found = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (SUSPECT.test(e.name)) {
        const rel = path.relative(root, abs).split(path.sep).join("/");
        if (rel !== POLICY_CONFIG_REL) found.push(rel);
      }
    }
  };
  walk(root);
  return found;
}

export function checkPolicyConfig(text) {
  const p = [];
  const code = text.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join("\n");
  if (/allowlist/i.test(code)) p.push("policy config contains an allowlist");
  if (/stopwords|disabledRules|\bpaths\s*=/i.test(code)) p.push("policy config contains stopwords, disabledRules or path filters");
  if (!/useDefault\s*=\s*true/.test(code)) p.push("policy config does not extend the default ruleset");
  if (!/id\s*=\s*"cep-synthetic-canary"/.test(code)) p.push("policy config lost the canary rule");
  return p;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const get = (f) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : undefined; };
  const root = path.resolve(get("--root") ?? ".");
  const config = get("--config");
  if (!config) { console.error("usage: --root <repo> --config <gitleaks.toml>"); process.exit(2); }
  const problems = [...findRepoOverrides(root).map((f) => `${f}: repository-level gitleaks ignore/config file is not allowed`), ...checkPolicyConfig(readFileSync(config, "utf8"))];
  if (problems.length) { for (const m of problems) console.error(`FAIL ${m}`); process.exit(1); }
  console.log("secret gate config OK");
}

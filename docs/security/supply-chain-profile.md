# Supply chain and security profile (CEP WP-11)

Status: proposal for owner review. Scope: reusable CI policy and templates in `platform-core`. It changes nothing in
production, publishes nothing and holds no credential.

**Adoption.** Nothing here is enforced on any other repository until that repository calls
`.github/workflows/supply-chain-baseline.yml`. Only `platform-core` calls it today (through
`.github/workflows/supply-chain.yml`). Branch protection that would make the checks required is an organisation setting and
is not changed by this work: NOT_VERIFIED whether the checks are required to merge.

Placement: `security/` in this repository is a contract module, so the policy lives in `docs/security/`,
`.github/workflows/`, `tools/supply-chain/` and `scripts/`, not in `security/policies/**` as the execution plan names it.

## Profile per class

| Class | Status | Control | How a defect is blocked |
|---|---|---|---|
| Secret detection | Implemented | gitleaks 8.30.1, sha256-verified download, default rules plus a synthetic canary rule (`tools/supply-chain/gitleaks.toml`); scans git history; findings redacted | job fails on any finding |
| Dependency audit (SCA), npm | Implemented | `npm audit --package-lock-only` from the lockfile; no install, no lifecycle scripts; a missing lockfile fails | job fails at or above `audit-level` |
| Dependency audit, dotnet and python | NOT_IMPLEMENTED | would need restore or an extra tool; not faked | the workflow fails when such an ecosystem is requested, it does not skip |
| SBOM | Implemented | `anchore/sbom-action` (CycloneDX JSON), then `scripts/validate-sbom.mjs` rejects a missing, malformed or empty SBOM; sha256 in the job summary; artifact kept 30 days | job fails |
| Workflow policy | Implemented | `scripts/validate-workflow-policy.mjs` (below) | job fails |
| Image scanning | NOT_IMPLEMENTED | needs a built image and a scanner database; no image is built in this repository. Profile requirement for repositories that ship images | none |
| Build provenance / attestation | NOT_IMPLEMENTED | needs `id-token: write` and `attestations: write`, a registry or release target and signing identity. Profile requirement for publishing repositories | none |

### Workflow policy rules

Workflows are parsed with the `yaml` package (YAML 1.2, merge keys on, duplicate keys rejected, anchors resolved), so flow
style, quoted keys and anchors do not hide a violation. This adds one pinned dev dependency, `yaml` 2.9.1 (exact, lockfile
updated, `npm audit` clean). Rules, enforced on the parsed tree:

- `unpinned-action`: every `uses`, in a step or a reusable-workflow job, must be a full 40-hex SHA with a `# version`
  comment on the same line (`@main`, `@v4`, short SHA, or SHA without comment fail; a SHA in flow style fails because it
  cannot carry the comment).
- `permissions-missing`, `permissions-write-all`: top-level `permissions` required; top-level `write-all` or any write scope fails.
- `job-permissions-write`: a job-level `write-all` or write scope fails unless a baseline entry gives a written reason.
- `prt-head-checkout`: under `pull_request_target`, a checkout whose `ref` or `repository` names the PR head, or comes from
  an indirect expression (`env`, `vars`, `inputs`, `needs`, `steps`, `matrix`), fails; so does any `run` that uses
  `git checkout/fetch/switch/pull/clone/worktree`, `gh pr checkout/diff` or `refs/pull/`.
- `secret-in-run`: `${{ secrets.* }}` written inside a `run` script fails.
- `secret-echo`: an env entry mapped from `secrets.*` (workflow, job or step level) or a credential-named variable that a
  printing or sending command (`echo`, `printf`, `cat`, `tee`, `curl`, `wget`, `nc`, `Write-Host`, ...) references, including
  heredoc bodies, or an environment dump (`env`, `printenv`, `set -x`) while a secret is mapped.
- `yaml-invalid`: anything that does not parse fails closed.

**Not detected** (the shell text in `run` is not parsed, so these rules are heuristics, not proof):
a secret reaching a printing command through a variable copy (`X=$V; echo $X`), command substitution or `eval`, a value
written to a file and printed later, a script file called from `run` (its contents are not read), `actions/github-script`
and other action inputs that print their arguments, secrets forwarded with `with:` to an action that logs them, line
continuations that split a command, and encoded or split output. Likewise for `pull_request_target`: a head checkout
performed inside a script file, a composite or third-party action, or a value computed at run time is not seen, and the
indirect-expression rule only flags the expression, it does not follow it. Script injection through `${{ github.event.* }}`
in `run` is not covered. Also not detected: `node -e`, `python -c` and similar interpreters printing the environment; a `workflow_run`
trigger that checks out the triggering head; a checkout done without `actions/checkout`; the contents of local actions
(`./.github/actions/*`), which are exempt from pinning and are not scanned; and a second `uses` of a target whose version
comment sits on another line (the comment is matched by target string, not by occurrence). Review remains necessary.

### Existing violations and the ratchet

Introduced with a visible baseline, `.github/workflow-policy.baseline.json`: 7 entries (8 occurrences, counted exactly) in
`capability-drift.yml` and `validate.yml`, each with a reason. Both lack top-level `permissions`, and both pin actions by
`@v4`. They are reported, not rewritten. `capability-drift.yml` is a published interface (callers use it through `@main`)
and is not edited here. The baseline may only shrink: a new violation fails, a stale entry fails (remove it), and in pull
requests the `ratchet` job fails if the baseline holds an entry absent from the base branch or with a larger count.
Occurrences are counted exactly (`count` per entry) and duplicate entries fail.

### Declared limit: a pull request controls its own gate

In this repository `supply-chain.yml` passes `checker-ref: ${{ github.sha }}`, so the tooling is taken from the pull
request's own commit. A pull request can therefore edit the caller, the reusable workflow, `tools/supply-chain/`, the
scripts and the baseline file. The ratchet only compares the baseline against the base branch; it does not protect the
checker, the workflows or the tooling. The hardening below stops a pull request from switching off the secret gate by
the usual repository-level means, not from rewriting the gate itself. This is a fundamental limit until (a) the checks
are required by branch protection, with the workflow files reviewed by an owner, and (b) consumers pin the reusable workflow
and `checker-ref` to a trusted SHA that the pull request cannot change. Required-check configuration is an organisation
setting and has not been changed by this work.

### Secret gate: repository-level bypasses are closed

gitleaks honours a repository `.gitleaksignore`, a repository config and inline `gitleaks:allow`. The job therefore:
passes `--config` explicitly (the policy file from the pinned tooling ref), `--ignore-gitleaks-allow` and
`--gitleaks-ignore-path` to an empty directory; scans a bare mirror clone, because with gitleaks 8.30.1 a `.gitleaksignore`
inside a scanned worktree is honoured even when `--gitleaks-ignore-path` points elsewhere (observed, not documented); and
fails before scanning if a `.gitleaksignore`, `.gitleaks.toml` or other gitleaks config file exists in the tree (other than
the policy's own path), or if the policy file contains an allowlist, stopwords, path filters, loses `useDefault`, or loses
the canary rule. Each bypass has a test with the real tool, including a control proving the unhardened scan is bypassable.
Residual: the policy file itself is trusted because it comes from `checker-ref`; a consumer that points `checker-ref` at a
weakened commit weakens its own gate.

## Least privilege

- Top-level `permissions: contents: read` and the same per job. No job in the baseline needs more: nothing publishes,
  comments, signs or attests. `actions/upload-artifact` needs no token scope.
- Tooling is fetched from `platform-core` at `checker-ref`, which must be a full commit SHA (a branch or tag is rejected).
  This is stricter than `capability-drift.yml`, which reads its analyzer from `main`. Gate code does not move under the caller.
- Checkouts use `persist-credentials: false`; the tooling checkout is moved out of the scanned tree.
- No secret, no `GITHUB_TOKEN` write scope, no OIDC. The caller passes none.

Pinned third-party actions (each SHA resolved from the real tag by the GitHub API on 2026-11-06):

| Action | Tag | Commit |
|---|---|---|
| actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| actions/upload-artifact | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |
| anchore/sbom-action | v0.24.3 | `66cbf4bc1f1c0d2edc94016e65bc221b6bb0ad6c` |

**Declared limit:** `anchore/sbom-action` downloads the syft binary itself at run time. That download and its integrity
check are performed by the action, outside this delivery's verification (unlike gitleaks, whose archive hash is pinned
here). The SBOM job is therefore trusted at the action's own level, and its output is only checked for shape and
non-emptiness, not for completeness.

gitleaks is not an action: `install-gitleaks.sh` pins version 8.30.1 and the sha256 of the release archive
(`551f6fc8...470eb`), checked against the project's published checksum file.

## Digest evidence sources (proposal, closes ADR-CEP-002 item 4)

ADR-CEP-002 is accepted and is not edited here. The owner may accept this as the answer to item 4. An `artifact-digest`
in the release ledger should be backed by one of, in order of strength:

1. **Signed attestation / provenance** bound to the digest (for example a SLSA provenance statement from the publishing
   job). Preferred. Requires the NOT_IMPLEMENTED provenance class.
2. **Registry API**: the digest read from the registry for the immutable version (GitHub Packages for npm and NuGet, per
   item 1). Acceptable; the evidence is the API response recorded with its retrieval time.
3. **CI run record**: the digest printed by the publishing job and linked by run URL. Weakest; it proves what the job
   reported, not what the registry serves.

A digest taken from a mutable tag, or typed by hand without one of these, is not evidence. The ledger validator still only
checks that evidence is well formed; it makes no network call.

## Cross-tenant requirement (requirement only; no test is claimed)

Any adapter or implementation that reads or writes tenant data must ship negative tests proving that a principal from
tenant A cannot read, list, modify or infer tenant B data, including through caches, queues and error messages, and that the
failure is audited (NFR-05). No such test exists in this repository and none is claimed by this change. The reusable
baseline cannot check it: it belongs to the adapter's own test suite. NOT_VERIFIED for every current capability.

## OIDC and PKCE (where applicable)

Applies to applications that authenticate users, not to this baseline. Requirements: authorization-code flow with PKCE
(S256) for public clients, exact redirect URI matching, `iss`/`aud`/`exp` validation, and keys resolved from a configured
key set rather than derived at start-up from a public hostname. Whether any current consumer meets this: NOT_VERIFIED.

## Synthetic defects (AC-11)

`scripts/test-supply-chain-gates.test.mjs` and `scripts/test-workflow-policy.test.mjs` hold one rejected defect per
implemented class, each with a positive control:

| Class | Synthetic defect | Source |
|---|---|---|
| Secret detection | canary string assembled from fragments at run time, committed to a throwaway repo | gate test |
| Dependency audit | lockfile pinning an old `lodash` with public advisories | gate test (needs the advisory service) |
| SBOM | empty SBOM, invalid JSON, unknown format | gate test |
| Workflow policy | each rule in a separate negative case | policy test |

No credential is stored. The canary has no provider shape, is never written to the repository as a whole, and matches only
the custom rule. Without gitleaks or network the affected cases report as skipped with the reason; in the CI `gate-selftest`
job `REQUIRE_GATE_TOOLS=1` turns that into a failure. Reusable workflows do not run by themselves, so
`.github/workflows/supply-chain.yml` calls the baseline on every pull request.

## Not verified

- Remote CI runs of `supply-chain.yml` and `supply-chain-baseline.yml`, including `anchore/sbom-action` and the SBOM
  artifact (the action cannot run locally).
- Whether the checks are required for merge (organisation or branch protection setting).
- Behaviour of the baseline on runners other than GitHub-hosted `ubuntu-latest`.
- Image scanning, provenance, dotnet and python audit: not implemented.

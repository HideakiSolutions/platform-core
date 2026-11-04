# Capability Drift Ratchet

`analyze.mjs` calculates the committed capability-reuse scorecard and compares it with the caller baseline. A metric may fall, but a higher value fails the job. The report is written to `capability-drift.json` for publication by the reusable workflow.

Supported metrics: app/package homonyms, repeated exported signatures, `style={{`, literal JSX enum props, .NET Service/BuildingBlocks helper signatures, and normalized three-line clone windows (the repository-local `jscpd`-equivalent threshold).

Run locally:

```bash
node tools/capability-drift/analyze.mjs --paths apps,packages --baseline governance/capability-drift.baseline.json --stack node
```

## Behavior change: a missing baseline fails

A missing baseline file now exits with code 2 and an explicit error. Previously it was treated as an empty baseline, so no regression could be found and the check passed without checking anything.

The reusable workflow `.github/workflows/capability-drift.yml` downloads the analyzer from `ref: main`. After this change reaches `main`, every calling repository without a committed baseline starts failing until it commits `governance/capability-drift.baseline.json` (or the path passed in `inputs.baseline`).

Known callers (GitHub code search in HideakiSolutions and cambioreal on 2026-11-04): `cambioreal/cambio-real-v3` and `cambioreal/cambio-real-platforms`, both `uses: HideakiSolutions/platform-core/.github/workflows/capability-drift.yml@main` with `baseline: governance/capability-drift.baseline.json`. Both have that file committed on `main` (668 and 1492 bytes), so exit 2 does not affect them; the behavior changes only for callers without a baseline. Verify with `gh api repos/cambioreal/<repo>/contents/governance/capability-drift.baseline.json`. Other callers are not ruled out.

The entry point also runs when the analyzer is invoked through a symlink or from a path with spaces or URL-encoded characters; before, `main()` was silently skipped with exit 0.

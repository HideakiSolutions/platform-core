# Capability Drift Ratchet

`analyze.mjs` calculates the committed capability-reuse scorecard and compares it with the caller baseline. A metric may fall, but a higher value fails the job. The report is written to `capability-drift.json` for publication by the reusable workflow.

Supported metrics: app/package homonyms, repeated exported signatures, `style={{`, literal JSX enum props, .NET Service/BuildingBlocks helper signatures, and normalized three-line clone windows (the repository-local `jscpd`-equivalent threshold).

Run locally:

```bash
node tools/capability-drift/analyze.mjs --paths apps,packages --baseline governance/capability-drift.baseline.json --stack node
```

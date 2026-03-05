# ADR-008: Documentation Language

## Status

Accepted

## Context

The SRM Banking team includes members with varying English proficiency. At the same time, technical documentation benefits from being in English for alignment with industry standards, open-source conventions, and tooling ecosystems. A clear policy is needed to avoid inconsistent language choices across repositories.

## Decision

Mixed language approach. README.md files are written in Portuguese (pt-BR) for accessibility to the full team. Technical documentation — architecture docs, contracts, ADRs, inline code comments — is written in English for industry alignment and searchability. UI labels and user-facing text are in Portuguese (pt-BR). Commit messages are in English.

## Consequences

- README files in Portuguese lower the barrier for all team members to understand a repo's purpose and setup
- Technical docs in English align with industry norms and make it easier to reference external resources
- Contributors must be aware of which language to use in which context
- Code reviews should enforce the language convention to prevent drift
- Translations are not maintained — each document exists in one language only

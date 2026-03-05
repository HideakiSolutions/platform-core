# Contributing to Platform Core

## Rules

1. All contracts are **language-agnostic** — no framework-specific assumptions
2. Every new module must include: `contracts/` with JSON Schema, `docs/` with README.md
3. Contract changes require backward compatibility analysis
4. Follow naming convention: `{module-name}.schema.json` for contracts
5. All documentation in English (READMEs in Portuguese)

## Adding a New Module

1. Create directory: `{module-name}/contracts/` and `{module-name}/docs/`
2. Write the JSON Schema contract
3. Write the docs README explaining purpose, usage, and stack recommendations
4. Update ARCHITECTURE.md module table
5. If the change is architectural, create an ADR in `docs/adr/`

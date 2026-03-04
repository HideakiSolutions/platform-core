# Contributing to platform-core

## General Rules

1. All changes must go through pull requests
2. PRs require at least one review from a core maintainer
3. Follow the GitFlow branching model
4. Write clear commit messages following Conventional Commits

## Branching Model

```
main       → production-ready, protected
develop    → integration branch
feature/*  → new features (from develop)
release/*  → release preparation (from develop)
hotfix/*   → urgent fixes (from main)
```

## Commit Convention

```
<type>(<scope>): <description>

Types: feat, fix, docs, chore, refactor, test, ci
Scope: module name (auth, logging, messaging, etc.)
```

Examples:
```
feat(auth): add JWT validation contract
docs(logging): update structured logging guidelines
fix(messaging): correct async event schema
```

## Adding a New Module

1. Create the module directory with `contracts/` and `docs/` subdirectories
2. Define contracts using JSON Schema or specification markdown
3. Write module documentation in `docs/`
4. Update ARCHITECTURE.md with the new module
5. Add an ADR if the module introduces architectural decisions

## Code Review Checklist

- [ ] Contracts are language-agnostic
- [ ] Documentation is clear and complete
- [ ] No product-specific logic introduced
- [ ] Follows existing module structure
- [ ] ADR created for significant decisions

## Quality Standards

- All contracts must have corresponding documentation
- Specifications must include examples
- Breaking changes must be documented in CHANGELOG.md

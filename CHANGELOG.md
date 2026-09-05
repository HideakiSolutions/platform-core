# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `auth/contracts/token-verifier.schema.json` — canonical bearer-token verification contract (middleware config + normalized Principal), mirroring the shape every backend-core stack projection already implements (Intent 0001)
- `auth-provider.schema.json`: optional PKCE (`code_verifier`), step-up request (`acr_values`), `revoke` operation, and normalized `principal` in `validate_token.output` (Intent 0001)
- Documented bridge between `auth/` and `authorization/` (roles in, `step_up_auth` obligations out) in both modules' READMEs (Intent 0001)
- Initial repository scaffold
- Module structure: auth, configuration, logging, messaging, observability, security, feature-flags, utils
- Architecture documentation
- Contributing guidelines
- Contract format specifications

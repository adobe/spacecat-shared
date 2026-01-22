<!--
Sync Impact Report:
Version: 1.0.0 (Initial constitution)
Modified Principles: N/A (new document)
Added Sections:
  - Core Principles (6 principles)
  - Development Standards
  - Quality Requirements
  - Governance
Removed Sections: N/A
Templates Requiring Updates:
  ✅ plan-template.md - Constitution Check section aligns with principles
  ✅ spec-template.md - Requirements align with package independence
  ✅ tasks-template.md - Task organization supports principle-driven development
  ✅ agent-file-template.md - No updates required
  ✅ checklist-template.md - No updates required
Follow-up TODOs: None
-->

# SpaceCat Shared Modules Constitution

## Core Principles

### I. Package Independence

Each package in the monorepo MUST be independently publishable, versionable, and usable.

- Packages MUST NOT depend on unpublished workspace siblings (use published npm versions)
- Each package MUST have its own README, package.json, tests, and documentation
- Packages MUST be self-contained with clear, single-purpose functionality
- No "organizational-only" packages—each MUST solve a concrete technical problem

**Rationale**: Consumers import individual packages, not the monorepo. Independence ensures packages can evolve at different rates and be consumed à la carte.

### II. API Stability & Contracts

Public APIs are contracts that downstream services depend on. Breaking changes require explicit versioning.

- Public API changes MUST follow semantic versioning strictly
- Breaking changes MUST increment MAJOR version
- New features MUST increment MINOR version
- Bug fixes and patches MUST increment PATCH version
- API contracts (function signatures, exports, types) MUST be documented
- Deprecations MUST include migration guides and sunset timelines

**Rationale**: SpaceCat services depend on these shared modules. Unexpected breaking changes cascade failures across the entire ecosystem.

### III. Test-First Development (NON-NEGOTIABLE)

All code changes MUST be covered by tests written before implementation.

- Unit tests MUST cover core logic and edge cases
- Integration tests MUST verify cross-boundary interactions (DB, APIs, external services)
- Contract tests MUST validate public API behavior
- Tests MUST fail before implementation begins
- All tests MUST pass before merge
- Code coverage MUST NOT decrease with new changes

**Rationale**: Shared modules are infrastructure. Regressions here break multiple services simultaneously. Test-first ensures reliability and prevents cascading failures.

### IV. Documentation as Code

Documentation MUST be comprehensive, current, and co-located with code.

- Each package MUST have a README with: installation, usage examples, API reference
- Public functions MUST have JSDoc comments (auto-generated to docs/API.md)
- Breaking changes MUST be documented in CHANGELOG.md
- Migration guides MUST accompany major version bumps
- Integration examples MUST be provided for complex packages (e.g., data-access wrapper)

**Rationale**: Shared modules serve multiple teams. Clear documentation reduces support burden and accelerates adoption.

### V. Monorepo Consistency

All packages MUST adhere to shared tooling, standards, and conventions.

- Linting: ESLint config MUST be consistent across all packages (eslint.config.js at root)
- Testing: Mocha + c8 for coverage, consistent test structure (test/ directory)
- Node version: MUST match engines specification in root package.json (>=22.0.0 <25.0.0)
- Semantic release: All packages MUST use semantic-release for versioning
- Licensing: All packages MUST use Apache-2.0 license
- Commit format: MUST follow conventional commits for semantic-release compatibility

**Rationale**: Consistency reduces cognitive load when working across packages and ensures tooling works reliably.

### VI. Simplicity & Minimal Dependencies

Start simple. Complexity must be justified.

- Prefer standard library solutions over third-party dependencies
- New dependencies MUST be justified (security, maintenance, bundle size)
- Avoid over-engineering—implement what's needed now, not what might be needed
- Refactor when patterns emerge, not preemptively
- Keep package scope narrow—split into multiple packages rather than adding complexity

**Rationale**: Dependencies increase maintenance burden, security surface, and bundle size. Simplicity reduces long-term cost.

## Development Standards

### Technology Stack

- **Language**: JavaScript (ES modules) + TypeScript (type definitions)
- **Runtime**: Node.js >=22.0.0 <25.0.0
- **Package Manager**: npm >=10.9.0 <12.0.0
- **Testing**: Mocha (test runner), c8 (coverage), nock (HTTP mocking)
- **Linting**: ESLint with @adobe/eslint-config-helix
- **Documentation**: jsdoc-to-markdown for API docs
- **Versioning**: semantic-release with semantic-release-monorepo

### Project Structure (Monorepo)

```
packages/
├── spacecat-shared-[name]/
│   ├── src/
│   │   ├── index.js         # Main entry point
│   │   └── index.d.ts       # TypeScript definitions
│   ├── test/
│   │   ├── unit/            # Unit tests
│   │   └── integration/     # Integration tests (if applicable)
│   ├── package.json         # Package manifest
│   ├── README.md            # Package documentation
│   ├── CHANGELOG.md         # Version history
│   └── LICENSE.txt          # Apache-2.0 license
```

### Naming Conventions

- Package names: `@adobe/spacecat-shared-[purpose]` (e.g., `spacecat-shared-http-utils`)
- File names: kebab-case (e.g., `auth-handler.js`)
- Exported functions: camelCase (e.g., `getUserById`)
- Classes: PascalCase (e.g., `DataAccessLayer`)

## Quality Requirements

### Testing Gates

- All tests MUST pass (`npm test` in each package)
- No linting errors (`npm run lint` in each package)
- Code coverage MUST NOT decrease
- Integration tests MUST pass for data-access and client packages
- Contract tests MUST validate public API behavior

### Code Review Requirements

- All PRs MUST be reviewed by at least one maintainer
- PRs MUST reference a GitHub issue (e.g., `#123`)
- Breaking changes MUST be flagged and approved explicitly
- Commit messages MUST follow conventional commits format
- Use `npm run commit` wizard for structured commits

### Pre-Merge Checklist

- Tests written and passing
- Documentation updated (README, JSDoc, CHANGELOG if breaking change)
- Linting passes
- No new vulnerabilities introduced (npm audit)
- Semantic versioning impact understood (MAJOR/MINOR/PATCH)

## Governance

### Amendment Process

This constitution is a living document and may be amended when project needs evolve.

1. Proposed amendments MUST be documented in a GitHub issue
2. Changes MUST be discussed with maintainers and affected teams
3. Amendments MUST increment constitution version semantically:
   - **MAJOR**: Backward-incompatible principle removals or redefinitions
   - **MINOR**: New principles or materially expanded guidance
   - **PATCH**: Clarifications, wording improvements, typo fixes
4. All dependent templates (plan, spec, tasks) MUST be updated to reflect changes
5. Amendment commits MUST reference this constitution and include version bump

### Compliance Enforcement

- Constitution supersedes informal practices and conventions
- All PRs and code reviews MUST verify compliance with principles
- Violations MUST be justified in "Complexity Tracking" section of implementation plans
- Repeated violations indicate need for constitution amendment or tooling support

### Conflict Resolution

When principles conflict in practice:

1. Document the conflict explicitly in implementation plan
2. Identify which principle takes precedence for this specific case
3. Justify the decision with concrete technical reasoning
4. Consider whether conflict reveals need for constitution clarification

### Review Cadence

- Constitution MUST be reviewed annually (every January)
- Immediate review triggered by: major technology shifts, repeated principle violations, significant project scope changes
- Review outcomes MUST be documented in this file's Sync Impact Report

**Version**: 1.0.0 | **Ratified**: 2026-01-22 | **Last Amended**: 2026-01-22

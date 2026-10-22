# AGENTS.md

This file defines the working rules for automated agents in this repository.

For Payload API details, read the skill that ships with Payload: `node_modules/payload/skills/payload/SKILL.md`. Parts of it are not yet up to date for Payload 4 (for example, storage adapters now live in the top-level `storage` key, not in `plugins`). When it disagrees with the installed `.d.ts` types or the [Payload 4 beta docs](https://payloadcms.com/docs/beta), trust the types.

## Core Principles

- Prefer maintainable fixes over shortcuts.
- Do not use dependency overrides as a vulnerability fix.
- Keep the project on properly updated direct dependencies whenever possible.
- Treat end-to-end verification as mandatory for meaningful changes.

## Dependency Rules

- Use `pnpm` for package management, through Corepack (`corepack pnpm ...`).
- Prefer updating direct dependencies in `package.json` and refreshing the lockfile through normal `pnpm` resolution.
- Do not use `pnpm.overrides` in this repository.
- If an advisory cannot be fixed by supported direct dependency upgrades and normal lockfile resolution, leave it visible and report the upstream blocker clearly.
- Keep `payload` and every `@payloadcms/*` package pinned to the same exact version. While Payload 4 is in beta, never use ranges like `^4.0.0-beta.x`.
- Payload 4 betas can break between releases. When bumping the beta, read the release notes and the [v4 migration guide](https://payloadcms.com/docs/beta/migration-guide/v4) for changes since the current version.
- When changing dependency versions, update every affected entry in the `Version Info` section of `README.md` in the same change.
- When updating `payload`, `@payloadcms/*`, `next`, React, TypeScript, Node engine requirements, `.node-version`, package manager versions or test tooling, verify the README still matches `package.json`.
- Do not leave misleading version notes in the README. Documentation must match the actual dependency state.

## Payload 4 Rules

- Local API calls default to `overrideAccess: false` in Payload 4. Pass `overrideAccess: true` only for trusted system work (seeding, hooks, jobs). Public pages must query as anonymous visitors so access control applies.
- Collections with public `read` access must set `readVersions` explicitly, or drafts and version history become public.
- Every schema change needs a committed migration: `corepack pnpm migrate:create <name>`. `pnpm start` runs migrations on every boot, on Railway and in e2e.
- The build must not need the database. Railway builds without private networking, so do not add `generateStaticParams` or other build-time queries.
- Storage adapters go in the top-level `storage` array (`src/config/storage.ts`), not in `plugins`.
- Run `corepack pnpm generate:types` and `corepack pnpm generate:importmap` after changing collections or admin components, and commit the results.

## Branching And Release Rules

- Never push directly to `master`.
- Push agent work to `staging` only.
- A human is responsible for merging to `master`.
- If asked to publish work, prefer `staging` unless the human explicitly instructs otherwise.
- Do not rewrite `master` history.

## Testing Rules

- Run relevant tests after changes, and always `corepack pnpm typecheck`.
- For changes that affect app behavior, dependency upgrades, build tooling, auth, roles, admin flows, seeding, comments, MCP, routing or rendering, run the Playwright end-to-end suite.
- Use `corepack pnpm test:e2e` as the default verification command for those changes.
- If the task affects the visible browser flow and manual inspection is useful, use `corepack pnpm test:e2e:headed` or `corepack pnpm test:e2e:manual`.
- Do not claim success without stating what was actually run.

## E2E And App Workflow Rules

- Keep the Docker-based PostgreSQL flow working for e2e tests. The e2e database runs in its own Compose project (`payload4-e2e`) and must never touch the development database.
- Keep e2e uploads on the MinIO bucket. Production always stores media in a Railway Bucket, and the S3 adapter's file URLs carry a query string (`?prefix=media`) that local disk storage does not. Build media URLs with `getMediaUrl`, which handles both.
- Do not break the admin onboarding flow. The first user must always become an admin.
- Preserve the seeded-content workflow and the comment approval flow unless the task explicitly changes them.
- Seed behavior must stay deterministic: all seed media is bundled in `src/endpoints/seed/assets`, with no network downloads.
- Keep the security guarantees covered by the e2e suite: no public drafts or commenter emails, no self-approved comments, and a demo author that cannot log in.

## Audit And Security Rules

- When addressing audit warnings, first try proper dependency upgrades.
- Prefer upstream-supported versions over local workaround pinning.
- If warnings remain after proper upgrades, identify whether they are upstream transitives and report that clearly.
- Do not hide unresolved advisories with sloppy shortcuts.

## Documentation Rules

- Update `README.md` when setup, environment variables, test commands, version info or important workflow expectations change.
- When changing dependency versions, update all affected README version entries immediately, not only Payload.
- Keep command examples aligned with the actual recommended workflow, especially `corepack pnpm` usage and e2e commands.

## Change Safety Rules

- Avoid destructive git operations unless explicitly requested.
- Do not revert unrelated user changes.
- Keep fixes minimal, intentional, and project-specific.
- If a framework or dependency upgrade requires code changes, make the compatibility changes explicitly instead of papering over the problem.

## Preferred Verification Commands

- Install dependencies: `corepack pnpm install`
- Rebuild native dependencies if needed: `corepack pnpm deps:native`
- Typecheck: `corepack pnpm typecheck`
- Run e2e: `corepack pnpm test:e2e`
- Run headed e2e: `corepack pnpm test:e2e:headed`
- Run manual-review e2e: `corepack pnpm test:e2e:manual`
- Check audit state: `corepack pnpm audit --json`

## Final Reminder

- Keep the repo maintainable.
- Keep the README honest.
- Push to `staging`.
- Let the human merge to `master`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

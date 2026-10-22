<p align="center">
  <a href="https://railway.com?referralCode=-Yg50p">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://railway.app/brand/logo-light.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://railway.app/brand/logo-dark.svg">
      <img alt="Railway logo" src="https://railway.app/brand/logo-light.svg" width=100>
    </picture>
  </a>
</p>

<h2 align="center">
  Payload CMS 4 Website Template (beta)<br>
  One-click deploy on Railway
</h2>

<p align="center">
  A production-ready Payload CMS 4 website with PostgreSQL, built to showcase what is new in Payload 4.
</p>

> **Payload 4 is in beta.** This template tracks the Payload 4 beta releases and is pinned to an exact version. Expect breaking changes between betas until Payload 4 is stable.
> Looking for the stable line? Use the [Payload 3 boilerplate](https://github.com/rpuls/payload-3-boilerplate).

## About this boilerplate

A pre-configured, ready-to-deploy Payload CMS 4 website builder: a backend, the new Payload 4 admin panel and a production-ready Next.js website. It is optimized for deployment on [Railway](https://railway.com?referralCode=-Yg50p) and uses PostgreSQL for both local development and production.

It is the Payload 4 sibling of the [Payload 3 boilerplate](https://github.com/rpuls/payload-3-boilerplate). Payload 4 changes defaults, database schemas and the toolchain, so existing Payload 3 projects should stay on the Payload 3 template instead of being upgraded in place.

## Version Info

- **Payload CMS**: `4.0.0-beta.2` (all `@payloadcms/*` packages on the same version)
- **Next.js**: `16.4.2`
- **React**: `19.3.1`
- **Node.js**: `>=24.15.0` (`.node-version` pins Node 24 for Railway)
- **pnpm**: `10.26.0`
- **TypeScript**: `6.0.3`
- **Playwright**: `1.63.0`
- **PostgreSQL**: 17 for local development and e2e (Docker), Railway's PostgreSQL template in production

## What's included

### Payload 4 features on display

- **New admin UI**: the redesigned Payload 4 admin, styled with CSS tokens instead of SCSS
- **Modular dashboard**: a custom "Pending comments" widget next to the built-in activity and collection widgets. Editors can add, move and resize widgets themselves
- **Hierarchy**: nested categories built on Payload 4's core hierarchy feature (no nested-docs plugin)
- **Tags**: a tags collection, with a tag picker on posts and a tags tab in the admin sidebar
- **Folders and grid view**: organize media in folders and browse uploads as a grid
- **MCP for AI agents**: `/api/mcp` lets AI agents and other MCP clients read and write content as a real user through a user API key, with custom `siteOverview` and `moderateComment` tools
- **LLM instructions**: per-collection guidance that agents receive over MCP, editable in the admin
- **Scheduled publishing**: the jobs queue runs inside the server, so "Schedule publish" works on Railway without an external cron
- **Versions and authorship**: version history and `createdBy`/`updatedBy` are on by default
- **Image variants**: `@payloadcms/transformer-sharp` generates responsive image variants

### Website and content

- **Layout builder** with hero, content, media, call-to-action, archive and form blocks
- **Draft preview and live preview** for pages and posts
- **Comments** with moderation. New comments stay pending until approved, commenter emails are never public, and a honeypot blocks naive bots
- **Roles**: the first account is an admin; later accounts are editors. Only admins manage users and seed content
- **SEO, redirects, search, sitemaps** and a contact form
- **Demo content** you can seed from the dashboard, fully bundled with the template (no external downloads)

### Production setup

- **Database migrations** run automatically on every start (`payload migrate && next start`)
- **Database-free build**: the app builds without database access, which is how Railway builds work
- **S3-compatible storage** for uploads (Railway Bucket, AWS S3, Cloudflare R2, MinIO). The Railway template includes a private Railway Bucket, and files are served through Payload. Without a bucket, uploads go to local disk, which is wiped on redeploy
- **Optional SMTP email** for password resets. Without it, emails are written to the log
- **Healthcheck** at `/api/health`, used by Railway

## Railway Setup

The template deploys the website, a PostgreSQL database and a Railway Bucket for uploads. After the deploy:

1. Open `https://<your-domain>/admin` and create the first user. It becomes the admin.
2. Click **Seed your database** on the dashboard for demo content (optional).

Configuration happens in [railway.json](railway.json). `pnpm start` applies committed Payload migrations before starting Next.js. Migrations do not run during `pnpm build`, because Railway private networking is unavailable while the image builds.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. On Railway: `${{Postgres.DATABASE_URL}}` |
| `PAYLOAD_SECRET` | yes | Long random string used to sign auth tokens |
| `NEXT_PUBLIC_SERVER_URL` | yes | Public URL without trailing slash. On Railway: `https://${{RAILWAY_PUBLIC_DOMAIN}}` |
| `PORT` | on Railway | `3000`. Must match the port the public domain targets, or Railway answers every request with "Application failed to respond" |
| `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | no | S3-compatible storage for uploads. On Railway, reference the bucket: `${{storage-bucket.BUCKET}}`, `${{storage-bucket.ENDPOINT}}` and so on. Set `S3_FORCE_PATH_STYLE=true` for MinIO |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` | no | SMTP for outgoing email |
| `CRON_SECRET` | no | Lets an external cron call `/api/payload-jobs/run` |
| `DISABLE_JOBS_AUTORUN` | no | Set to `true` to stop the in-process job runner |

See [.env.example](.env.example) for a local starting point.

## Connect an AI agent (MCP)

1. In the admin, open your user account and generate an API key.
2. Point any MCP client that supports streamable HTTP at `https://<your-domain>/api/mcp`, with the header `Authorization: users API-Key <your-key>`.

Agents act with that user's permissions. They can draft posts and pages but cannot delete them, and they can moderate comments. See [src/plugins/mcp.ts](src/plugins/mcp.ts).

## Nestwell apartment rentals

The front page and `/listings` show approved apartments. `/listings/[slug]` shows approved or rented apartments, with photos, facts and a rich text description. Prices are displayed as amounts; use one consistent currency for rent and deposit across listings.

Anyone can submit the form at `/list-your-apartment`. Submissions start pending, ignore supplied status/photos/internal notes, and use a honeypot to reject simple bots. There is no public upload. Landlord names, emails, phone numbers and internal notes are visible only to staff. Editors and admins review listings in **Nestwell → Listings**, filter by status, add photos and approve or mark rented. Only admins can delete.

MCP agents can read, create and edit listings. Collection hooks reject approval, rented status and deletion for MCP and API-key requests, even if development MCP access overrides are enabled. Human staff must use their normal admin login to approve listings. Existing posts, seeding and comment moderation remain available.

Schema migrations run through the existing `corepack pnpm start` workflow. After schema changes, run `corepack pnpm generate:types`, `corepack pnpm generate:importmap` and `corepack pnpm typecheck`. The Playwright suite includes the public submission, privacy, moderation and MCP workflows.

A focused collection integration check can run against a **separate empty PostgreSQL database** whose name starts with `nestwell_test`. Set `DATABASE_URL` to that database, run `NODE_ENV=production corepack pnpm migrate`, then `NODE_ENV=production corepack pnpm payload run tests/integration/listings.ts`. The check creates test users and listings; never point it at development or production data.

## Local Setup

1. Clone or fork this repository. Or deploy on Railway first and then clone your new repository.
2. Use Node.js 24 (`.node-version`), and enable pnpm through Corepack: `corepack enable`
3. Copy `.env.example` to `.env`
4. Start PostgreSQL: `docker compose up -d postgres`
5. Install dependencies: `corepack pnpm install`
6. Run development mode: `corepack pnpm dev`, then open http://localhost:3000/admin

Uploads are stored on local disk by default. To use a bucket like production does, start MinIO with `docker compose up -d minio minio-init` and fill in the MinIO values listed in `.env.example`.

To run the production build locally: `corepack pnpm build && corepack pnpm start`

### Changing the schema

In development, Payload pushes schema changes straight to your local database. Before you deploy, create a migration so production gets the same change:

```bash
corepack pnpm migrate:create my-change
```

Commit the generated file in `src/migrations`. It runs automatically on the next start.

## End-to-End Testing

The Playwright suite:

1. Starts a fresh PostgreSQL container (port `54344`) and a private MinIO bucket (port `54345`) in their own Docker Compose project (`payload4-e2e`), so your development database is never touched and uploads go to a bucket, like on Railway
2. Builds the app and starts it with `pnpm start`, the same way Railway does (migrations included)
3. Creates the first admin through the onboarding UI
4. Seeds the demo content
5. Checks the public site, tags, comments and that every image renders
6. Checks the security rules: no public drafts or commenter emails, no self-approved comments, the honeypot, and no demo login
7. Submits a comment, approves it in the admin and verifies it appears
8. Calls the MCP endpoint with a user API key

Make sure Docker is running, then:

1. Install everything required for e2e: `corepack pnpm e2e:install`
2. Run the suite headlessly: `corepack pnpm test:e2e`
3. Run the suite with a visible browser: `corepack pnpm test:e2e:headed`
4. Run the suite slowly and keep the browser open for manual review: `corepack pnpm test:e2e:manual`

`e2e:install` installs dependencies, rebuilds native dependencies (`sharp`, `esbuild`) and downloads Chromium for Playwright.

`test:e2e:manual` runs headed with a visible slowdown and pauses at the end of the happy path, so you can click around the admin and the public pages. Resume or stop the session from the Playwright inspector when you are done.

## Requirements

- **Database**: PostgreSQL
- **Node.js**: 24.15 or newer
- **Docker**: for local PostgreSQL, the optional MinIO bucket and the e2e suite

## Useful Resources

- **Payload 4 beta documentation**: [payloadcms.com/docs/beta](https://payloadcms.com/docs/beta/getting-started/what-is-payload)
- **Payload 3 to 4 migration guide**: [payloadcms.com/docs/beta/migration-guide/v4](https://payloadcms.com/docs/beta/migration-guide/v4)
- **Payload 3 version of this template**: [rpuls/payload-3-boilerplate](https://github.com/rpuls/payload-3-boilerplate)

This repo was ported from [payload-3-boilerplate](https://github.com/rpuls/payload-3-boilerplate) by Claude Opus 5.5.

<p align="center">
  <a href="https://funkyton.com/">
    A template by,
    <br><br>
    <picture>
      <img alt="FUNKYTON logo" src="https://res-5.cloudinary.com/hczpmiapo/image/upload/q_auto/v1/ghost-blog-images/funkyton-logo.png" width=200>
    </picture>
  </a>
</p>

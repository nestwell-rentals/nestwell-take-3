# mcp-oauth

> **Disclaimer**
>
> Made by Fable 5.1, for demonstration purposes only, use it at your own risk.
>
> This plugin was written by Claude Fable 5.1, an AI model, to show how an MCP client such as
> ChatGPT can sign in to a Payload site. It implements security-sensitive functionality (an OAuth
> 2.1 authorization server, token issuing and revocation) and has not been reviewed or audited by a
> security professional. It is provided as is, without warranty of any kind, and no liability is
> accepted for any loss or damage arising from its use. Before relying on it to protect real
> content or real user accounts, review the code yourself, test it against your own threat model,
> and keep the rest of your deployment in order: HTTPS, a strong `PAYLOAD_SECRET`, backups and
> up-to-date dependencies.

A self-contained Payload plugin that turns the site into an OAuth 2.1 authorization server for
its MCP endpoint, so ChatGPT and other MCP clients can sign in as a real user instead of needing
an API key. It follows the MCP authorization spec (2026-07-28): RFC 9728 and RFC 8414 discovery,
dynamic client registration (RFC 7591) and client ID metadata documents, PKCE S256, resource
indicators (RFC 8707), `iss` in authorization responses (RFC 9207) and token revocation (RFC 7009).

## How it is wired in

One line in [src/plugins/index.ts](../index.ts):

```ts
plugins: [/* ... */, mcp, mcpOAuthPlugin()]
```

The plugin runs before `@payloadcms/plugin-mcp` and sets that plugin's `overrideGetAuthorizedMCP`,
so `src/plugins/mcp.ts`, the Users collection and `payload.config.ts` stay stock. It adds:

- four hidden collections (`oauth-clients`, `oauth-authorization-codes`, `oauth-grants`,
  `oauth-tokens`), unreachable over REST, GraphQL and MCP
- the endpoints under `/api/oauth` (register, token, revoke, the consent decision, "Not you?",
  and the admin's revoke action)
- a "Connected apps" UI field on the users collection, an admin-wide view at
  `/admin/connected-apps` with a sidebar link, and a `beforeDelete` hook that removes a deleted
  user's grants

Next.js only discovers pages and route handlers under `src/app`, so five two-line files live there
and re-export from this folder:

- `src/app/(frontend)/oauth/authorize/page.tsx` → the consent page ([next/AuthorizePage.tsx](next/AuthorizePage.tsx))
- `src/app/.well-known/oauth-protected-resource/route.ts` and `.../oauth-protected-resource/api/mcp/route.ts`
- `src/app/.well-known/oauth-authorization-server/route.ts` and `.../oauth-authorization-server/api/mcp/route.ts`

The database schema arrives through the normal migration in `src/migrations`
(`20261022_202749_oauth`).

## Layout

| Path | What |
| --- | --- |
| `index.ts` | the plugin: collections, endpoints, admin components, users field and hook, MCP auth override |
| `collections.ts` | the four bookkeeping collections |
| `endpoints.ts` | register, token, revoke, consent decision, switch account, revoke grant |
| `server/urls.ts` | issuer, MCP resource URL, discovery documents, the 401 challenge |
| `server/authorize.ts` | authorization request validation, consent token, code issuing |
| `server/tokens.ts` | grants, access and refresh tokens, single-use claims, bearer authentication |
| `server/clients.ts`, `server/clientMetadata.ts`, `server/redirectUris.ts`, `server/cimd.ts` | client registration, metadata rules, redirect URI rules, client ID metadata documents |
| `server/mcpAuth.ts` | what the MCP plugin calls to authenticate a request |
| `server/http.ts`, `server/crypto.ts`, `server/constants.ts`, `server/grants.ts` | helpers, hashing and PKCE, lifetimes, the "Connected apps" listing |
| `admin/` | the Connected apps field, view, sidebar link and revoke list |
| `next/` | the consent page and the well-known route handlers |

Tests: `tests/e2e/oauth.spec.ts` (the whole flow through a real browser and its failure cases)
and `tests/e2e/oauth-cimd.spec.ts` (client ID metadata documents with the network injected).

## What it borrows from the site

- `NEXT_PUBLIC_SERVER_URL` through `@/utilities/getURL`: the issuer and the MCP resource URL.
  It must be the URL users actually use; the consent form's Origin check compares against it.
- `@/components/ui/button` and `@/components/ui/card` for the consent page, so it matches the
  website. Swap those two imports to restyle.
- A `roles` field containing `admin` on the users collection, for who may see everyone's
  connected apps. Change `isAdminUser` in [server/grants.ts](server/grants.ts) if your roles differ.

## Removing it

1. Delete this folder and the five thin files under `src/app` listed above.
2. Remove `mcpOAuthPlugin()` from `src/plugins/index.ts`.
3. Create a migration that drops the four `oauth_*` tables (the `down` of
   `20261022_202749_oauth` has the SQL), then regenerate types and the import map.
4. Delete the two test files.

Without the plugin, `/api/mcp` accepts user API keys only, as it did before.

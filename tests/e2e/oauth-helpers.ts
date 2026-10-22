import { createHash, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'

import { type APIRequestContext, type APIResponse, expect } from '@playwright/test'

import { baseURL } from './env'

export const mcpResource = `${baseURL}/api/mcp`

/**
 * Stands in for the MCP client's redirect URI. The browser really lands here after consent, so
 * the test reads the authorization response straight from the page URL.
 */
export class CallbackServer {
  private server: null | Server = null

  constructor(private readonly port = 3999) {}

  get redirectUri() {
    return `http://127.0.0.1:${this.port}/callback`
  }

  async start() {
    this.server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<!doctype html><title>Callback</title><p>callback received</p>')
    })
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(this.port, '127.0.0.1', resolve)
    })
  }

  async stop() {
    await new Promise<void>((resolve) => {
      if (!this.server) return resolve()
      this.server.close(() => resolve())
    })
  }
}

/** RFC 7636 S256: a random verifier and its challenge */
export const createPKCE = () => {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { challenge, verifier }
}

/** Splits `Bearer a="b", c="d"` into its parameters */
export const parseChallenge = (header: string | undefined): Record<string, string> => {
  expect(header, 'WWW-Authenticate header').toBeTruthy()
  expect(header!.startsWith('Bearer ')).toBeTruthy()
  const params: Record<string, string> = {}
  for (const match of header!.slice('Bearer '.length).matchAll(/(\w+)="([^"]*)"/g)) {
    params[match[1]!] = match[2]!
  }
  return params
}

export type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token: string
  scope?: string
  token_type: string
}

/** One JSON-RPC call to /api/mcp. Returns the raw response so callers can check the status. */
export const callMCP = (
  api: APIRequestContext,
  authorization: string | undefined,
  method: string,
  params: Record<string, unknown> = {},
): Promise<APIResponse> =>
  api.post('/api/mcp', {
    data: { id: 1, jsonrpc: '2.0', method, params },
    headers: {
      Accept: 'application/json, text/event-stream',
      ...(authorization ? { Authorization: authorization } : {}),
    },
  })

type ToolResult = { content: Array<{ text?: string; type: string }>; isError?: boolean }

/** Calls an MCP tool and returns its result; fails the test when the transport itself errors */
export const callTool = async (
  api: APIRequestContext,
  accessToken: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> => {
  const response = await callMCP(api, `Bearer ${accessToken}`, 'tools/call', { name, arguments: args })
  expect(response.ok(), `tools/call ${name} should be accepted`).toBeTruthy()
  const body = await response.json()
  expect(body.error, `tools/call ${name} JSON-RPC error`).toBeUndefined()
  return body.result as ToolResult
}

export const toolText = (result: ToolResult): string =>
  result.content.map((block) => block.text ?? '').join('\n')

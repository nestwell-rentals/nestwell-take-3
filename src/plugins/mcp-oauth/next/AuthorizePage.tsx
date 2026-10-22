import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

// The consent page borrows the website's button and card so it looks like the rest of the site.
// Swap these two imports to restyle it.
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import {
  buildAuthorizeURL,
  createConsentToken,
  parseAuthorizationRequest,
  type SearchParams,
} from '../server/authorize'
import { redirectUriHost } from '../server/redirectUris'
import { getIssuer, oauthPaths } from '../server/urls'
import { SameOriginBounce } from './SameOriginBounce'

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Allow access',
}

type Args = {
  searchParams: Promise<SearchParams>
}

/**
 * The OAuth authorization endpoint, mounted at /oauth/authorize by the thin page in src/app.
 * An MCP client such as ChatGPT sends the user here. After signing in through the normal admin
 * login, the user sees who is asking and allows or denies; the decision is posted to
 * /api/oauth/authorize, which redirects back to the client.
 */
export default async function AuthorizePage({ searchParams }: Args) {
  const params = await searchParams
  const payload = await getPayload({ config: configPromise })

  // The decision endpoint sends people back here when their request can no longer be used
  if (typeof params.reason === 'string' && !params.client_id) {
    return <RequestError reason={params.reason} />
  }

  const parsed = await parseAuthorizationRequest({ params, payload })
  if (parsed.kind === 'invalid') {
    return <RequestError description={parsed.description} error={parsed.error} />
  }
  if (parsed.kind === 'redirect') redirect(parsed.url)

  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  const authorizeURL = buildAuthorizeURL(parsed.request)

  if (!user) {
    // When `serverURL` is configured, Payload ignores its login cookie on cross-site navigations,
    // and arriving from chatgpt.com is one. Hop once through this origin before concluding that
    // the visitor is signed out.
    if (payload.config.csrf.length > 0 && headers.get('sec-fetch-site') === 'cross-site') {
      return <SameOriginBounce href={authorizeURL} />
    }
    redirect(`${payload.config.routes.admin}/login?redirect=${encodeURIComponent(authorizeURL)}`)
  }

  const requestToken = createConsentToken({
    clientRecordId: parsed.client.id,
    request: parsed.request,
    secret: payload.secret,
    userId: user.id,
  })

  return (
    <ConsentCard
      clientName={parsed.client.clientName}
      clientUri={parsed.client.clientUri ?? null}
      decisionAction={oauthPaths.decision}
      redirectHost={redirectUriHost(parsed.request.redirectUri)}
      requestToken={requestToken}
      siteHost={new URL(getIssuer()).host}
      switchAccountHref={`${oauthPaths.switchAccount}?request=${encodeURIComponent(requestToken)}`}
      userEmail={user.email}
      userName={user.name ?? null}
    />
  )
}

type ConsentProps = {
  clientName: string
  clientUri: null | string
  decisionAction: string
  /** Where the browser goes after the decision, shown so people can recognise the app */
  redirectHost: string
  requestToken: string
  siteHost: string
  switchAccountHref: string
  userEmail: string
  userName: null | string
}

/**
 * "<client> wants to act as <user> on <site>". A plain HTML form: the signed request token in
 * the hidden field is the only state, and the decision buttons post straight to Payload.
 */
const ConsentCard: React.FC<ConsentProps> = ({
  clientName,
  clientUri,
  decisionAction,
  redirectHost,
  requestToken,
  siteHost,
  switchAccountHref,
  userEmail,
  userName,
}) => (
  <main className="container flex justify-center py-16 md:py-24">
    <Card className="w-full max-w-xl">
      <CardHeader className="gap-3">
        <CardDescription>Sign-in request</CardDescription>
        <CardTitle className="text-2xl leading-tight" data-testid="consent-title">
          <span className="text-primary">{clientName}</span> wants to act as{' '}
          <span>{userName || userEmail}</span> on {siteHost}
        </CardTitle>
        <CardDescription>
          You are signed in as {userEmail}.{' '}
          <a className="underline hover:text-foreground" href={switchAccountHref}>
            Not you?
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            It gets the same permissions as you: what you can read and change, it can read and
            change. Nothing more.
          </li>
          <li>Changes it makes are recorded under your name.</li>
          <li>
            You can revoke this access at any time under <strong>Connected apps</strong> on your
            account in the admin.
          </li>
        </ul>
        <p className="text-muted-foreground">
          After you decide, you will be sent back to{' '}
          <strong className="text-foreground">{redirectHost}</strong>.
          {clientUri ? (
            <>
              {' '}
              App website:{' '}
              <a
                className="underline hover:text-foreground"
                href={clientUri}
                rel="noopener noreferrer"
                target="_blank"
              >
                {clientUri}
              </a>
            </>
          ) : null}
        </p>
      </CardContent>
      <CardFooter>
        <form action={decisionAction} className="flex w-full justify-end gap-3" method="post">
          <input name="request" type="hidden" value={requestToken} />
          <Button name="decision" type="submit" value="deny" variant="outline">
            Deny
          </Button>
          <Button name="decision" type="submit" value="allow">
            Allow
          </Button>
        </form>
      </CardFooter>
    </Card>
  </main>
)

const KNOWN_REASONS: Record<string, { description: string; title: string }> = {
  expired: {
    title: 'This sign-in request has expired',
    description: 'Go back to the app that asked for access and connect again.',
  },
  unknown_client: {
    title: 'This app is no longer registered',
    description: 'Go back to the app that asked for access and connect again.',
  },
}

/**
 * Shown when an authorization request cannot be trusted enough to send the visitor anywhere:
 * an unknown client or an unregistered redirect URI. Never redirects.
 */
const RequestError: React.FC<{ description?: string; error?: string; reason?: string }> = ({
  description,
  error,
  reason,
}) => {
  const known = reason ? KNOWN_REASONS[reason] : undefined
  const title = known?.title ?? 'This sign-in request is not valid'
  const text =
    known?.description ?? description ?? 'Go back to the app that asked for access and try again.'

  return (
    <main className="container flex justify-center py-16 md:py-24">
      <Card className="w-full max-w-xl">
        <CardHeader className="gap-3">
          <CardDescription>Sign-in request</CardDescription>
          <CardTitle className="text-2xl leading-tight">{title}</CardTitle>
          <CardDescription>{text}</CardDescription>
        </CardHeader>
        {error ? (
          <CardContent>
            <code className="text-muted-foreground text-xs">{error}</code>
          </CardContent>
        ) : null}
        <CardFooter>
          <Button asChild variant="outline">
            <Link href="/">Go to the website</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}

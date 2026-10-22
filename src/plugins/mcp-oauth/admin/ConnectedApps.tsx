import type { AdminViewServerProps, ServerProps, UIFieldServerProps } from 'payload'

import { Gutter, PayloadLink } from '@payloadcms/ui'
import React from 'react'

import { isAdminUser, listConnectedApps } from '../server/grants'
import { GrantsList } from './GrantsList'
import './connected-apps.css'

/**
 * "Connected apps" on a user's account: the AI assistants and other apps that may act as this
 * user over MCP. A UI field the plugin adds to the users collection, so it shows on
 * /admin/account and, for admins, on every user's edit view.
 */
export async function ConnectedAppsField({ data, payload, req }: UIFieldServerProps) {
  const viewer = req.user
  const targetId = data?.id as number | string | undefined
  if (!viewer || targetId === undefined || targetId === null) return null

  const isSelf = String(viewer.id) === String(targetId)
  if (!isSelf && !isAdminUser(viewer)) return null

  const apps = await listConnectedApps({ payload, userId: targetId })

  return (
    <div className="connected-apps" id="connected-apps">
      <h3 className="connected-apps__title">Connected apps</h3>
      <p className="connected-apps__description">
        {isSelf
          ? 'Apps you have allowed to act as you over MCP, for example ChatGPT. They get exactly your permissions, and revoking stops them immediately.'
          : 'Apps this user has allowed to act as them over MCP.'}
      </p>
      <GrantsList
        apiRoute={payload.config.routes.api}
        apps={apps}
        emptyText={
          isSelf ? 'No apps are connected to your account.' : 'No apps are connected to this account.'
        }
      />
    </div>
  )
}

/**
 * /admin/connected-apps: every app that may act as any user over MCP, for admins. Payload wraps
 * custom views in the admin template and sends signed-out visitors to the login page.
 */
export async function ConnectedAppsView({ initPageResult }: AdminViewServerProps) {
  const { payload, user } = initPageResult.req
  const { admin: adminRoute, api: apiRoute } = payload.config.routes

  if (!user || !isAdminUser(user)) {
    return (
      <Gutter className="connected-apps-view">
        <h1>Connected apps</h1>
        <p>
          Only admins can see every user&apos;s connected apps. Your own are listed on{' '}
          <PayloadLink href={`${adminRoute}/account`}>your account</PayloadLink>.
        </p>
      </Gutter>
    )
  }

  const apps = await listConnectedApps({ payload })

  return (
    <Gutter className="connected-apps-view">
      <h1>Connected apps</h1>
      <p className="connected-apps__description">
        Every AI assistant and app that is allowed to act as a user over MCP. Revoking removes its
        tokens immediately; the app has to ask the user again.
      </p>
      <GrantsList apiRoute={apiRoute} apps={apps} emptyText="No apps are connected." showUser />
    </Gutter>
  )
}

/** Sidebar link to the admin-wide "Connected apps" overview. Admins only. */
export const ConnectedAppsNavLink: React.FC<ServerProps> = ({ payload, user }) => {
  if (!isAdminUser(user)) return null

  return (
    <PayloadLink
      className="nav__link"
      href={`${payload.config.routes.admin}/connected-apps`}
      id="nav-connected-apps"
    >
      <span className="nav__link-label">Connected apps</span>
    </PayloadLink>
  )
}

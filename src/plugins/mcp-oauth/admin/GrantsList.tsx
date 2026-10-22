'use client'

import { Button, toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import type { ConnectedApp } from '../server/grants'

type Props = {
  apiRoute: string
  apps: ConnectedApp[]
  emptyText: string
  /** Admin overview: say whose account each app acts as */
  showUser?: boolean
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export const GrantsList: React.FC<Props> = ({ apiRoute, apps, emptyText, showUser = false }) => {
  const router = useRouter()
  const [busyId, setBusyId] = useState<null | string>(null)

  const revoke = async (app: ConnectedApp) => {
    const who = showUser && app.user ? app.user.name || app.user.email || 'this user' : 'you'
    if (!window.confirm(`Stop ${app.clientName} from acting as ${who}?`)) return

    setBusyId(app.id)
    try {
      const response = await fetch(`${apiRoute}/oauth/grants/${encodeURIComponent(app.id)}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        method: 'DELETE',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      toast.success(`${app.clientName} can no longer act as ${who}.`)
      router.refresh()
    } catch {
      toast.error('Could not revoke access. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  if (apps.length === 0) {
    return <p className="connected-apps__empty">{emptyText}</p>
  }

  return (
    <ul className="connected-apps__list">
      {apps.map((app) => (
        <li className="connected-apps__item" data-grant-id={app.id} key={app.id}>
          <div className="connected-apps__details">
            <span className="connected-apps__name">{app.clientName}</span>
            {showUser && app.user ? (
              <span className="connected-apps__user">
                acting as {app.user.name || app.user.email}
              </span>
            ) : null}
            <span className="connected-apps__meta">
              {app.clientHost ? `Returns to ${app.clientHost} · ` : ''}
              Connected {formatDate(app.createdAt)} · Last used{' '}
              {app.lastUsedAt ? formatDate(app.lastUsedAt) : 'never'}
            </span>
          </div>
          <Button buttonStyle="secondary" disabled={busyId === app.id} onClick={() => void revoke(app)}>
            Revoke
          </Button>
        </li>
      ))}
    </ul>
  )
}

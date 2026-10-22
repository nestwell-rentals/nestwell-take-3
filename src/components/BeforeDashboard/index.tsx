import type { ServerProps } from 'payload'

import { Button, PayloadLink } from '@payloadcms/ui'
import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

import { hasRole } from '@/access/roles'

import { SeedButton } from './SeedButton'
import './index.css'

const baseClass = 'before-dashboard'

const BeforeDashboard: React.FC<ServerProps> = ({ user }) => {
  const isAdmin = hasRole(user, 'admin')

  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Welcome to your Payload 4 dashboard!</h4>
      </Banner>
      {/* The admin lives at /admin, so new owners easily miss that the website is at / */}
      <Button
        buttonStyle="primary"
        className={`${baseClass}__visit`}
        el="anchor"
        newTab
        size="large"
        url="/"
      >
        Visit your website ↗
      </Button>
      Here&apos;s what to do next:
      <ul className={`${baseClass}__instructions`}>
        {isAdmin && (
          <li>
            <SeedButton />
            {' with demo posts, pages, categories, tags and comments, then '}
            <a href="/" target="_blank">
              visit your website
            </a>
            {'. Seeding replaces existing content, so only do this on a fresh site.'}
          </li>
        )}
        <li>
          {'Moderate visitor comments in '}
          <PayloadLink href="/admin/collections/comments">Comments</PayloadLink>
          {'. New comments stay hidden until you approve them.'}
        </li>
        <li>
          {'Make this dashboard yours: use '}
          <strong>Edit</strong>
          {' to add, move and resize widgets such as "Pending comments".'}
        </li>
        <li>
          {'Connect ChatGPT or another AI agent over MCP: add '}
          <code>/api/mcp</code>
          {' as a connector with OAuth and sign in, or create an API key on your '}
          <PayloadLink href={`/admin/collections/users/${user?.id ?? ''}`}>account</PayloadLink>
          {'. Your account also lists the connected apps, with a Revoke button each.'}
        </li>
        <li>
          {'Change the '}
          <a
            href="https://payloadcms.com/docs/beta/configuration/collections"
            rel="noopener noreferrer"
            target="_blank"
          >
            collections
          </a>
          {' and push to GitHub. Railway rebuilds and runs your database migrations automatically.'}
        </li>
      </ul>
      <p className={`${baseClass}__tip`}>
        {'Pro tip: this block is a '}
        <a
          href="https://payloadcms.com/docs/beta/custom-components/overview"
          rel="noopener noreferrer"
          target="_blank"
        >
          custom component
        </a>
        {'. Remove it any time in '}
        <strong>payload.config.ts</strong>.
      </p>
    </div>
  )
}

export default BeforeDashboard

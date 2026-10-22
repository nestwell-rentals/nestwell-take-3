import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test'

import {
  adminEmail,
  adminPassword,
  commentText,
  demoAuthorEmail,
  featuredPost,
  moderatedPost,
  moderatedPostApprovedComments,
  seededPosts,
  targetPost,
} from './env'

const manualReviewMode = process.env.E2E_MANUAL_REVIEW === 'true'

// The tests build on each other: onboarding -> seed -> public site -> moderation -> MCP
test.describe.configure({ mode: 'serial' })

let adminPage: Page
let publicPage: Page

async function fillFirst(locator: Locator, value: string) {
  await expect(locator.first()).toBeVisible()
  await locator.first().fill(value)
}

// Wait for React to hydrate before typing: input filled earlier is lost from the form state
async function gotoAndHydrate(page: Page, url: string) {
  const response = await page.goto(url)
  await page.waitForLoadState('networkidle')
  return response
}

// Scrolls through the page so lazy images load, then lists every image that failed to render
async function brokenImages(page: Page, url: string) {
  await page.goto(url)
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  })
  await page.waitForLoadState('networkidle')

  return page
    .locator('img')
    .evaluateAll((images) =>
      (images as HTMLImageElement[])
        .filter((image) => !image.complete || image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src),
    )
}

async function newPage(browser: Browser) {
  const context = await browser.newContext()
  return context.newPage()
}

async function createFirstAdmin(page: Page) {
  await gotoAndHydrate(page, '/admin')
  await expect(page).toHaveURL(/\/admin\/create-first-user/)

  await fillFirst(page.locator('input[name="email"]'), adminEmail)
  const nameField = page.locator('input[name="name"]')
  if (await nameField.count()) await nameField.fill('Playwright Admin')
  await fillFirst(page.getByLabel('New Password'), adminPassword)
  await fillFirst(page.getByLabel('Confirm Password'), adminPassword)

  await page.getByRole('button', { name: /create|continue/i }).first().click()

  await expect(page.getByRole('button', { name: /seed your database/i })).toBeVisible({
    timeout: 30000,
  })
}

async function findComments(request: APIRequestContext, where: Record<string, string>) {
  const params: Record<string, string> = { depth: '0', limit: '100' }
  for (const [key, value] of Object.entries(where)) params[`where[${key}][equals]`] = value

  const response = await request.get('/api/comments', { params })
  expect(response.ok()).toBeTruthy()

  return (await response.json()).docs as Array<Record<string, any>> // eslint-disable-line @typescript-eslint/no-explicit-any
}

async function approveCommentInAdmin(page: Page, commentID: string) {
  await gotoAndHydrate(page, `/admin/collections/comments/${commentID}`)
  await expect(page.getByText(commentText).first()).toBeVisible({ timeout: 30000 })

  // Status is a select field in the sidebar: open it and pick "Approved"
  const statusField = page.locator('#field-status')
  await statusField.click()
  await page.getByRole('option', { name: 'Approved' }).click()
  await page.getByRole('button', { name: /^save$/i }).first().click()
  await expect(page.getByText(/updated successfully|saved successfully/i).first()).toBeVisible()
}

test('first user becomes an admin and can seed the database', async ({ browser }) => {
  adminPage = await newPage(browser)
  await createFirstAdmin(adminPage)

  const me = await (await adminPage.request.get('/api/users/me')).json()
  expect(me.user.roles).toEqual(['admin'])

  // The custom Payload 4 dashboard widget is part of the default layout
  await expect(adminPage.getByText('Comments waiting for review')).toBeVisible()

  // New owners land in /admin, so the dashboard links prominently to the website itself
  await expect(adminPage.getByRole('link', { name: /visit your website/i }).first()).toHaveAttribute(
    'href',
    '/',
  )

  await adminPage.getByRole('button', { name: /seed your database/i }).click()
  await expect(adminPage.getByText(/database seeded!/i)).toBeVisible({ timeout: 180000 })
})

test('seeded posts render publicly with tags and comments', async ({ browser }) => {
  publicPage = await newPage(browser)

  // The newest post is featured in the home page's "Latest posts" block
  await publicPage.goto('/')
  await expect(publicPage.getByText(featuredPost.title).first()).toBeVisible()

  // Seeded images render on the website, not only in the admin
  for (const url of ['/', `/posts/${featuredPost.slug}`]) {
    expect(await brokenImages(publicPage, url), `broken images on ${url}`).toEqual([])
  }

  await publicPage.goto('/posts')
  await expect(publicPage.getByRole('heading', { name: 'Posts' })).toBeVisible()
  for (const post of seededPosts) {
    await expect(publicPage.getByRole('link', { name: post.title }).first()).toBeVisible()
  }

  for (const post of seededPosts) {
    const response = await publicPage.goto(`/posts/${post.slug}`)
    expect(response?.ok(), `/posts/${post.slug} should respond successfully`).toBeTruthy()
    await expect(publicPage.getByRole('heading', { level: 1, name: post.title })).toBeVisible()
    await expect(publicPage.getByRole('heading', { name: /^comments/i })).toBeVisible()
  }

  // Payload 4 tags are shown on the post
  await publicPage.goto(`/posts/${targetPost.slug}`)
  await expect(publicPage.getByRole('list', { name: 'Tags' })).toContainText('#Payload')

  // Only approved seeded comments are shown
  await publicPage.goto(`/posts/${moderatedPost.slug}`)
  await expect(publicPage.locator('#comments-heading')).toContainText(
    `(${moderatedPostApprovedComments})`,
  )
})

test('public API hides pending comments, author emails and drafts', async () => {
  const comments = await findComments(publicPage.request, {})
  expect(comments.length).toBeGreaterThan(0)
  for (const comment of comments) {
    expect(comment.status).toBe('approved')
    expect(comment.author?.email).toBeUndefined()
  }

  // Version history (drafts, autosaves) is private even though published posts are public
  const versions = await publicPage.request.get('/api/posts/versions')
  if (versions.ok()) {
    expect((await versions.json()).docs).toHaveLength(0)
  } else {
    expect(versions.status()).toBe(403)
  }

  // The seeded demo author is not a usable login
  const login = await publicPage.request.post('/api/users/login', {
    data: { email: demoAuthorEmail, password: 'password' },
  })
  expect(login.ok()).toBeFalsy()
})

test('visitors cannot self-approve comments or get past the honeypot', async () => {
  const post = await (
    await publicPage.request.get('/api/posts', {
      params: { 'where[slug][equals]': targetPost.slug, depth: '0' },
    })
  ).json()
  const postID = post.docs[0].id

  const selfApproved = await publicPage.request.post('/api/comments', {
    data: {
      author: { email: 'sneaky@example.com', name: 'Sneaky' },
      content: 'I approve of myself',
      post: postID,
      status: 'approved',
    },
  })
  expect(selfApproved.ok()).toBeTruthy()
  const created = (await selfApproved.json()).doc
  // The public response is filtered by read access, so check the stored status as the admin
  const stored = await (await adminPage.request.get(`/api/comments/${created.id}`)).json()
  expect(stored.status).toBe('pending')

  const bot = await publicPage.request.post('/api/comments', {
    data: {
      author: { email: 'bot@example.com', name: 'Bot' },
      content: 'Buy now',
      post: postID,
      website: 'https://spam.example.com',
    },
  })
  expect(bot.status()).toBe(400)
})

test('visitor comment appears after an admin approves it', async () => {
  await gotoAndHydrate(publicPage, `/posts/${targetPost.slug}`)

  await fillFirst(publicPage.getByLabel(/^name$/i), 'Playwright Visitor')
  await fillFirst(publicPage.getByLabel(/^email/i), 'visitor@example.com')
  await fillFirst(publicPage.getByLabel(/^comment$/i), commentText)
  await publicPage.getByRole('button', { name: /submit comment/i }).click()

  await expect(publicPage.getByText(/comment submitted successfully/i)).toBeVisible()
  await expect(publicPage.getByText(commentText)).toHaveCount(0)

  const [pending] = await findComments(adminPage.request, { content: commentText })
  expect(pending.status).toBe('pending')

  await approveCommentInAdmin(adminPage, String(pending.id))

  await expect
    .poll(async () => (await findComments(publicPage.request, { content: commentText })).length, {
      timeout: 30000,
    })
    .toBe(1)

  await expect
    .poll(
      async () => {
        await publicPage.reload()
        return publicPage.getByText(commentText).count()
      },
      { timeout: 30000 },
    )
    .toBe(1)

  if (manualReviewMode) {
    await publicPage.bringToFront()
    await publicPage.pause()
  }
})

test('AI agents can use the MCP endpoint with a user API key', async () => {
  const me = await (await adminPage.request.get('/api/users/me')).json()
  const apiKey = `e2e-${Date.now()}-mcp-key`

  const update = await adminPage.request.patch(`/api/users/${me.user.id}`, {
    data: { apiKey },
  })
  expect(update.ok()).toBeTruthy()

  const callMCP = (body: Record<string, unknown>) =>
    publicPage.request.post('/api/mcp', {
      data: { jsonrpc: '2.0', id: 1, ...body },
      headers: {
        Accept: 'application/json, text/event-stream',
        Authorization: `users API-Key ${apiKey}`,
      },
    })

  const response = await callMCP({
    method: 'tools/call',
    params: { name: 'siteOverview', arguments: {} },
  })
  expect(response.ok()).toBeTruthy()
  expect(await response.text()).toContain(`Published posts: ${seededPosts.length}`)
})

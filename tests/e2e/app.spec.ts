import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test'

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

  await page
    .getByRole('button', { name: /create|continue/i })
    .first()
    .click()

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
  await page
    .getByRole('button', { name: /^save$/i })
    .first()
    .click()
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
  await expect(
    adminPage.getByRole('link', { name: /visit your website/i }).first(),
  ).toHaveAttribute('href', '/')

  await adminPage.getByRole('button', { name: /seed your database/i }).click()
  await expect(adminPage.getByText(/database seeded!/i)).toBeVisible({ timeout: 180000 })
})

test('Nestwell submissions stay private until human review', async ({ browser }) => {
  const visitor = await newPage(browser)
  await gotoAndHydrate(visitor, '/list-your-apartment')
  await expect(visitor.locator('input[type="file"]')).toHaveCount(0)
  for (const [name, value] of Object.entries({
    title: 'Sunny Nestwell apartment',
    monthlyRent: '1400',
    deposit: '2800',
    availableFrom: '2027-01-01',
    streetAddress: '12 Garden Street',
    city: 'Copenhagen',
    size: '72',
    rooms: '3',
    landlordName: 'Private Landlord',
    landlordEmail: 'landlord@example.com',
    landlordPhone: '+4512345678',
  })) {
    await visitor.locator(`input[name="${name}"]`).fill(value)
  }
  await visitor
    .locator('textarea[name="description"]')
    .fill('A bright apartment with a practical layout.')
  await visitor.getByRole('button', { name: 'Submit your apartment' }).click()
  await expect(visitor.getByRole('status')).toContainText('Our team will review')
  const staffResult = await (
    await adminPage.request.get('/api/listings?where[title][equals]=Sunny%20Nestwell%20apartment')
  ).json()
  const listing = staffResult.docs[0]
  expect(listing.status).toBe('pending')
  expect(listing.landlordEmail).toBe('landlord@example.com')
  expect((await visitor.request.get(`/api/listings/${listing.id}`)).status()).toBe(404)
  await visitor.goto(`/listings/${listing.slug}`)
  await expect(visitor.getByRole('heading', { name: 'Sunny Nestwell apartment' })).toHaveCount(0)

  const malicious = {
    title: 'Unreviewed apartment',
    monthlyRent: 1000,
    deposit: 2000,
    availableFrom: '2027-01-01',
    streetAddress: '1 Park Road',
    city: 'Copenhagen',
    size: 50,
    rooms: 2,
    landlordName: 'Private Owner',
    landlordEmail: 'private@example.com',
    landlordPhone: '12345678',
    description: 'A real apartment.',
    status: 'approved',
    internalNotes: 'Visitor must not set this',
    photos: [999999],
  }
  expect(
    (
      await visitor.request.post('/api/listing-submissions', {
        data: { ...malicious, website: 'spam' },
      })
    ).status(),
  ).toBe(400)
  expect(
    (await visitor.request.post('/api/listing-submissions', { data: malicious })).status(),
  ).toBe(201)
  const injected = (
    await (
      await adminPage.request.get('/api/listings?where[title][equals]=Unreviewed%20apartment')
    ).json()
  ).docs[0]
  expect(injected.status).toBe('pending')
  expect(injected.internalNotes).toBeFalsy()
  expect(injected.photos || []).toHaveLength(0)
  // The collection itself also protects REST callers bypassing the website form.
  const direct = await visitor.request.post('/api/listings', {
    data: {
      ...malicious,
      title: 'Direct submission',
      description: listing.description,
      status: 'rented',
    },
  })
  expect(direct.status()).toBe(201)
  const directID = (await direct.json()).doc.id
  const directStaff = await (await adminPage.request.get(`/api/listings/${directID}`)).json()
  expect(directStaff.status).toBe('pending')
  expect(directStaff.internalNotes).toBeFalsy()
  expect(directStaff.photos || []).toHaveLength(0)

  const editorContext = await browser.newContext()
  const email = `editor-${Date.now()}@example.com`
  const editorCreate = await adminPage.request.post('/api/users', {
    data: { email, password: 'EditorTest123!', roles: ['editor'] },
  })
  expect(editorCreate.ok()).toBeTruthy()
  expect(
    (
      await editorContext.request.post('/api/users/login', {
        data: { email, password: 'EditorTest123!' },
      })
    ).ok(),
  ).toBeTruthy()
  expect(
    (
      await editorContext.request.patch(`/api/listings/${listing.id}`, {
        data: { status: 'approved', internalNotes: 'Staff only' },
      })
    ).ok(),
  ).toBeTruthy()
  expect((await editorContext.request.delete(`/api/listings/${listing.id}`)).status()).toBe(403)
  const publicListing = await (await visitor.request.get(`/api/listings/${listing.id}`)).json()
  for (const field of ['landlordName', 'landlordEmail', 'landlordPhone', 'internalNotes'])
    expect(publicListing).not.toHaveProperty(field)
  await visitor.goto('/')
  await expect(visitor.getByRole('link', { name: /Sunny Nestwell apartment/ })).toBeVisible()
  await visitor.goto(`/listings/${listing.slug}`)
  await expect(visitor.getByRole('heading', { name: listing.title })).toBeVisible()
  await expect(visitor.getByRole('img', { name: /Photos coming soon/ })).toBeVisible()
  await expect(visitor.getByText('72 m²')).toBeVisible()
  await expect(visitor.getByText('Staff only')).toHaveCount(0)
  const media = (await (await adminPage.request.get('/api/media?limit=1')).json()).docs[0]
  expect(media).toBeTruthy()
  expect(
    (
      await editorContext.request.patch(`/api/listings/${listing.id}`, {
        data: { photos: [media.id] },
      })
    ).ok(),
  ).toBeTruthy()
  await visitor.goto(`/listings/${listing.slug}`)
  await expect(visitor.locator('section[aria-label="Apartment photo gallery"] img')).toHaveCount(1)
  expect(await brokenImages(visitor, `/listings/${listing.slug}`)).toEqual([])

  expect(
    (
      await editorContext.request.patch(`/api/listings/${listing.id}`, {
        data: { status: 'rented' },
      })
    ).ok(),
  ).toBeTruthy()
  await visitor.goto(`/listings/${listing.slug}`)
  await expect(visitor.getByText('This apartment has been rented.')).toBeVisible()
  await visitor.goto('/listings')
  await expect(visitor.getByRole('link', { name: /Sunny Nestwell apartment/ })).toHaveCount(0)
  expect(
    (
      await editorContext.request.patch(`/api/listings/${listing.id}`, {
        data: { status: 'rejected' },
      })
    ).ok(),
  ).toBeTruthy()
  expect((await visitor.request.get(`/api/listings/${listing.id}`)).status()).toBe(404)
  expect((await adminPage.request.delete(`/api/listings/${listing.id}`)).ok()).toBeTruthy()
  await editorContext.close()
  await visitor.close()
})

test('seeded posts render publicly with tags and comments', async ({ browser }) => {
  publicPage = await newPage(browser)

  // The home page is now dedicated to Nestwell rentals.
  await publicPage.goto('/')
  await expect(publicPage.getByRole('heading', { name: 'Find your next home' })).toBeVisible()

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
  const data = {
    title: 'MCP apartment',
    slug: `mcp-apartment-${Date.now()}`,
    status: 'pending',
    monthlyRent: 1200,
    deposit: 2400,
    availableFrom: '2027-01-01',
    streetAddress: '10 Main Street',
    city: 'Copenhagen',
    size: 65,
    rooms: 2,
    landlordName: 'Private MCP owner',
    landlordEmail: 'mcp-owner@example.com',
    landlordPhone: '12345678',
    description: {
      root: {
        type: 'root',
        version: 1,
        direction: 'ltr',
        format: '',
        indent: 0,
        children: [
          {
            type: 'paragraph',
            version: 1,
            textFormat: 0,
            textStyle: '',
            direction: 'ltr',
            format: '',
            indent: 0,
            children: [
              {
                type: 'text',
                version: 1,
                text: 'Verified apartment details.',
                format: 0,
                detail: 0,
                mode: 'normal',
                style: '',
              },
            ],
          },
        ],
      },
    },
  }
  const create = await callMCP({
    method: 'tools/call',
    params: {
      name: 'createDocuments',
      arguments: { slug: 'listings', documents: [{ data }], returning: true },
    },
  })
  expect(await create.text()).toContain('MCP apartment')
  const listing = (
    await (await adminPage.request.get(`/api/listings?where[slug][equals]=${data.slug}`)).json()
  ).docs[0]
  expect(listing.status).toBe('pending')
  const edit = await callMCP({
    method: 'tools/call',
    params: {
      name: 'updateDocument',
      arguments: { slug: 'listings', id: listing.id, data: { title: 'Honest updated apartment' } },
    },
  })
  expect(await edit.text()).toContain('successfully')
  for (const status of ['approved', 'rented']) {
    const denied = await callMCP({
      method: 'tools/call',
      params: {
        name: 'updateDocument',
        arguments: { slug: 'listings', id: listing.id, data: { status } },
      },
    })
    expect(await denied.text()).toContain('Only human staff')
  }
  const unchanged = await (await adminPage.request.get(`/api/listings/${listing.id}`)).json()
  expect(unchanged.status).toBe('pending')
  const deleteAttempt = await callMCP({
    method: 'tools/call',
    params: { name: 'deleteDocuments', arguments: { slug: 'listings', id: listing.id } },
  })
  expect(await deleteAttempt.text()).toContain('Error')
  expect((await adminPage.request.get(`/api/listings/${listing.id}`)).ok()).toBeTruthy()
})

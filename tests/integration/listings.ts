/** Run only against an isolated database: corepack pnpm payload run tests/integration/listings.ts */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createPayloadRequest, getPayload, type RequiredDataFromCollectionSlug } from 'payload'
import config from '@payload-config'

if (!process.env.DATABASE_URL?.match(/\/nestwell_test[a-z0-9_]*(\?|$)/))
  throw new Error('Use a dedicated nestwell_test database, never the development database.')
const payload = await getPayload({ config, cron: false })
try {
  const adminDoc = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      email: `admin-${Date.now()}@example.com`,
      password: 'IntegrationTest123!',
      roles: ['admin'],
    },
  })
  const editorDoc = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      email: `editor-${Date.now()}@example.com`,
      password: 'IntegrationTest123!',
      roles: ['editor'],
    },
  })
  const admin = { ...adminDoc, collection: 'users' as const }
  const editor = { ...editorDoc, collection: 'users' as const }
  const data: RequiredDataFromCollectionSlug<'listings'> = {
    slug: randomUUID(),
    status: 'pending',
    title: 'Sunny apartment',
    monthlyRent: 1400,
    deposit: 2800,
    availableFrom: '2027-01-01',
    streetAddress: '12 Garden Street',
    city: 'Copenhagen',
    size: 72,
    rooms: 3,
    landlordName: 'Private Landlord',
    landlordEmail: 'private@example.com',
    landlordPhone: '+4512345678',
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
                text: 'A bright home.',
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
  for (const status of ['approved', 'rented', 'rejected', 'invalid'] as const) {
    // Simulate untrusted JSON, including invalid status. It must be ignored, not validated.
    const submitted = await payload.create({
      collection: 'listings',
      overrideAccess: false,
      user: null,
      data: {
        ...data,
        slug: randomUUID(),
        status,
        internalNotes: 'injected',
        photos: [999999],
      } as typeof data,
    })
    const stored = await payload.findByID({
      collection: 'listings',
      id: submitted.id,
      user: editor,
      overrideAccess: false,
    })
    assert.equal(stored.status, 'pending')
    assert.ok(!stored.internalNotes)
    assert.equal(stored.photos?.length || 0, 0)
    assert.equal(stored.landlordEmail, 'private@example.com')
    assert.equal(Object.hasOwn(submitted, 'landlordEmail'), false)
    await assert.rejects(
      payload.findByID({
        collection: 'listings',
        id: submitted.id,
        user: null,
        overrideAccess: false,
      }),
    )
  }
  await assert.rejects(
    payload.create({
      collection: 'listings',
      overrideAccess: false,
      data: { ...data, slug: randomUUID(), website: 'bot' },
    }),
  )
  const listing = await payload.create({
    collection: 'listings',
    user: editor,
    overrideAccess: false,
    data: { ...data, slug: randomUUID(), status: 'approved', internalNotes: 'staff only' },
  })
  for (const status of ['approved', 'rented'] as const) {
    await payload.update({
      collection: 'listings',
      id: listing.id,
      user: editor,
      overrideAccess: false,
      data: { status },
    })
    const visible = await payload.findByID({
      collection: 'listings',
      id: listing.id,
      user: null,
      overrideAccess: false,
    })
    for (const key of ['landlordName', 'landlordEmail', 'landlordPhone', 'internalNotes'])
      assert.ok(!(key in visible), `${key} leaked`)
  }
  await assert.rejects(
    payload.update({
      collection: 'listings',
      id: listing.id,
      user: null,
      overrideAccess: false,
      data: { title: 'unauthorized' },
    }),
  )
  await assert.rejects(
    payload.delete({ collection: 'listings', id: listing.id, user: editor, overrideAccess: false }),
  )
  const mcpReq = await createPayloadRequest({ payload, user: admin })
  mcpReq.payloadAPI = 'MCP'
  const draft = await payload.create({
    collection: 'listings',
    req: mcpReq,
    overrideAccess: false,
    data: { ...data, slug: randomUUID() },
  })
  await payload.update({
    collection: 'listings',
    id: draft.id,
    req: mcpReq,
    overrideAccess: false,
    data: { title: 'An honest updated title' },
  })
  for (const status of ['approved', 'rented'] as const) {
    await assert.rejects(
      payload.update({
        collection: 'listings',
        id: draft.id,
        req: mcpReq,
        overrideAccess: false,
        data: { status },
      }),
    )
    await assert.rejects(
      payload.create({
        collection: 'listings',
        req: mcpReq,
        overrideAccess: false,
        data: { ...data, slug: randomUUID(), status },
      }),
    )
    // Even development MCP overrideAccess cannot bypass collection hooks.
    await assert.rejects(
      payload.update({
        collection: 'listings',
        id: draft.id,
        req: mcpReq,
        overrideAccess: true,
        data: { status },
      }),
    )
  }
  await assert.rejects(
    payload.delete({ collection: 'listings', id: draft.id, req: mcpReq, overrideAccess: true }),
  )
  await payload.update({
    collection: 'listings',
    id: draft.id,
    user: admin,
    overrideAccess: false,
    data: { status: 'approved' },
  })
  // Agents must still be able to edit approved listings without changing their status.
  await payload.update({
    collection: 'listings',
    id: draft.id,
    req: mcpReq,
    overrideAccess: false,
    data: { title: 'Updated verified details' },
  })
  const keyUser = { ...admin, _strategy: 'api-key' }
  await assert.rejects(
    payload.update({
      collection: 'listings',
      id: draft.id,
      user: keyUser,
      overrideAccess: false,
      data: { status: 'rented' },
    }),
  )
  await assert.rejects(
    payload.delete({ collection: 'listings', id: draft.id, user: keyUser, overrideAccess: false }),
  )
  await payload.delete({
    collection: 'listings',
    id: listing.id,
    user: admin,
    overrideAccess: false,
  })
  console.log(
    'PASS: public submissions, spam rejection, privacy, role access, human approval, MCP create/edit and approval/deletion restrictions',
  )
} catch (error) {
  console.error(error)
  throw error
} finally {
  await payload.destroy()
}

import { randomUUID } from 'node:crypto'
import {
  APIError,
  type Access,
  type CollectionConfig,
  type FieldAccess,
  type PayloadRequest,
} from 'payload'
import { hasRole } from '../../access/roles'

const staff = (req: PayloadRequest) => hasRole(req.user, 'admin') || hasRole(req.user, 'editor')
const staffAccess: Access = ({ req }) => staff(req)
const staffField: FieldAccess = ({ req }) => staff(req)
// Payload sets payloadAPI itself in both HTTP and stdio MCP transports. API-key
// restrictions also prevent an agent bypassing MCP by calling REST directly.
const agent = (req: PayloadRequest) => req.payloadAPI === 'MCP' || req.user?._strategy === 'api-key'
const publicFields = [
  'title',
  'monthlyRent',
  'deposit',
  'availableFrom',
  'streetAddress',
  'city',
  'size',
  'rooms',
  'furnished',
  'petsAllowed',
  'description',
  'landlordName',
  'landlordEmail',
  'landlordPhone',
  'website',
]

export const Listings: CollectionConfig = {
  slug: 'listings',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'city', 'monthlyRent', 'status'],
    listSearchableFields: ['title', 'city', 'streetAddress'],
    group: 'Nestwell',
    description:
      'Review submissions and filter by status. Only approved and rented apartments are public.',
  },
  access: {
    create: () => true,
    read: ({ req }) => (staff(req) ? true : { status: { in: ['approved', 'rented'] } }),
    readVersions: staffAccess,
    update: staffAccess,
    delete: ({ req }) => hasRole(req.user, 'admin') && !agent(req),
  },
  llmInstructions: [
    'Nestwell apartment rentals. Write clear, honest titles and useful descriptions.',
    'Use only verified facts about rent, deposit, size, rooms, address, availability, furnishing and pets.',
    'Never invent amenities, photos, availability or prices; ask staff when information is missing.',
    'Keep landlord contact details and internal notes out of public titles and descriptions.',
    'Create pending listings. You may edit details, but only a human may approve a listing or mark it rented. Never delete listings.',
    'Monthly rent and deposit use the same currency; do not invent a currency.',
  ].join('\n'),
  hooks: {
    // Inspect the submitted fields before Payload merges unchanged document values.
    beforeOperation: [
      ({ args, operation, req }) => {
        if (
          (operation === 'create' || operation === 'update') &&
          'data' in args &&
          agent(req) &&
          ['approved', 'rented'].includes(String(args.data?.status))
        ) {
          throw new APIError('Only human staff can approve listings or mark them rented.', 403)
        }
        return args
      },
    ],
    beforeValidate: [
      ({ data, operation, req }) => {
        if (!data) return data
        if (operation === 'create' && !staff(req)) {
          const safe = Object.fromEntries(
            publicFields.filter((key) => key in data).map((key) => [key, data[key]]),
          )
          return {
            ...safe,
            status: 'pending',
            slug: `${String(safe.title || 'apartment')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
              .slice(0, 80)}-${randomUUID().slice(0, 8)}`,
          }
        }
        return data
      },
    ],
    beforeChange: [
      ({ data, originalDoc, req }) => {
        if (
          agent(req) &&
          ['approved', 'rented'].includes(data.status) &&
          data.status !== originalDoc?.status
        ) {
          throw new APIError('Only human staff can approve listings or mark them rented.', 403)
        }
        return data
      },
    ],
    beforeDelete: [
      ({ req }) => {
        if (agent(req)) throw new APIError('Agents cannot delete listings.', 403)
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 150 },
    { name: 'slug', type: 'slug', useAsSlug: 'title' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: ['pending', 'approved', 'rejected', 'rented'],
      admin: { position: 'sidebar' },
    },
    { name: 'monthlyRent', label: 'Monthly rent', type: 'number', required: true, min: 0 },
    { name: 'deposit', type: 'number', required: true, min: 0 },
    {
      name: 'availableFrom',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
    { name: 'streetAddress', type: 'text', required: true, maxLength: 250 },
    { name: 'city', type: 'text', required: true, index: true, maxLength: 100 },
    { name: 'size', label: 'Size (m²)', type: 'number', required: true, min: 1 },
    { name: 'rooms', type: 'number', required: true, min: 1 },
    { name: 'furnished', type: 'checkbox', defaultValue: false },
    { name: 'petsAllowed', type: 'checkbox', defaultValue: false },
    { name: 'description', type: 'richText', required: true },
    {
      name: 'photos',
      type: 'upload',
      filterOptions: { mimeType: { contains: 'image/' } },
      relationTo: 'media',
      hasMany: true,
      access: { create: staffField, update: staffField },
    },
    {
      name: 'landlordName',
      type: 'text',
      required: true,
      maxLength: 150,
      access: { read: staffField },
    },
    { name: 'landlordEmail', type: 'email', required: true, access: { read: staffField } },
    {
      name: 'landlordPhone',
      type: 'text',
      required: true,
      maxLength: 50,
      access: { read: staffField },
    },
    {
      name: 'internalNotes',
      type: 'textarea',
      access: { read: staffField, create: staffField, update: staffField },
    },
    {
      name: 'website',
      type: 'text',
      admin: { hidden: true },
      access: { read: () => false },
      validate: (value: string | null | undefined) =>
        value ? 'Your listing could not be submitted.' : true,
    },
  ],
  versions: false,
}

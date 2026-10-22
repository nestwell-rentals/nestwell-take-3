export const port = Number(process.env.PORT ?? '3000')
export const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`

// The e2e database runs in its own Docker Compose project and port, so it never touches
// your development database (or the Payload 3 template's e2e database on 54343).
export const composeProject = process.env.E2E_COMPOSE_PROJECT ?? 'payload4-e2e'
export const postgresPort = Number(process.env.E2E_POSTGRES_PORT ?? '54344')
export const postgresDb = process.env.E2E_POSTGRES_DB ?? 'payload_e2e'
export const postgresUser = process.env.E2E_POSTGRES_USER ?? 'postgres'
export const postgresPassword = process.env.E2E_POSTGRES_PASSWORD ?? 'postgres'

export const databaseURL =
  process.env.E2E_DATABASE_URL ??
  `postgres://${postgresUser}:${postgresPassword}@127.0.0.1:${postgresPort}/${postgresDb}`

// Uploads go to a private MinIO bucket, the same way a Railway deploy stores them in a
// Railway Bucket, so the e2e suite covers the storage setup production actually runs.
export const minioPort = Number(process.env.E2E_MINIO_PORT ?? '54345')
export const minioUser = 'payload'
export const minioPassword = 'payload-secret'
export const minioBucket = 'payload-e2e'

export const payloadSecret = process.env.PAYLOAD_SECRET ?? 'playwright-secret'

export const adminEmail = 'admin@example.com'
export const adminPassword = 'ChangeMe123!'
export const demoAuthorEmail = 'demo-author@example.com'
export const commentText = 'Playwright public comment awaiting approval.'

export const seededPosts = [
  { title: "What's New in Payload 4", slug: 'whats-new-in-payload-4' },
  { title: 'Getting Started with the Payload 4 Template', slug: 'getting-started-payload-4-template' },
  {
    title: 'Goodbye Google Drive: a self-hosted Drive and Docs replacement',
    slug: 'goodbye-google-drive-seafile-onlyoffice',
  },
  {
    title: 'I self-hosted my password manager for 3 months. Should you?',
    slug: 'self-hosted-password-manager-vaultwarden',
  },
  {
    title: 'My Own Suite: the open-source app launcher for your own private cloud',
    slug: 'my-own-suite-your-own-private-cloud',
  },
  {
    title: 'Launch a real online store in minutes, then let AI agents make it yours',
    slug: 'launch-online-store-medusa-railway',
  },
] as const

// Has no seeded comments, so the test controls everything shown on it
export const targetPost = seededPosts[0]
// Seeded with 2 approved comments and 1 pending comment
export const moderatedPost = seededPosts[4]
// The newest post, so it leads the home page and /posts
export const featuredPost = seededPosts[5]
export const moderatedPostApprovedComments = 2

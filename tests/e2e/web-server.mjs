import { execFileSync, spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const composeProject = process.env.E2E_COMPOSE_PROJECT ?? 'payload4-e2e'
const postgresPort = Number(process.env.E2E_POSTGRES_PORT ?? '54344')
// playwright.config.ts passes the app's S3 settings; MinIO is started to match them
const minioPort = Number(new URL(process.env.S3_ENDPOINT).port)

const env = {
  ...process.env,
  POSTGRES_DB: process.env.E2E_POSTGRES_DB ?? 'payload_e2e',
  POSTGRES_USER: process.env.E2E_POSTGRES_USER ?? 'postgres',
  POSTGRES_PASSWORD: process.env.E2E_POSTGRES_PASSWORD ?? 'postgres',
  POSTGRES_PORT: String(postgresPort),
  MINIO_PORT: String(minioPort),
  MINIO_ROOT_USER: process.env.S3_ACCESS_KEY_ID,
  MINIO_ROOT_PASSWORD: process.env.S3_SECRET_ACCESS_KEY,
  MINIO_BUCKET: process.env.S3_BUCKET,
}

const isWindows = process.platform === 'win32'
const compose = ['compose', '-p', composeProject]

function run(command, args) {
  const [file, fileArgs] = isWindows ? ['cmd.exe', ['/c', command, ...args]] : [command, args]
  execFileSync(file, fileArgs, { cwd: repoRoot, env, stdio: 'inherit' })
}

async function waitForPort(port, host = '127.0.0.1', timeoutMs = 60000) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const ready = await new Promise((resolve) => {
      const socket = net.createConnection({ host, port })
      socket.once('connect', () => {
        socket.end()
        resolve(true)
      })
      socket.once('error', () => {
        socket.destroy()
        resolve(false)
      })
    })

    if (ready) return
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error(`Timed out waiting for port ${host}:${port}`)
}

function stopServices() {
  try {
    run('docker', [...compose, 'down', '--volumes', '--remove-orphans'])
  } catch {
    // Best-effort cleanup for local test runs.
  }
}

async function main() {
  // Start from an empty database and bucket every run so seeding and onboarding are deterministic
  stopServices()
  run('docker', [...compose, 'up', '-d', '--wait', 'postgres', 'minio'])
  run('docker', [...compose, 'run', '--rm', 'minio-init'])
  await waitForPort(postgresPort)
  await waitForPort(minioPort)

  run('corepack', ['pnpm', 'deps:native'])
  run('corepack', ['pnpm', 'build'])

  // `pnpm start` runs the migrations first, exactly like the Railway deploy
  const [file, args] = isWindows
    ? ['cmd.exe', ['/c', 'corepack', 'pnpm', 'start']]
    : ['corepack', ['pnpm', 'start']]
  const app = spawn(file, args, { cwd: repoRoot, env, stdio: 'inherit' })

  const shutdown = (signal) => {
    app.kill(signal)
    stopServices()
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  app.on('exit', (code) => {
    stopServices()
    process.exit(code ?? 0)
  })
}

main().catch((error) => {
  console.error(error)
  stopServices()
  process.exit(1)
})

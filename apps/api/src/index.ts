// Load .env before anything else
import 'dotenv/config'
import { env } from './lib/env.js'
import { buildApp } from './app.js'

async function main() {
  const app = await buildApp()

  try {
    await app.listen({ port: env.PORT, host: env.HOST })
    app.log.info(`LastNite API running on http://${env.HOST}:${env.PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

void main()

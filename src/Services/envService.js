import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const localEnvPath = fileURLToPath(new URL('../../.env', import.meta.url))

export function loadLocalEnv() {
  if (!existsSync(localEnvPath)) return

  const entries = readFileSync(localEnvPath, 'utf8').split(/\r?\n/)

  for (const entry of entries) {
    const line = entry.trim()

    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, '')

    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

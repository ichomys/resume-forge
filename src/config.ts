import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'
import { z } from 'zod'
import writeFileAtomic from 'write-file-atomic'
import { ResumeForgeError } from './errors.js'

// ── Path constants ────────────────────────────────────────────────────────────

export const CONFIG_DIR = path.join(os.homedir(), '.resume-forge')
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config', 'settings.json')

// ── Schema ────────────────────────────────────────────────────────────────────

export const ConfigSchema = z.object({
  version: z.literal(1),
  apiKeyEnvVar: z.string().default('ANTHROPIC_API_KEY'),
  model: z.string().default('claude-sonnet-4-5'),
  outputDir: z.string().default('~/resume-forge-output'),
  templatePath: z
    .string()
    .default('~/.resume-forge/templates/default/resume.html'),
  theme: z.enum(['amber', 'slate-blue', 'forest', 'charcoal']).default('amber'),
})

export type Config = z.infer<typeof ConfigSchema>

// ── Defaults ──────────────────────────────────────────────────────────────────

export function getDefaultConfig(): Config {
  return ConfigSchema.parse({ version: 1 })
}

// ── Path utilities ────────────────────────────────────────────────────────────

/** Expand leading ~/ to the OS home directory. Absolute paths pass through. */
export function expandPath(p: string): string {
  if (p === '~') {
    return os.homedir()
  }
  if (p.startsWith('~/')) {
    return path.join(os.homedir(), p.slice(2))
  }
  return p
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Create ~/.resume-forge/ with user-only permissions if it does not exist. */
async function ensureDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
  await fs.mkdir(path.join(CONFIG_DIR, 'config'), { recursive: true })
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read and validate the config file. Returns default config if file absent.
 * Throws ResumeForgeError on schema violation.
 */
export async function readConfig(): Promise<Config> {
  await ensureDir()

  let raw: string
  try {
    raw = await fs.readFile(CONFIG_FILE, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return getDefaultConfig()
    }
    throw err
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ResumeForgeError(
      'CONFIG_INVALID',
      'settings.json is not valid JSON. Delete it and re-run resume-forge init.',
    )
  }

  const result = ConfigSchema.safeParse(parsed)
  if (!result.success) {
    throw new ResumeForgeError(
      'CONFIG_INVALID',
      `Config schema validation failed: ${result.error.message}`,
    )
  }
  return result.data
}

/**
 * Write config atomically. Creates config directory if needed.
 * Never call fs.writeFile directly on config — always use this function.
 */
export async function writeConfig(config: Config): Promise<void> {
  await ensureDir()
  await writeFileAtomic(CONFIG_FILE, JSON.stringify(config, null, 2))
}

/**
 * Migrate raw config data to the current schema version.
 * Used when reading configs written by older tool versions.
 */
export function migrateConfig(raw: unknown): Config {
  const obj = (raw ?? {}) as Record<string, unknown>

  // Version 1 is the only version — apply defaults for any missing fields.
  // Future versions: add `if (obj.version === 2)` migration steps here.
  const merged = { ...obj, version: 1 }

  const result = ConfigSchema.safeParse(merged)
  if (!result.success) {
    throw new ResumeForgeError(
      'CONFIG_INVALID',
      `Cannot migrate config: ${result.error.message}`,
    )
  }
  return result.data
}

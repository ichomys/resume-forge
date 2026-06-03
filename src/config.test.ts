import * as os from 'os'
import * as path from 'path'
import * as realFs from 'fs/promises'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Redirect homedir to a temp dir so tests never touch the real ~/.resume-forge.
// vi.mock and vi.hoisted are both hoisted above the config.js import below, so
// CONFIG_DIR/CONFIG_FILE (computed at module load) resolve under tmpHome.
const { tmpHome } = vi.hoisted(() => {
  const osMod = require('os') as typeof import('os')
  const pathMod = require('path') as typeof import('path')
  return {
    tmpHome: pathMod.join(osMod.tmpdir(), `resume-forge-test-${Date.now()}`),
  }
})

vi.mock('os', async (importOriginal) => {
  const original = await importOriginal<typeof os>()
  return { ...original, homedir: () => tmpHome, default: { ...original, homedir: () => tmpHome } }
})

import {
  readConfig,
  writeConfig,
  getDefaultConfig,
  migrateConfig,
  expandPath,
} from './config.js'
import { ResumeForgeError } from './errors.js'

const settingsFile = path.join(tmpHome, '.resume-forge', 'config', 'settings.json')

describe('config', () => {
  beforeEach(async () => {
    await realFs.rm(tmpHome, { recursive: true, force: true })
  })

  afterEach(async () => {
    await realFs.rm(tmpHome, { recursive: true, force: true })
  })

  it('readConfig returns default when settings.json absent', async () => {
    const config = await readConfig()
    expect(config.version).toBe(1)
    expect(config.model).toBe('claude-sonnet-4-5')
    expect(config.theme).toBe('amber')
    expect(config.apiKeyEnvVar).toBe('ANTHROPIC_API_KEY')
    expect(config.outputDir).toBe('~/resume-forge-output')
  })

  it('readConfig parses a valid existing config', async () => {
    await realFs.mkdir(path.dirname(settingsFile), { recursive: true })
    await realFs.writeFile(
      settingsFile,
      JSON.stringify({ version: 1, model: 'claude-opus-4-5', theme: 'forest' }),
    )
    const config = await readConfig()
    expect(config.model).toBe('claude-opus-4-5')
    expect(config.theme).toBe('forest')
  })

  it('readConfig throws ResumeForgeError on invalid schema', async () => {
    await realFs.mkdir(path.dirname(settingsFile), { recursive: true })
    await realFs.writeFile(
      settingsFile,
      JSON.stringify({ version: 1, theme: 'invalid-theme' }),
    )
    await expect(readConfig()).rejects.toThrow(ResumeForgeError)
  })

  it('readConfig throws ResumeForgeError on malformed JSON', async () => {
    await realFs.mkdir(path.dirname(settingsFile), { recursive: true })
    await realFs.writeFile(settingsFile, '{ not valid json')
    await expect(readConfig()).rejects.toThrow(ResumeForgeError)
  })

  it('writeConfig writes atomically and readConfig reads it back', async () => {
    const updated = { ...getDefaultConfig(), model: 'claude-opus-4-5' as const }
    await writeConfig(updated)
    const read = await readConfig()
    expect(read.model).toBe('claude-opus-4-5')
    // Confirm a real file landed on disk (write-file-atomic path)
    const onDisk = JSON.parse(await realFs.readFile(settingsFile, 'utf-8'))
    expect(onDisk.model).toBe('claude-opus-4-5')
  })

  it('migrateConfig passes a v1 config through, applying defaults', () => {
    const partial = { version: 1, model: 'claude-opus-4-5' }
    const migrated = migrateConfig(partial)
    expect(migrated.theme).toBe('amber') // default applied
    expect(migrated.model).toBe('claude-opus-4-5') // provided value kept
  })

  it('expandPath expands ~/ to homedir', () => {
    const expanded = expandPath('~/my-output')
    expect(expanded).toContain('my-output')
    expect(expanded).not.toContain('~')
    expect(expanded.startsWith(tmpHome)).toBe(true)
  })

  it('expandPath passes absolute paths through unchanged', () => {
    const abs = path.join(path.sep, 'absolute', 'path')
    expect(expandPath(abs)).toBe(abs)
  })
})

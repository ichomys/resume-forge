import * as os from 'os'
import * as path from 'path'
import * as realFs from 'fs/promises'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'

// Redirect homedir to a temp dir so init never touches the real ~/.resume-forge.
const { tmpHome } = vi.hoisted(() => {
  const osMod = require('os') as typeof import('os')
  const pathMod = require('path') as typeof import('path')
  return {
    tmpHome: pathMod.join(osMod.tmpdir(), `resume-forge-init-test-${Date.now()}`),
  }
})

vi.mock('os', async (importOriginal) => {
  const original = await importOriginal<typeof os>()
  return {
    ...original,
    homedir: () => tmpHome,
    default: { ...original, homedir: () => tmpHome },
  }
})

// Profile loaders are mocked — we only care whether they're called.
vi.mock('../profile/index.js', () => ({
  load: vi.fn().mockResolvedValue(undefined),
  loadBaseResume: vi.fn().mockResolvedValue(undefined),
  updateContact: vi.fn().mockResolvedValue(undefined),
}))

// Anthropic client — messages.create resolves so Step 3 passes immediately.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: vi.fn().mockResolvedValue({}) }
  },
}))

vi.mock('../display.js', () => ({
  status:  vi.fn(),
  error:   vi.fn(),
  success: vi.fn(),
  spinner: () => ({ succeed: vi.fn(), fail: vi.fn() }),
}))

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
}))

import { initAction } from './init.js'
import { load } from '../profile/index.js'
import * as display from '../display.js'
import { input } from '@inquirer/prompts'

const configDir   = path.join(tmpHome, '.resume-forge')
const dataDir     = path.join(configDir, 'data')
const profileDir  = path.join(configDir, 'profile')
const profilePath = path.join(profileDir, 'linkedin-export.json')
const settingsPath = path.join(configDir, 'config', 'settings.json')

// Default answers per prompt; tests override `linkedinResponse` as needed.
let linkedinResponse = '/tmp/linkedin.json'

function wireInput() {
  ;(input as Mock).mockImplementation(async (opts: { message: string }) => {
    if (/LinkedIn/i.test(opts.message)) return linkedinResponse
    return '' // base resume (skip), API key (Enter), output dir (default)
  })
}

describe('init data preservation (Story 4.3)', () => {
  beforeEach(async () => {
    await realFs.rm(tmpHome, { recursive: true, force: true })
    vi.clearAllMocks()
    linkedinResponse = '/tmp/linkedin.json'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    wireInput()
  })

  afterEach(async () => {
    await realFs.rm(tmpHome, { recursive: true, force: true })
    delete process.env.ANTHROPIC_API_KEY
  })

  async function seedExistingInstall(): Promise<void> {
    await realFs.mkdir(dataDir, { recursive: true })
    await realFs.mkdir(profileDir, { recursive: true })
  }

  it('first run does NOT show "Updating config" preservation message', async () => {
    // No ~/.resume-forge/ exists yet.
    await initAction()
    expect(display.status).not.toHaveBeenCalledWith('Updating config · Answer store preserved')
  })

  it('re-run shows "Updating config · Answer store preserved"', async () => {
    await seedExistingInstall()
    await initAction()
    expect(display.status).toHaveBeenCalledWith('Updating config · Answer store preserved')
  })

  it('does not modify answer-store.json during init', async () => {
    await seedExistingInstall()
    const storeFile = path.join(dataDir, 'answer-store.json')
    const original = JSON.stringify({ version: 1, entries: { foo: { answer: 'bar' } } })
    await realFs.writeFile(storeFile, original)

    await initAction()

    const after = await realFs.readFile(storeFile, 'utf-8')
    expect(after).toBe(original)
  })

  it('does not modify run-history.jsonl during init', async () => {
    await seedExistingInstall()
    const historyFile = path.join(dataDir, 'run-history.jsonl')
    const original = '{"role":"Engineer","date":"2026-05-29","alignmentScore":80,"outputPath":"/x.html","timestamp":"2026-05-29T00:00:00.000Z"}\n'
    await realFs.writeFile(historyFile, original)

    await initAction()

    const after = await realFs.readFile(historyFile, 'utf-8')
    expect(after).toBe(original)
  })

  it('re-run with empty Step 1 input keeps the existing profile (load NOT called)', async () => {
    await seedExistingInstall()
    await realFs.writeFile(profilePath, JSON.stringify({ entries: [], skills: [], education: [] }))
    linkedinResponse = '' // press Enter to keep existing

    await initAction()

    expect(load).not.toHaveBeenCalled()
    expect(display.status).toHaveBeenCalledWith('Keeping existing LinkedIn profile')
  })

  it('re-run with non-empty Step 1 input loads the provided path', async () => {
    await seedExistingInstall()
    await realFs.writeFile(profilePath, JSON.stringify({ entries: [], skills: [], education: [] }))
    linkedinResponse = '/tmp/new-linkedin.json'

    await initAction()

    expect(load).toHaveBeenCalledWith('/tmp/new-linkedin.json')
  })

  it('Step 4 with empty input writes the default outputDir', async () => {
    await initAction()
    const settings = JSON.parse(await realFs.readFile(settingsPath, 'utf-8'))
    expect(settings.outputDir).toBe('~/resume-forge-output')
  })
})

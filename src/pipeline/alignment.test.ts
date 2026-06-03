import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { AlignmentResult, ExperiencePool } from '../types.js'

const analyzeAlignmentMock = vi.fn()

vi.mock('../llm/index.js', () => ({
  createAdapter: () => ({ analyzeAlignment: analyzeAlignmentMock }),
}))

vi.mock('../config.js', () => ({
  readConfig: async () => ({
    model: 'claude-test',
    apiKeyEnvVar: 'X',
    outputDir: '~/out',
    templatePath: '~/t.html',
    theme: 'amber',
  }),
}))

const pool: ExperiencePool = { entries: [], skills: [], education: [] }
vi.mock('../profile/index.js', () => ({
  getExperiencePool: async () => pool,
}))

// Spinner is a no-op with succeed/fail.
vi.mock('../display.js', () => ({
  spinner: () => ({ succeed: vi.fn(), fail: vi.fn() }),
  status: vi.fn(),
  error: vi.fn(),
  prompt: vi.fn(),
  success: vi.fn(),
}))

import { runAlignment, renderAlignmentReport } from './alignment.js'

describe('alignment', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  const handlers: Record<string, (key: string) => void> = {}

  beforeEach(() => {
    analyzeAlignmentMock.mockReset()
    for (const k of Object.keys(handlers)) delete handlers[k]
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    // Stub raw-mode stdin so readMenuKey works headlessly.
    const stdin = process.stdin as unknown as Record<string, unknown>
    stdin.setRawMode = vi.fn()
    stdin.resume = vi.fn()
    stdin.pause = vi.fn()
    stdin.setEncoding = vi.fn()
    stdin.on = vi.fn((ev: string, h: (key: string) => void) => {
      handlers[ev] = h
      return process.stdin
    })
    stdin.removeListener = vi.fn(() => process.stdin)
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('renders (none) for empty gaps and noMatch at high score', () => {
    const result: AlignmentResult = {
      score: 92,
      aligned: ['TypeScript', 'Node.js'],
      gaps: [],
      noMatch: [],
      gapKeys: [],
    }
    renderAlignmentReport(result)
    const output = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n')
    expect(output).toContain('92%')
    expect(output).toContain('✦ Gaps:     (none)')
    expect(output).toContain('✗ No match: (none)')
  })

  it('stores AlignmentResult in the returned session on Generate', async () => {
    const result: AlignmentResult = {
      score: 85,
      aligned: ['React'],
      gaps: [],
      noMatch: [],
      gapKeys: [],
    }
    analyzeAlignmentMock.mockResolvedValue(result)

    const session = { jdText: 'a job', jdConfirmed: true, resolvedGaps: {} }
    const promise = runAlignment(session)

    await vi.waitFor(() => expect(handlers.data).toBeDefined())
    handlers.data('g')

    const outcome = await promise
    expect(outcome.action).toBe('generate')
    expect(outcome.session.alignment).toEqual(result)
    // Immutability — original session untouched.
    expect(session).not.toHaveProperty('alignment')
  })
})

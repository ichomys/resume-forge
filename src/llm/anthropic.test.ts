import { describe, it, expect, beforeEach, vi } from 'vitest'

// Controllable mock for the Anthropic SDK message call.
const createMock = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: createMock }
    constructor(_opts: unknown) {
      void _opts
    }
  }
  return { default: MockAnthropic }
})

// Silence display output.
vi.mock('../display.js', () => ({
  error: vi.fn(),
  prompt: vi.fn(),
  status: vi.fn(),
  success: vi.fn(),
  spinner: vi.fn(),
}))

import { AnthropicAdapter } from './anthropic.js'
import * as display from '../display.js'
import type { ExperiencePool } from '../types.js'

const pool: ExperiencePool = { entries: [], skills: [], education: [] }
const ENV_VAR = 'TEST_RESUME_FORGE_KEY'

function makeAdapter(): AnthropicAdapter {
  process.env[ENV_VAR] = 'sk-test-key'
  return new AnthropicAdapter({ model: 'claude-test', apiKeyEnvVar: ENV_VAR })
}

describe('AnthropicAdapter', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    createMock.mockReset()
    vi.mocked(display.error).mockClear()
    // process.exit must abort control flow in tests — throw a sentinel.
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`)
    }) as never)
  })

  it('exits with code 2 on a 429 rate-limit error', async () => {
    const adapter = makeAdapter()
    createMock.mockRejectedValue({ status: 429, message: 'rate limited' })

    await expect(adapter.analyzeAlignment('jd', pool)).rejects.toThrow('process.exit:2')
    expect(exitSpy).toHaveBeenCalledWith(2)
    expect(display.error).toHaveBeenCalledWith(
      'Rate limit reached.',
      'Wait a moment and try again.',
    )
  })

  it('exits with code 2 on a network/timeout error', async () => {
    const adapter = makeAdapter()
    createMock.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(adapter.analyzeAlignment('jd', pool)).rejects.toThrow('process.exit:2')
    expect(exitSpy).toHaveBeenCalledWith(2)
    expect(display.error).toHaveBeenCalledWith(
      'API unavailable.',
      'Check your connection and retry.',
    )
  })

  it('parses a valid JSON alignment response', async () => {
    const adapter = makeAdapter()
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"score":72,"aligned":["TS"],"gaps":[],"noMatch":[],"gapKeys":[]}',
        },
      ],
    })

    const result = await adapter.analyzeAlignment('jd', pool)
    expect(result.score).toBe(72)
    expect(result.aligned).toEqual(['TS'])
  })

  it('strips markdown code fences before parsing JSON', async () => {
    const adapter = makeAdapter()
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '```json\n{"score":50,"aligned":[],"gaps":[],"noMatch":[],"gapKeys":[]}\n```',
        },
      ],
    })

    const result = await adapter.analyzeAlignment('jd', pool)
    expect(result.score).toBe(50)
  })
})

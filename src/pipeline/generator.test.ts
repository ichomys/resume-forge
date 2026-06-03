import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AlignmentResult, ExperiencePool, ResumeContent } from '../types.js'

const generateResumeMock = vi.fn()

vi.mock('../llm/index.js', () => ({
  createAdapter: () => ({ generateResume: generateResumeMock }),
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

vi.mock('../display.js', () => ({
  spinner: () => ({ succeed: vi.fn(), fail: vi.fn() }),
  status: vi.fn(),
  error: vi.fn(),
  prompt: vi.fn(),
  success: vi.fn(),
}))

import { generateContent, extractRoleInfo } from './generator.js'
import * as display from '../display.js'

const alignment: AlignmentResult = {
  score: 80,
  aligned: ['TS'],
  gaps: [],
  noMatch: [],
  gapKeys: [],
}

const sampleContent: ResumeContent = {
  name: 'Jane Doe',
  subtitle: 'Senior Engineer',
  contact: { email: 'jane@example.com' },
  experience: [],
  skills: ['TS'],
  education: [],
}

describe('generator', () => {
  beforeEach(() => {
    generateResumeMock.mockReset()
    vi.mocked(display.error).mockClear()
  })

  it('sets generatedContent immutably on the returned session', async () => {
    generateResumeMock.mockResolvedValue(sampleContent)
    const session = { jdText: 'jd', jdConfirmed: true, resolvedGaps: {}, alignment }

    const result = await generateContent(session)

    expect(result.generatedContent).toEqual(sampleContent)
    // Original session untouched.
    expect(session).not.toHaveProperty('generatedContent')
  })

  it('displays an error and re-throws when generation fails; session unchanged', async () => {
    generateResumeMock.mockRejectedValue(new Error('boom'))
    const session = { jdText: 'jd', jdConfirmed: true, resolvedGaps: {}, alignment }

    await expect(generateContent(session)).rejects.toThrow('boom')
    expect(display.error).toHaveBeenCalledWith(
      'Generation failed. boom',
      'Check your API key or retry.',
    )
    expect(session).not.toHaveProperty('generatedContent')
  })

  it('extractRoleInfo parses an explicit "Role:" line', () => {
    const { role } = extractRoleInfo('Role: Backend Developer\nAt Acme')
    expect(role).toBe('Backend Developer')
  })
})

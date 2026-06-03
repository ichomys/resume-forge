import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AlignmentResult, ExperiencePool } from '../types.js'

// ── Mock LLM adapter ──────────────────────────────────────────────────────────
const generateGapQuestionMock = vi.fn()
const analyzeAlignmentMock = vi.fn()

vi.mock('../llm/index.js', () => ({
  createAdapter: () => ({
    generateGapQuestion: generateGapQuestionMock,
    analyzeAlignment: analyzeAlignmentMock,
  }),
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
  spinner:  () => ({ succeed: vi.fn(), fail: vi.fn() }),
  prompt:   vi.fn(),
  status:   vi.fn(),
  error:    vi.fn(),
  success:  vi.fn(),
}))

vi.mock('../store/index.js', () => ({
  write:  vi.fn(),
  get:    vi.fn().mockResolvedValue(undefined), // default: no stored answer
  update: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
}))

// Stub alignment report rendering (uses console.log)
vi.mock('./alignment.js', () => ({
  renderAlignmentReport: vi.fn(),
}))

import { runGapLoop } from './gap-loop.js'
import { input } from '@inquirer/prompts'
import { write as storeWrite, get as storeGet, update as storeUpdate } from '../store/index.js'
import type { Mock } from 'vitest'

// ── stdin stub helpers ────────────────────────────────────────────────────────
let stdinHandlers: Record<string, (key: string) => void> = {}

function stubStdin() {
  const stdin = process.stdin as unknown as Record<string, unknown>
  stdin.setRawMode  = vi.fn()
  stdin.resume      = vi.fn()
  stdin.pause       = vi.fn()
  stdin.setEncoding = vi.fn()
  stdin.on = vi.fn((ev: string, h: (key: string) => void) => {
    stdinHandlers[ev] = h
    return process.stdin
  })
  stdin.removeListener = vi.fn(() => process.stdin)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('runGapLoop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stdinHandlers = {}
    stubStdin()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  const baseResult: AlignmentResult = {
    score: 65,
    aligned: ['TypeScript'],
    gaps: ['Kubernetes orchestration', 'Terraform'],
    noMatch: [],
    gapKeys: ['kubernetes-orchestration', 'terraform'],
  }

  const session = {
    jdText: 'Senior DevOps Engineer',
    jdConfirmed: true,
    alignment: baseResult,
    resolvedGaps: {},
  }

  it('returns session immediately when no gaps exist', async () => {
    const noGapSession = {
      ...session,
      alignment: { ...baseResult, gaps: [], gapKeys: [] },
    }
    const result = await runGapLoop(noGapSession)
    expect(result.resolvedGaps).toEqual({})
    expect(generateGapQuestionMock).not.toHaveBeenCalled()
  })

  it('calls generateGapQuestion for each unresolved gap', async () => {
    generateGapQuestionMock.mockResolvedValue('Tell me about your Kubernetes experience?')
    ;(input as ReturnType<typeof vi.fn>).mockResolvedValue('I deployed 3-node clusters')

    const updatedResult: AlignmentResult = { ...baseResult, score: 80, gaps: [], gapKeys: [], noMatch: [] }
    analyzeAlignmentMock.mockResolvedValue(updatedResult)

    const promise = runGapLoop(session)
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('g')

    await promise
    expect(generateGapQuestionMock).toHaveBeenCalledTimes(2)
    expect(generateGapQuestionMock).toHaveBeenCalledWith(
      'kubernetes-orchestration',
      'Kubernetes orchestration',
      pool,
    )
  })

  it('collects answers into resolvedGaps', async () => {
    generateGapQuestionMock.mockResolvedValue('What is your Kubernetes experience?')
    ;(input as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('Managed k8s clusters')
      .mockResolvedValueOnce('Used Terraform at Acme')

    const updatedResult: AlignmentResult = { ...baseResult, score: 85, gaps: [], gapKeys: [], noMatch: [] }
    analyzeAlignmentMock.mockResolvedValue(updatedResult)

    const promise = runGapLoop(session)
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('g')

    const result = await promise
    expect(result.resolvedGaps['kubernetes-orchestration']).toBe('Managed k8s clusters')
    expect(result.resolvedGaps['terraform']).toBe('Used Terraform at Acme')
  })

  it('skips already-resolved gaps in subsequent rounds', async () => {
    const partialSession = {
      ...session,
      resolvedGaps: { 'kubernetes-orchestration': 'already answered' },
    }

    generateGapQuestionMock.mockResolvedValue('Tell me about Terraform?')
    ;(input as ReturnType<typeof vi.fn>).mockResolvedValue('Used Terraform at Acme')

    const updatedResult: AlignmentResult = { ...baseResult, score: 80, gaps: [], gapKeys: [], noMatch: [] }
    analyzeAlignmentMock.mockResolvedValue(updatedResult)

    const promise = runGapLoop(partialSession)
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('g')

    await promise
    // Only 1 gap was unresolved — should only generate 1 question
    expect(generateGapQuestionMock).toHaveBeenCalledTimes(1)
    expect(generateGapQuestionMock).toHaveBeenCalledWith('terraform', 'Terraform', pool)
  })

  it('writes answers to the store', async () => {
    generateGapQuestionMock.mockResolvedValue('What is your Kubernetes experience?')
    ;(input as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('Managed k8s clusters')
      .mockResolvedValueOnce('Used Terraform')

    const updatedResult: AlignmentResult = { ...baseResult, score: 85, gaps: [], gapKeys: [], noMatch: [] }
    analyzeAlignmentMock.mockResolvedValue(updatedResult)

    const promise = runGapLoop(session)
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('g')

    await promise
    expect(storeWrite).toHaveBeenCalledWith('kubernetes-orchestration', {
      question: 'What is your Kubernetes experience?',
      answer: 'Managed k8s clusters',
    })
  })

  it('recalculates alignment after the round and returns updated alignment', async () => {
    generateGapQuestionMock.mockResolvedValue('Question?')
    ;(input as ReturnType<typeof vi.fn>).mockResolvedValue('My answer')

    const updatedResult: AlignmentResult = {
      ...baseResult,
      score: 88,
      gaps: [],
      gapKeys: [],
      noMatch: [],
    }
    analyzeAlignmentMock.mockResolvedValue(updatedResult)

    const promise = runGapLoop(session)
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('g')

    const result = await promise
    expect(analyzeAlignmentMock).toHaveBeenCalledTimes(1)
    expect(result.alignment?.score).toBe(88)
  })

  // ── Story 4.1: stored-answer pre-fill paths ─────────────────────────────────

  const oneGapResult: AlignmentResult = {
    score: 65,
    aligned: ['TypeScript'],
    gaps: ['Kubernetes orchestration'],
    noMatch: [],
    gapKeys: ['kubernetes-orchestration'],
  }
  const oneGapSession = {
    jdText: 'Senior DevOps Engineer',
    jdConfirmed: true,
    alignment: oneGapResult,
    resolvedGaps: {},
  }
  const resolvedAlignment: AlignmentResult = {
    ...oneGapResult,
    score: 90,
    gaps: [],
    gapKeys: [],
    noMatch: [],
  }

  it('stored answer + Enter confirms and applies the stored answer', async () => {
    ;(storeGet as Mock).mockResolvedValue({
      question: 'Old question?',
      answer: 'My stored answer',
      createdAt: '2026-05-01T00:00:00.000Z',
      usageCount: 2,
    })
    analyzeAlignmentMock.mockResolvedValue(resolvedAlignment)

    const promise = runGapLoop(oneGapSession)
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('\r') // confirm
    delete stdinHandlers['data']
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('g') // generate

    const result = await promise
    expect(storeUpdate).toHaveBeenCalledWith('kubernetes-orchestration', 'My stored answer')
    expect(result.resolvedGaps['kubernetes-orchestration']).toBe('My stored answer')
    expect(generateGapQuestionMock).not.toHaveBeenCalled()
  })

  it('stored answer + E edits and uses the new answer', async () => {
    ;(storeGet as Mock).mockResolvedValue({
      question: 'Old question?',
      answer: 'My stored answer',
      createdAt: '2026-05-01T00:00:00.000Z',
      usageCount: 2,
    })
    ;(input as ReturnType<typeof vi.fn>).mockResolvedValue('A freshly edited answer')
    analyzeAlignmentMock.mockResolvedValue(resolvedAlignment)

    const promise = runGapLoop(oneGapSession)
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('e') // edit
    delete stdinHandlers['data']
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('g')

    const result = await promise
    expect(storeUpdate).toHaveBeenCalledWith('kubernetes-orchestration', 'A freshly edited answer')
    expect(result.resolvedGaps['kubernetes-orchestration']).toBe('A freshly edited answer')
    expect(generateGapQuestionMock).not.toHaveBeenCalled()
  })

  it('stored answer + S skips, leaving the gap unresolved and the store unchanged', async () => {
    ;(storeGet as Mock).mockResolvedValue({
      question: 'Old question?',
      answer: 'My stored answer',
      createdAt: '2026-05-01T00:00:00.000Z',
      usageCount: 2,
    })
    analyzeAlignmentMock.mockResolvedValue(resolvedAlignment)

    const promise = runGapLoop(oneGapSession)
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('s') // skip
    delete stdinHandlers['data']
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('g')

    const result = await promise
    expect(storeUpdate).not.toHaveBeenCalled()
    expect(generateGapQuestionMock).not.toHaveBeenCalled()
    expect(result.resolvedGaps['kubernetes-orchestration']).toBeUndefined()
  })

  it('no stored answer falls through to generateGapQuestion (regression guard)', async () => {
    ;(storeGet as Mock).mockResolvedValue(undefined)
    generateGapQuestionMock.mockResolvedValue('What is your Kubernetes experience?')
    ;(input as ReturnType<typeof vi.fn>).mockResolvedValue('Managed k8s clusters')
    analyzeAlignmentMock.mockResolvedValue(resolvedAlignment)

    const promise = runGapLoop(oneGapSession)
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('g')

    await promise
    expect(generateGapQuestionMock).toHaveBeenCalledWith(
      'kubernetes-orchestration',
      'Kubernetes orchestration',
      pool,
    )
    expect(storeUpdate).not.toHaveBeenCalled()
  })

  it('exits with code 1 when user presses X', async () => {
    generateGapQuestionMock.mockResolvedValue('Question?')
    ;(input as ReturnType<typeof vi.fn>).mockResolvedValue('My answer')

    const updatedResult: AlignmentResult = { ...baseResult, score: 70, gaps: [], gapKeys: [], noMatch: [] }
    analyzeAlignmentMock.mockResolvedValue(updatedResult)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    const promise = runGapLoop(session)
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('x')

    await expect(promise).rejects.toThrow('exit')
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })
})

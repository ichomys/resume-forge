import * as os from 'os'
import * as path from 'path'
import * as realFs from 'fs/promises'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { tmpHome } = vi.hoisted(() => {
  const osMod = require('os') as typeof import('os')
  const pathMod = require('path') as typeof import('path')
  return {
    tmpHome: pathMod.join(osMod.tmpdir(), `resume-forge-store-test-${Date.now()}`),
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

vi.mock('../display.js', () => ({
  status: vi.fn(),
  error:  vi.fn(),
  success: vi.fn(),
  prompt: vi.fn(),
}))

import { read, write, get, update, remove, clearAll, normalizeKey, fuzzyMatch } from './index.js'

const storeFile = path.join(tmpHome, '.resume-forge', 'data', 'answer-store.json')

describe('store', () => {
  beforeEach(async () => {
    await realFs.rm(tmpHome, { recursive: true, force: true })
  })

  afterEach(async () => {
    await realFs.rm(tmpHome, { recursive: true, force: true })
  })

  it('read returns empty store when file is absent', async () => {
    const store = await read()
    expect(store).toEqual({ version: 1, entries: {} })
  })

  it('write creates an entry with correct fields', async () => {
    await write('container-orchestration', {
      question: 'Tell me about Kubernetes?',
      answer:   'I managed 3-node clusters at Acme.',
    })
    const raw = await realFs.readFile(storeFile, 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.version).toBe(1)
    const entry = parsed.entries['container-orchestration']
    expect(entry.question).toBe('Tell me about Kubernetes?')
    expect(entry.answer).toBe('I managed 3-node clusters at Acme.')
    expect(entry.usageCount).toBe(1)
    expect(entry.createdAt).toBeTruthy()
    expect(entry.lastUsed).toBeUndefined()
  })

  it('write increments usageCount and updates lastUsed on second write', async () => {
    await write('ml-experience', { question: 'ML exp?', answer: 'first answer' })
    await write('ml-experience', { question: 'ML exp?', answer: 'second answer' })
    const store = await read()
    const entry = store.entries['ml-experience']
    expect(entry.usageCount).toBe(2)
    expect(entry.answer).toBe('second answer')
    expect(entry.lastUsed).toBeTruthy()
  })

  it('get returns undefined for unknown key', async () => {
    const result = await get('nonexistent-key')
    expect(result).toBeUndefined()
  })

  it('get returns the entry for a written key', async () => {
    await write('cloud-experience', { question: 'Cloud?', answer: 'AWS at scale' })
    const entry = await get('cloud-experience')
    expect(entry?.answer).toBe('AWS at scale')
  })

  it('normalizeKey produces valid kebab-case keys', () => {
    expect(normalizeKey('Container Orchestration')).toBe('container-orchestration')
    expect(normalizeKey('ML/AI experience')).toBe('ml-ai-experience')
    expect(normalizeKey('  leading spaces  ')).toBe('leading-spaces')
    expect(normalizeKey('kubernetes--double')).toBe('kubernetes-double')
  })

  it('update replaces the answer and increments usageCount', async () => {
    await write('rust-experience', { question: 'Rust?', answer: 'none' })
    await update('rust-experience', 'Built a CLI in Rust')
    const entry = await get('rust-experience')
    expect(entry?.answer).toBe('Built a CLI in Rust')
    expect(entry?.usageCount).toBe(2)
  })

  it('remove deletes a single entry leaving others intact', async () => {
    await write('topic-a', { question: 'Q A', answer: 'Answer A' })
    await write('topic-b', { question: 'Q B', answer: 'Answer B' })
    await remove('topic-a')
    const store = await read()
    expect(store.entries['topic-a']).toBeUndefined()
    expect(store.entries['topic-b']?.answer).toBe('Answer B')
  })

  it('clearAll writes an empty store', async () => {
    await write('some-topic', { question: 'Q', answer: 'A' })
    await clearAll()
    const store = await read()
    expect(store.entries).toEqual({})
  })

  describe('fuzzy key matching', () => {
    it('fuzzyMatch returns undefined when no candidates share words', () => {
      expect(fuzzyMatch('kubernetes-experience', ['python-scripting', 'aws-networking'])).toBeUndefined()
    })

    it('fuzzyMatch returns best overlap candidate above threshold', () => {
      const candidates = ['container-orchestration', 'python-scripting', 'ml-ai-experience']
      // "kubernetes-orchestration" shares "orchestration" with "container-orchestration"
      expect(fuzzyMatch('kubernetes-orchestration', candidates)).toBe('container-orchestration')
    })

    it('fuzzyMatch exact key returns that key', () => {
      const candidates = ['container-orchestration', 'cloud-experience']
      expect(fuzzyMatch('container-orchestration', candidates)).toBe('container-orchestration')
    })

    it('get falls back to fuzzy match when exact key is absent', async () => {
      await write('container-orchestration', { question: 'Kubernetes?', answer: 'Managed k8s clusters' })
      // LLM produces a different key next run for the same gap
      const entry = await get('kubernetes-orchestration')
      expect(entry?.answer).toBe('Managed k8s clusters')
    })

    it('get returns undefined when fuzzy match falls below threshold', async () => {
      await write('python-scripting', { question: 'Python?', answer: 'Five years' })
      const entry = await get('kubernetes-experience')
      expect(entry).toBeUndefined()
    })
  })
})

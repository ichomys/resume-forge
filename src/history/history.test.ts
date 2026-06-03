import * as os from 'os'
import * as path from 'path'
import * as realFs from 'fs/promises'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Redirect homedir to a temp dir so history never touches the real ~/.resume-forge.
const { tmpHome } = vi.hoisted(() => {
  const osMod = require('os') as typeof import('os')
  const pathMod = require('path') as typeof import('path')
  return {
    tmpHome: pathMod.join(osMod.tmpdir(), `resume-forge-history-test-${Date.now()}`),
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
  error:   vi.fn(),
  success: vi.fn(),
  status:  vi.fn(),
  prompt:  vi.fn(),
}))

import { append, getLastEntry } from './index.js'
import * as display from '../display.js'
import type { RunEntry } from './schema.js'

const historyFile = path.join(tmpHome, '.resume-forge', 'data', 'run-history.jsonl')

const entryA: RunEntry = {
  role: 'Senior Engineer',
  date: '2026-05-29',
  alignmentScore: 80,
  outputPath: '/out/senior-engineer_2026-05-29.html',
  timestamp: '2026-05-29T10:00:00.000Z',
}

const entryB: RunEntry = {
  role: 'Staff Engineer',
  date: '2026-05-30',
  alignmentScore: 90,
  outputPath: '/out/staff-engineer_2026-05-30.html',
  timestamp: '2026-05-30T10:00:00.000Z',
}

describe('history', () => {
  beforeEach(async () => {
    await realFs.rm(tmpHome, { recursive: true, force: true })
  })

  afterEach(async () => {
    await realFs.rm(tmpHome, { recursive: true, force: true })
  })

  it('append writes a valid JSON line to the history file', async () => {
    await append(entryA)
    const raw = await realFs.readFile(historyFile, 'utf-8')
    const lines = raw.trim().split('\n')
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0])).toEqual(entryA)
  })

  it('getLastEntry returns the most recently appended entry', async () => {
    await append(entryA)
    await append(entryB)
    const last = await getLastEntry()
    expect(last).toEqual(entryB)
  })

  it('getLastEntry returns null when the history file is missing', async () => {
    const last = await getLastEntry()
    expect(last).toBeNull()
  })

  // ── Story 4.4: corrupt-line, multi-entry, append-only ─────────────────────

  it('getLastEntry calls display.error and returns null on a corrupt last line', async () => {
    await append(entryA)
    await append(entryB)
    // Append a corrupt JSON line directly to the file.
    const raw = await realFs.readFile(historyFile, 'utf-8')
    await realFs.writeFile(historyFile, raw + '{"corrupt"\n')

    const result = await getLastEntry()
    expect(result).toBeNull()
    expect(display.error).toHaveBeenCalledWith(
      'Run history entry is corrupt.',
      'Check ~/.resume-forge/data/run-history.jsonl',
    )
  })

  it('append writes three entries as separate lines; getLastEntry returns the third', async () => {
    const entryC: RunEntry = {
      role: 'Principal Engineer',
      date: '2026-05-31',
      alignmentScore: 95,
      outputPath: '/out/principal-engineer_2026-05-31.html',
      timestamp: '2026-05-31T10:00:00.000Z',
    }
    await append(entryA)
    await append(entryB)
    await append(entryC)

    const raw = await realFs.readFile(historyFile, 'utf-8')
    const lines = raw.trim().split('\n')
    expect(lines).toHaveLength(3)
    expect(JSON.parse(lines[0])).toEqual(entryA)
    expect(JSON.parse(lines[1])).toEqual(entryB)
    expect(JSON.parse(lines[2])).toEqual(entryC)

    const last = await getLastEntry()
    expect(last).toEqual(entryC)
  })

  it('append is append-only — the first line is never rewritten', async () => {
    await append(entryA)
    const firstLineBefore = (await realFs.readFile(historyFile, 'utf-8')).trim().split('\n')[0]
    await append(entryB)

    const lines = (await realFs.readFile(historyFile, 'utf-8')).trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(firstLineBefore)
  })

  it('parses entries that include the optional company field, and those without it', async () => {
    const withCompany: RunEntry = { ...entryA, company: 'Acme Corp' }
    await append(withCompany)
    const last = await getLastEntry()
    expect(last).toEqual(withCompany)
    expect(last?.company).toBe('Acme Corp')
  })
})

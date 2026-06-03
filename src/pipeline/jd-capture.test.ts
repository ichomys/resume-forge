import * as os from 'os'
import * as path from 'path'
import * as realFs from 'fs/promises'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the confirm prompt so captureJD never blocks on stdin during tests.
vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(async () => true),
}))

// Silence display output during tests.
vi.mock('../display.js', () => ({
  prompt: vi.fn(),
  status: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  spinner: vi.fn(),
}))

import { captureJD, captureFromFile, captureRoleTitle } from './jd-capture.js'
import { ResumeForgeError } from '../errors.js'

const tmpDir = path.join(os.tmpdir(), `resume-forge-jd-test-${Date.now()}`)

describe('jd-capture', () => {
  beforeEach(async () => {
    await realFs.mkdir(tmpDir, { recursive: true })
  })

  afterEach(async () => {
    await realFs.rm(tmpDir, { recursive: true, force: true })
  })

  it('captureFromFile reads a .txt file correctly', async () => {
    const file = path.join(tmpDir, 'jd.txt')
    await realFs.writeFile(file, 'Senior Engineer\nWe need someone great.')
    const text = await captureFromFile(file)
    expect(text).toContain('Senior Engineer')
    expect(text).toContain('We need someone great.')
  })

  it('captureFromFile throws ResumeForgeError for a missing file', async () => {
    const missing = path.join(tmpDir, 'does-not-exist.txt')
    await expect(captureFromFile(missing)).rejects.toThrow(ResumeForgeError)
  })

  it('captureJD returns session with jdText and jdConfirmed:true', async () => {
    const file = path.join(tmpDir, 'jd.txt')
    await realFs.writeFile(file, '  Backend Developer role  ')
    const session = await captureJD(file)
    expect(session.jdText).toBe('Backend Developer role') // trimmed
    expect(session.jdConfirmed).toBe(true)
    expect(session.resolvedGaps).toEqual({})
  })

  it('captureRoleTitle returns session with the role title as jdText', async () => {
    const session = await captureRoleTitle('Senior Software Engineer')
    expect(session.jdText).toBe('Senior Software Engineer')
    expect(session.jdConfirmed).toBe(true)
    expect(session.resolvedGaps).toEqual({})
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as display from './display.js'

describe('display', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>
  let consoleErrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prompt outputs ✦ symbol and message', () => {
    display.prompt('Test prompt')
    expect(consoleSpy).toHaveBeenCalledOnce()
    const output = consoleSpy.mock.calls[0][0] as string
    expect(output).toContain('✦')
    expect(output).toContain('Test prompt')
  })

  it('success outputs ✓ symbol and message', () => {
    display.success('Test success')
    expect(consoleSpy).toHaveBeenCalledOnce()
    const output = consoleSpy.mock.calls[0][0] as string
    expect(output).toContain('✓')
    expect(output).toContain('Test success')
  })

  it('status outputs → symbol and message', () => {
    display.status('Test status')
    expect(consoleSpy).toHaveBeenCalledOnce()
    const output = consoleSpy.mock.calls[0][0] as string
    expect(output).toContain('→')
    expect(output).toContain('Test status')
  })

  it('error outputs ✗ symbol without recovery', () => {
    display.error('Test error')
    expect(consoleErrSpy).toHaveBeenCalledOnce()
    const output = consoleErrSpy.mock.calls[0][0] as string
    expect(output).toContain('✗')
    expect(output).toContain('Test error')
  })

  it('error outputs ✗ then → recovery on second line', () => {
    display.error('Test error', 'Try this fix')
    expect(consoleErrSpy).toHaveBeenCalledTimes(2)
    const line1 = consoleErrSpy.mock.calls[0][0] as string
    const line2 = consoleErrSpy.mock.calls[1][0] as string
    expect(line1).toContain('✗')
    expect(line1).toContain('Test error')
    expect(line2).toContain('→')
    expect(line2).toContain('Try this fix')
  })

  it('noProfile calls error with correct message', () => {
    display.noProfile()
    expect(consoleErrSpy).toHaveBeenCalledTimes(2)
    expect(consoleErrSpy.mock.calls[0][0] as string).toContain('No profile found.')
    expect(consoleErrSpy.mock.calls[1][0] as string).toContain('Run resume-forge init first.')
  })

  it('linkedinNotLoaded calls error with correct message', () => {
    display.linkedinNotLoaded()
    expect(consoleErrSpy).toHaveBeenCalledTimes(2)
    expect(consoleErrSpy.mock.calls[0][0] as string).toContain('LinkedIn profile not loaded.')
    expect(consoleErrSpy.mock.calls[1][0] as string).toContain(
      'Re-run resume-forge init to add your profile.',
    )
  })

  it('storeEmpty calls status with correct message', () => {
    display.storeEmpty()
    expect(consoleSpy).toHaveBeenCalledOnce()
    expect(consoleSpy.mock.calls[0][0] as string).toContain('Answer store is empty')
  })

  it('noRecentRun calls error with correct message', () => {
    display.noRecentRun()
    expect(consoleErrSpy).toHaveBeenCalledTimes(2)
    expect(consoleErrSpy.mock.calls[0][0] as string).toContain('No generated resume found.')
    expect(consoleErrSpy.mock.calls[1][0] as string).toContain('Run resume-forge generate first.')
  })
})

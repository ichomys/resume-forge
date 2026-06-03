import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('../store/index.js', () => ({
  read:         vi.fn(),
  update:       vi.fn().mockResolvedValue(undefined),
  remove:       vi.fn().mockResolvedValue(undefined),
  clearAll:     vi.fn().mockResolvedValue(undefined),
  normalizeKey: (s: string) => s.toLowerCase(),
}))

vi.mock('../display.js', () => ({
  storeEmpty: vi.fn(),
  error:      vi.fn(),
  success:    vi.fn(),
  status:     vi.fn(),
  prompt:     vi.fn(),
}))

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
}))

import { Command } from 'commander'
import { register } from './store.js'
import { read, update, remove, clearAll } from '../store/index.js'
import * as display from '../display.js'
import { input } from '@inquirer/prompts'

// ── Command harness ─────────────────────────────────────────────────────────────
// Register against a real commander program and drive subcommands via parseAsync.
function buildProgram(): Command {
  const program = new Command()
  program.exitOverride() // throw on commander parse errors instead of process.exit
  register(program)
  return program
}

/** Run `store <args...>` through the real commander tree. */
async function run(program: Command, ...args: string[]): Promise<void> {
  await program.parseAsync(['store', ...args], { from: 'user' })
}

// ── stdin stub helpers ──────────────────────────────────────────────────────────
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
describe('store command', () => {
  let program: Command

  beforeEach(() => {
    vi.clearAllMocks()
    stdinHandlers = {}
    stubStdin()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    program = buildProgram()
  })

  it('registers a store group with list, edit, and clear subcommands', () => {
    const storeCmd = program.commands.find((c) => c.name() === 'store')
    expect(storeCmd).toBeDefined()
    const subNames = storeCmd!.commands.map((c) => c.name())
    expect(subNames).toEqual(expect.arrayContaining(['list', 'edit', 'clear']))
  })

  // ── list ──────────────────────────────────────────────────────────────────
  it('list shows the empty message when the store is empty', async () => {
    ;(read as Mock).mockResolvedValue({ version: 1, entries: {} })
    await run(program, 'list')
    expect(display.storeEmpty).toHaveBeenCalled()
  })

  it('list sorts entries by lastUsed desc and truncates preview at 60 chars', async () => {
    const longAnswer = 'x'.repeat(100)
    ;(read as Mock).mockResolvedValue({
      version: 1,
      entries: {
        older: {
          question: 'Q', answer: 'older answer',
          createdAt: '2026-05-01T00:00:00.000Z', usageCount: 1,
          lastUsed: '2026-05-20T00:00:00.000Z',
        },
        newer: {
          question: 'Q', answer: longAnswer,
          createdAt: '2026-05-02T00:00:00.000Z', usageCount: 3,
          lastUsed: '2026-05-28T00:00:00.000Z',
        },
      },
    })

    const logSpy = console.log as unknown as Mock
    await run(program, 'list')

    const lines = logSpy.mock.calls.map((c) => String(c[0]))
    // newer (2026-05-28) should appear before older (2026-05-20)
    expect(lines[0]).toContain('[newer]')
    expect(lines[1]).toContain('[older]')
    // 60-char truncation with ellipsis
    expect(lines[0]).toContain('"' + 'x'.repeat(60) + '..."')
  })

  // ── edit ──────────────────────────────────────────────────────────────────
  it('edit without --topic errors and exits 1', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })
    await expect(run(program, 'edit')).rejects.toThrow('exit')
    expect(display.error).toHaveBeenCalledWith(
      '--topic is required',
      'Run resume-forge store list to see all stored topics',
    )
    exitSpy.mockRestore()
  })

  it('edit with unknown topic errors and exits 1', async () => {
    ;(read as Mock).mockResolvedValue({ version: 1, entries: {} })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })
    await expect(run(program, 'edit', '--topic', 'missing')).rejects.toThrow('exit')
    expect(display.error).toHaveBeenCalledWith(
      'No entry found for topic: missing',
      'Run resume-forge store list to see all stored topics',
    )
    exitSpy.mockRestore()
  })

  it('edit with valid topic + new answer calls update and success', async () => {
    ;(read as Mock).mockResolvedValue({
      version: 1,
      entries: {
        terraform: {
          question: 'Q', answer: 'old', createdAt: '2026-05-01T00:00:00.000Z', usageCount: 1,
        },
      },
    })
    ;(input as Mock).mockResolvedValue('new terraform answer')

    await run(program, 'edit', '--topic', 'terraform')
    expect(update).toHaveBeenCalledWith('terraform', 'new terraform answer')
    expect(display.success).toHaveBeenCalledWith('Entry updated: terraform')
  })

  it('edit with empty input makes no change', async () => {
    ;(read as Mock).mockResolvedValue({
      version: 1,
      entries: {
        terraform: {
          question: 'Q', answer: 'old', createdAt: '2026-05-01T00:00:00.000Z', usageCount: 1,
        },
      },
    })
    ;(input as Mock).mockResolvedValue('   ')

    await run(program, 'edit', '--topic', 'terraform')
    expect(update).not.toHaveBeenCalled()
    expect(display.status).toHaveBeenCalledWith('No change made')
  })

  // ── clear ─────────────────────────────────────────────────────────────────
  it('clear --topic removes the matching entry', async () => {
    await run(program, 'clear', '--topic', 'Terraform')
    expect(remove).toHaveBeenCalledWith('terraform')
    expect(display.success).toHaveBeenCalledWith('Cleared: terraform')
  })

  it('clear (no topic) with y clears the whole store', async () => {
    const promise = run(program, 'clear')
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('y')
    await promise
    expect(clearAll).toHaveBeenCalled()
    expect(display.success).toHaveBeenCalledWith('Answer store cleared')
  })

  it('clear (no topic) with Enter cancels', async () => {
    const promise = run(program, 'clear')
    await vi.waitFor(() => expect(stdinHandlers['data']).toBeDefined())
    stdinHandlers['data']('\r')
    await promise
    expect(clearAll).not.toHaveBeenCalled()
    expect(display.status).toHaveBeenCalledWith('Cancelled')
  })
})

import * as fs from 'fs/promises'
import * as path from 'path'
import * as readline from 'readline'
import { confirm } from '@inquirer/prompts'
import * as display from '../display.js'
import { ResumeForgeError } from '../errors.js'
import type { GenerationSession } from '../types.js'

/**
 * Capture a job description — either interactively (multi-line paste) or from a
 * file — and confirm completeness before returning an immutable session.
 */
export async function captureJD(jdFile?: string): Promise<GenerationSession> {
  let text: string

  // eslint-disable-next-line no-constant-condition
  while (true) {
    text = jdFile ? await captureFromFile(jdFile) : await captureInteractive()

    if (!text.trim()) {
      display.error('No job description captured.', 'Paste content and press Enter twice, or use --jd <file>.')
      process.exit(2)
      throw new Error('unreachable')
    }

    const wordCount = text.trim().split(/\s+/).filter(Boolean).length
    display.status(`Captured ${wordCount} words. Does this look complete?`)

    const confirmed = await confirmJD()
    if (confirmed) break
  }

  return {
    jdText: text.trim(),
    jdConfirmed: true,
    resolvedGaps: {},
  }
}

/** Multi-line paste capture via readline. Terminates on two consecutive empty lines. */
async function captureInteractive(): Promise<string> {
  display.prompt('Paste job description below. Press Enter twice when done.')

  return new Promise<string>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
    const lines: string[] = []
    let emptyCount = 0

    rl.on('line', (line: string) => {
      if (line === '') {
        emptyCount++
        if (emptyCount >= 2) {
          rl.close()
        }
      } else {
        emptyCount = 0
        lines.push(line)
      }
    })

    rl.on('close', () => resolve(lines.join('\n')))
  })
}

/**
 * Read a JD from a file. Supports `.txt` and `.html` (both read as raw text).
 * Throws `ResumeForgeError('FILE_NOT_FOUND')` when the file is missing.
 */
export async function captureFromFile(filePath: string): Promise<string> {
  const resolved = path.resolve(filePath)
  try {
    return await fs.readFile(resolved, 'utf-8')
  } catch {
    display.error(`File not found: ${filePath}`, 'Check the path and try again.')
    throw new ResumeForgeError('FILE_NOT_FOUND', `JD file not found: ${filePath}`)
  }
}

/** Confirm completeness — Y/Enter returns true, N returns false. */
async function confirmJD(): Promise<boolean> {
  return confirm({ message: 'Does this look complete?', default: true })
}

/**
 * Capture a role title as the generation target instead of a full job description.
 * Displays a confirmation prompt, then returns an immutable session.
 */
export async function captureRoleTitle(roleTitle: string): Promise<GenerationSession> {
  display.status(`Captured role title: "${roleTitle}". Does this look complete?`)

  const confirmed = await confirm({ message: 'Does this look complete?', default: true })
  if (!confirmed) {
    display.status('Please re-run with the correct role title using --role "Your Role Title".')
    process.exit(1)
    throw new Error('unreachable')
  }

  display.status(`Using role title as target: "${roleTitle}"`)

  return {
    jdText: roleTitle,
    jdConfirmed: true,
    resolvedGaps: {},
  }
}

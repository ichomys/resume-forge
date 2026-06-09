import { createAdapter } from '../llm/index.js'
import { readConfig } from '../config.js'
import { getExperiencePool } from '../profile/index.js'
import * as display from '../display.js'
import { read as readStore } from '../store/index.js'
import type { AlignmentResult, GenerationSession } from '../types.js'

export type AlignmentAction = 'generate' | 'context' | 'exit'
export type AlignmentOutcome = {
  session: GenerationSession
  action: AlignmentAction
}

/**
 * Run LLM call 1 (alignment), render the report, and read the user's G/C/X choice.
 * Returns the session with `alignment` populated immutably plus the chosen action.
 * Exits with code 1 when the user presses X (abort).
 */
export async function runAlignment(
  session: GenerationSession,
): Promise<AlignmentOutcome> {
  const config = await readConfig()
  const pool = await getExperiencePool()
  const llm = createAdapter(config)

  const storedStore = await readStore()
  const storedAnswers = Object.fromEntries(
    Object.entries(storedStore.entries).map(([key, entry]) => [key, entry.answer]),
  )

  const spin = display.spinner('Analyzing alignment with your experience profile...')
  let result: AlignmentResult
  try {
    result = await llm.analyzeAlignment(session.jdText, pool, storedAnswers)
    spin.succeed()
  } catch (e) {
    spin.fail()
    throw e
  }

  const updatedSession = { ...session, alignment: result }

  if (result.careerChanger) {
    display.status(
      'Career transition detected: gap prompting will focus on transferable skills and outcomes relevant to the new domain.',
    )
  }

  renderAlignmentReport(result)

  const key = await readMenuKey()
  return {
    session: updatedSession,
    action: key === 'g' ? 'generate' : key === 'x' ? 'exit' : 'context',
  }
}

/**
 * Render the alignment report terminal block. Co-located with the alignment stage
 * for cohesion; `console.log` here is the display concern for this report.
 */
export function renderAlignmentReport(
  result: AlignmentResult,
  options?: { expandedMenu?: boolean },
): void {
  const LINE = '─'.repeat(50)
  const filled = Math.round(result.score / 10)
  const empty = Math.max(0, 10 - filled)
  const bar = '█'.repeat(filled) + '░'.repeat(empty)

  const aligned = result.aligned.length > 0 ? result.aligned.join(', ') : '(none)'
  const gaps = result.gaps.length > 0 ? result.gaps.join(', ') : '(none)'
  const noMatch = result.noMatch.length > 0 ? result.noMatch.join(', ') : '(none)'

  console.log()
  console.log(LINE)
  console.log('  Resume Forge — Alignment Report')
  console.log(LINE)
  console.log(`  ${bar}  ${result.score}%`)
  console.log()
  console.log(`  ✓ Aligned:  ${aligned}`)
  console.log(`  ✦ Gaps:     ${gaps}`)
  console.log(`  ✗ No match: ${noMatch}`)
  console.log()
  if (options?.expandedMenu) {
    console.log('  [G] Generate anyway  [C] Add more context  [X] Exit')
  } else {
    console.log('  [G] Generate  [C] Add context  [X] Exit')
  }
  console.log()
}

/** Single-keypress reader (no Enter) for the G/C/X menu. Ctrl+C maps to exit. */
async function readMenuKey(): Promise<'g' | 'c' | 'x'> {
  return new Promise((resolve) => {
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const handler = (key: string): void => {
      const k = key.toLowerCase()
      if (k === 'g' || k === 'c' || k === 'x' || k === '') {
        process.stdin.setRawMode?.(false)
        process.stdin.pause()
        process.stdin.removeListener('data', handler)
        resolve(k === '' ? 'x' : (k as 'g' | 'c' | 'x'))
      }
    }

    process.stdin.on('data', handler)
  })
}

import { input } from '@inquirer/prompts'
import { createAdapter } from '../llm/index.js'
import { readConfig } from '../config.js'
import { getExperiencePool } from '../profile/index.js'
import * as display from '../display.js'
import { write as storeWrite, get as storeGet, update as storeUpdate } from '../store/index.js'
import { renderAlignmentReport } from './alignment.js'
import type { AlignmentResult, GenerationSession } from '../types.js'

/** Gap discovery loop — question generation, multi-round context collection, recalculation, fit assessment. */
export async function runGapLoop(session: GenerationSession): Promise<GenerationSession> {
  if (!session.alignment) return session

  const config = await readConfig()
  const pool = await getExperiencePool()
  const llm = createAdapter(config)

  let currentAlignment = session.alignment
  let resolvedGaps: Record<string, string> = { ...session.resolvedGaps }

  // Outer loop: repeat rounds until user chooses G (generate) or X (exit)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Find gaps not yet answered this session
    const unresolvedIndices = currentAlignment.gaps
      .map((_, i) => i)
      .filter((i) => !resolvedGaps[currentAlignment.gapKeys[i] ?? ''])

    if (unresolvedIndices.length === 0) {
      // All gaps resolved — skip directly to generate
      return { ...session, alignment: currentAlignment, resolvedGaps }
    }

    const totalGaps = unresolvedIndices.length

    // Inner loop: one question per unresolved gap
    for (let ri = 0; ri < unresolvedIndices.length; ri++) {
      const gapIdx = unresolvedIndices[ri]
      const gapKey = currentAlignment.gapKeys[gapIdx] ?? ''
      const gapDescription = currentAlignment.gaps[gapIdx] ?? ''
      const gapNum = ri + 1

      // Story 4.1: pre-fill from the answer store if a stored answer matches this gap.
      const storedEntry = await storeGet(gapKey)
      if (storedEntry) {
        console.log()
        display.status(`Using stored answer for '${gapKey}'`)
        console.log(
          '   "' +
            storedEntry.answer.slice(0, 80) +
            (storedEntry.answer.length > 80 ? '...' : '') +
            '"',
        )
        console.log('   [Enter] confirm · [E] edit · [S] skip')

        const choice = await readStoreConfirmKey()

        if (choice === 'enter') {
          await storeUpdate(gapKey, storedEntry.answer)
          resolvedGaps = { ...resolvedGaps, [gapKey]: storedEntry.answer }
          display.success('Stored answer applied')
          continue
        }

        if (choice === 'e') {
          const newAnswer = await input({ message: '> ' })
          if (newAnswer.trim()) {
            await storeUpdate(gapKey, newAnswer.trim())
            resolvedGaps = { ...resolvedGaps, [gapKey]: newAnswer.trim() }
            display.success('Answer updated')
          }
          continue
        }

        // choice === 's' → skip: leave the gap unresolved, store unchanged.
        continue
      }

      // LLM call 2: generate a human-phrased question for this gap
      const spin = display.spinner(`Generating question for gap ${gapNum} of ${totalGaps}...`)
      let question: string
      try {
        question = await llm.generateGapQuestion(gapKey, gapDescription, pool)
        spin.succeed()
      } catch (e) {
        spin.fail()
        throw e
      }

      // Display gap prompt (Story 3.2 AC3)
      console.log()
      display.prompt(`Gap ${gapNum} of ${totalGaps} — ${gapKey}`)
      console.log()
      console.log(question)

      const answer = await input({ message: '>' })

      if (answer.trim()) {
        await storeWrite(gapKey, { question, answer: answer.trim() })
        resolvedGaps = { ...resolvedGaps, [gapKey]: answer.trim() }
      }
    }

    // Story 3.4: Recalculate alignment with all collected answers
    const prevScore = currentAlignment.score

    const answersBlock = Object.entries(resolvedGaps)
      .map(([key, ans]) => `${key}: ${ans}`)
      .join('\n')
    const enrichedJD = answersBlock
      ? `${session.jdText}\n\nADDITIONAL CANDIDATE CONTEXT:\n${answersBlock}`
      : session.jdText

    const recalcSpin = display.spinner('Recalculating alignment...')
    try {
      currentAlignment = await llm.analyzeAlignment(enrichedJD, pool)
      recalcSpin.succeed()
    } catch (e) {
      recalcSpin.fail()
      throw e
    }

    // Show alignment delta (Story 3.4 AC2)
    display.status(`Alignment updated: ${prevScore}% → ${currentAlignment.score}%`)

    // Story 3.5: Show fit assessment when unresolvable gaps remain
    const hasNoMatch = currentAlignment.noMatch.length > 0
    if (hasNoMatch) {
      const missing = currentAlignment.noMatch.join(', ')
      display.status(
        `Core requirements ${missing} remain unaddressed. This role may not be the right target.`,
      )
    }

    // Re-render the updated alignment report (Story 3.4 AC3)
    renderAlignmentReport(currentAlignment, { expandedMenu: hasNoMatch })

    // Wait for user's G/C/X choice
    const key = await readMenuKey()

    if (key === 'g') {
      if (hasNoMatch) {
        display.status('Generating with available context — some gaps remain unaddressed.')
      }
      return { ...session, alignment: currentAlignment, resolvedGaps }
    }

    if (key === 'x') {
      process.exit(1)
    }
    // key === 'c' → continue outer loop with next round
  }
}

/** Single-keypress reader for the stored-answer confirmation prompt (Enter/E/S). Ctrl+C exits. */
async function readStoreConfirmKey(): Promise<'enter' | 'e' | 's'> {
  return new Promise((resolve) => {
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const cleanup = (): void => {
      process.stdin.setRawMode?.(false)
      process.stdin.pause()
      process.stdin.removeListener('data', handler)
    }

    const handler = (key: string): void => {
      const k = key.toLowerCase()
      if (k === '\r' || k === '\n') {
        cleanup()
        resolve('enter')
      } else if (k === 'e') {
        cleanup()
        resolve('e')
      } else if (k === 's') {
        cleanup()
        resolve('s')
      } else if (k === '\x03') {
        cleanup()
        process.exit(1)
      }
    }

    process.stdin.on('data', handler)
  })
}

/** Single-keypress reader for the G/C/X menu in the gap loop. Ctrl+C maps to exit. */
async function readMenuKey(): Promise<'g' | 'c' | 'x'> {
  return new Promise((resolve) => {
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const handler = (key: string): void => {
      const k = key.toLowerCase()
      if (k === 'g' || k === 'c' || k === 'x' || k === '\x03') {
        process.stdin.setRawMode?.(false)
        process.stdin.pause()
        process.stdin.removeListener('data', handler)
        resolve(k === '\x03' ? 'x' : (k as 'g' | 'c' | 'x'))
      }
    }

    process.stdin.on('data', handler)
  })
}

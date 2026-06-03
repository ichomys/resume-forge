import { createAdapter } from '../llm/index.js'
import { readConfig } from '../config.js'
import { getExperiencePool } from '../profile/index.js'
import * as display from '../display.js'
import { ResumeForgeError } from '../errors.js'
import type { GenerationSession, ResumeContent } from '../types.js'

/**
 * Run LLM call 3 (resume generation). Returns a new session with `generatedContent`
 * populated immutably. On failure the spinner fails, an error is displayed, and the
 * error re-throws so the command layer exits — the input session is never mutated.
 */
export async function generateContent(
  session: GenerationSession,
): Promise<GenerationSession> {
  if (!session.alignment) {
    throw new ResumeForgeError(
      'ALIGNMENT_FAILED',
      'No alignment data in session — run alignment before generation.',
    )
  }

  const config = await readConfig()
  const pool = await getExperiencePool()
  const llm = createAdapter(config)

  const { role, company } = extractRoleInfo(session.jdText)
  const spinMsg = company
    ? `Generating resume for ${role}, ${company}...`
    : `Generating resume for ${role}...`

  const spin = display.spinner(spinMsg)
  let result: ResumeContent

  try {
    result = await llm.generateResume(session.alignment, pool, session.resolvedGaps)
    spin.succeed()
  } catch (e) {
    spin.fail()
    const reason = e instanceof Error ? e.message : 'Unknown error'
    display.error(`Generation failed. ${reason}`, 'Check your API key or retry.')
    throw e
  }

  return { ...session, generatedContent: result }
}

/** Best-effort parse of role title and company from JD text for the spinner message. */
export function extractRoleInfo(jdText: string): { role: string; company: string } {
  const lines = jdText.split('\n').map((l) => l.trim()).filter(Boolean)

  const rolePatterns = [
    /^(?:role|position|title|job title):\s*(.+)$/i,
    /^((?:senior|junior|staff|principal|lead)?\s*\w+(?:\s+\w+){0,4} (?:engineer|developer|manager|designer|analyst))/i,
  ]

  let role = 'the target role'
  for (const line of lines.slice(0, 5)) {
    for (const pattern of rolePatterns) {
      const m = line.match(pattern)
      if (m) {
        // Strip trailing " at <company>" to avoid capturing the company in the title.
        role = m[1].trim().replace(/\s+at\s+.*/i, '').trim()
        break
      }
    }
    if (role !== 'the target role') break
  }

  const companyPatterns = [
    /^(?:company|employer|at|@):\s*(.+)$/i,
    /^(?:about|join)\s+([A-Z][a-z][\w\s]{2,30})/,
  ]

  let company = ''
  for (const line of lines.slice(0, 10)) {
    for (const pattern of companyPatterns) {
      const m = line.match(pattern)
      if (m) {
        company = m[1].trim()
        break
      }
    }
    if (company) break
  }

  return { role, company }
}

import type { ExperiencePool } from '../../types.js'

/** Build the prompt for LLM call 2 — a single human-phrased question for one gap. */
export function gapQuestionPrompt(
  gapKey: string,
  description: string,
  pool: ExperiencePool,
): string {
  const context = pool.entries
    .map((e) => `${e.title} at ${e.company}`)
    .join('; ')

  return `You are helping a candidate close a gap on their resume for a target role.

GAP: ${gapKey}
GAP DESCRIPTION: ${description}

CANDIDATE BACKGROUND: ${context}
SKILLS: ${pool.skills.join(', ')}

Write ONE concise, conversational question that asks the candidate for concrete
experience or context that could address this gap. Return ONLY the question text —
no preamble, no quotes, no markdown. Keep it under 30 words.`
}

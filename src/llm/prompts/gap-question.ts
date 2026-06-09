import type { ExperiencePool } from '../../types.js'

/** Build the prompt for LLM call 2 — an interview-style question + follow-up probe for one gap. */
export function gapQuestionPrompt(
  gapKey: string,
  description: string,
  pool: ExperiencePool,
): string {
  const context = pool.entries
    .map((e) => `${e.title} at ${e.company}`)
    .join('; ')

  return `You are conducting a structured career interview to surface concrete evidence for a gap in a candidate's profile.

GAP: ${gapKey}
GAP DESCRIPTION: ${description}

CANDIDATE BACKGROUND: ${context}
SKILLS: ${pool.skills.join(', ')}

Return ONLY a JSON object — no markdown, no explanation:
{
  "question": "<One direct, conversational question asking for a specific example or outcome that addresses this gap. Under 30 words.>",
  "followUp": "<A follow-up probe for when the initial answer is vague or short — ask for a concrete number, outcome, or specific example. Under 25 words.>"
}

The primary question should invite a real story, not a yes/no answer. The follow-up should dig for quantifiable results or a specific instance — surface real evidence without pressuring the candidate to invent metrics they don't have.`
}

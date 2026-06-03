import type { ExperiencePool } from '../../types.js'

/** Build the prompt for LLM call 1 — JD ↔ experience alignment analysis. */
export function alignmentPrompt(
  jdText: string,
  pool: ExperiencePool,
  storedAnswers?: Record<string, string>,
): string {
  const experience = pool.entries
    .map(
      (e) =>
        `${e.title} at ${e.company} (${e.startDate}–${e.endDate}): ${e.description}`,
    )
    .join('\n')

  const answersSection =
    storedAnswers && Object.keys(storedAnswers).length > 0
      ? `\nCANDIDATE ADDITIONAL CONTEXT (from prior sessions — treat as supplementary experience):\n${Object.entries(storedAnswers)
          .map(([key, answer]) => `- ${key}: ${answer}`)
          .join('\n')}\n`
      : ''

  return `You are analyzing resume-job alignment. Return ONLY a JSON object with no markdown, no explanation.

JOB DESCRIPTION:
${jdText}

CANDIDATE EXPERIENCE:
${experience}

SKILLS: ${pool.skills.join(', ')}
${answersSection}
Return this exact JSON structure:
{
  "score": <integer 0-100>,
  "aligned": [<skill/area strings where candidate matches>],
  "gaps": [<skill/area strings candidate can address with context>],
  "noMatch": [<hard requirements candidate cannot address>],
  "gapKeys": [<kebab-case topic slugs matching each gaps[] entry, e.g. "container-orchestration">]
}

Rules:
- score is a percentage integer
- gapKeys must match gaps[] length and order
- gapKeys use only lowercase letters, digits, hyphens; start with a letter
- Treat "CANDIDATE ADDITIONAL CONTEXT" as supplementary experience; if it addresses a gap, move that item to aligned and raise the score accordingly`
}

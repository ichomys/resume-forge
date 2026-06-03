import type { AlignmentResult, ExperiencePool } from '../../types.js'

/** Build the prompt for LLM call 3 — role-tailored resume content generation. */
export function resumePrompt(
  analysis: AlignmentResult,
  pool: ExperiencePool,
  answers: Record<string, string>,
): string {
  const answersSection =
    Object.keys(answers).length > 0
      ? `\nADDITIONAL CONTEXT PROVIDED:\n${Object.entries(answers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')}`
      : ''

  return `Generate a role-tailored resume as JSON. Return ONLY valid JSON, no markdown.

ALIGNED AREAS: ${analysis.aligned.join(', ')}
ROLE REQUIREMENTS: ${analysis.gaps.concat(analysis.noMatch).join(', ')}
${answersSection}

CANDIDATE EXPERIENCE:
${pool.entries.map((e) => JSON.stringify(e)).join('\n')}

CANDIDATE SKILLS: ${pool.skills.join(', ')}
CANDIDATE EDUCATION: ${pool.education.map((ed) => `${ed.degree}, ${ed.institution} (${ed.year})`).join('; ')}
${pool.name ? `CANDIDATE NAME: ${pool.name}` : ''}

Return this exact JSON structure matching ResumeContent:
{
  "name": "<full name>",
  "subtitle": "<role title>",
  "contact": {},
  "summary": "<2-3 sentence summary>",
  "experience": [
    {
      "title": "<title>",
      "company": "<company>",
      "location": "<location>",
      "startDate": "<start>",
      "endDate": "<end>",
      "description": "<one-line description>",
      "bullets": ["<achievement bullet>"]
    }
  ],
  "skills": ["<skill>"],
  "education": [{ "degree": "<degree>", "institution": "<school>", "year": "<year>" }],
  "achievements": ["<achievement>"]
}

Rules:
- Order experience by relevance to the role (most aligned first)
- Frame bullets around the ROLE REQUIREMENTS listed above
- Omit optional fields (achievements, summary) if not applicable — do not write null or empty strings`
}

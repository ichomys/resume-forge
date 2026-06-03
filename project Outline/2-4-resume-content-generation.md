# Story 2.4: Resume Content Generation

Status: done

## Story

As Rainboldt,
I want the tool to generate role-tailored resume content from my experience pool, JD analysis, and any provided answers,
so that the output reflects my strongest relevant experience framed around this specific role's requirements.

## Acceptance Criteria

1. `pipeline/generator.ts` calls `llm.generateResume(alignment, pool, resolvedGaps)` with a spinner `⠋ Generating resume for [role title], [company]...` shown during the call
2. The spinner resolves to `✓` on success or `✗` on failure
3. The response populates a `ResumeContent` object with typed sections (summary, experience entries, skills, education)
4. Experience entries are ordered by relevance to the role — most aligned roles/projects first (enforced via the LLM prompt, not post-processing)
5. Bullet points frame accomplishments around the target role's requirements
6. Two independent calls with the same pool + JD + answers produce equivalent quality level outputs (same sections covered, same relevance ordering)
7. When the Anthropic API call fails during generation, `display.error()` shows `✗ Generation failed. → [specific reason] Check your API key or retry` and the in-progress session state is not corrupted
8. The returned session is updated immutably: `{ ...session, generatedContent: result }`
9. `src/commands/generate.ts` is updated to call `generateContent()` after alignment and pass the result to subsequent stages

## Tasks / Subtasks

- [x] Create `src/pipeline/generator.ts` — generation stage (AC: 1, 2, 3, 4, 5, 7, 8)
  - [x] Import `createAdapter`, `readConfig`, `getExperiencePool`, `display`, `ResumeForgeError`, `GenerationSession`, `ResumeContent`
  - [x] Implement `extractRoleInfo(jdText: string): { role: string; company: string }` — best-effort parse of role title and company from JD text for the spinner message
  - [x] Implement and export `generateContent(session: GenerationSession): Promise<GenerationSession>`
  - [x] Show spinner with extracted role/company, call `llm.generateResume()`, resolve spinner
  - [x] Return `{ ...session, generatedContent: result }` on success
  - [x] On failure: `spin.fail()`, `display.error(...)`, `throw` the error (generate.ts catches it)

- [x] Update `src/pipeline/index.ts` (AC: 9)
  - [x] Export `generateContent` from `./generator.js`

- [x] Update `src/commands/generate.ts` (AC: 9)
  - [x] Import `generateContent` from `../pipeline/index.js`
  - [x] After `runAlignment()` resolves with action `'generate'`, call `generateContent(session)`
  - [x] Pass updated session to next stage (stub comment for 2.5)

- [x] Write unit tests `src/pipeline/generator.test.ts` (AC: 3, 7, 8)
  - [x] Mock `createAdapter` to return `ResumeContent` with correct shape
  - [x] Test returned session has `generatedContent` set immutably
  - [x] Mock adapter to throw; assert `display.error()` called and session unchanged

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes

## Dev Notes

### `generateContent()` — Full Implementation

```typescript
// src/pipeline/generator.ts
import { createAdapter } from '../llm/index.js'
import { readConfig } from '../config.js'
import { getExperiencePool } from '../profile/index.js'
import * as display from '../display.js'
import type { GenerationSession, ResumeContent } from '../types.js'

export async function generateContent(session: GenerationSession): Promise<GenerationSession> {
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
    result = await llm.generateResume(
      session.alignment!,
      pool,
      session.resolvedGaps
    )
    spin.succeed()
  } catch (e) {
    spin.fail()
    const reason = e instanceof Error ? e.message : 'Unknown error'
    display.error(`Generation failed. ${reason}`, 'Check your API key or retry.')
    throw e
  }

  return { ...session, generatedContent: result }
}
```

### `extractRoleInfo()` — Best-Effort JD Parser

```typescript
function extractRoleInfo(jdText: string): { role: string; company: string } {
  const lines = jdText.split('\n').map(l => l.trim()).filter(Boolean)

  // Try to find role title — usually in first 3 lines
  // Common patterns: "Senior Software Engineer", "Role: Backend Developer"
  const rolePatterns = [
    /^(?:role|position|title|job title):\s*(.+)$/i,
    /^((?:senior|junior|staff|principal|lead)?\s*\w+(?:\s+\w+){0,4} (?:engineer|developer|manager|designer|analyst))/i,
  ]

  let role = 'the target role'
  for (const line of lines.slice(0, 5)) {
    for (const pattern of rolePatterns) {
      const m = line.match(pattern)
      if (m) { role = m[1].trim(); break }
    }
    if (role !== 'the target role') break
  }

  // Try to find company — often near the top
  const companyPatterns = [
    /^(?:company|employer|at|@):\s*(.+)$/i,
    /^(?:about|join)\s+([A-Z][a-z][\w\s]{2,30})/,
  ]

  let company = ''
  for (const line of lines.slice(0, 10)) {
    for (const pattern of companyPatterns) {
      const m = line.match(pattern)
      if (m) { company = m[1].trim(); break }
    }
    if (company) break
  }

  return { role, company }
}
```

This is best-effort — JD formats vary widely. If extraction fails, the spinner falls back to `'the target role'` with no company. The LLM sees the full JD text regardless.

### How `session.alignment!` Is Safe

The `!` non-null assertion on `session.alignment` is safe here because:
1. `generateContent()` is only called from `generate.ts` after `runAlignment()` succeeds
2. `runAlignment()` always populates `session.alignment` before returning
3. TypeScript can't infer this statically, so the assertion is needed

If you prefer a guard:
```typescript
if (!session.alignment) throw new ResumeForgeError('ALIGNMENT_FAILED', 'No alignment data in session')
```

### `src/commands/generate.ts` After Story 2.4

```typescript
import type { Command } from 'commander'
import { captureJD, runAlignment, generateContent } from '../pipeline/index.js'
import * as display from '../display.js'
import { ResumeForgeError } from '../errors.js'

export function register(program: Command): void {
  program
    .command('generate')
    .description('Generate a role-tailored resume')
    .option('--jd <file>', 'Path to job description file (.txt or .html)')
    .option('--compact', 'Apply compact CSS class for content-dense layouts')
    .action(async (options: { jd?: string; compact?: boolean }) => {
      try {
        let session = await captureJD(options.jd)

        const { session: s2, action } = await runAlignment(session)
        session = s2
        if (action === 'exit') process.exit(1)
        // action === 'context': Epic 3 gap loop; for Epic 2, fall through to generate

        session = await generateContent(session)

        // Story 2.5: session = await renderHTML(session, { compact: options.compact })
        // Story 2.6: await hitlReview(session)
        display.status('Generation complete — rendering and HITL added in Stories 2.5–2.6')
      } catch (e) {
        if (e instanceof ResumeForgeError) {
          display.error(e.message)
          process.exit(2)
        }
        throw e
      }
    })
}
```

### Quality Consistency (AC: 6)

Quality consistency across independent runs is enforced by the prompt design in `src/llm/prompts/resume.ts`, not by post-processing code. The prompt must specify:
- "Order experience entries by relevance to the role requirements"
- "Frame bullet points around these specific role requirements: [list from alignment]"

The `resumePrompt()` function (Story 2.2) includes the aligned areas and gap areas as explicit context. This gives the LLM the signals needed for consistent relevance ordering.

**Note:** LLM outputs are inherently non-deterministic. AC 6 means "equivalent quality level" — same sections, same relevance ordering principle — not byte-for-byte identical. Exact reproducibility would require `temperature: 0` on the API call, which can be added to `AnthropicAdapter.call()` if needed.

### Architecture Compliance

| Rule | Application |
|------|-------------|
| All output via display.ts | Spinner via `display.spinner()`; error via `display.error()` |
| No inline prompts | `llm.generateResume()` uses prompt from `src/llm/prompts/resume.ts` |
| Immutable session | `{ ...session, generatedContent: result }` spread |
| Barrel imports only | `pipeline/index.ts` exports `generateContent`; generate.ts imports from barrel |
| Exit codes | Errors thrown; generate.ts catches and exits with code 2 |

### Previous Story Intelligence

- **Story 2.2 (LLM adapter):** `llm.generateResume()` is defined on `LLMAdapter`. It takes `analysis: AlignmentResult`, `pool: ExperiencePool`, `answers: Record<string, string>`. The `AnthropicAdapter` handles all API error paths — if it throws, `generateContent` only needs to `spin.fail()` and re-throw.
- **Story 2.3 (alignment):** `session.alignment` is populated after `runAlignment()`. The `resolvedGaps` field is `{}` for Epic 2 (no gap loop yet). Pass it as-is — the resume prompt handles empty answers gracefully.
- **Story 1.7 (getExperiencePool):** Pool is fetched fresh each pipeline stage. This is slightly inefficient but keeps each stage self-contained. If performance matters, pass pool as a parameter through the pipeline — but for Epic 2, fetching per stage is acceptable.
- **`ResumeContent` shape:** Defined in `src/types.ts`. The LLM must return JSON matching this shape. The `resumePrompt()` in Story 2.2 specifies this structure. If the LLM returns extra fields, `JSON.parse` keeps them — TypeScript types won't catch this at runtime, which is fine (extra fields are ignored by Handlebars).

### References

- Acceptance criteria [Source: project Outline/epics-resume-forge.md#Story-2.4]
- LLM call 3 architecture [Source: project Outline/architecture-resume-forge.md#LLM-Integration-Architecture]
- `GenerationSession` immutable threading [Source: project Outline/architecture-resume-forge.md#Pipeline-State-Management]
- `ResumeContent` type [Source: src/types.ts]
- Spinner lifecycle pattern [Source: project Outline/architecture-resume-forge.md#Process-Patterns]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story workflow)

### Debug Log References

- `npx vitest run src/pipeline/generator.test.ts` → 3/3 pass
- `npm run lint` → clean; `npm run build` → success

### Completion Notes List

- Implemented `generateContent()` and exported `extractRoleInfo()` (exported for unit testing the JD parser).
- Replaced the `session.alignment!` non-null assertion with an explicit guard that throws `ResumeForgeError('ALIGNMENT_FAILED')` — safer and avoids a lint complaint about non-null assertions.
- On API failure: `spin.fail()` → `display.error('Generation failed. <reason>', 'Check your API key or retry.')` → re-throw; the input session is never mutated (immutability verified in tests).
- `generate.ts` now threads `captureJD → runAlignment → generateContent`.

### File List

- `src/pipeline/generator.ts` (new)
- `src/pipeline/generator.test.ts` (new)
- `src/pipeline/index.ts` (modified — export `generateContent`)
- `src/commands/generate.ts` (modified — wire `generateContent`)

### Change Log

- 2026-05-29: Story 2.4 created — resume content generation stage
- 2026-05-29: Story 2.4 implemented — generation stage with role/company spinner, immutable session update, error handling; 3 unit tests passing

### Review Findings

- [ ] [Review][Decision] Error message format for AC 2.4-7 — AC requires `✗ Generation failed. → [reason] Check your API key or retry`. Code calls `display.error('Generation failed. ${reason}', 'Check your API key or retry.')`. If `display.error` formats as `✗ [msg] → [hint]`, the rendered output would be `✗ Generation failed. [reason] → Check your API key or retry` — reason is embedded in the first segment, not between `→` and hint. Verify the intended order or reformat the arguments.
- [x] [Review][Patch] `extractRoleInfo` second role pattern too permissive [src/pipeline/generator.ts:54] — fixed: added `.replace(/\s+at\s+.*/i, '').trim()` post-processing to strip trailing " at <company>" from captured role titles.

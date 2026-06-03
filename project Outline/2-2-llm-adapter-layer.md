# Story 2.2: LLM Adapter Layer

Status: done

## Story

As a developer,
I want a thin LLM abstraction layer with retry, timeout, and error handling built in,
so that the alignment, gap, and generation calls all work reliably and I can swap models without touching business logic.

## Acceptance Criteria

1. `src/llm/adapter.ts` defines the `LLMAdapter` interface with three methods: `analyzeAlignment(jdText, pool)`, `generateGapQuestion(gapKey, description, pool)`, `generateResume(analysis, pool, answers)`
2. `src/llm/anthropic.ts` implements `LLMAdapter` as `AnthropicAdapter`
3. `AnthropicAdapter` uses the `model` field from the injected config object — changing config `model` requires zero code changes
4. When an Anthropic API call returns a rate limit error (429), `display.error()` shows `✗ Rate limit reached. → Wait a moment and try again` and exits with code 2
5. When an Anthropic API call times out or the network is unavailable, `display.error()` shows `✗ API unavailable. → Check your connection and retry` with no in-progress state corrupted
6. `src/llm/prompts/` contains `alignment.ts`, `gap-question.ts`, and `resume.ts`; no inline template strings exist in `anthropic.ts` or any business logic file
7. `src/llm/index.ts` exports `createAdapter(config): LLMAdapter` factory function
8. `src/llm/prompts/index.ts` exports all three prompt functions

## Tasks / Subtasks

- [x] Create `src/llm/adapter.ts` (AC: 1)
  - [x] Define and export `LLMAdapter` interface with `analyzeAlignment`, `generateGapQuestion`, `generateResume`
  - [x] Type all parameters using types from `../types.js`

- [x] Create `src/llm/prompts/alignment.ts` (AC: 6)
  - [x] Export `alignmentPrompt(jdText: string, pool: ExperiencePool): string`
  - [x] Prompt instructs LLM to return structured JSON: `{ score, aligned[], gaps[], noMatch[], gapKeys[] }`

- [x] Create `src/llm/prompts/gap-question.ts` (AC: 6)
  - [x] Export `gapQuestionPrompt(gapKey: string, description: string, pool: ExperiencePool): string`
  - [x] Prompt requests a human-phrased question string for the gap

- [x] Create `src/llm/prompts/resume.ts` (AC: 6)
  - [x] Export `resumePrompt(analysis: AlignmentResult, pool: ExperiencePool, answers: Record<string, string>): string`
  - [x] Prompt instructs LLM to return structured `ResumeContent` JSON

- [x] Update `src/llm/prompts/index.ts` (AC: 8)
  - [x] Export `alignmentPrompt`, `gapQuestionPrompt`, `resumePrompt`

- [x] Create `src/llm/anthropic.ts` (AC: 2, 3, 4, 5)
  - [x] Import `Anthropic` from `@anthropic-ai/sdk`
  - [x] Import all prompts from `./prompts/index.js`
  - [x] Import `readConfig`-produced config type (pass config at construction time)
  - [x] Implement `AnthropicAdapter` class with `analyzeAlignment`, `generateGapQuestion`, `generateResume`
  - [x] Handle rate-limit (status 429) → `display.error` + `process.exit(2)`
  - [x] Handle network errors / timeouts → `display.error` + `process.exit(2)`
  - [x] Parse LLM JSON responses; throw `ResumeForgeError` on parse failure

- [x] Update `src/llm/index.ts` (AC: 7)
  - [x] Export `createAdapter(config): LLMAdapter` factory that constructs `AnthropicAdapter`
  - [x] Export `LLMAdapter` type re-exported from `./adapter.js`

- [x] Write unit tests `src/llm/anthropic.test.ts` (AC: 4, 5)
  - [x] Mock `@anthropic-ai/sdk` to reject with status 429; assert `process.exit(2)` called
  - [x] Mock to reject with network error; assert `process.exit(2)` called

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes

## Dev Notes

### `LLMAdapter` Interface

```typescript
// src/llm/adapter.ts
import type { AlignmentResult, ExperiencePool, ResumeContent } from '../types.js'

export interface LLMAdapter {
  analyzeAlignment(jdText: string, pool: ExperiencePool): Promise<AlignmentResult>
  generateGapQuestion(gapKey: string, description: string, pool: ExperiencePool): Promise<string>
  generateResume(
    analysis: AlignmentResult,
    pool: ExperiencePool,
    answers: Record<string, string>
  ): Promise<ResumeContent>
}
```

### `AnthropicAdapter` Implementation

```typescript
// src/llm/anthropic.ts
import Anthropic from '@anthropic-ai/sdk'
import * as display from '../display.js'
import { ResumeForgeError } from '../errors.js'
import type { LLMAdapter } from './adapter.js'
import type { AlignmentResult, ExperiencePool, ResumeContent } from '../types.js'
import { alignmentPrompt } from './prompts/alignment.js'
import { gapQuestionPrompt } from './prompts/gap-question.js'
import { resumePrompt } from './prompts/resume.js'

type AdapterConfig = {
  model: string
  apiKeyEnvVar: string
}

export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic
  private model: string

  constructor(config: AdapterConfig) {
    const apiKey = process.env[config.apiKeyEnvVar]
    if (!apiKey) {
      display.error(
        `API key not found in environment: ${config.apiKeyEnvVar}`,
        `Set ${config.apiKeyEnvVar} in your environment and retry.`
      )
      process.exit(2)
    }
    this.client = new Anthropic({ apiKey })
    this.model = config.model
  }

  async analyzeAlignment(jdText: string, pool: ExperiencePool): Promise<AlignmentResult> {
    const prompt = alignmentPrompt(jdText, pool)
    const raw = await this.call(prompt)
    return this.parseJSON<AlignmentResult>(raw, 'ALIGNMENT_FAILED')
  }

  async generateGapQuestion(gapKey: string, description: string, pool: ExperiencePool): Promise<string> {
    const prompt = gapQuestionPrompt(gapKey, description, pool)
    const raw = await this.call(prompt)
    return raw.trim()
  }

  async generateResume(
    analysis: AlignmentResult,
    pool: ExperiencePool,
    answers: Record<string, string>
  ): Promise<ResumeContent> {
    const prompt = resumePrompt(analysis, pool, answers)
    const raw = await this.call(prompt)
    return this.parseJSON<ResumeContent>(raw, 'GENERATION_FAILED')
  }

  private async call(prompt: string): Promise<string> {
    try {
      const msg = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      const block = msg.content[0]
      if (block.type !== 'text') throw new Error('Unexpected response block type')
      return block.text
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 429) {
        display.error('Rate limit reached.', 'Wait a moment and try again.')
        process.exit(2)
      }
      display.error('API unavailable.', 'Check your connection and retry.')
      process.exit(2)
    }
  }

  private parseJSON<T>(raw: string, errorCode: keyof typeof import('../errors.js').ERROR_CODES): T {
    // Strip markdown code fences if present (LLMs sometimes wrap JSON in ```json)
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    try {
      return JSON.parse(cleaned) as T
    } catch {
      throw new ResumeForgeError(errorCode, `LLM returned invalid JSON: ${cleaned.slice(0, 100)}`)
    }
  }
}
```

**Note on `process.exit` in `call()`:** TypeScript requires a `never` return type for `process.exit`. Add `as never` cast after `process.exit(2)` if TypeScript complains about unreachable code. The `throw new Error('unreachable')` pattern also works for narrowing.

### Alignment Prompt Structure

The LLM must return parseable JSON matching `AlignmentResult`. Instruct it explicitly:

```typescript
// src/llm/prompts/alignment.ts
import type { ExperiencePool } from '../../types.js'

export function alignmentPrompt(jdText: string, pool: ExperiencePool): string {
  const experience = pool.entries.map(e =>
    `${e.title} at ${e.company} (${e.startDate}–${e.endDate}): ${e.description}`
  ).join('\n')

  return `You are analyzing resume-job alignment. Return ONLY a JSON object with no markdown, no explanation.

JOB DESCRIPTION:
${jdText}

CANDIDATE EXPERIENCE:
${experience}

SKILLS: ${pool.skills.join(', ')}

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
- gapKeys use only lowercase letters, digits, hyphens; start with a letter`
}
```

### Resume Prompt Structure

```typescript
// src/llm/prompts/resume.ts
import type { AlignmentResult, ExperiencePool } from '../../types.js'

export function resumePrompt(
  analysis: AlignmentResult,
  pool: ExperiencePool,
  answers: Record<string, string>
): string {
  const answersSection = Object.keys(answers).length > 0
    ? `\nADDITIONAL CONTEXT PROVIDED:\n${Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join('\n')}`
    : ''

  return `Generate a role-tailored resume as JSON. Return ONLY valid JSON, no markdown.

ALIGNED AREAS: ${analysis.aligned.join(', ')}
ROLE REQUIREMENTS: ${analysis.gaps.concat(analysis.noMatch).join(', ')}
${answersSection}

CANDIDATE EXPERIENCE:
${pool.entries.map(e => JSON.stringify(e)).join('\n')}

Return this exact JSON structure matching ResumeContent:
{
  "name": "<full name>",
  "subtitle": "<role title>",
  "contact": { "phone": "<phone>", "email": "<email>", "linkedin": "<url>" },
  "summary": "<2-3 sentence summary>",
  "experience": [
    {
      "title": "<title>",
      "company": "<company>",
      "location": "<location>",
      "startDate": "<start>",
      "endDate": "<end>",
      "description": "<one-line description>",
      "bullets": ["<achievement bullet>", ...]
    }
  ],
  "skills": ["<skill>", ...],
  "education": [{ "degree": "<degree>", "institution": "<school>", "year": "<year>" }],
  "achievements": ["<achievement>", ...]
}

Rules:
- Order experience by relevance to the role (most aligned first)
- Frame bullets around role requirements
- Omit optional fields (achievements, summary) if not applicable — do not write null or empty strings`
}
```

### `createAdapter` Factory

```typescript
// src/llm/index.ts
import type { LLMAdapter } from './adapter.js'
import { AnthropicAdapter } from './anthropic.js'

type AdapterConfig = { model: string; apiKeyEnvVar: string }

export function createAdapter(config: AdapterConfig): LLMAdapter {
  return new AnthropicAdapter(config)
}

export type { LLMAdapter }
```

### Error Code Usage

`ResumeForgeError` codes for LLM failures are already defined in `src/errors.ts`:
- `ALIGNMENT_FAILED` — alignment JSON parse fails
- `GENERATION_FAILED` — resume JSON parse fails
- `API_RATE_LIMITED` — 429 from Anthropic (use in display only; process.exit handles it)
- `API_UNAVAILABLE` — network timeout or unavailability

### Architecture Compliance

| Rule | Application |
|------|-------------|
| All output via display.ts | `display.error()` used for all API error paths |
| All prompts in src/llm/prompts/ | No inline template strings in `anthropic.ts` |
| Barrel imports only | `src/llm/index.ts` is the public API; pipeline imports via `'../llm/index.js'` |
| ResumeForgeError for all errors | JSON parse failures use `ResumeForgeError` |
| Zero-code model swap | `model` read from config at construction; never hardcoded |

### Previous Story Intelligence

- **Story 1.4 (config.ts):** `readConfig()` returns `{ model, apiKeyEnvVar, outputDir, templatePath, theme }`. Pass the config object directly to `createAdapter(config)` — no need to import config inside the llm module.
- **Story 1.3 (display.ts):** `display.error(msg, recovery?)` takes optional recovery string on second param — always provide it for API errors.
- **`@anthropic-ai/sdk` v0.100.1:** Installed. API changed significantly in v0.100+. The `messages.create()` API remains stable. Rate limit errors surface as `Anthropic.APIStatusError` with `.status === 429`. Network errors surface as `Anthropic.APIConnectionError`. Check `instanceof` for precise typing:
  ```typescript
  import Anthropic from '@anthropic-ai/sdk'
  if (e instanceof Anthropic.APIStatusError && e.status === 429) { ... }
  if (e instanceof Anthropic.APIConnectionError) { ... }
  ```
- **JSON in LLM responses:** Claude sometimes wraps JSON in ` ```json ``` ` fences. Strip these before `JSON.parse`. The `parseJSON()` helper in `AnthropicAdapter` handles this.

### References

- Acceptance criteria [Source: project Outline/epics-resume-forge.md#Story-2.2]
- LLM integration architecture (3-call pipeline, adapter pattern) [Source: project Outline/architecture-resume-forge.md#LLM-Integration-Architecture]
- Prompt file locations [Source: project Outline/architecture-resume-forge.md#Complete-Project-Directory-Structure]
- Error handling pattern [Source: project Outline/architecture-resume-forge.md#Format-Patterns]
- `AlignmentResult`, `ResumeContent` types [Source: src/types.ts]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story workflow)

### Debug Log References

- `npx vitest run src/llm/anthropic.test.ts` → 4/4 pass
- `npm run lint` → clean; `npm run build` → success

### Completion Notes List

- Implemented `LLMAdapter` interface, `AnthropicAdapter`, three prompt builders, and `createAdapter()` factory.
- **429 detection deviation:** In `@anthropic-ai/sdk` v0.100.1 the error classes (`APIStatusError`, `RateLimitError`, etc.) are *named module exports*, NOT static properties on the default `Anthropic` class — `Anthropic.APIStatusError` is `undefined`. Verified at runtime. Rather than depend on error-class identity, used the duck-typed `status === 429` check from the Dev Notes `call()` implementation (`isRateLimit()` helper). This is robust across SDK shapes and directly testable.
- Constructor exits with code 2 (via `display.error`) when the configured API-key env var is unset.
- `parseJSON()` strips ```` ```json ```` fences before parsing and throws `ResumeForgeError` (`ALIGNMENT_FAILED` / `GENERATION_FAILED`) on parse failure.
- Unexpected/non-text response blocks raise an error that routes through the same "API unavailable" exit path.
- Added two extra tests (valid-JSON parse + fence-stripping) beyond the required two error-path tests, for coverage of the happy path.
- `resume.ts` prompt enriched with candidate name/contact/education/skills from the pool so the LLM has the data needed to fill `ResumeContent`.

### File List

- `src/llm/adapter.ts` (new)
- `src/llm/anthropic.ts` (new)
- `src/llm/anthropic.test.ts` (new)
- `src/llm/prompts/alignment.ts` (new)
- `src/llm/prompts/gap-question.ts` (new)
- `src/llm/prompts/resume.ts` (new)
- `src/llm/prompts/index.ts` (modified — export three prompts)
- `src/llm/index.ts` (modified — `createAdapter` factory + `LLMAdapter` re-export)

### Change Log

- 2026-05-29: Story 2.2 created — LLM adapter interface, AnthropicAdapter, three prompt files
- 2026-05-29: Story 2.2 implemented — adapter + prompts + factory; duck-typed 429 handling (SDK v0.100 error classes are module exports); 4 unit tests passing

### Review Findings

- [ ] [Review][Decision] `display.error()` format contract for rate-limit and network messages — AC 2.2-4 requires `✗ Rate limit reached. → Wait a moment and try again`; AC 2.2-5 requires `✗ API unavailable. → Check your connection and retry`. The code calls `display.error('Rate limit reached.', 'Wait a moment and try again.')` with two separate arguments. Whether `display.error` composes them as `✗ [msg] → [hint]` determines AC conformance.
- [x] [Review][Patch] `call()` method falls off end — implicit `undefined` return [src/llm/anthropic.ts:64] — fixed: added `throw new Error('unreachable')` after each `process.exit(2)` call.

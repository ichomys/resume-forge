# Story 2.3: Alignment Analysis & Report

Status: done

## Story

As Rainboldt,
I want to see a clear alignment report — percentage score, categorized skills, and a proceed/add-context/exit menu — before committing to generation,
so that I understand exactly where I stand against a role before investing time in a resume.

## Acceptance Criteria

1. `pipeline/alignment.ts` calls `llm.analyzeAlignment(jdText, pool)` with a spinner `⠋ Analyzing alignment with your experience profile...` shown during the call; spinner resolves to `✓` on success or `✗` on failure
2. The alignment report renders as a terminal block: horizontal rule header, `████░░` progress bar + percentage, three categorical lines (`✓ Aligned`, `✦ Gaps`, `✗ No match`), and `[G] Generate  [C] Add context  [X] Exit` menu
3. The report appears within 15 seconds of JD submission under normal API conditions
4. Pressing `G` causes the session to proceed to resume generation (function returns with action `'generate'`)
5. Pressing `X` exits the process with code 1 (user abort)
6. When alignment is ≥80% with no gaps, `✗ No match` and `✦ Gaps` lines both show `(none)` and pressing `G` proceeds with no gap prompting
7. `src/commands/generate.ts` is updated to call `runAlignment()` after `captureJD()` and handle the returned action
8. `pipeline/alignment.ts` is exported from `src/pipeline/index.ts`

## Tasks / Subtasks

- [x] Create `src/pipeline/alignment.ts` (AC: 1, 2, 4, 5, 6)
  - [x] Import `createAdapter` from `../llm/index.js`, `readConfig` from `../config.js`, `getExperiencePool` from `../profile/index.js`
  - [x] Implement `renderAlignmentReport(result: AlignmentResult): void` — horizontal rule, progress bar, three categorical lines
  - [x] Implement `readMenuKey(): Promise<'g' | 'c' | 'x'>` — single-keypress stdin raw mode reader
  - [x] Implement and export `runAlignment(session: GenerationSession): Promise<{ session: GenerationSession; action: 'generate' | 'context' | 'exit' }>`
  - [x] Show spinner, call `llm.analyzeAlignment()`, resolve spinner, render report, read key

- [x] Update `src/pipeline/index.ts` (AC: 8)
  - [x] Export `runAlignment` from `./alignment.js`

- [x] Update `src/commands/generate.ts` (AC: 7)
  - [x] Import `runAlignment` from `../pipeline/index.js`
  - [x] After `captureJD()`, call `runAlignment(session)`; if action is `'exit'`, `process.exit(1)`; if `'generate'`, proceed to next stage (stub comment for 2.4)

- [x] Write unit tests `src/pipeline/alignment.test.ts` (AC: 1, 6)
  - [x] Mock `createAdapter` to return a fake adapter with controlled `analyzeAlignment` response
  - [x] Test that a ≥80% result with empty gaps/noMatch shows `(none)` in output
  - [x] Test that `AlignmentResult` is stored in returned session

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes

## Dev Notes

### `runAlignment()` — Full Implementation

```typescript
// src/pipeline/alignment.ts
import { createAdapter } from '../llm/index.js'
import { readConfig } from '../config.js'
import { getExperiencePool } from '../profile/index.js'
import * as display from '../display.js'
import { ResumeForgeError } from '../errors.js'
import type { AlignmentResult, GenerationSession } from '../types.js'

type AlignmentAction = 'generate' | 'context' | 'exit'
type AlignmentOutcome = { session: GenerationSession; action: AlignmentAction }

export async function runAlignment(session: GenerationSession): Promise<AlignmentOutcome> {
  const config = await readConfig()
  const pool = await getExperiencePool()
  const llm = createAdapter(config)

  const spin = display.spinner('Analyzing alignment with your experience profile...')
  let result: AlignmentResult
  try {
    result = await llm.analyzeAlignment(session.jdText, pool)
    spin.succeed()
  } catch (e) {
    spin.fail()
    throw e
  }

  const updatedSession = { ...session, alignment: result }
  renderAlignmentReport(result)

  const key = await readMenuKey()
  if (key === 'x') {
    process.exit(1)
  }

  return { session: updatedSession, action: key === 'g' ? 'generate' : 'context' }
}
```

### `renderAlignmentReport()` — Terminal Block Rendering

```typescript
function renderAlignmentReport(result: AlignmentResult): void {
  const LINE = '─'.repeat(50)
  const filled = Math.round(result.score / 10)
  const empty = 10 - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)

  console.log()
  console.log(LINE)
  console.log('  Resume Forge — Alignment Report')
  console.log(LINE)
  console.log(`  ${bar}  ${result.score}%`)
  console.log()

  const aligned = result.aligned.length > 0 ? result.aligned.join(', ') : '(none)'
  const gaps = result.gaps.length > 0 ? result.gaps.join(', ') : '(none)'
  const noMatch = result.noMatch.length > 0 ? result.noMatch.join(', ') : '(none)'

  console.log(`  ✓ Aligned:  ${aligned}`)
  console.log(`  ✦ Gaps:     ${gaps}`)
  console.log(`  ✗ No match: ${noMatch}`)
  console.log()
  console.log('  [G] Generate  [C] Add context  [X] Exit')
  console.log()
}
```

**Note:** The `console.log` calls here are intentional — `renderAlignmentReport` is a display-level function that formats output. These are effectively part of the display module's concern but co-located with the alignment pipeline stage for cohesion. If the team prefers strict `display.ts` routing, extract `renderAlignmentReport` to `display.ts` as `display.alignmentReport(result)`.

### `readMenuKey()` — Single Keypress Without Enter

```typescript
async function readMenuKey(): Promise<'g' | 'c' | 'x'> {
  return new Promise(resolve => {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const handler = (key: string) => {
      const k = key.toLowerCase()
      if (k === 'g' || k === 'c' || k === 'x' || k === '') {
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdin.removeListener('data', handler)
        if (k === '') resolve('x')  // Ctrl+C treated as exit
        else resolve(k as 'g' | 'c' | 'x')
      }
    }

    process.stdin.on('data', handler)
  })
}
```

**Why raw mode:** The `[G/C/X]` interaction is single-key — the user presses one letter and the action fires immediately without pressing Enter. This requires stdin raw mode. `process.stdin.setRawMode(true)` is available in Node.js when stdin is a TTY (which it is when running as a CLI tool). In non-TTY environments (CI, tests), set raw mode will throw — mock this in tests.

**Ctrl+C handling:** `` is the Ctrl+C character in raw mode. Treating it as `'x'` (exit) gives the user a familiar escape path.

### Alignment Report Format Details

Progress bar uses block characters:
- `█` (U+2588 FULL BLOCK) for filled segments
- `░` (U+2591 LIGHT SHADE) for empty segments
- 10 segments total; `filled = Math.round(score / 10)`

For a score of 68%:
```
  ███████░░░  68%
  ✓ Aligned:  TypeScript, Node.js, REST APIs
  ✦ Gaps:     Kubernetes, AWS
  ✗ No match: COBOL
```

For a score of 100% (no gaps):
```
  ██████████  100%
  ✓ Aligned:  TypeScript, Node.js, Kubernetes
  ✦ Gaps:     (none)
  ✗ No match: (none)
```

### `src/commands/generate.ts` Update

After Story 2.3, generate.ts should look like:

```typescript
import type { Command } from 'commander'
import { captureJD, runAlignment } from '../pipeline/index.js'
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
        if (action === 'context') {
          // Gap loop — Story 3.x; for Epic 2 proceed directly to generation
          display.status('Gap context loop will be implemented in Epic 3.')
        }

        // Story 2.4: generateContent(session, pool, options.compact)
        // Story 2.5: renderHTML(session, config)
        // Story 2.6: hitlReview(session, config)
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

### Architecture Compliance

| Rule | Application |
|------|-------------|
| All output via display.ts | Spinner via `display.spinner()`; report uses `console.log` at display level |
| No inline prompts | LLM prompt in `src/llm/prompts/alignment.ts` |
| Immutable session | `{ ...session, alignment: result }` spread pattern |
| Barrel imports only | Pipeline imports from `'../llm/index.js'`; generate.ts imports from `'../pipeline/index.js'` |
| Exit codes | `process.exit(1)` for user abort (X key); `process.exit(2)` only for system errors (in catch) |

### Previous Story Intelligence

- **Story 2.2 (LLM adapter):** `createAdapter(config)` is available from `'../llm/index.js'`. Pass config from `readConfig()`. The adapter handles all API errors internally — `runAlignment` only needs to handle `ResumeForgeError` from JSON parse failures.
- **Story 2.1 (generate command):** `generate.ts` was started with a JD capture stub. This story replaces the stub comment with the alignment call. Preserve the existing `captureJD` import and usage.
- **Story 1.4 (readConfig):** `readConfig()` returns `{ model, apiKeyEnvVar, outputDir, templatePath, theme }`. Pass the whole config to `createAdapter(config)`.
- **Story 1.7 (getExperiencePool):** `getExperiencePool()` reads the stored profile from `~/.resume-forge/profile/linkedin-export.json`. If no profile exists, it calls `display.noProfile()` and `process.exit(2)` — this is handled inside the profile module, not in alignment.ts.
- **Spinner resolution:** `spin.succeed()` renders `✓ Analyzing alignment...` on the same line; `spin.fail()` renders `✗`. This is `ora`'s built-in behavior. Never call `spin.stop()` — always `succeed()` or `fail()`.

### References

- Acceptance criteria [Source: project Outline/epics-resume-forge.md#Story-2.3]
- UX alignment report format (UX-DR2) [Source: project Outline/epics-resume-forge.md#UX-Design-Requirements]
- LLM call 1 architecture [Source: project Outline/architecture-resume-forge.md#LLM-Integration-Architecture]
- Exit code conventions [Source: project Outline/architecture-resume-forge.md#Process-Patterns]
- `AlignmentResult` type [Source: src/types.ts]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story workflow)

### Debug Log References

- `npx vitest run src/pipeline/alignment.test.ts` → 2/2 pass
- `npm run lint` → clean; `npm run build` → success

### Completion Notes List

- Implemented `runAlignment()`, exported `renderAlignmentReport()`, and internal `readMenuKey()`.
- `renderAlignmentReport` is exported so the `(none)` / progress-bar formatting is unit-testable without driving stdin.
- `readMenuKey` uses optional chaining on `setRawMode?.()` so headless/non-TTY environments (and tests) don't crash; the test stubs `process.stdin` methods and captures the `data` handler to simulate a keypress.
- Empty-segment count clamped with `Math.max(0, 10 - filled)` to stay safe if a score >100 is ever returned.
- `generate.ts` now threads `captureJD → runAlignment`; `context` action falls through to generation (Epic 3 will add the gap loop); `exit` → `process.exit(1)`.

### File List

- `src/pipeline/alignment.ts` (new)
- `src/pipeline/alignment.test.ts` (new)
- `src/pipeline/index.ts` (modified — export `runAlignment`)
- `src/commands/generate.ts` (modified — wire `runAlignment`)

### Change Log

- 2026-05-29: Story 2.3 created — alignment pipeline stage, report rendering, G/C/X menu
- 2026-05-29: Story 2.3 implemented — alignment stage, report block, raw-mode G/C/X menu; 2 unit tests passing

### Review Findings

- [x] [Review][Patch] Ctrl-C (`\x03`) not handled in `readMenuKey` — confirmed already handled: the file contains the literal `\x03` byte (rendered as `^C` by cat; Read tool strips it). No change needed.
- [x] [Review][Patch] `action === 'exit'` guard in `generate.ts` is dead code [src/commands/generate.ts:24] — fixed: `runAlignment` now returns `action: 'exit'` instead of calling `process.exit(1)` directly; `generate.ts` guard is now live and owns the exit decision.

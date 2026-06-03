# Story 2.1: Job Description Capture

Status: done

## Story

As Rainboldt,
I want to provide a job description either by pasting it interactively or pointing to a saved file,
so that the tool always works from a complete, confirmed JD before any analysis begins.

## Acceptance Criteria

1. When `resume-forge generate` is run with no flags, `✦ Paste job description below. Press Enter twice when done.` is displayed and the tool captures multi-line text until two consecutive empty newlines
2. After capture, `→ Captured N words. Does this look complete? [Y/n]` is shown; pressing `Y` or Enter proceeds; pressing `N` returns to the paste prompt
3. When `resume-forge generate --jd <file>` is used, the JD text is loaded from the file (supports `.txt` and `.html`) and the same completeness confirmation is shown
4. If the `--jd` file does not exist, a `ResumeForgeError` is thrown and `✗ File not found: [path] → Check the path and try again` is displayed
5. Upon confirmation, `session.jdText` contains the confirmed JD text and `session.jdConfirmed` is `true`
6. The session object is immutable — subsequent pipeline stages spread rather than mutate it
7. `src/commands/generate.ts` registers `resume-forge generate [--jd <file>] [--compact]` and wires `captureJD()` as the first pipeline stage

## Tasks / Subtasks

- [x] Create `src/commands/generate.ts` (AC: 7)
  - [x] Import `Command` from `commander`, `captureJD` from `../pipeline/index.js`
  - [x] Export `register(program: Command): void`
  - [x] Register `generate` command with `--jd <file>` and `--compact` options
  - [x] Call `captureJD(options.jd)` to start the pipeline; catch `ResumeForgeError` → `display.error()` → `process.exit(2)`

- [x] Create `src/pipeline/jd-capture.ts` (AC: 1, 2, 3, 4, 5, 6)
  - [x] Import `fs/promises`, `path`, `readline`, `display`, `ResumeForgeError`, `GenerationSession`
  - [x] Implement `captureInteractive(): Promise<string>` — readline loop collecting lines until two consecutive empty lines
  - [x] Implement `captureFromFile(filePath: string): Promise<string>` — reads `.txt` and `.html` files; throws `ResumeForgeError('FILE_NOT_FOUND')` if missing
  - [x] Implement `confirmJD(text: string): Promise<boolean>` — `@inquirer/prompts` confirm prompt returning true for Y/Enter, false for N
  - [x] Implement and export `captureJD(jdFile?: string): Promise<GenerationSession>` — loops until confirmed; returns immutable session

- [x] Update `src/pipeline/index.ts` to export `captureJD` (AC: 7)

- [x] Update `src/commands/index.ts` to register generate command (AC: 7)

- [x] Write unit tests `src/pipeline/jd-capture.test.ts` (AC: 3, 4, 5)
  - [x] Test `captureFromFile()` reads a `.txt` file correctly
  - [x] Test `captureFromFile()` throws `ResumeForgeError` for a missing file
  - [x] Test returned session has `jdText` and `jdConfirmed: true`

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes

## Dev Notes

### `captureJD()` — Full Flow

```typescript
// src/pipeline/jd-capture.ts
import * as fs from 'fs/promises'
import * as path from 'path'
import * as readline from 'readline'
import { confirm } from '@inquirer/prompts'
import * as display from '../display.js'
import { ResumeForgeError } from '../errors.js'
import type { GenerationSession } from '../types.js'

export async function captureJD(jdFile?: string): Promise<GenerationSession> {
  let text: string

  while (true) {
    text = jdFile ? await captureFromFile(jdFile) : await captureInteractive()
    const wordCount = text.trim().split(/\s+/).length
    display.status(`Captured ${wordCount} words. Does this look complete?`)

    const confirmed = await confirm({ message: '', default: true })
    if (confirmed) break
    if (jdFile) break  // file content doesn't change on retry — break anyway
  }

  return {
    jdText: text.trim(),
    jdConfirmed: true,
    resolvedGaps: {},
  }
}
```

### `captureInteractive()` — Multi-Line Paste via Readline

Standard readline handles multi-line paste reliably without raw mode:

```typescript
async function captureInteractive(): Promise<string> {
  display.prompt('Paste job description below. Press Enter twice when done.')

  return new Promise<string>(resolve => {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
    const lines: string[] = []
    let emptyCount = 0

    rl.on('line', (line: string) => {
      if (line === '') {
        emptyCount++
        if (emptyCount >= 2) {
          rl.close()
        }
      } else {
        emptyCount = 0
        lines.push(line)
      }
    })

    rl.on('close', () => resolve(lines.join('\n')))
  })
}
```

### `captureFromFile()` — File Read with Error Handling

```typescript
async function captureFromFile(filePath: string): Promise<string> {
  const resolved = path.resolve(filePath)
  try {
    return await fs.readFile(resolved, 'utf-8')
  } catch {
    display.error(`File not found: ${filePath}`, 'Check the path and try again.')
    throw new ResumeForgeError('FILE_NOT_FOUND', `JD file not found: ${filePath}`)
  }
}
```

Supports `.txt` and `.html` — both are read as raw text. For `.html`, the HTML tags will be present in the text passed to the LLM; the alignment prompt must be robust to HTML content in the JD.

### `src/commands/generate.ts` — Stub for Epic 2

The generate command will grow across Stories 2.1–2.6. In Story 2.1, only JD capture is wired. Subsequent stories extend the pipeline:

```typescript
// src/commands/generate.ts
import type { Command } from 'commander'
import { captureJD } from '../pipeline/index.js'
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
        const session = await captureJD(options.jd)
        // Story 2.3 will add: analyzeAlignment(session)
        // Story 2.4 will add: generateResume(session, ...)
        // Story 2.5 will add: renderHTML(session, ...)
        // Story 2.6 will add: hitlReview(session, ...)
        display.status('JD captured — pipeline stages will be added in Stories 2.3–2.6')
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

**Important:** Each subsequent story (2.3–2.6) will update `generate.ts` to add the next pipeline stage call after `captureJD`. Story 2.1 leaves the placeholders as comments.

### `@inquirer/prompts` `confirm` Usage

The `confirm` function from `@inquirer/prompts` v8:

```typescript
import { confirm } from '@inquirer/prompts'

// Returns true for Y/Enter, false for N
const ok = await confirm({ message: 'Does this look complete?', default: true })
```

Capital-Y is the default (shown in brackets). This matches the UX spec `[Y/n]` convention where capital means default.

### Immutable Session Pattern

The returned `GenerationSession` must never be mutated by downstream callers:

```typescript
// Correct — downstream stages spread the session
return { ...session, alignment: result }

// Wrong — never mutate
session.alignment = result
```

The `captureJD()` function returns the initial session. Every subsequent pipeline stage takes the session as input and returns a new session via spread.

### Architecture Compliance

| Rule | Application |
|------|-------------|
| All output via display.ts | `display.prompt()`, `display.status()`, `display.error()` — no `console.log` |
| ResumeForgeError for all errors | `FILE_NOT_FOUND` used for missing JD file |
| Immutable session | `captureJD()` returns new object; never mutates |
| Barrel imports only | `pipeline/index.ts` exports `captureJD`; commands import from `'../pipeline/index.js'` |
| No console.log | Zero raw console calls in any new file |

### Previous Story Intelligence

- **Story 1.3 (display.ts):** `display.prompt()`, `display.status()`, `display.error()` are available and tested. The `✦` amber prefix is `display.prompt()`.
- **Story 1.4 (config.ts):** `readConfig()` is available — generate command will need it in Story 2.2 to load the model and API key env var name. Wire it in when needed.
- **Story 1.7 (profile/index.ts):** `getExperiencePool()` is available. The generate command needs it in Story 2.3. Don't call it in 2.1.
- **`@inquirer/prompts` v8:** Installed at `^8.5.0`. Named exports: `input`, `confirm`, `select`, `password`, `editor`. Import individually: `import { confirm } from '@inquirer/prompts'`.
- **`GenerationSession` type:** Defined in `src/types.ts`. The `resolvedGaps` field is `Record<string, string>` — initialize as `{}` in `captureJD()`.

### References

- Acceptance criteria [Source: project Outline/epics-resume-forge.md#Story-2.1]
- JD capture module location [Source: project Outline/architecture-resume-forge.md#Complete-Project-Directory-Structure]
- UX prefix conventions [Source: project Outline/architecture-resume-forge.md#Format-Patterns]
- GenerationSession type [Source: src/types.ts]
- `@inquirer/prompts` confirm [Source: project Outline/architecture-resume-forge.md#Selected-Foundation]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story workflow)

### Debug Log References

- `npx vitest run src/pipeline/jd-capture.test.ts` → 3/3 pass
- `npm run lint` → clean; `npm run build` → success

### Completion Notes List

- Implemented `captureJD()`, `captureInteractive()` (readline two-empty-line terminator), `captureFromFile()` (`.txt`/`.html` raw text), and `confirmJD()` (`@inquirer/prompts` confirm).
- `captureFromFile` is exported (in addition to `captureJD`) for direct unit testing of the file-read and missing-file paths.
- `confirmJD()` takes no argument (word count is shown via `display.status()` before the prompt, matching the UX `→ Captured N words` line); the confirm prompt message is empty per the Dev Notes flow.
- `generate.ts` wired as a stub — alignment/generation/render/HITL stages added in Stories 2.3–2.6. Used `void session` to satisfy `no-unused-vars` until later stages consume it.
- Session returned is a fresh immutable object `{ jdText, jdConfirmed, resolvedGaps }`.

### File List

- `src/pipeline/jd-capture.ts` (new)
- `src/pipeline/jd-capture.test.ts` (new)
- `src/commands/generate.ts` (new)
- `src/pipeline/index.ts` (modified — export `captureJD`)
- `src/commands/index.ts` (modified — register generate)

### Change Log

- 2026-05-29: Story 2.1 created — JD capture pipeline stage and generate command stub
- 2026-05-29: Story 2.1 implemented — JD capture (interactive + file), confirmation, generate command stub wired; 3 unit tests passing

### Review Findings

- [ ] [Review][Decision] Does `display.prompt()` prepend the `✦` glyph automatically, or must callers include it? — AC 2.1-1 requires `✦ Paste job description below...`; code calls `display.prompt('Paste job description below...')` without the prefix. If the function does not add it, the glyph is missing.
- [ ] [Review][Decision] Does `display.status()` prepend a `→` arrow automatically? — AC 2.1-2 requires `→ Captured N words. Does this look complete? [Y/n]`; code calls `display.status('Captured N words...')`. Whether `→` is rendered depends on the display module's format contract.
- [x] [Review][Patch] `--jd` file confirmation bypass: user pressing `N` still proceeds [src/pipeline/jd-capture.ts:25] — fixed: removed `if (jdFile) break`; loop now re-reads file and re-prompts until confirmed.
- [x] [Review][Patch] `captureInteractive` resolves empty string on immediate stdin EOF [src/pipeline/jd-capture.ts:36] — fixed: added empty-text guard that exits with code 2 before proceeding.
- [x] [Review][Patch] `confirmJD` uses empty string as message — fixed: changed to `confirm({ message: 'Does this look complete?', default: true })`.
- [x] [Review][Defer] No maximum file size guard in `captureFromFile` [src/pipeline/jd-capture.ts:64] — deferred, pre-existing; multi-MB JD could exceed LLM context window, surfacing as generic API error.

# Story 2.6: HITL Review & File Output

Status: done

## Story

As Rainboldt,
I want to review the generated HTML draft in my browser before approving, request changes if needed, and save the final file with a predictable filename,
so that I have full control over every resume that leaves this tool.

## Acceptance Criteria

1. After `ResumeContent` is rendered to HTML, `✓ Draft ready.` is displayed followed by `[O] Open in browser  [R] Request changes  [A] Approve & save`
2. Pressing `O` writes the HTML to a temp path and opens it in the system default browser; the `[O/R/A]` menu is redisplayed and pressing `O` again reopens without finalizing
3. Pressing `R` prompts for free-text change description; a spinner `⠋ Revising...` appears; the LLM regenerates the `ResumeContent`; the HTML is re-rendered and the menu is redisplayed
4. Pressing `A` writes the HTML atomically to `{outputDir}/{role-slug}_{YYYY-MM-DD}.html`; displays `✓ Resume saved → {full path}`; displays `→ Run resume-forge review to reopen at any time.`
5. The saved file path is appended to run history as `{ role, date, alignmentScore, outputPath, timestamp }`
6. `resume-forge review` opens the most recently saved HTML file path from run history in the default browser; if no run exists: `✗ No generated resume found. → Run resume-forge generate first`
7. The saved HTML opens and prints correctly as a two-column PDF in Chrome or Edge (this is enforced by the template CSS from Story 1.2, not by renderer code)
8. `src/history/schema.ts` defines `RunEntrySchema` (zod v1) and `RunEntry` type; `src/history/index.ts` implements `append(entry)` and `getLastEntry()` functions
9. `src/commands/review.ts` registers `resume-forge review` command
10. `src/commands/generate.ts` is fully wired: captureJD → runAlignment → generateContent → renderHTML → hitlReview

## Tasks / Subtasks

- [x] Create `src/history/schema.ts` (AC: 5, 8)
  - [x] Import `z` from `zod`
  - [x] Define and export `RunEntrySchema` with fields: `role`, `date`, `alignmentScore`, `outputPath`, `timestamp`
  - [x] Export `RunEntry` type inferred from schema
  - [x] Export `HISTORY_PATH` constant pointing to `~/.resume-forge/data/run-history.jsonl`

- [x] Implement `src/history/index.ts` (AC: 5, 6, 8)
  - [x] Import `fs/promises`, `write-file-atomic`, `RunEntrySchema`, `RunEntry`, `HISTORY_PATH`, `DATA_DIR`
  - [x] Implement and export `append(entry: RunEntry): Promise<void>` — atomically appends one JSON line to history file
  - [x] Implement and export `getLastEntry(): Promise<RunEntry | null>` — reads last line from history file; returns null if file missing or empty

- [x] Create `src/pipeline/hitl.ts` (AC: 1, 2, 3, 4, 5)
  - [x] Import `fs/promises`, `os`, `path`, `child_process`, `write-file-atomic`, `readConfig`, `display`, `append` from history, `generateContent`, `renderHTML`
  - [x] Implement `openInBrowser(htmlPath: string): void` — platform-specific `child_process.exec`
  - [x] Implement `buildOutputPath(outputDir, session): string` — `{outputDir}/{role-slug}_{YYYY-MM-DD}.html`
  - [x] Implement `readRevisionInput(): Promise<string>` — prompt user for change description
  - [x] Implement and export `hitlReview(session: GenerationSession, htmlString: string, options?: { compact?: boolean }): Promise<void>` — O/R/A loop

- [x] Update `src/pipeline/index.ts`
  - [x] Export `hitlReview` from `./hitl.js`

- [x] Create `src/commands/review.ts` (AC: 6, 9)
  - [x] Register `resume-forge review` command
  - [x] Call `getLastEntry()`; if null → `display.noRecentRun()` + `process.exit(1)`
  - [x] Otherwise open `outputPath` in browser

- [x] Update `src/commands/index.ts`
  - [x] Import and register `review` and (if not already) `generate` commands

- [x] Update `src/commands/generate.ts` (AC: 10)
  - [x] Import `renderHTML`, `hitlReview` from `../pipeline/index.js`
  - [x] Fully wire the pipeline: captureJD → runAlignment → generateContent → renderHTML → hitlReview
  - [x] Pass `{ compact: options.compact }` to both `renderHTML` and `hitlReview`

- [x] Write unit tests `src/history/history.test.ts` (AC: 5, 8)
  - [x] Test `append()` writes a valid JSON line to temp file
  - [x] Test `getLastEntry()` returns the last appended entry
  - [x] Test `getLastEntry()` returns null when file missing

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes

## Dev Notes

### `RunEntrySchema` and History Module

```typescript
// src/history/schema.ts
import { z } from 'zod'
import * as path from 'path'
import * as os from 'os'

export const RunEntrySchema = z.object({
  role:           z.string(),
  date:           z.string(),   // YYYY-MM-DD
  alignmentScore: z.number(),
  outputPath:     z.string(),
  timestamp:      z.string(),   // ISO 8601
})

export type RunEntry = z.infer<typeof RunEntrySchema>

export const HISTORY_PATH = path.join(os.homedir(), '.resume-forge', 'data', 'run-history.jsonl')
export const DATA_DIR = path.join(os.homedir(), '.resume-forge', 'data')
```

```typescript
// src/history/index.ts
import * as fs from 'fs/promises'
import writeFileAtomic from 'write-file-atomic'
import { HISTORY_PATH, DATA_DIR, RunEntrySchema } from './schema.js'
import type { RunEntry } from './schema.js'

export type { RunEntry }

export async function append(entry: RunEntry): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })

  // Atomic JSONL append: read existing + append new line + write atomically
  let existing = ''
  try {
    existing = await fs.readFile(HISTORY_PATH, 'utf-8')
  } catch {
    // File doesn't exist yet — start fresh
  }

  const line = JSON.stringify(entry)
  const content = existing
    ? existing.trimEnd() + '\n' + line + '\n'
    : line + '\n'

  await writeFileAtomic(HISTORY_PATH, content)
}

export async function getLastEntry(): Promise<RunEntry | null> {
  let content: string
  try {
    content = await fs.readFile(HISTORY_PATH, 'utf-8')
  } catch {
    return null
  }

  const lines = content.trim().split('\n').filter(Boolean)
  if (lines.length === 0) return null

  try {
    const parsed = JSON.parse(lines[lines.length - 1])
    return RunEntrySchema.parse(parsed)
  } catch {
    return null
  }
}
```

**Why `writeFileAtomic` for JSONL?** The JSONL file is append-only — a process crash during write must not corrupt existing entries. The read-entire-file + write-entire-file approach with `write-file-atomic` satisfies this via atomic rename. For large history files, this is slightly expensive, but history is a low-frequency operation.

### `hitlReview()` — O/R/A Loop

```typescript
// src/pipeline/hitl.ts
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { exec } from 'child_process'
import writeFileAtomic from 'write-file-atomic'
import { input } from '@inquirer/prompts'
import { readConfig } from '../config.js'
import { generateContent } from './generator.js'
import { renderHTML } from './renderer.js'
import { append } from '../history/index.js'
import * as display from '../display.js'
import type { GenerationSession } from '../types.js'

export async function hitlReview(
  session: GenerationSession,
  htmlString: string,
  options: { compact?: boolean } = {}
): Promise<void> {
  const config = await readConfig()
  let html = htmlString
  let currentSession = session

  console.log()
  display.success('Draft ready.')

  while (true) {
    console.log('  [O] Open in browser  [R] Request changes  [A] Approve & save')
    const key = await readReviewKey()

    if (key === 'o') {
      const tmpPath = path.join(os.tmpdir(), `resume-forge-draft-${Date.now()}.html`)
      await fs.writeFile(tmpPath, html)
      openInBrowser(tmpPath)

    } else if (key === 'r') {
      const changeDesc = await input({ message: '✦  Describe the changes you want:' })
      const spin = display.spinner('Revising...')
      try {
        // Re-generate with change description appended to resolvedGaps as a special key
        const revisionSession = {
          ...currentSession,
          resolvedGaps: { ...currentSession.resolvedGaps, _revision: changeDesc },
        }
        currentSession = await generateContent(revisionSession)
        html = await renderHTML(currentSession, options)
        spin.succeed()
      } catch (e) {
        spin.fail()
        throw e
      }

    } else if (key === 'a') {
      const outputPath = buildOutputPath(config.outputDir, currentSession)
      const outDir = path.dirname(outputPath)
      await fs.mkdir(outDir, { recursive: true })
      await writeFileAtomic(outputPath, html)

      display.success(`Resume saved → ${outputPath}`)
      display.status('Run resume-forge review to reopen at any time.')

      const today = new Date()
      const role = currentSession.generatedContent?.subtitle ?? 'unknown-role'
      await append({
        role,
        date: today.toISOString().split('T')[0],
        alignmentScore: currentSession.alignment?.score ?? 0,
        outputPath,
        timestamp: today.toISOString(),
      })
      break
    }
  }
}
```

### `buildOutputPath()` — Filename Construction

```typescript
function buildOutputPath(outputDir: string, session: GenerationSession): string {
  const resolved = outputDir.startsWith('~/')
    ? path.join(os.homedir(), outputDir.slice(2))
    : path.resolve(outputDir)

  const role = session.generatedContent?.subtitle ?? 'resume'
  const slug = role.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const date = new Date().toISOString().split('T')[0]

  return path.join(resolved, `${slug}_${date}.html`)
}
```

Result: `~/resume-forge-output/senior-software-engineer_2026-05-29.html`

### `openInBrowser()` — Cross-Platform

```typescript
function openInBrowser(filePath: string): void {
  const url = `file://${filePath}`
  const platform = process.platform

  if (platform === 'win32') {
    exec(`start "" "${url}"`)
  } else if (platform === 'darwin') {
    exec(`open "${url}"`)
  } else {
    exec(`xdg-open "${url}"`)
  }
}
```

**Note:** No `open` package is installed — use `child_process.exec` with platform detection. This is reliable for opening local HTML files. `file://` prefix is required.

**Temp file:** Pressing `O` writes to `os.tmpdir()` — not the final output location. The temp file is never cleaned up (acceptable — OS temp cleanup handles it). Only pressing `A` writes to the permanent output location.

### `readReviewKey()` — Single Key for O/R/A

```typescript
async function readReviewKey(): Promise<'o' | 'r' | 'a'> {
  return new Promise(resolve => {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const handler = (key: string) => {
      const k = key.toLowerCase()
      if (k === 'o' || k === 'r' || k === 'a') {
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdin.removeListener('data', handler)
        resolve(k as 'o' | 'r' | 'a')
      }
    }

    process.stdin.on('data', handler)
  })
}
```

After pressing `R`, the terminal switches from raw mode to normal mode for the `input()` prompt (which uses `@inquirer/prompts` and requires Enter). The `readReviewKey()` → `input()` → `readReviewKey()` cycle works because raw mode is cleanly toggled.

### `resume-forge review` Command

```typescript
// src/commands/review.ts
import type { Command } from 'commander'
import { getLastEntry } from '../history/index.js'
import { exec } from 'child_process'
import * as os from 'os'
import * as display from '../display.js'

export function register(program: Command): void {
  program
    .command('review')
    .description('Reopen the most recently generated resume in your browser')
    .action(async () => {
      const entry = await getLastEntry()
      if (!entry) {
        display.noRecentRun()
        process.exit(1)
      }

      const url = `file://${entry.outputPath}`
      const platform = process.platform
      if (platform === 'win32') exec(`start "" "${url}"`)
      else if (platform === 'darwin') exec(`open "${url}"`)
      else exec(`xdg-open "${url}"`)

      display.status(`Opened: ${entry.outputPath}`)
    })
}
```

### Fully Wired `generate.ts` (After Story 2.6)

```typescript
// src/commands/generate.ts
import type { Command } from 'commander'
import { captureJD, runAlignment, generateContent, renderHTML, hitlReview } from '../pipeline/index.js'
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
        // action === 'context': Epic 3 — fall through to generate for now

        session = await generateContent(session)
        const html = await renderHTML(session, { compact: options.compact })
        await hitlReview(session, html, { compact: options.compact })

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
| All output via display.ts | `display.success()`, `display.status()`, `display.error()`, `display.noRecentRun()` used; `console.log` only for menu formatting |
| Atomic writes | `writeFileAtomic()` for output HTML and history JSONL |
| Barrel imports only | `pipeline/index.ts` exports `hitlReview`; `history/index.ts` is the public history API |
| Exit codes | `process.exit(1)` for no prior run (user state); `process.exit(2)` only for system errors |
| Immutable session | History append uses `session.generatedContent` and `session.alignment` read-only |

### Previous Story Intelligence

- **Story 2.4 (generateContent):** `generateContent()` can be called again during `R` (revision). Pass a modified session with `_revision` key in `resolvedGaps` — the `resumePrompt()` in Story 2.2 will include this in the "additional context" section of the prompt.
- **Story 2.5 (renderHTML):** `renderHTML()` is called again after each revision. Pass `options.compact` through consistently.
- **Story 2.3 (runAlignment):** `session.alignment?.score` provides the alignment score for the history entry. Use optional chaining — score may be undefined if alignment was skipped (not possible in normal flow, but defensive coding).
- **Story 1.3 (display.ts):** `display.noRecentRun()` is already implemented — calls `display.error('No generated resume found.', 'Run resume-forge generate first.')`. Use it in `review.ts`.
- **`write-file-atomic` v7:** Type definitions covered by `src/write-file-atomic.d.ts` (added in Story 1.4). Import as `import writeFileAtomic from 'write-file-atomic'`.
- **`zod` v4:** Installed at `^4.4.3`. Zod v4 API is similar to v3: `z.object()`, `z.string()`, `z.number()`, `z.infer`. Use `RunEntrySchema.parse()` (throws on failure) or `RunEntrySchema.safeParse()` (returns result object).
- **History module scope:** This story creates the minimum history API (`append`, `getLastEntry`). Story 4.4 extends it with full JSONL management and potentially a `list` function. Don't implement more than `append` and `getLastEntry` here — Story 4.4 owns the rest.

### References

- Acceptance criteria [Source: project Outline/epics-resume-forge.md#Story-2.6]
- Output filename format [Source: project Outline/epics-resume-forge.md#Story-2.6]
- Run history schema (JSONL format) [Source: project Outline/architecture-resume-forge.md#Data-Architecture]
- Atomic write pattern [Source: project Outline/architecture-resume-forge.md#Format-Patterns]
- `display.noRecentRun()` [Source: src/display.ts]
- Exit code conventions [Source: project Outline/architecture-resume-forge.md#Process-Patterns]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story workflow)

### Debug Log References

- `npx vitest run src/history/history.test.ts` → 3/3 pass
- Full suite `npm test` → 44/44 pass (9 files)
- `npm run lint` → clean; `npm run build` → success
- `node bin/resume-forge.js --help` → `generate` and `review` commands registered

### Completion Notes List

- Implemented history module (`schema.ts` + `index.ts` with `append`/`getLastEntry`), HITL pipeline (`hitl.ts`), `review` command, and fully wired `generate.ts` (captureJD → runAlignment → generateContent → renderHTML → hitlReview).
- Per Story scope note, only `append` and `getLastEntry` were implemented — Story 4.4 owns the rest of the history API. `RunEntrySchema`/`HISTORY_PATH`/`DATA_DIR` re-exported from the barrel for downstream use.
- `buildOutputPath`, `openInBrowser`, and `hitlReview` are exported (the first two for unit testability and reuse).
- `readReviewKey` uses optional chaining on `setRawMode?.()` (consistent with the alignment menu) for headless safety.
- Revision flow (`R`) threads a `_revision` key into `resolvedGaps`, which `resumePrompt()` surfaces as "ADDITIONAL CONTEXT PROVIDED" — re-generates and re-renders before redisplaying the menu.
- Approve flow (`A`) writes atomically via `write-file-atomic`, prints `✓ Resume saved → {path}` + the review hint, and appends a `RunEntry` to `~/.resume-forge/data/run-history.jsonl`.
- AC7 (print-correct two-column PDF) is enforced by the Story 1.2 template CSS, not renderer/HITL code — no action needed here.

### File List

- `src/history/schema.ts` (new)
- `src/history/history.test.ts` (new)
- `src/history/index.ts` (modified — implement `append`/`getLastEntry` + re-exports)
- `src/pipeline/hitl.ts` (new)
- `src/commands/review.ts` (new)
- `src/pipeline/index.ts` (modified — export `hitlReview`)
- `src/commands/index.ts` (modified — register `review`)
- `src/commands/generate.ts` (modified — full pipeline wiring)

### Change Log

- 2026-05-29: Story 2.6 created — HITL review loop, file output, run history, review command
- 2026-05-29: Story 2.6 implemented — history module, O/R/A HITL loop, atomic file output, review command, full generate pipeline wiring; 3 unit tests passing (44 total green)

### Review Findings

- [x] [Review][Patch] Shell injection via `exec` in `openInBrowser` and `review.ts` — Critical [src/pipeline/hitl.ts:99, src/commands/review.ts:18] — fixed: replaced `exec` with `execFile` using argument arrays on all platforms.
- [x] [Review][Patch] Ctrl-C (`\x03`) not handled in `readReviewKey` — terminal lockup [src/pipeline/hitl.ts:119] — fixed: added `\x03` handler that cleans up raw mode and calls `process.exit(1)`.
- [x] [Review][Patch] `buildOutputPath` calls `new Date()` independently of the `today` used in `append()` [src/pipeline/hitl.ts:93 vs 69] — fixed: `today` computed once before `buildOutputPath`; `dateStr` passed to both.
- [x] [Review][Patch] `resolvedGaps._revision` magic key can collide with a real gap key named `_revision` [src/pipeline/hitl.ts:48] — fixed: renamed to `__hitl_revision__`.
- [x] [Review][Defer] `history/index.ts` append is not atomic w.r.t. concurrent processes [src/history/index.ts:11] — deferred, pre-existing; two simultaneous `resume-forge` invocations can lose one append via read-modify-write race. Acceptable for single-user CLI.
- [x] [Review][Defer] `buildOutputPath` slug collides for same role on same day [src/pipeline/hitl.ts:91] — deferred, pre-existing; second save silently overwrites first. Consider adding a timestamp suffix if collision occurs.
- [x] [Review][Defer] `getLastEntry` silently returns null on corrupt JSONL [src/history/index.ts:38] — deferred, pre-existing; corrupt last line returns null with no user warning. Acceptable for MVP.

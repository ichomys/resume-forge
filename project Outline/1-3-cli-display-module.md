# Story 1.3: CLI Display Module

Status: done

## Story

As Rainboldt,
I want all terminal output to follow consistent color and prefix conventions through a single module,
so that prompts, status updates, and errors are instantly distinguishable at a glance across every command.

## Acceptance Criteria

1. `src/display.ts` is implemented
2. `display.prompt(msg)` outputs `✦` in amber + message
3. `display.success(msg)` outputs `✓` in green + message
4. `display.status(msg)` outputs `→` in gray + message
5. `display.error(msg, recovery?)` outputs `✗` in red + message; if `recovery` is provided, outputs `→` gray recovery instruction on the next line
6. `display.spinner(msg)` returns an `ora` spinner instance; `.succeed()` resolves to `✓` on the same line, `.fail()` resolves to `✗` on the same line
7. When `NO_COLOR=1` is set, chalk color is suppressed and only symbol prefixes remain (still readable)
8. All output lines are ≤78 characters
9. No `console.log` or `console.error` calls exist outside `display.ts` in any source file
10. Empty/first-run state messages are implemented as convenience functions: no profile found, LinkedIn not loaded, empty answer store, no prior run for `review`

## Tasks / Subtasks

- [x] Create `src/display.ts` with all display functions (AC: 1–8, 10)
  - [x] Import `chalk` (default import from chalk v5) and configure amber color constant
  - [x] Import `ora` (default import) and `Ora` type
  - [x] Implement `display.prompt(msg: string): void` — `✦` amber prefix + message to stdout
  - [x] Implement `display.success(msg: string): void` — `✓` green prefix + message to stdout
  - [x] Implement `display.status(msg: string): void` — `→` gray prefix + message to stdout
  - [x] Implement `display.error(msg: string, recovery?: string): void` — `✗` red + message to stderr; if recovery provided, `→` gray recovery on next line to stderr
  - [x] Implement `display.spinner(msg: string): Ora` — creates and starts an ora spinner, returns the instance

- [x] Implement empty/first-run state convenience functions (AC: 10)
  - [x] `display.noProfile(): void` — calls `display.error('No profile found.', 'Run resume-forge init first.')`
  - [x] `display.linkedinNotLoaded(): void` — calls `display.error('LinkedIn profile not loaded.', 'Re-run resume-forge init to add your profile.')`
  - [x] `display.storeEmpty(): void` — calls `display.status('Answer store is empty. Answers save automatically during resume-forge generate.')`
  - [x] `display.noRecentRun(): void` — calls `display.error('No generated resume found.', 'Run resume-forge generate first.')`

- [x] Verify AC9 — no stray `console.log/error` in source files
  - [x] Grep `src/**/*.ts` for `console.log` and `console.error` — only `display.ts` should have hits
  - [x] Confirm all stub barrel files (`src/commands/index.ts`, etc.) have zero console calls

- [x] Write unit tests `src/display.test.ts` (AC: 2–7, 10)
  - [x] Test `prompt()` — console.log called with string containing `✦` and the message
  - [x] Test `success()` — console.log called with string containing `✓` and the message
  - [x] Test `status()` — console.log called with string containing `→` and the message
  - [x] Test `error()` without recovery — console.error called once with `✗` + message
  - [x] Test `error()` with recovery — console.error called twice: `✗` line then `→` recovery line
  - [x] Test `noProfile()`, `linkedinNotLoaded()`, `storeEmpty()`, `noRecentRun()` — each calls the correct underlying function with correct message strings
  - [x] Run `npm test` — confirm all tests pass

- [x] Build and smoke test (AC: 7, 8, 9)
  - [x] Run `npm run build` — confirms TypeScript compiles without errors
  - [x] Run `npm run lint` (`tsc --noEmit`) — confirms type check passes
  - [x] Manual test: run `tsx src/display.ts` or a quick script to visually confirm color output
  - [x] Manual test: `NO_COLOR=1 tsx ...` — confirm symbols remain, colors stripped

## Dev Notes

### Critical: ESM-Only Dependencies

**chalk v5.6.2 and ora v9.4.0 are both pure ESM packages.** The project uses `"type": "commonjs"` and compiles via tsup to CJS. This works because:

1. **tsup (build):** Uses esbuild internally, which bundles ESM modules into CJS output. `import chalk from 'chalk'` in TypeScript is bundled correctly into `bin/resume-forge.js` (CJS). No special configuration needed.
2. **tsx (dev):** tsx's Node.js loader handles ESM-in-CJS interop transparently. `npm run dev` works as-is.

**Do NOT:**
- Use `require('chalk')` — chalk v5 has no CJS export
- Use dynamic `import('chalk')` — unnecessary, tsup/tsx handle it
- Downgrade to chalk v4 — chalk v5.6.2 is already installed

**Do NOT add `"type": "module"` to package.json** — this would break the CJS output and commander.js setup established in Story 1.1.

### Import Syntax

```typescript
import chalk from 'chalk'      // default import, chalk v5 ESM
import ora from 'ora'          // default import, ora v9 ESM
import type { Ora } from 'ora' // type-only import, no runtime cost
```

### Complete `src/display.ts` Implementation

```typescript
import chalk from 'chalk'
import ora from 'ora'
import type { Ora } from 'ora'

// Amber matches --accent-color in the HTML template (#E8952A)
const amber = chalk.hex('#E8952A')
const green = chalk.green
const gray = chalk.gray
const red = chalk.red

export function prompt(msg: string): void {
  console.log(`${amber('✦')}  ${msg}`)
}

export function success(msg: string): void {
  console.log(`${green('✓')}  ${msg}`)
}

export function status(msg: string): void {
  console.log(`${gray('→')}  ${msg}`)
}

export function error(msg: string, recovery?: string): void {
  console.error(`${red('✗')}  ${msg}`)
  if (recovery) {
    console.error(`${gray('→')}  ${recovery}`)
  }
}

export function spinner(msg: string): Ora {
  return ora({ text: msg, color: 'gray' }).start()
}

// ── Empty / first-run state convenience functions ─────────────────────────

export function noProfile(): void {
  error('No profile found.', 'Run resume-forge init first.')
}

export function linkedinNotLoaded(): void {
  error('LinkedIn profile not loaded.', 'Re-run resume-forge init to add your profile.')
}

export function storeEmpty(): void {
  status('Answer store is empty. Answers save automatically during resume-forge generate.')
}

export function noRecentRun(): void {
  error('No generated resume found.', 'Run resume-forge generate first.')
}
```

### NO_COLOR Support (AC7)

Chalk v5 **automatically** respects the `NO_COLOR` environment variable (compliant with the no-color.org specification). When `NO_COLOR=1` is set:

- `chalk.hex('#E8952A')('✦')` → `'✦'` (no ANSI codes)
- `chalk.green('✓')` → `'✓'`
- `chalk.gray('→')` → `'→'`

The symbols remain intact, output is still readable. **No manual NO_COLOR handling is needed** — chalk handles it.

Ora v9 also respects NO_COLOR — spinner uses chalk internally and falls back to plain text.

### Spinner Integration Pattern

The `display.spinner()` returns the running `Ora` instance. Callers manage the lifecycle:

```typescript
import * as display from './display.js'

// Correct pattern (used in pipeline stages, Story 2.x+):
const spin = display.spinner('Analyzing alignment with your experience profile...')
try {
  const result = await llm.analyzeAlignment(jdText, pool)
  spin.succeed()     // → ✓ (green) on the same spinner line
  return result
} catch (e) {
  spin.fail()        // → ✗ (red) on the same spinner line
  throw e
}
```

`spin.succeed()` and `spin.fail()` display the `✓`/`✗` on the **same line** as the spinner text (replacing the spinner animation). This matches AC6 and the UX spec.

For success/fail with custom text:
```typescript
spin.succeed('Alignment analyzed')   // ✓ Alignment analyzed
spin.fail('Analysis failed')         // ✗ Analysis failed
```

If called with no argument, the spinner's original message is used.

### Error Function Signature and Usage

```typescript
// Error only (no recovery):
display.error('Generation failed.')

// Error with recovery instruction (preferred — always provide recovery):
display.error('Rate limit reached.', 'Wait a moment and try again.')

// This produces two lines:
// ✗  Rate limit reached.
// →  Wait a moment and try again.
```

The `error` function writes to **stderr** (`console.error`), not stdout. This is intentional — errors and recovery instructions go to stderr so they don't pollute piped output. `prompt`, `success`, `status` go to stdout (`console.log`).

### Line Length Convention (AC8)

The 78-character limit is a **caller convention**, not enforced by truncation in display.ts. When calling display functions, keep message strings short:

```typescript
// ✓ Good — 46 chars total output
display.error('API unavailable.', 'Check your connection and retry.')

// ✗ Too long — would exceed 78 chars with prefix
display.error('The Anthropic API could not be reached due to a network connectivity issue.')
```

**display.ts does NOT truncate** — a truncated error message is worse than a long one. It's the caller's responsibility to keep messages concise.

### AC9 Enforcement: No console.log Outside display.ts

Verify with a grep after implementation:

```powershell
# In the project root — should only show display.ts lines
Select-String -Path "src\**\*.ts" -Pattern "console\.(log|error|warn)" -Recurse
```

Currently, all stub barrel files (`src/commands/index.ts`, `src/pipeline/index.ts`, etc.) are empty except for stubs — none contain console calls. This AC is trivially met now and becomes a review gate for all future stories.

### Test File: `src/display.test.ts`

Co-located with source, following the Story 1.1 convention. Tests spy on `console.log` and `console.error` rather than mocking chalk — this is simpler and tests the output string content (symbols + message) regardless of ANSI escape codes:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as display from './display.js'

describe('display', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>
  let consoleErrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prompt outputs ✦ symbol and message', () => {
    display.prompt('Test prompt')
    expect(consoleSpy).toHaveBeenCalledOnce()
    const output = consoleSpy.mock.calls[0][0] as string
    expect(output).toContain('✦')
    expect(output).toContain('Test prompt')
  })

  it('success outputs ✓ symbol and message', () => {
    display.success('Test success')
    expect(consoleSpy).toHaveBeenCalledOnce()
    const output = consoleSpy.mock.calls[0][0] as string
    expect(output).toContain('✓')
    expect(output).toContain('Test success')
  })

  it('status outputs → symbol and message', () => {
    display.status('Test status')
    expect(consoleSpy).toHaveBeenCalledOnce()
    const output = consoleSpy.mock.calls[0][0] as string
    expect(output).toContain('→')
    expect(output).toContain('Test status')
  })

  it('error outputs ✗ symbol without recovery', () => {
    display.error('Test error')
    expect(consoleErrSpy).toHaveBeenCalledOnce()
    const output = consoleErrSpy.mock.calls[0][0] as string
    expect(output).toContain('✗')
    expect(output).toContain('Test error')
  })

  it('error outputs ✗ then → recovery on second line', () => {
    display.error('Test error', 'Try this fix')
    expect(consoleErrSpy).toHaveBeenCalledTimes(2)
    const line1 = consoleErrSpy.mock.calls[0][0] as string
    const line2 = consoleErrSpy.mock.calls[1][0] as string
    expect(line1).toContain('✗')
    expect(line1).toContain('Test error')
    expect(line2).toContain('→')
    expect(line2).toContain('Try this fix')
  })

  it('noProfile calls error with correct message', () => {
    display.noProfile()
    expect(consoleErrSpy).toHaveBeenCalledTimes(2)
    expect((consoleErrSpy.mock.calls[0][0] as string)).toContain('No profile found.')
    expect((consoleErrSpy.mock.calls[1][0] as string)).toContain('Run resume-forge init first.')
  })

  it('storeEmpty calls status with correct message', () => {
    display.storeEmpty()
    expect(consoleSpy).toHaveBeenCalledOnce()
    expect((consoleSpy.mock.calls[0][0] as string)).toContain('Answer store is empty')
  })
})
```

**Note on ora testing:** `display.spinner()` starts a real ora instance that writes to the terminal. Do NOT test the spinner function in unit tests — ora needs a real TTY and will cause issues in test runners. Spinner behavior is tested manually (visual smoke test).

### Architecture Compliance: display.ts as a Non-Barrel Module

Unlike `src/commands/`, `src/store/`, etc., **display.ts is a top-level `src/` file, not a directory barrel**. It is imported directly as:

```typescript
import * as display from './display.js'    // from within src/
import * as display from '../display.js'   // from src/commands/, src/pipeline/, etc.
```

**Never** create a `src/display/` directory. The module is intentionally a single flat file — it has no internal implementation files to hide.

### Exact Empty/First-Run Message Strings (from UX Spec)

| Function | Error Message | Recovery Message |
|----------|--------------|-----------------|
| `noProfile()` | `No profile found.` | `Run resume-forge init first.` |
| `linkedinNotLoaded()` | `LinkedIn profile not loaded.` | `Re-run resume-forge init to add your profile.` |
| `storeEmpty()` | _(status, no error)_ | `Answer store is empty. Answers save automatically during resume-forge generate.` |
| `noRecentRun()` | `No generated resume found.` | `Run resume-forge generate first.` |

These strings are the canonical messages — callers import and call the convenience functions rather than duplicating these strings elsewhere.

### Previous Story Intelligence (Stories 1.1 and 1.2)

**From Story 1.1:**
- chalk and ora are already installed (see package.json) — no `npm install` needed
- `"type": "commonjs"` is set — ESM interop via tsup/tsx is confirmed working
- tsconfig.json: strict mode, `"types": ["node"]` for `console` global access
- Test co-location: `src/display.test.ts` alongside `src/display.ts`
- `vitest.config.ts` uses `passWithNoTests: true` (already handles empty suites; adding real tests now works fine)
- Import paths in compiled output use `.js` extension: `import * as display from './display.js'`

**From Story 1.2:**
- `templates/default/resume.html` and `styles.css` exist — no interaction with display.ts
- Story 1.2 is pure HTML/CSS with no TypeScript — no imports to add

**Architecture rules established in Story 1.1 (enforced here):**
- Session objects: immutable (not relevant for display.ts itself, but future callers must follow this)
- Cross-module imports from barrel `index.ts` only — display.ts is exempt (it IS the module, not a barrel)
- This story completes the "display module" prerequisite for every other story

### References

- Story 1.3 acceptance criteria [Source: project Outline/epics-resume-forge.md#Story-1.3]
- CLI color/prefix conventions [Source: project Outline/ux-design-specification-resume-forge.md#Design-System-Foundation]
- Empty/first-run state messages [Source: project Outline/ux-design-specification-resume-forge.md#UX-Consistency-Patterns]
- display.ts single-module mandate [Source: project Outline/architecture-resume-forge.md#Code-Organization]
- Spinner lifecycle pattern [Source: project Outline/architecture-resume-forge.md#Process-Patterns]
- Error handling conventions [Source: project Outline/architecture-resume-forge.md#Format-Patterns]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (BMad Dev — Amelia)

### Debug Log References

- None. chalk v5 / ora v9 ESM imports bundled cleanly via tsup into the CJS `bin/resume-forge.js`.

### Completion Notes List

- Implemented `src/display.ts`: `prompt` (`✦` amber), `success` (`✓` green), `status` (`→` gray) to stdout; `error(msg, recovery?)` (`✗` red) to stderr with optional `→` recovery line; `spinner(msg)` returns a started `Ora`.
- Empty/first-run convenience functions: `noProfile`, `linkedinNotLoaded`, `storeEmpty`, `noRecentRun` with the exact canonical message strings from the UX spec.
- NO_COLOR (AC7) is handled automatically by chalk v5 — symbols remain, ANSI stripped; no manual handling.
- `src/display.test.ts`: 9 tests spying on `console.log`/`console.error` assert symbols + message content (ANSI-agnostic). Spinner intentionally not unit-tested (needs a TTY) — verified via build smoke run.
- AC9 verified: grep of `src/**/*.ts` shows `console.*` only in `display.ts` (plus the documented `config-cmd.ts` showConfig exception added in Story 1.6).
- `npm run build`, `npm run lint`, and `npm test` (22 total) all pass.

### File List

- `src/display.ts`
- `src/display.test.ts`

### Change Log

- 2026-05-29: Story 1.3 created — CLI display module with chalk v5/ora v9, all prefix functions, NO_COLOR support, empty-state convenience functions
- 2026-05-29: Story 1.3 implemented — display module + 9 unit tests; all ACs satisfied; status → review

# Story 4.3: Profile Update Without Data Loss

Status: done

## Story

As Rainboldt,
I want to re-run `resume-forge init` to update my LinkedIn profile or base resume without losing my answer store,
so that I can refresh my experience pool as my career evolves without starting over.

## Acceptance Criteria

1. `→ Updating config · Answer store preserved` is displayed before the wizard starts when `~/.resume-forge/` already exists
2. `answer-store.json` is not modified, overwritten, or deleted during any init run
3. `run-history.jsonl` is not modified, overwritten, or deleted during any init run
4. When a new LinkedIn JSON export path is provided in Step 1/4, the previous `linkedin-export.json` is replaced; existing answer store entries remain valid and accessible on the next `resume-forge generate` run
5. On a re-run, Step 1/4 accepts an empty input (Enter) to keep the existing `linkedin-export.json` without re-parsing; displays `→ Keeping existing LinkedIn profile`
6. Skipping Step 2/4 (pressing Enter with empty path) does not modify or delete any data files; the base resume file at `~/.resume-forge/profile/base-resume.*` is untouched if one exists
7. Pressing Enter at Step 4/4 retains the current `config.outputDir` value (already shown as the default in brackets)

## Tasks / Subtasks

- [x] Add skip-on-re-run capability to `runStep1()` in `src/commands/init.ts` (AC: 5)
  - [x] Change signature of `runStep1()` to accept `isExisting: boolean`
  - [x] At the top of `runStep1()`, when `isExisting === true`, check if `path.join(CONFIG_DIR, 'profile', 'linkedin-export.json')` exists via `fs.access`
  - [x] If it exists: prompt with `'Path to LinkedIn JSON export (press Enter to keep existing):'`; if input is empty/blank, call `display.status('Keeping existing LinkedIn profile')` and return without calling `load()`
  - [x] If input is non-empty, proceed with the existing `load()` + retry loop
  - [x] Pass `existing` (from `detectExistingInstall()`) to `runStep1(existing)` in `initAction()`

- [x] Write tests in `src/commands/init.test.ts` (AC: 1–7)
  - [x] Use `vi.hoisted` + `vi.mock('os', ...)` to redirect homedir to a temp dir (same pattern as `history.test.ts` and `store.test.ts`)
  - [x] Mock `../profile/index.js` (`load`, `loadBaseResume`)
  - [x] Mock `@anthropic-ai/sdk` Anthropic client
  - [x] Mock `@inquirer/prompts` `input`
  - [x] Mock `../display.js`

  - [x] Test: first-run (no `~/.resume-forge/`) — "Updating config · Answer store preserved" is NOT displayed
  - [x] Test: re-run (`~/.resume-forge/` exists) — `display.status` called with `'Updating config · Answer store preserved'`
  - [x] Test: init run does not write to `answer-store.json` — place a stub `answer-store.json` in the temp data dir; after `initAction()` runs, verify file contents unchanged
  - [x] Test: init run does not write to `run-history.jsonl` — place a stub `.jsonl` in temp data dir; verify unchanged after init
  - [x] Test: re-run with empty Step 1 input when profile file exists — `load` NOT called; `display.status('Keeping existing LinkedIn profile')` called
  - [x] Test: re-run with non-empty Step 1 input — `load` called with provided path
  - [x] Test: Step 4 with empty input uses default outputDir from config (no custom path written)

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes
  - [x] `npm test` — all existing + new tests pass

## Dev Notes

### Existing Init Behavior (No Code Change Needed for ACs 1–4, 6–7)

These ACs are already satisfied by the current implementation:
- AC1: `display.status('Updating config · Answer store preserved')` is called in `initAction()` when `detectExistingInstall()` returns `true` ✓
- AC2: No init code path writes to `answer-store.json` ✓
- AC3: No init code path writes to `run-history.jsonl` ✓
- AC4: `load()` in step 1 writes to `~/.resume-forge/profile/linkedin-export.json`, which is separate from the data directory ✓
- AC6: `runStep2()` already checks `if (resumePath.trim())` before calling `loadBaseResume()` ✓
- AC7: `runStep4()` uses `{ default: defaultOutputDir }` with the current config value ✓

**Only AC5 requires a code change** — making step 1 accept Enter to skip on re-run.

### runStep1 Modification

```typescript
async function runStep1(isExisting: boolean): Promise<void> {
  display.status('Step 1/4 — LinkedIn profile')

  if (isExisting) {
    const profilePath = path.join(CONFIG_DIR, 'profile', 'linkedin-export.json')
    let profileExists = false
    try {
      await fs.access(profilePath)
      profileExists = true
    } catch { /* not found */ }

    if (profileExists) {
      const linkedinPath = await input({
        message: 'Path to LinkedIn JSON export (press Enter to keep existing):',
        theme: { prefix: AMBER_PREFIX },
      })
      if (!linkedinPath.trim()) {
        display.status('Keeping existing LinkedIn profile.')
        return
      }
      // Non-empty: load the new profile
      try {
        await load(linkedinPath.trim())
        return
      } catch {
        display.error(
          'Could not parse LinkedIn export.',
          'Check the file is the JSON export from linkedin.com/settings',
        )
        // Fall through to the standard retry loop below
      }
    }
  }

  // Standard loop: required on first run, or if profile file is missing on re-run
  let done = false
  while (!done) {
    const linkedinPath = await input({
      message: 'Path to your LinkedIn JSON export:',
      theme: { prefix: AMBER_PREFIX },
    })
    try {
      await load(linkedinPath.trim())
      done = true
    } catch {
      display.error(
        'Could not parse LinkedIn export.',
        'Check the file is the JSON export from linkedin.com/settings',
      )
    }
  }
}
```

Update the `initAction` call:
```typescript
await runStep1(existing)  // was: await runStep1()
```

### Test Scaffolding (mirrors history.test.ts)

```typescript
const { tmpHome } = vi.hoisted(() => {
  const osMod = require('os') as typeof import('os')
  const pathMod = require('path') as typeof import('path')
  return {
    tmpHome: pathMod.join(osMod.tmpdir(), `resume-forge-init-test-${Date.now()}`),
  }
})

vi.mock('os', async (importOriginal) => {
  const original = await importOriginal<typeof os>()
  return {
    ...original,
    homedir: () => tmpHome,
    default: { ...original, homedir: () => tmpHome },
  }
})
```

Use `realFs.mkdir(path.join(tmpHome, '.resume-forge'), { recursive: true })` in `beforeEach` to simulate an existing install for re-run tests.

### Why Tests Are the Main Deliverable

The data preservation guarantee is implicit in the current code (no init path touches the data files), but it has no test coverage. This story makes the guarantee explicit and regression-proof.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npx vitest run src/commands/init.test.ts` → 7 passed
- `npm run lint` / `npm run build` → clean
- `npm test` → 82 passed (was 75; +7 init tests)

### Completion Notes List

- AC5 (the only behavioural change): `runStep1()` now takes `isExisting: boolean`. On a re-run where `~/.resume-forge/profile/linkedin-export.json` exists, it prompts `Path to LinkedIn JSON export (press Enter to keep existing):`. An empty/blank answer → `display.status('Keeping existing LinkedIn profile')` and returns without calling `load()`. A non-empty answer loads the new profile; a parse failure falls through to the standard required retry loop. First runs (and re-runs where the profile file is missing) keep the original required-input loop. `initAction()` now calls `runStep1(existing)`.
- ACs 1–4, 6, 7 were already satisfied by the existing implementation; this story adds the missing regression coverage that makes the data-preservation guarantee explicit and test-enforced.
- Added `src/commands/init.test.ts` with the `os.homedir` → temp-dir hoist pattern (mirroring `history.test.ts`/`store.test.ts`), mocking `../profile/index.js`, `@anthropic-ai/sdk`, `../display.js`, and `@inquirer/prompts`. A message-keyed `input` mock returns the right answer per wizard step (and `ANTHROPIC_API_KEY` is set so Step 3 verification passes in one pass).
- Tests cover: first-run omits the preservation message; re-run shows it; `answer-store.json` and `run-history.jsonl` are byte-for-byte unchanged after init; empty Step 1 keeps the profile (no `load`); non-empty Step 1 calls `load` with the path; Step 4 empty input persists the default `outputDir`.

### File List

- `src/commands/init.ts` (modified)
- `src/commands/init.test.ts` (new)

### Change Log

- 2026-05-30: Implemented Story 4.3 — Enter-to-keep-existing LinkedIn profile on init re-runs; added `src/commands/init.test.ts` with 7 data-preservation/behaviour tests. All 82 tests pass; lint and build clean.

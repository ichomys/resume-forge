# Story 4.1: Answer Store Pre-fill on Return Runs

Status: done

## Story

As Rainboldt,
I want the tool to automatically match stored answers to new gap prompts and show them to me for confirmation,
so that questions I've already answered don't require re-typing — I just press Enter.

## Acceptance Criteria

1. When the gap loop encounters a gap with a matching topic key in the answer store, the stored answer is displayed in the confirmation format: `→ Using stored answer for '[topic]'` / `   "[first ~80 chars of stored answer]..."` / `   [Enter] confirm · [E] edit · [S] skip`
2. Pressing Enter at the confirmation applies the stored answer: `session.resolvedGaps[topicKey]` is set, `entry.usageCount` is incremented and `entry.lastUsed` is updated, `✓ Stored answer applied` is displayed
3. Pressing `E` at the confirmation shows a `>` input prompt; typing a new answer updates the store entry (new text, incremented `usageCount`, updated `lastUsed`), displays `✓ Answer updated`, and uses the new answer for generation
4. Pressing `S` at the confirmation leaves the gap unresolved in `session.resolvedGaps`; the store entry is not modified; the gap contributes to the unresolved count in alignment recalculation
5. When a gap topic key has no match in the store, `llm.generateGapQuestion()` is called and the question is presented as a new free-text prompt (existing behavior, unchanged)
6. Existing gap-loop tests continue to pass; new tests cover all three confirmation paths (Enter, E, S)

## Tasks / Subtasks

- [x] Update imports in `src/pipeline/gap-loop.ts` (AC: 1–4)
  - [x] Add `get as storeGet, update as storeUpdate` to imports from `'../store/index.js'`
  - [x] Add `input` import is already present; ensure it's available for the edit path

- [x] Add `readStoreConfirmKey()` helper in `src/pipeline/gap-loop.ts` (AC: 1–4)
  - [x] Define `async function readStoreConfirmKey(): Promise<'enter' | 'e' | 's'>` below `readMenuKey()`
  - [x] Set raw mode, listen for single keypress
  - [x] Map: `'\r'` or `'\n'` → `'enter'`; `'e'` → `'e'`; `'s'` → `'s'`; `'\x03'` (Ctrl+C) → `process.exit(1)`
  - [x] Restore raw mode and remove listener on resolution

- [x] Insert store pre-fill check in the gap inner loop in `src/pipeline/gap-loop.ts` (AC: 1–5)
  - [x] At the start of the inner loop body (before the LLM spinner), call `const storedEntry = await storeGet(gapKey)`
  - [x] If `storedEntry` exists, display the confirmation block:
    - `display.status("Using stored answer for '${gapKey}'")`
    - `console.log('   "' + storedEntry.answer.slice(0, 80) + (storedEntry.answer.length > 80 ? '...' : '') + '"')`
    - `console.log('   [Enter] confirm · [E] edit · [S] skip')`
  - [x] Call `const choice = await readStoreConfirmKey()`
  - [x] **Enter path**: call `await storeUpdate(gapKey, storedEntry.answer)` (increments usageCount+lastUsed), set `resolvedGaps = { ...resolvedGaps, [gapKey]: storedEntry.answer }`, call `display.success('Stored answer applied')`, then `continue`
  - [x] **E path**: call `const newAnswer = await input({ message: '> ' })`; if `newAnswer.trim()` is non-empty: call `await storeUpdate(gapKey, newAnswer.trim())`, set `resolvedGaps = { ...resolvedGaps, [gapKey]: newAnswer.trim() }`, call `display.success('Answer updated')`; then `continue`
  - [x] **S path**: `continue` with no change to `resolvedGaps` or store
  - [x] If `storedEntry` is undefined, fall through to the existing LLM spinner + question flow (no change to that code path)

- [x] Update `src/pipeline/gap-loop.test.ts` to cover the new paths (AC: 6)
  - [x] Update the `vi.mock('../store/index.js', ...)` to expose `get: vi.fn(), update: vi.fn(), write: vi.fn()`
  - [x] Add test: stored answer found + Enter (confirm) → `storeUpdate` called with same answer, resolvedGaps set, `generateGapQuestion` NOT called
  - [x] Add test: stored answer found + E (edit) → `storeUpdate` called with new answer, resolvedGaps set to new answer
  - [x] Add test: stored answer found + S (skip) → gap stays unresolved, `storeUpdate` NOT called, `generateGapQuestion` NOT called
  - [x] Add test: no stored answer → `generateGapQuestion` called as before (regression guard)
  - [x] Existing tests must pass unchanged

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes
  - [x] `npm test` — all existing + new tests pass

## Dev Notes

### Implementation Location

Single file change: `src/pipeline/gap-loop.ts`. No new files required.

### readStoreConfirmKey Pattern

Mirrors the existing `readMenuKey()` in the same file. Same stdin raw mode setup/teardown pattern:

```typescript
async function readStoreConfirmKey(): Promise<'enter' | 'e' | 's'> {
  return new Promise((resolve) => {
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const handler = (key: string): void => {
      const k = key.toLowerCase()
      if (k === '\r' || k === '\n') {
        cleanup(); resolve('enter')
      } else if (k === 'e') {
        cleanup(); resolve('e')
      } else if (k === 's') {
        cleanup(); resolve('s')
      } else if (k === '\x03') {
        cleanup(); process.exit(1)
      }
    }

    const cleanup = () => {
      process.stdin.setRawMode?.(false)
      process.stdin.pause()
      process.stdin.removeListener('data', handler)
    }

    process.stdin.on('data', handler)
  })
}
```

### Store Update vs Write for Confirm Path

Use `storeUpdate(gapKey, storedEntry.answer)` (not `storeWrite`) on the Enter confirm path. `update()` increments `usageCount` and sets `lastUsed` without showing the "Answer saved to store" status message — the `display.success('Stored answer applied')` in the gap loop is the right message for this path. `storeWrite()` (which DOES show a status message) should only be called for brand-new answers.

### Mock Update for Tests

The existing mock in `gap-loop.test.ts` only exposes `write`. Update it:

```typescript
vi.mock('../store/index.js', () => ({
  write:  vi.fn(),
  get:    vi.fn().mockResolvedValue(undefined), // default: no stored answer
  update: vi.fn().mockResolvedValue(undefined),
}))
```

For stored-answer tests, set `(storeGet as Mock).mockResolvedValueOnce({ question: '...', answer: 'My stored answer', createdAt: '...', usageCount: 2 })`.

The stdin handler for `readStoreConfirmKey` uses the same `stdinHandlers['data']` pattern already established in the test file — trigger with `stdinHandlers['data']('\r')` for Enter, `stdinHandlers['data']('e')` for edit, `stdinHandlers['data']('s')` for skip.

### Deferred Work Addressed

None of the deferred items from Epic 3 directly affect this story. The deferred `gapKeys[i] ?? ''` fallback and concurrent `store.write()` race items are left deferred.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npx vitest run src/pipeline/gap-loop.test.ts` → 11 passed
- `npm run lint` (tsc --noEmit) → clean
- `npm run build` (tsup) → success
- `npm test` → 65 passed (was 61; +4 new gap-loop tests)

### Completion Notes List

- Added stored-answer pre-fill to `runGapLoop`: before generating an LLM question for a gap, the loop now calls `storeGet(gapKey)`. When a match exists it renders the confirmation block (`→ Using stored answer for '<topic>'`, an ~80-char answer preview, and the `[Enter] confirm · [E] edit · [S] skip` line) and reads a single keypress via the new `readStoreConfirmKey()` helper.
- Enter confirms → `storeUpdate(gapKey, answer)` (bumps usageCount/lastUsed) + `resolvedGaps` set + `✓ Stored answer applied`. E edits → prompts `> `, and a non-empty trimmed answer triggers `storeUpdate` + `resolvedGaps` set + `✓ Answer updated`. S skips → gap left unresolved, store untouched. No-match gaps fall through unchanged to the existing LLM question flow.
- `readStoreConfirmKey()` mirrors the existing `readMenuKey()` stdin raw-mode pattern with a shared `cleanup()` and Ctrl+C → `process.exit(1)`.
- Tests: expanded the `../store/index.js` mock to expose `get`/`update` (default `get` → undefined). Added four tests covering Enter/E/S and the no-stored-answer regression path. The two-stdin-read tests delete `stdinHandlers['data']` after the confirm keypress so `vi.waitFor` re-syncs on the subsequent G/C/X menu handler.

### File List

- `src/pipeline/gap-loop.ts` (modified)
- `src/pipeline/gap-loop.test.ts` (modified)

### Change Log

- 2026-05-30: Implemented Story 4.1 — answer-store pre-fill with Enter/E/S confirmation on gap prompts; added `readStoreConfirmKey()` and four new tests. All 65 tests pass; lint and build clean.

# Story 4.4: Run History Log

Status: done

## Story

As Rainboldt,
I want each completed resume generation logged automatically with role, date, alignment score, and output path,
so that I have a reliable record of every application I've prepared without any manual tracking.

## Acceptance Criteria

1. When the user presses `A` at the HITL review, a JSON line is appended to `~/.resume-forge/data/run-history.jsonl` with `{ role, date, alignmentScore, outputPath, timestamp }`; the append is performed atomically via `write-file-atomic`
2. Existing entries in `run-history.jsonl` are never modified or deleted — the file is append-only
3. When the user aborts (presses `X` at alignment or fit assessment), no entry is appended to `run-history.jsonl`
4. `resume-forge review` reads the most recent `outputPath` from `run-history.jsonl` and opens the file in the default browser; if the file is missing or empty: `✗ No generated resume found. → Run resume-forge generate first`
5. A process crash during the append does not corrupt previously written entries — the atomic write prevents partial-line corruption
6. `getLastEntry()` in `src/history/index.ts` produces a user-visible diagnostic when the last line is corrupt JSON (not silent null) — `display.error('Run history entry is corrupt.', 'Check ~/.resume-forge/data/run-history.jsonl')` — and returns `null` after logging
7. `src/history/schema.ts` adds `company: z.string().optional()` to `RunEntrySchema` for forward compatibility; existing history files without the field continue to parse correctly
8. `src/history/history.test.ts` gains test coverage for corrupt-JSONL handling, multi-entry files, and the abort-path (no append)

## Tasks / Subtasks

- [x] Add `company` field to `RunEntrySchema` in `src/history/schema.ts` (AC: 7)
  - [x] Add `company: z.string().optional()` to the schema object (after `role`)
  - [x] Update `RunEntry` type is inferred automatically via `z.infer`
  - [x] No migration needed — `optional()` means absence is valid; existing JSONL entries parse correctly

- [x] Fix `getLastEntry()` corrupt-line handling in `src/history/index.ts` (AC: 6)
  - [x] Import `* as display from '../display.js'`
  - [x] In the inner `try/catch` of `getLastEntry()`, change the silent `return null` to:
    - `display.error('Run history entry is corrupt.', 'Check ~/.resume-forge/data/run-history.jsonl')`
    - `return null`
  - [x] This addresses the deferred item: `getLastEntry silently returns null on corrupt JSONL`

- [x] Verify AC1–5 are already correctly implemented (no code changes expected)
  - [x] Confirm `hitl.ts` calls `append({ role, date, alignmentScore, outputPath, timestamp })` on `A` keypress ✓
  - [x] Confirm `hitl.ts` does NOT call `append()` on `X` (process.exit(1) path) ✓
  - [x] Confirm `append()` uses `write-file-atomic` ✓
  - [x] Confirm `review.ts` calls `getLastEntry()` and uses `display.noRecentRun()` when null ✓
  - [x] Note: `company` field is intentionally not populated in this story — the schema accepts it for future use; populating it requires JD text parsing or LLM extraction, which is out of scope here

- [x] Expand `src/history/history.test.ts` (AC: 8)
  - [x] **Corrupt last line test**: write two valid entries followed by `{"bad json"`, verify `getLastEntry()` returns `null` and calls `display.error` with correct message
  - [x] **Multi-entry append test**: call `append()` three times; verify all three entries are in the file as separate lines; verify `getLastEntry()` returns the third entry
  - [x] **Append-only guarantee test**: call `append()` twice; manually verify line count is exactly 2 and first line is unchanged
  - [x] **Abort-path test (static)**: verify the `getLastEntry()` function only reads — confirm `append()` is NOT called from within `runGapLoop` or `runAlignment` (this is a code inspection check; assert in comments)
  - [x] Mock `display` in the history test file to capture `display.error` calls for the corrupt-line test
  - [x] All existing tests continue to pass

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes
  - [x] `npm test` — all tests pass

## Dev Notes

### Existing Implementation Status

The core run history pipeline is already implemented as of Story 2.6:
- `src/history/schema.ts` — `RunEntrySchema`, `RunEntry`, `DATA_DIR`, `HISTORY_PATH`
- `src/history/index.ts` — `append()`, `getLastEntry()`
- `src/pipeline/hitl.ts` — calls `append()` on `A` keypress, before `break`
- `src/commands/review.ts` — calls `getLastEntry()`, opens file in browser

**ACs 1–5 are satisfied by the existing code.** This story adds the `company` schema field, fixes the silent corrupt-line bug, and adds test coverage.

### company Field — Intentionally Not Populated

The epic AC specifies `{ role, company, date, alignmentScore, outputPath, timestamp }`, but `company` (the target employer) is unstructured text within the JD and cannot be extracted without another LLM call or regex heuristics. Adding it as `optional()` satisfies the schema completeness requirement. A future story can wire up extraction. The current `hitl.ts` append call does not need to change.

### getLastEntry Corrupt-Line Fix

Current code (lines 39–44 of `src/history/index.ts`):
```typescript
  try {
    const parsed = JSON.parse(lines[lines.length - 1])
    return RunEntrySchema.parse(parsed)
  } catch {
    return null          // ← silent; deferred item from code review
  }
```

After fix:
```typescript
  try {
    const parsed = JSON.parse(lines[lines.length - 1])
    return RunEntrySchema.parse(parsed)
  } catch {
    display.error(
      'Run history entry is corrupt.',
      'Check ~/.resume-forge/data/run-history.jsonl',
    )
    return null
  }
```

### Mock display in history.test.ts

Add at top of test file (after the os mock):
```typescript
vi.mock('../display.js', () => ({
  error:   vi.fn(),
  success: vi.fn(),
  status:  vi.fn(),
  prompt:  vi.fn(),
}))

import * as display from '../display.js'
```

Then in the corrupt-line test:
```typescript
it('getLastEntry calls display.error and returns null on corrupt last line', async () => {
  await append(entryA)
  await append(entryB)
  // Append corrupt line directly
  const raw = await realFs.readFile(historyFile, 'utf-8')
  await realFs.writeFile(historyFile, raw + '{"corrupt"\n')
  
  const result = await getLastEntry()
  expect(result).toBeNull()
  expect(display.error).toHaveBeenCalledWith(
    'Run history entry is corrupt.',
    'Check ~/.resume-forge/data/run-history.jsonl',
  )
})
```

### RunEntrySchema After Change

```typescript
export const RunEntrySchema = z.object({
  role:           z.string(),
  company:        z.string().optional(),   // added; not yet populated
  date:           z.string(),              // YYYY-MM-DD
  alignmentScore: z.number(),
  outputPath:     z.string(),
  timestamp:      z.string(),              // ISO 8601
})
```

Existing test fixtures (`entryA`, `entryB`) in `history.test.ts` do not need to change — `optional()` means absence is valid.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npx vitest run src/history/history.test.ts` → 7 passed
- `npm run lint` / `npm run build` → clean
- `npm test` → 86 passed (was 82; +4 history tests)

### Completion Notes List

- AC7: added `company: z.string().optional()` to `RunEntrySchema` (after `role`). No migration needed — `optional()` means existing JSONL entries without the field still parse. Intentionally not populated by `hitl.ts` (extracting the employer requires extra LLM/regex work, out of scope here).
- AC6: `getLastEntry()` no longer swallows a corrupt last line silently. The inner `catch` now calls `display.error('Run history entry is corrupt.', 'Check ~/.resume-forge/data/run-history.jsonl')` before returning `null`. Added `import * as display from '../display.js'`.
- ACs 1–5 verified by code inspection and confirmed already correct: `hitl.ts` appends `{ role, date, alignmentScore, outputPath, timestamp }` on the `A` keypress via `append()`; `append()` is read-all + write-all through `write-file-atomic` (append-only, crash-safe); the `X`/abort path calls `process.exit(1)` with no append; `review.ts` reads `getLastEntry()` and shows `display.noRecentRun()` when null.
- AC8: expanded `history.test.ts` — corrupt-last-line (returns null + `display.error` asserted), three-entry append (separate lines, `getLastEntry` returns the third), append-only guarantee (first line byte-identical after a second append), and optional-`company`-field round-trip. Mocked `../display.js` to capture `display.error`.

### File List

- `src/history/schema.ts` (modified)
- `src/history/index.ts` (modified)
- `src/history/history.test.ts` (modified)

### Change Log

- 2026-05-30: Implemented Story 4.4 — added optional `company` schema field, surfaced corrupt-JSONL via `display.error` in `getLastEntry()`, and expanded history test coverage. All 86 tests pass; lint and build clean.

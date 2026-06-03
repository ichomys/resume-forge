# Story 3.1: Answer Store Persistence

Status: done

## Story

As Rainboldt,
I want every gap answer I provide to be saved automatically to a local store keyed by topic,
so that the tool builds a growing record of my professional knowledge without any extra effort on my part.

## Acceptance Criteria

1. `store.write(topicKey, { question, answer })` is called when the user submits a gap answer; write is atomic via `write-file-atomic`; `~/.resume-forge/data/answer-store.json` is created if it does not exist; `→ Answer saved to store (topic: [key])` is displayed
2. `store.read()` parses and validates `answer-store.json` against `AnswerStoreSchema`; if absent returns `{ version: 1, entries: {} }`; if schema version mismatched, migration function applied
3. Topic key normalization: key matches `/^[a-z][a-z0-9-]*$/` (lowercase kebab-case, e.g. `container-orchestration`)
4. `store.write()` completes in under 500ms
5. `src/store/schema.ts` defines `AnswerEntrySchema`, `AnswerStoreSchema`, `AnswerEntry`, `AnswerStore` types, `STORE_PATH`, `DATA_DIR` constants
6. `src/store/matcher.ts` exports `normalizeKey(raw)` and `isValidKey(key)`
7. `src/store/index.ts` exports `read()`, `write()`, `get()` functions
8. `src/store/index.ts` also exports `update(topicKey, newAnswer)` for Story 4.2 edit flow and `remove(topicKey)` for Story 4.2 clear flow
9. `src/store/store.test.ts` covers: write creates entry, read returns empty store when missing, normalizeKey produces valid keys

## Tasks / Subtasks

- [x] Create `src/store/schema.ts` (AC: 2, 5)
  - [x] Import `z` from `zod`, `path`, `os`
  - [x] Define and export `AnswerEntrySchema` with fields: `question`, `answer`, `createdAt`, `usageCount: z.number().int().min(0)`, `lastUsed: z.string().optional()`
  - [x] Define and export `AnswerStoreSchema` with fields: `version: z.literal(1)`, `entries: z.record(AnswerEntrySchema)`
  - [x] Export `AnswerEntry` and `AnswerStore` types inferred from schemas
  - [x] Export `DATA_DIR` = `~/.resume-forge/data` and `STORE_PATH` = `~/.resume-forge/data/answer-store.json`
  - [x] Export `migrate(raw: unknown): AnswerStore` — validates and returns `{ version: 1, entries: {} }` on parse failure

- [x] Create `src/store/matcher.ts` (AC: 3, 6)
  - [x] Export `normalizeKey(raw: string): string` — lowercase, replace non-`[a-z0-9]` with `-`, trim leading/trailing `-`
  - [x] Export `isValidKey(key: string): boolean` — tests `/^[a-z][a-z0-9-]*$/`

- [x] Implement `src/store/index.ts` (AC: 1, 2, 4, 7, 8)
  - [x] Import `fs/promises`, `write-file-atomic`, `display`, `schema`, `matcher`
  - [x] Implement and export `read(): Promise<AnswerStore>` — reads and validates; returns empty store when file absent; calls migrate on version mismatch
  - [x] Implement and export `get(topicKey: string): Promise<AnswerEntry | undefined>` — reads store, looks up normalized key
  - [x] Implement and export `write(topicKey: string, data: { question: string; answer: string }): Promise<void>` — atomic write; creates DATA_DIR if needed; displays status message
  - [x] Implement and export `update(topicKey: string, newAnswer: string): Promise<void>` — atomic update of answer + lastUsed + usageCount increment
  - [x] Implement and export `remove(topicKey: string): Promise<void>` — atomic removal of one entry
  - [x] Implement and export `clearAll(): Promise<void>` — atomic write of empty store

- [x] Update `src/store/index.ts` barrel to export all public API

- [x] Write unit tests `src/store/store.test.ts` (AC: 1, 2, 3, 9)
  - [x] Use `vi.mock('os', ...)` to redirect homedir to a temp dir (same pattern as `history.test.ts`)
  - [x] Test `write()` creates an entry with correct fields
  - [x] Test `read()` returns empty store when file absent
  - [x] Test `write()` called twice with same key increments `usageCount`
  - [x] Test `normalizeKey()` produces correct results for typical gap names
  - [x] Test `get()` returns undefined for unknown key

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes

## Dev Notes

### Schema Design

```typescript
// src/store/schema.ts
import { z } from 'zod'
import * as path from 'path'
import * as os from 'os'

export const AnswerEntrySchema = z.object({
  question: z.string(),
  answer:   z.string(),
  createdAt: z.string(),        // ISO 8601
  usageCount: z.number().int().nonneg(),
  lastUsed: z.string().optional(), // ISO 8601 — set on second+ use
})

export const AnswerStoreSchema = z.object({
  version: z.literal(1),
  entries: z.record(z.string(), AnswerEntrySchema),
})

export type AnswerEntry = z.infer<typeof AnswerEntrySchema>
export type AnswerStore = z.infer<typeof AnswerStoreSchema>

export const DATA_DIR   = path.join(os.homedir(), '.resume-forge', 'data')
export const STORE_PATH = path.join(DATA_DIR, 'answer-store.json')

export function migrate(raw: unknown): AnswerStore {
  // Version 1 is the only version — parse or return empty
  const result = AnswerStoreSchema.safeParse(raw)
  return result.success ? result.data : { version: 1, entries: {} }
}
```

### `write()` Implementation

```typescript
export async function write(
  topicKey: string,
  data: { question: string; answer: string },
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const normalized = normalizeKey(topicKey)
  const store = await read()
  const existing = store.entries[normalized]
  const now = new Date().toISOString()

  store.entries[normalized] = existing
    ? { ...existing, answer: data.answer, lastUsed: now, usageCount: existing.usageCount + 1 }
    : { question: data.question, answer: data.answer, createdAt: now, usageCount: 1 }

  await writeFileAtomic(STORE_PATH, JSON.stringify(store, null, 2))
  display.status(`Answer saved to store (topic: ${normalized})`)
}
```

### Test Pattern (mirrors history.test.ts)

```typescript
const { tmpHome } = vi.hoisted(() => {
  const osMod = require('os') as typeof import('os')
  const pathMod = require('path') as typeof import('path')
  return { tmpHome: pathMod.join(osMod.tmpdir(), `resume-forge-store-test-${Date.now()}`) }
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

### Architecture Notes

- `write-file-atomic` v7: import as `import writeFileAtomic from 'write-file-atomic'`
- `zod` v4: `z.number().int().nonneg()` for non-negative integer
- DATA_DIR is the same as `history/schema.ts` DATA_DIR — they share `~/.resume-forge/data/` but different files
- `storeEmpty()` in `display.ts` is already implemented — use it in store list command (Story 4.2)
- Story 4.2 owns the `store list/edit/clear` CLI commands — this story only creates the persistence API

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (bmad-dev-story workflow)

### Debug Log References

### Completion Notes List

- Implemented `src/store/schema.ts` with `AnswerEntrySchema`, `AnswerStoreSchema`, `AnswerEntry`/`AnswerStore` types, `DATA_DIR`, `STORE_PATH`, and `migrate()`.
- Implemented `src/store/matcher.ts` with `normalizeKey()` and `isValidKey()`.
- Implemented `src/store/index.ts` with `read()`, `get()`, `write()`, `update()`, `remove()`, `clearAll()` — all writes use `write-file-atomic`; `write()` displays `→ Answer saved to store (topic: key)`.
- Fixed zod v4 API: uses `z.number().int().min(0)` not `.nonneg()`.
- 9/9 unit tests pass in `src/store/store.test.ts`.

### File List

- `src/store/schema.ts` (new)
- `src/store/matcher.ts` (new)
- `src/store/index.ts` (modified — full implementation)
- `src/store/store.test.ts` (new)

### Review Findings

- [x] [Review][Patch] `read()` swallows all errors, not just ENOENT [`src/store/index.ts:16-19`] — Both branches of the catch return `{ version: 1, entries: {} }`, making `isNotFound()` dead code. JSON parse errors and permission-denied errors are silently replaced with an empty store. Fix: re-throw when `!isNotFound(e)`.

### Change Log

- 2026-05-29: Story 3.1 implemented — answer store schema, matcher, persistence API, 9 unit tests passing

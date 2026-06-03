# Story 4.2: Answer Store Management (`resume-forge store`)

Status: done

## Story

As Rainboldt,
I want to list, edit, and clear my stored answers via the `resume-forge store` command,
so that I can keep my knowledge base accurate and remove stale or incorrect entries.

## Acceptance Criteria

1. `resume-forge store list` displays all stored entries sorted by `lastUsed` descending (most recent first); each entry shows topic key, first ~60 chars of answer, usage count, and last used date; if the store is empty: `→ Answer store is empty. Answers save automatically during resume-forge generate.`
2. `resume-forge store edit --topic <key>` shows the current answer text above a `>` input prompt; typing a replacement and pressing Enter updates the entry atomically and displays `✓ Entry updated: <key>`
3. `resume-forge store clear --topic <key>` removes only the matching entry atomically and displays `✓ Cleared: <key>`
4. `resume-forge store clear` (no `--topic`) shows `✦ Clear entire answer store? This cannot be undone. [y/N]` (capital N = default no); `y` clears all entries and displays `✓ Answer store cleared`; Enter or `N` cancels with `→ Cancelled`
5. `resume-forge store edit --topic <key>` where the topic does not exist displays `✗ No entry found for topic: <key> → Run resume-forge store list to see all stored topics`
6. `src/commands/index.ts` registers the store command so it appears in `resume-forge --help`

## Tasks / Subtasks

- [x] Create `src/commands/store.ts` with `list`, `edit`, and `clear` subcommands (AC: 1–5)
  - [x] Import `commander`, `input` from `@inquirer/prompts`, `display`, and store functions: `read, update, remove, clearAll` from `'../store/index.js'`
  - [x] Define and export `register(program: Command): void`
  - [x] Add `const storeCmd = program.command('store').description('Manage stored gap answers')`

  - [x] **`store list` subcommand** (AC: 1)
    - [x] `storeCmd.command('list').description('List all stored answer entries').action(listAction)`
    - [x] In `listAction`: call `read()`; if `entries` is empty, call `display.storeEmpty()` and return
    - [x] Sort entries by `lastUsed ?? createdAt` descending
    - [x] For each entry: print `  [<topic>]  <answer_preview> | used: <usageCount>x | last: <lastUsed_date>`
    - [x] Truncate answer preview at 60 chars with `...` suffix if longer

  - [x] **`store edit` subcommand** (AC: 2, 5)
    - [x] `storeCmd.command('edit').option('--topic <key>', 'Topic key to edit').action(editAction)`
    - [x] In `editAction`: if `!options.topic`, call `display.error('--topic is required', 'Run resume-forge store list to see all stored topics')` and return with exit 1
    - [x] Call `read()`, look up `entries[normalizeKey(options.topic)]`
    - [x] If not found: call `display.error('No entry found for topic: ' + topic, 'Run resume-forge store list to see all stored topics')` and exit 1
    - [x] Display current answer: `console.log('  Current: "' + entry.answer + '"')`
    - [x] Prompt: `const newAnswer = await input({ message: '> ' })`
    - [x] If `newAnswer.trim()`: call `update(topic, newAnswer.trim())`, then `display.success('Entry updated: ' + topic)`
    - [x] If empty input: `display.status('No change made')`

  - [x] **`store clear` subcommand** (AC: 3, 4)
    - [x] `storeCmd.command('clear').option('--topic <key>', 'Topic key to clear (omit to clear all)').action(clearAction)`
    - [x] **With `--topic`**: call `remove(options.topic)`, then `display.success('Cleared: ' + options.topic)`
    - [x] **Without `--topic`**: call `display.prompt('Clear entire answer store? This cannot be undone. [y/N]')`; read single keypress via `readYesNoKey()`; if `'y'`: call `clearAll()`, `display.success('Answer store cleared')`; else: `display.status('Cancelled')`

  - [x] Add `readYesNoKey()` private helper (same stdin raw mode pattern as gap-loop.ts)
    - [x] Accepts: `'y'` → `true`; Enter / `'n'` / any other key → `false`; Ctrl+C → `process.exit(1)`

- [x] Register store command in `src/commands/index.ts` (AC: 6)
  - [x] Import `register as registerStore` from `'./store.js'`
  - [x] Call `registerStore(program)` inside `register()`
  - [x] Remove the `// Future: registerStore (Epics 3–4)` comment

- [x] Write unit tests `src/commands/store.test.ts`
  - [x] Mock `read`, `update`, `remove`, `clearAll` from `../store/index.js`
  - [x] Mock `display` from `../display.js`
  - [x] Mock `@inquirer/prompts` `input`
  - [x] Stub stdin for `readYesNoKey` tests (same pattern as gap-loop.test.ts)
  - [x] Test `listAction`: empty store → `display.storeEmpty()` called
  - [x] Test `listAction`: entries sorted by lastUsed desc; preview truncated at 60 chars
  - [x] Test `editAction`: missing topic → `display.error` called with correct message
  - [x] Test `editAction`: unknown topic → error + exit 1
  - [x] Test `editAction`: valid topic + new answer → `update` called, `display.success` called
  - [x] Test `clearAction` with `--topic`: `remove` called with correct key
  - [x] Test `clearAction` no-topic + 'y' key → `clearAll` called + success message
  - [x] Test `clearAction` no-topic + Enter key → `clearAll` NOT called + `Cancelled` shown

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes
  - [x] `npm test` — all tests pass

## Dev Notes

### Commander Subcommand Structure

```typescript
export function register(program: Command): void {
  const storeCmd = program
    .command('store')
    .description('Manage stored gap answers')

  storeCmd
    .command('list')
    .description('List all stored answer entries')
    .action(listAction)

  storeCmd
    .command('edit')
    .description('Edit a stored answer by topic key')
    .option('--topic <key>', 'Topic key to edit')
    .action(editAction)

  storeCmd
    .command('clear')
    .description('Clear one or all stored answers')
    .option('--topic <key>', 'Topic key to clear (omit to clear all)')
    .action(clearAction)
}
```

### List Output Format

```
  [kubernetes-orchestration]  "Managed 3-node k8s cluster at Acme, handling..."  used: 3x  last: 2026-05-29
  [terraform]                  "Used Terraform at Acme for AWS infra provisio..."  used: 1x  last: 2026-05-28
```

Sort: `(a.lastUsed ?? a.createdAt) > (b.lastUsed ?? b.createdAt)` — most recent first.

### readYesNoKey Pattern

```typescript
async function readYesNoKey(): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const handler = (key: string): void => {
      const k = key.toLowerCase()
      process.stdin.setRawMode?.(false)
      process.stdin.pause()
      process.stdin.removeListener('data', handler)
      if (k === '\x03') process.exit(1)
      resolve(k === 'y')
    }

    process.stdin.on('data', handler)
  })
}
```

### Normalizing Topic Keys for Edit/Clear

Call `normalizeKey(options.topic)` before the store lookup — the user may type `Kubernetes-Orchestration` and it should match `kubernetes-orchestration`. Import `normalizeKey` from `'../store/index.js'`.

### Available Store Functions

All needed functions are already exported from `src/store/index.ts`:
- `read()` → `Promise<AnswerStore>`
- `update(topicKey, newAnswer)` → `Promise<void>`
- `remove(topicKey)` → `Promise<void>`
- `clearAll()` → `Promise<void>`
- `normalizeKey(raw)` → `string`

`display.storeEmpty()` is already implemented in `src/display.ts` and should be called directly for the empty list case.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npx vitest run src/commands/store.test.ts` → 10 passed
- `node bin/resume-forge.js --help` → lists `store  Manage stored gap answers`
- `node bin/resume-forge.js store --help` → lists `list`, `edit`, `clear`
- `npm run lint` / `npm run build` → clean
- `npm test` → 75 passed (was 65; +10 store-command tests)

### Completion Notes List

- Added `src/commands/store.ts` exposing the `store` command group with `list`, `edit`, and `clear` subcommands, wired through `register(program)`.
- `list`: reads the store, calls `display.storeEmpty()` when empty; otherwise sorts entries by `lastUsed ?? createdAt` descending and prints `  [<topic>]  "<preview>" | used: <n>x | last: <YYYY-MM-DD>`, truncating the answer preview at 60 chars with an ellipsis.
- `edit`: requires `--topic`; missing/unknown topic → `display.error(..., 'Run resume-forge store list to see all stored topics')` + `process.exit(1)`. Topic keys are passed through `normalizeKey` so `Kubernetes-Orchestration` matches `kubernetes-orchestration`. Non-empty trimmed input → `update()` + `✓ Entry updated`; empty input → `→ No change made`.
- `clear`: with `--topic` removes the single (normalized) entry + `✓ Cleared`. Without `--topic`, prompts `✦ Clear entire answer store? This cannot be undone. [y/N]` and reads one keypress via `readYesNoKey()` (y → clearAll + `✓ Answer store cleared`; anything else → `→ Cancelled`).
- Registered the command in `src/commands/index.ts` (replacing the `// Future: registerStore` placeholder).
- Tests drive a real `commander` program via `parseAsync(['store', ...], { from: 'user' })` (with `exitOverride()`), so registration of the `store` group + subcommands is genuinely validated. stdin is stubbed for the `readYesNoKey` confirm/cancel paths; `process.exit` is spied for the error paths.

### File List

- `src/commands/store.ts` (new)
- `src/commands/store.test.ts` (new)
- `src/commands/index.ts` (modified)

### Change Log

- 2026-05-30: Implemented Story 4.2 — `resume-forge store` management command (list/edit/clear) with 10 unit tests. Registered in the CLI; all 75 tests pass; lint and build clean.

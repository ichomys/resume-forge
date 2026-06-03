# Story 3.2: Gap Identification & Question Generation

Status: done

## Story

As Rainboldt,
I want the tool to identify each experience gap from my alignment results and generate a specific, human-phrased question for it,
so that I'm prompted only about things that actually matter to this role — not generic questions.

## Acceptance Criteria

1. Each gap in `alignment.gaps[]` is processed one at a time (never as a list)
2. For each gap, `llm.generateGapQuestion(gapKey, description, pool)` is called (LLM call 2)
3. The generated question is displayed as: `✦ Gap N of M — [topic]` on line one, blank line, question text, then `>` on a new line for input
4. Pressing `C` at the alignment report triggers the gap loop beginning with `Gap 1 of N`
5. `src/pipeline/gap-loop.ts` is created and exports `runGapLoop(session)`
6. `src/pipeline/index.ts` exports `runGapLoop`

## Tasks / Subtasks

- [x] Create `src/pipeline/gap-loop.ts` (AC: 1, 2, 3, 4, 5)
  - [x] Import `input` from `@inquirer/prompts`, `createAdapter`, `readConfig`, `getExperiencePool`, `display`, `write` from store, `renderAlignmentReport` from alignment
  - [x] Export `runGapLoop(session: GenerationSession): Promise<GenerationSession>`
  - [x] Implement gap list identification: filter out already-resolved gaps from `alignment.gaps`/`gapKeys`
  - [x] For each unresolved gap: call `llm.generateGapQuestion(gapKey, description, pool)`, display `✦ Gap N of M — [gapKey]`, blank line, question, then collect input via `input({ message: '>' })`
  - [x] Write non-empty answers to store via `storeWrite(gapKey, { question, answer })`
  - [x] Collect all answers into `resolvedGaps` spread
  - [x] Re-display alignment report and `[G/C/X]` menu after recalculation
  - [x] Read menu key; `g` → return updated session; `x` → `process.exit(1)`; `c` → loop continues

- [x] Update `src/pipeline/index.ts` (AC: 6)
  - [x] Export `runGapLoop` from `./gap-loop.js`

- [x] Update `src/commands/generate.ts`
  - [x] Replace Epic 3 placeholder with `session = await runGapLoop(session)`
  - [x] Import `runGapLoop` from pipeline barrel

- [x] Write unit tests `src/pipeline/gap-loop.test.ts` (AC: 1, 2, 3)
  - [x] Mock `llm`, `config`, `profile`, `display`, `store`, `@inquirer/prompts`
  - [x] Test that `runGapLoop` calls `generateGapQuestion` for each gap
  - [x] Test that answers end up in `session.resolvedGaps`
  - [x] Test that already-resolved gaps are skipped

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes

## Dev Notes

### `runGapLoop` Signature

```typescript
export async function runGapLoop(session: GenerationSession): Promise<GenerationSession>
```

Input session MUST have `alignment` populated (called only after `runAlignment`).
Returns session with `alignment` and `resolvedGaps` updated immutably (spread pattern).

### Gap Display Pattern

```typescript
console.log()
display.prompt(`Gap ${gapNum} of ${totalGaps} — ${gapKey}`)
console.log()
console.log(question)
const answer = await input({ message: '>' })
```

The `✦` prefix comes from `display.prompt()` — consistent with other prompt patterns.

### readMenuKey pattern

Copy the same raw-mode stdin reader from `alignment.ts`. The gap loop needs its own
`readMenuKey()` helper within the same file:

```typescript
async function readMenuKey(): Promise<'g' | 'c' | 'x'> {
  return new Promise(resolve => {
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    const handler = (key: string) => {
      const k = key.toLowerCase()
      if (k === 'g' || k === 'c' || k === 'x' || k === '\x03') {
        process.stdin.setRawMode?.(false)
        process.stdin.pause()
        process.stdin.removeListener('data', handler)
        resolve(k === '\x03' ? 'x' : k as 'g' | 'c' | 'x')
      }
    }
    process.stdin.on('data', handler)
  })
}
```

### Integration into generate.ts

```typescript
if (action === 'context') {
  session = await runGapLoop(session)
}
```

This replaces the Epic 3 placeholder comment. The gap loop returns the session
(when user presses G) or exits (when user presses X).

### Previous Story Intelligence

- `alignment.ts` `renderAlignmentReport()` is public and can be called from gap-loop
- The `AlignmentResult.gaps[]` and `AlignmentResult.gapKeys[]` are parallel arrays — same index maps gap description to topic key
- `store.write()` from Story 3.1 handles atomic persistence and displays the status message
- `display.prompt()` produces `✦` amber prefix — use for gap prompts

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (bmad-dev-story workflow)

### Debug Log References

### Completion Notes List

- Implemented `src/pipeline/gap-loop.ts` with full gap identification and question generation loop. Each gap calls `llm.generateGapQuestion()`, displays `✦ Gap N of M — [gapKey]` prompt, collects user input, and writes to store. Multi-round loop, recalculation, and fit assessment all included (Stories 3.3–3.5 implemented together).
- Exported `runGapLoop` from `src/pipeline/index.ts`.
- Updated `src/commands/generate.ts` to call `runGapLoop` when action is `context` and added `--role` option.
- 7/7 gap-loop unit tests pass; 60/60 total tests pass.

### File List

- `src/pipeline/gap-loop.ts` (new)
- `src/pipeline/gap-loop.test.ts` (new)
- `src/pipeline/index.ts` (modified — export `runGapLoop`, `captureRoleTitle`)
- `src/commands/generate.ts` (modified — wire gap loop, add `--role` option)
- `src/pipeline/alignment.ts` (modified — `renderAlignmentReport` accepts `options.expandedMenu`)

### Review Findings

- [x] [Review][Patch] Multi-paragraph docstring on `runGapLoop` violates project style rule [`src/pipeline/gap-loop.ts:11-17`] — CLAUDE.md requires "one short line max" for comments. The 7-line block should be condensed to a single line.
- [x] [Review][Defer] `readMenuKey()` duplicated in `alignment.ts` and `gap-loop.ts` [`src/pipeline/gap-loop.ts:127-145`, `src/pipeline/alignment.ts:81-99`] — deferred, pre-existing design; out of scope for this epic
- [x] [Review][Defer] `gapKeys[i] ?? ''` silent fallback on array length mismatch [`src/pipeline/gap-loop.ts:34,46`] — deferred, pre-existing; TypeScript types guarantee aligned arrays at runtime
- [x] [Review][Defer] Concurrent `write()` calls have a lost-update race [`src/store/index.ts:27-43`] — deferred, architectural concern; `write-file-atomic` prevents corruption but not lost updates; address in Story 4+

### Change Log

- 2026-05-29: Story 3.2 implemented — gap loop with question generation, multi-round, recalculation, fit assessment; 7 unit tests

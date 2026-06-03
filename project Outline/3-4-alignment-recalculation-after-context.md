# Story 3.4: Alignment Recalculation After Context

Status: done

## Story

As Rainboldt,
I want to see my alignment score update after each round of answers,
so that I can watch the gap close in real time and make an informed decision about whether to generate or keep adding context.

## Acceptance Criteria

1. After each round, `llm.analyzeAlignment()` is called with the original JD + experience pool + all provided answers embedded in the JD text
2. Updated score displayed as `→ Alignment updated: 61% → 76%`
3. Updated alignment report block re-rendered with new score, updated `✓ Aligned` list, remaining `✦ Gaps`
4. After recalc ≥80%, menu is still presented (user always controls whether to proceed)
5. If recalculated score is lower or equal, show it honestly with the same `[G/C/X]` menu
6. `currentAlignment` is replaced with the newly returned `AlignmentResult` after recalculation

## Tasks / Subtasks

- [x] Update `src/pipeline/gap-loop.ts` post-round recalculation (AC: 1, 2, 3, 4, 5, 6)
  - [x] Record `prevScore = currentAlignment.score` before recalculation
  - [x] Build `enrichedJD`: append `\n\nADDITIONAL CANDIDATE CONTEXT:\n` + each `[key]: [answer]` pair to `session.jdText`
  - [x] Call `llm.analyzeAlignment(enrichedJD, pool)` with a spinner `⠋ Recalculating alignment...`
  - [x] Replace `currentAlignment` with the new result (immutable — let binding reassigned)
  - [x] Display `→ Alignment updated: ${prevScore}% → ${currentAlignment.score}%`
  - [x] Call `renderAlignmentReport(currentAlignment)` with the updated result

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes

## Dev Notes

### Enriched JD Construction

The `analyzeAlignment(jdText, pool)` signature is unchanged. To pass context, append
it to the JD text before calling:

```typescript
const answersBlock = Object.entries(resolvedGaps)
  .map(([key, answer]) => `${key}: ${answer}`)
  .join('\n')
const enrichedJD = answersBlock
  ? `${session.jdText}\n\nADDITIONAL CANDIDATE CONTEXT:\n${answersBlock}`
  : session.jdText

const spin = display.spinner('Recalculating alignment...')
let newAlignment: AlignmentResult
try {
  newAlignment = await llm.analyzeAlignment(enrichedJD, pool)
  spin.succeed()
} catch (e) {
  spin.fail()
  throw e
}
currentAlignment = newAlignment
```

### Note on score movement

The LLM may return a lower score if the recalculation prompt surface area reveals
more gaps than previously detected. Always show the real number — do not clamp or smooth.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (bmad-dev-story workflow)

### Debug Log References

### Completion Notes List

- Recalculation after each round implemented in `gap-loop.ts`. Enriched JD appends all collected answers as "ADDITIONAL CANDIDATE CONTEXT" block. `llm.analyzeAlignment()` called with enriched JD; result replaces `currentAlignment`. Score delta shown via `display.status()`.

### File List

- `src/pipeline/gap-loop.ts` (modified — recalculation after round)

### Change Log

- 2026-05-29: Story 3.4 implemented as part of gap-loop.ts (with 3.2, 3.3, 3.5)

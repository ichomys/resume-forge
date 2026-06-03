# Story 3.3: Multi-Round Context Collection

Status: done

## Story

As Rainboldt,
I want to answer gap questions across as many rounds as I need without the tool ever forcing me to stop,
so that I can surface experience I have but haven't yet articulated — on my own timeline.

## Acceptance Criteria

1. Answers are accepted with no minimum or maximum length constraint; `→ Answer saved to store (topic: [key])` is displayed after each new answer
2. After all gaps in the current round are answered, `→ Alignment updated: [old]% → [new]%` is displayed inline
3. The `[G] Generate  [C] Add context  [X] Exit` menu is redisplayed with the updated score after each round
4. Pressing `C` again starts a new context round prompting only unresolved gaps; already-answered gaps are skipped
5. The `Gap N of M` counter reflects the remaining unresolved count, not the original total
6. Pressing `G` after multiple rounds includes ALL collected answers in `session.resolvedGaps` passed to `llm.generateResume()`

## Tasks / Subtasks

- [x] Update `src/pipeline/gap-loop.ts` outer loop (AC: 1, 2, 3, 4, 5, 6)
  - [x] Wrap gap processing in a `while (true)` outer loop that continues on `c`
  - [x] Track `resolvedGaps` across rounds (spread into running record)
  - [x] Before each inner iteration, compute `unresolvedIndices` = gaps whose key is NOT in current `resolvedGaps`
  - [x] Use `unresolvedIndices.length` as `totalGaps` for the `Gap N of M` counter
  - [x] After inner loop, display `→ Alignment updated: ${prevScore}% → ${currentScore}%`
  - [x] Re-render alignment report and show menu
  - [x] Read key: `g` → return `{ ...session, alignment: currentAlignment, resolvedGaps }`; `x` → `process.exit(1)`; `c` → continue outer loop
  - [x] If no unresolved gaps remain at top of outer loop, immediately return (no more gaps to prompt)

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes

## Dev Notes

### Outer Loop Structure

```typescript
// Outer loop: repeat until user picks G or X
while (true) {
  // Find unresolved gaps for this round
  const unresolvedIndices = currentAlignment.gaps
    .map((_, i) => i)
    .filter(i => !resolvedGaps[currentAlignment.gapKeys[i]])

  if (unresolvedIndices.length === 0) {
    // All gaps resolved — no more to prompt
    return { ...session, alignment: currentAlignment, resolvedGaps }
  }

  // Inner loop: process each unresolved gap one at a time
  for (let ri = 0; ri < unresolvedIndices.length; ri++) {
    const gapIdx = unresolvedIndices[ri]
    const gapKey = currentAlignment.gapKeys[gapIdx]
    const gapDescription = currentAlignment.gaps[gapIdx]
    const gapNum = ri + 1
    const totalGaps = unresolvedIndices.length
    // ... generate question, display, collect answer
  }

  // After round: show alignment update (3.4 adds actual recalc)
  display.status(`Alignment updated: ${prevScore}% → ${currentAlignment.score}%`)

  // Re-render report and wait for key
  renderAlignmentReport(currentAlignment)
  const key = await readMenuKey()
  if (key === 'g') return { ...session, alignment: currentAlignment, resolvedGaps }
  if (key === 'x') process.exit(1)
  // c → continue outer loop
}
```

### Key Invariant

`resolvedGaps` is a plain `Record<string, string>` mapping `gapKey → userAnswer`.
It is spread into the new session only when returning. The original `session.resolvedGaps`
is never mutated — spread operator creates new objects on each update.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (bmad-dev-story workflow)

### Debug Log References

### Completion Notes List

- Multi-round outer loop implemented in `gap-loop.ts` — `while(true)` loop with `unresolvedIndices` filter, round-to-round `resolvedGaps` accumulation, and correct `Gap N of M` counter based on remaining unresolved count.

### File List

- `src/pipeline/gap-loop.ts` (modified — outer loop, skip logic, round tracking)

### Change Log

- 2026-05-29: Story 3.3 implemented as part of gap-loop.ts (with 3.2, 3.4, 3.5)

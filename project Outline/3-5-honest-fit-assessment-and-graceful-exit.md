# Story 3.5: Honest Fit Assessment & Graceful Exit

Status: done

## Story

As Rainboldt,
I want the tool to surface a clear fit assessment when my remaining gaps are unresolvable,
so that I can make an informed decision to redirect rather than waste an application on a role that isn't right.

## Acceptance Criteria

1. When alignment report has one or more `noMatch[]` items, a message reads: `→ Core requirements [A], [B] remain unaddressed. This role may not be the right target.`
2. Menu expands to `[G] Generate anyway  [C] Add more context  [X] Exit` when `noMatch[]` is non-empty
3. Pressing `X` at poor-fit assessment exits cleanly with code 1; no resume written, no history entry
4. Pressing `G` at poor-fit assessment proceeds to generation with all available answers; shows `→ Generating with available context — some gaps remain unaddressed` before spinner
5. Pressing `C` at poor-fit assessment re-prompts only the `noMatch[]` gaps (another chance for context)
6. Fit assessment message is framed as "here's what's missing" — never a hard stop or failure message

## Tasks / Subtasks

- [x] Update `src/pipeline/gap-loop.ts` fit assessment display (AC: 1, 2, 3, 4, 5, 6)
  - [x] After each recalculation, check `currentAlignment.noMatch.length > 0`
  - [x] If noMatch present: display `→ Core requirements ${noMatch.join(', ')} remain unaddressed. This role may not be the right target.`
  - [x] Pass `hasNoMatch` flag to menu display logic to choose between standard and expanded menu text
  - [x] For expanded menu display: show `[G] Generate anyway  [C] Add more context  [X] Exit`
  - [x] For C on poor-fit assessment: outer loop re-prompts remaining unresolved gaps; noMatch items surface via recalculation
  - [x] When user presses G with `noMatch` items, display `→ Generating with available context — some gaps remain unaddressed`

- [x] Update `src/pipeline/alignment.ts` — `renderAlignmentReport` (AC: 2)
  - [x] Add optional parameter: `options?: { expandedMenu?: boolean }`
  - [x] When `expandedMenu` is true, show `[G] Generate anyway  [C] Add more context  [X] Exit` instead of standard menu

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes

## Dev Notes

### renderAlignmentReport signature update

```typescript
export function renderAlignmentReport(
  result: AlignmentResult,
  options?: { expandedMenu?: boolean },
): void {
  // ... existing render ...
  if (options?.expandedMenu) {
    console.log('  [G] Generate anyway  [C] Add more context  [X] Exit')
  } else {
    console.log('  [G] Generate  [C] Add context  [X] Exit')
  }
  console.log()
}
```

### Gap loop usage

```typescript
const hasNoMatch = currentAlignment.noMatch.length > 0

if (hasNoMatch) {
  const missing = currentAlignment.noMatch.join(', ')
  display.status(`Core requirements ${missing} remain unaddressed. This role may not be the right target.`)
}

renderAlignmentReport(currentAlignment, { expandedMenu: hasNoMatch })

const key = await readMenuKey()
if (key === 'g') {
  if (hasNoMatch) {
    display.status('Generating with available context — some gaps remain unaddressed.')
  }
  return { ...session, alignment: currentAlignment, resolvedGaps }
}
```

### Note on noMatch re-prompting

When user presses C after a poor-fit assessment, `currentAlignment.noMatch[]` items
may not map directly to the existing `gapKeys[]`. The recalculated alignment may
reclassify them or keep them as noMatch. The outer loop simply prompts all unresolved
gapKeys — LLM recalculation will decide if they move from noMatch to gaps.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (bmad-dev-story workflow)

### Debug Log References

### Completion Notes List

- Fit assessment implemented in `gap-loop.ts`: checks `currentAlignment.noMatch.length > 0` after recalculation, displays "Core requirements X remain unaddressed" message, passes `expandedMenu: true` to `renderAlignmentReport` for `[G] Generate anyway` variant. G with noMatch shows "Generating with available context" before returning.
- `renderAlignmentReport` in `alignment.ts` updated with optional `{ expandedMenu?: boolean }` parameter.

### File List

- `src/pipeline/gap-loop.ts` (modified — fit assessment + expanded menu)
- `src/pipeline/alignment.ts` (modified — expandedMenu option)

### Change Log

- 2026-05-29: Story 3.5 implemented as part of gap-loop.ts (with 3.2, 3.3, 3.4)

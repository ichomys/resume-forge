# Story 3.6: Role Title as Generation Target

Status: done

## Story

As Rainboldt,
I want to provide a plain-text role title instead of a full job description,
so that I can generate a targeted resume quickly without needing a specific job posting.

## Acceptance Criteria

1. Running `resume-forge generate --role "Senior Software Engineer"` accepts the role title as the target
2. `→ Captured role title: "[title]". Does this look complete? [Y/n]` is displayed before analysis proceeds
3. `→ Using role title as target: "[title]"` is displayed before analysis begins
4. The alignment report and gap loop behave identically to the full JD path
5. If no experience pool is loaded, `✗ No profile found. → Run resume-forge init first` is displayed and exits with code 2
6. `src/commands/generate.ts` registers `--role <title>` option
7. `src/pipeline/jd-capture.ts` handles the role title path

## Tasks / Subtasks

- [x] Update `src/pipeline/jd-capture.ts` (AC: 2, 3, 5, 7)
  - [x] Add `captureRoleTitle(roleTitle: string): Promise<GenerationSession>` export
  - [x] Display `→ Captured role title: "[title]". Does this look complete?` confirmation
  - [x] On confirm: display `→ Using role title as target: "[title]"` and return session
  - [x] On deny: exits with code 1 with guidance to re-run with correct title

- [x] Update `src/commands/generate.ts` (AC: 1, 4, 6)
  - [x] Add `.option('--role <title>', 'Use a role title as the generation target instead of a full JD')`
  - [x] In action handler: if `options.role` is set, call `captureRoleTitle(options.role)` instead of `captureJD(options.jd)`
  - [x] The rest of the pipeline (alignment, gap loop, generation, HITL) is unchanged

- [x] Update `src/pipeline/jd-capture.test.ts`
  - [x] Add test: `captureRoleTitle` with confirmed input returns session with correct `jdText`

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes

## Dev Notes

### captureRoleTitle implementation

```typescript
export async function captureRoleTitle(roleTitle: string): Promise<GenerationSession> {
  display.status(`Captured role title: "${roleTitle}". Does this look complete?`)

  const confirmed = await confirm({ message: 'Does this look complete?', default: true })
  if (!confirmed) {
    display.status('Please re-run with the correct role title.')
    process.exit(1)
  }

  display.status(`Using role title as target: "${roleTitle}"`)

  return {
    jdText: roleTitle,
    jdConfirmed: true,
    resolvedGaps: {},
  }
}
```

### generate.ts update

```typescript
program
  .command('generate')
  .option('--jd <file>', 'Path to job description file (.txt or .html)')
  .option('--role <title>', 'Use a role title as the generation target instead of a full JD')
  .option('--compact', 'Apply compact CSS class for content-dense layouts')
  .action(async (options: { jd?: string; role?: string; compact?: boolean }) => {
    let session = options.role
      ? await captureRoleTitle(options.role)
      : await captureJD(options.jd)
    // ... rest unchanged
  })
```

### Architecture Note

The role title is used as the `jdText` directly. The alignment prompt sees it as a
very short JD — the LLM infers typical requirements for that role title. This is
intentionally minimal; a full JD always produces better alignment accuracy.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (bmad-dev-story workflow)

### Debug Log References

### Completion Notes List

- Implemented `captureRoleTitle(roleTitle)` in `jd-capture.ts`: shows confirmation `→ Captured role title: X`, then `→ Using role title as target: X`, returns session with `jdText: roleTitle`. Denial exits with code 1 with re-run guidance.
- Added `--role <title>` option to `generate.ts`; routes to `captureRoleTitle` when set.
- Added `captureRoleTitle` test to `jd-capture.test.ts`; 61/61 total tests pass.

### File List

- `src/pipeline/jd-capture.ts` (modified — captureRoleTitle added)
- `src/pipeline/jd-capture.test.ts` (modified — captureRoleTitle test added)
- `src/commands/generate.ts` (modified — --role option, captureRoleTitle import)
- `src/pipeline/index.ts` (modified — export captureRoleTitle)

### Change Log

- 2026-05-29: Story 3.6 implemented — role title capture, --role CLI option, 1 test added

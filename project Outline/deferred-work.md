# Deferred Work

Tracks real-but-not-now items surfaced during reviews. Each entry notes its origin.

## Deferred from: code review of Epic 2 stories 2-1..2-6 (2026-05-29)

- **No max file size guard in `captureFromFile`** (2-1) — very large JD files pass through to LLM unguarded; context-window overflow surfaces as generic "API unavailable". Low priority until a real size limit is known.
- **`history/index.ts` append read-modify-write race** (2-6) — two concurrent `resume-forge` invocations could lose one history entry. Single-user CLI; acceptable for now.
- **`buildOutputPath` same-day filename collision** (2-6) — two resumes for the same role on the same day silently overwrite. Add timestamp suffix on collision when output UX is finalized.
- **`getLastEntry` silently returns null on corrupt JSONL** (2-6) — disk-full or partial write produces silent null with no user diagnostic. Address in Story 4.4 history management epic.
- **`ExperiencePool.entries` empty-array not validated before alignment** (2-3) — profile module handles missing profile; empty-but-present pool reaches the LLM with no guard. Low risk; add guard when gap-discovery epic (Epic 3) is scoped.

## Deferred from: code review of Epic 3 stories 3-1..3-6 (2026-05-30)

- **`readMenuKey()` duplicated in `alignment.ts` and `gap-loop.ts`** (3-2) — identical raw-mode stdin handler copy-pasted into both files. Maintenance risk if key-handling logic changes. Extract to a shared `src/pipeline/read-menu-key.ts` when there is a third caller or a bug surfaces.
- **`gapKeys[i] ?? ''` silent fallback on array length mismatch** (3-2) — if `AlignmentResult.gapKeys` and `.gaps` ever diverge in length, an empty string is used as the topic key, causing a silent store write to `entries['']`. TypeScript types guarantee alignment at present; add a defensive guard when the LLM adapter response parsing is hardened.
- **Concurrent `store.write()` lost-update race** (3-1) — two concurrent gap-loop invocations both read-then-write the store; the second write overwrites the first's entry. Single-user CLI, so low risk. Address with a write-queue or file-lock in the Story 4 answer-store management epic.

## Deferred from: code review of stories 1-2..1-7, 4-1..4-4 (2026-05-30)

- **`loadBaseResume()` copies file without text extraction via pdf-parse/mammoth** (1-7) — AC4 specifies "uses pdf-parse for PDF and mammoth for DOCX" but the implementation copies the file only. Story dev notes explicitly defer text extraction: "stored as visual reference — extraction is a future enhancement". Wire up pdf-parse/mammoth when a downstream story needs the extracted text (e.g., a story that uses the base resume content to enrich the ExperiencePool).

## Deferred from: code review of story-1.1 (2026-05-29)

- **`bin/` gitignored but is the published CLI entry** — `package.json` declares `"bin": {"resume-forge": "bin/resume-forge.js"}` yet `.gitignore` excludes `bin/`, and there is no `files` field or `prepare`/`prepublishOnly` build script. A fresh clone (or `npm publish` when `bin/` was cleaned) ships without the binary. Out of scope for Story 1.1 (ACs cover local dev build/test/run only). Add a `prepare` build + `files: ["bin"]` in a packaging/publish story.
- **`pdf-parse@^2.4.5` runtime vs `@types/pdf-parse@^1.1.5`** — major-version mismatch between library and its `@types`. Harmless today (`skipLibCheck` on, pdf-parse unused), but typed usage will mistype in Story 2.x. Resolve when pdf-parse is first wired up.
- **No `engines` field in package.json** — `commander@^15` / `@types/node@^25` imply a recent Node floor; without `engines`, installs on older Node fail at runtime rather than with a clean error. Add a Node engine floor before publish.
- **`tsconfig.json` excludes `tests` while `vitest.config.ts` includes `tests/**`** — `tsc --noEmit` (the `lint` script) does not type-check test files. Revisit when the first tests are added.
- **`~/.resume-forge/` in `.gitignore` is a literal path, not home-dir expansion** — effectively a dead line. Matches the spec's exact `.gitignore` content and is harmless (the real config store lives outside the repo), so noted only.

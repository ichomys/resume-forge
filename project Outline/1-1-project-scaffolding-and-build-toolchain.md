# Story 1.1: Project Scaffolding & Build Toolchain

Status: done

## Story

As a developer,
I want a complete TypeScript + commander.js project with build and test tooling configured,
so that I can develop, build, and run the Resume Forge CLI from source.

## Acceptance Criteria

1. `npm run build` produces a working CLI entry in `bin/resume-forge.js`
2. `npm test` runs the Vitest suite with zero failures on an empty test suite
3. `npm run dev` executes TypeScript source directly via `tsx`
4. `src/index.ts` registers commander.js with `--version` and `--help` working
5. `src/errors.ts` defines `ResumeForgeError` with error code constants
6. `src/types.ts` defines `GenerationSession`, `AlignmentResult`, `ResumeContent`, `GapEntry` as stub types
7. All `src/` subdirectories (`commands/`, `pipeline/`, `store/`, `profile/`, `llm/`, `history/`) exist with stub `index.ts` barrel files
8. `.gitignore` excludes `.env`, `node_modules/`, `bin/`, and local data dir references

## Tasks / Subtasks

- [x] Initialize npm project and install dependencies (AC: 1, 2, 3)
  - [x] Run `npm init -y` in the project root
  - [x] Install dev deps: `npm install -D typescript tsup @types/node tsx vitest`
  - [x] Install prod deps: `npm install commander ora chalk @inquirer/prompts zod write-file-atomic pdf-parse mammoth @anthropic-ai/sdk handlebars`
  - [x] Install missing type packages: `npm install -D @types/pdf-parse @types/handlebars`
  - [x] Set `"type": "commonjs"` in package.json
  - [x] Add scripts to package.json: `"build": "tsup"`, `"dev": "tsx src/index.ts"`, `"test": "vitest run"`
  - [x] Add `"bin": { "resume-forge": "bin/resume-forge.js" }` to package.json

- [x] Create build and test configuration files (AC: 1, 2, 3)
  - [x] Create `tsconfig.json` — strict mode, ES2022 target, CommonJS module, Node.js types
  - [x] Create `tsup.config.ts` — entry `{ 'resume-forge': 'src/index.ts' }`, format CJS, outDir `bin/`, shebang banner
  - [x] Create `vitest.config.ts` — include src/**/*.test.ts and tests/**/*.test.ts

- [x] Create `src/errors.ts` (AC: 5)
  - [x] Define `ResumeForgeError extends Error` with `code` and `message` fields
  - [x] Export `ERROR_CODES` constant object with all error code strings

- [x] Create `src/types.ts` (AC: 6)
  - [x] Define `GenerationSession` type (exact shape from architecture)
  - [x] Define `AlignmentResult` type
  - [x] Define `ResumeContent` type with all nested types
  - [x] Define `GapEntry` type

- [x] Create `src/index.ts` — commander entry point (AC: 4)
  - [x] Import commander and set up `program` with version from package.json
  - [x] Import and call commands barrel's `register(program)` 
  - [x] Call `program.parse(process.argv)`

- [x] Create stub barrel files for all src/ subdirectories (AC: 7)
  - [x] `src/commands/index.ts` — exports `register(program: Command): void` (no-op stub)
  - [x] `src/pipeline/index.ts` — empty barrel stub
  - [x] `src/store/index.ts` — empty barrel stub
  - [x] `src/profile/index.ts` — empty barrel stub
  - [x] `src/llm/index.ts` — empty barrel stub
  - [x] `src/llm/prompts/` directory with empty `index.ts`
  - [x] `src/history/index.ts` — empty barrel stub

- [x] Create project config files (AC: 8)
  - [x] Create `.gitignore`
  - [x] Create `.env.example`

- [x] Verify all acceptance criteria pass (AC: 1–8)
  - [x] `npm run build` succeeds; `bin/resume-forge.js` exists and is executable
  - [x] `bin/resume-forge.js --version` outputs version string
  - [x] `bin/resume-forge.js --help` shows help text
  - [x] `npm test` exits 0 with empty suite
  - [x] `npm run dev -- --help` works via tsx

## Review Findings

_Code review 2026-05-29 — adversarial 3-layer (Blind Hunter / Edge Case Hunter / Acceptance Auditor). All 8 ACs verified PASS (AC1–AC4 confirmed at runtime; `npm run lint` exits 0). 0 decision-needed, 0 patch, 5 deferred, 10 dismissed as noise/false-positive/per-spec._

- [x] [Review][Defer] `bin/` is gitignored but is the published CLI entry; no `files` field or `prepare`/`prepublishOnly` build script [package.json:6, .gitignore:3] — deferred: distribution concern, out of scope for 1.1 (ACs cover local dev only). Address in a packaging/publish story.
- [x] [Review][Defer] `pdf-parse@^2.4.5` runtime paired with `@types/pdf-parse@^1.1.5` (major-version type mismatch) [package.json] — deferred: not exercised in 1.1; resolve when pdf-parse is first used (Story 2.x profile loading).
- [x] [Review][Defer] No `engines` field; `commander@^15` / `@types/node@^25` imply a recent Node floor, so old-Node installs fail at runtime instead of with a clean error [package.json] — deferred: add a Node engine floor before publish.
- [x] [Review][Defer] `tsconfig.json` excludes `tests` while `vitest.config.ts` includes `tests/**`, so `tsc --noEmit` (lint) does not type-check test files [tsconfig.json:18, vitest.config.ts:5] — deferred: revisit when test files are added.
- [x] [Review][Defer] `~/.resume-forge/` in `.gitignore` is a literal path segment, not home-dir expansion — line is effectively dead [.gitignore:6] — deferred: matches spec's exact `.gitignore` content; harmless (real config store lives outside repo).

## Dev Notes

### Exact Dependency Install Commands

```bash
npm init -y
npm install -D typescript tsup @types/node tsx vitest
npm install commander ora chalk @inquirer/prompts zod write-file-atomic pdf-parse mammoth @anthropic-ai/sdk handlebars
npm install -D @types/pdf-parse @types/handlebars
```

**Note:** `handlebars` is not listed in the epic's starter command but IS required by `pipeline/renderer.ts` (Story 2.5). Install it now with all other production deps to avoid a mid-project dependency add.

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "bin", "tests"]
}
```

### tsup.config.ts

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { 'resume-forge': 'src/index.ts' },
  format: ['cjs'],
  outDir: 'bin',
  clean: true,
  shims: true,
  banner: { js: '#!/usr/bin/env node' },
})
```

- `entry` keyed as `'resume-forge'` → output is `bin/resume-forge.js` (matches package.json `bin` field)
- `shims: true` — adds CJS shims for `__dirname`, `__filename` needed in Node.js CommonJS output
- `banner` injects the shebang so the CLI is directly executable after `npm link`

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    passWithNoTests: true,
  },
})
```

### package.json Required Fields

```json
{
  "name": "resume-forge",
  "version": "0.1.0",
  "type": "commonjs",
  "bin": { "resume-forge": "bin/resume-forge.js" },
  "scripts": {
    "build": "tsup",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  }
}
```

### src/errors.ts — Exact Shape Required

```typescript
export class ResumeForgeError extends Error {
  constructor(public readonly code: keyof typeof ERROR_CODES, message: string) {
    super(message)
    this.name = 'ResumeForgeError'
  }
}

export const ERROR_CODES = {
  ALIGNMENT_FAILED: 'ALIGNMENT_FAILED',
  GENERATION_FAILED: 'GENERATION_FAILED',
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  PROFILE_PARSE_FAILED: 'PROFILE_PARSE_FAILED',
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_WRITE_FAILED: 'CONFIG_WRITE_FAILED',
  API_RATE_LIMITED: 'API_RATE_LIMITED',
  API_UNAVAILABLE: 'API_UNAVAILABLE',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  STORE_CORRUPT: 'STORE_CORRUPT',
  UNKNOWN_CONFIG_KEY: 'UNKNOWN_CONFIG_KEY',
  HISTORY_NOT_FOUND: 'HISTORY_NOT_FOUND',
} as const
```

### src/types.ts — Exact Shapes From Architecture

```typescript
export type AlignmentResult = {
  score: number          // 0–100 percentage
  aligned: string[]      // areas of strong alignment
  gaps: string[]         // experience gaps (potentially resolvable)
  noMatch: string[]      // unresolvable gaps
  gapKeys: string[]      // kebab-case topic keys for gap loop
}

export type ExperienceEntry = {
  title: string
  company: string
  location?: string
  startDate: string
  endDate: string
  description: string
  bullets: string[]
}

export type ResumeContent = {
  name: string
  subtitle: string
  contact: {
    phone?: string
    email?: string
    linkedin?: string
  }
  summary?: string
  experience: ExperienceEntry[]
  skills: string[]
  education: Array<{ degree: string; institution: string; year: string }>
  achievements?: string[]
}

export type GapEntry = {
  key: string         // kebab-case topic slug matching answer store key
  description: string // gap description from alignment analysis
  question?: string   // LLM-generated human-phrased question
  answer?: string     // user-provided or store-retrieved answer
}

export type GenerationSession = {
  jdText: string
  jdConfirmed: boolean
  alignment?: AlignmentResult
  resolvedGaps: Record<string, string>  // gapKey → answer string
  generatedContent?: ResumeContent
  approvedOutputPath?: string
}
```

### src/index.ts — Commander Setup

```typescript
import { Command } from 'commander'
import { register } from './commands/index.js'

const { version } = require('../package.json') as { version: string }

const program = new Command()

program
  .name('resume-forge')
  .description('Role-tailored resume generator')
  .version(version)

register(program)

program.parse(process.argv)
```

**Note:** Since output is CJS, use `require('../package.json')` for version — do NOT use `import.meta` or dynamic `import()` for JSON in CommonJS output. Also add `"types": ["node"]` to tsconfig to resolve `process` and `require` globals.

### src/commands/index.ts — Stub Barrel

```typescript
import type { Command } from 'commander'

export function register(_program: Command): void {
  // Commands registered here in later stories (1.5, 1.6, 2.x, 3.x, 4.x)
}
```

### .gitignore Content

```
.env
node_modules/
bin/
dist/
*.tsbuildinfo
~/.resume-forge/
.resume-forge/
```

### .env.example Content

```
# Anthropic API key for Resume Forge
# Set this variable; the value is never stored in any config file
ANTHROPIC_API_KEY=your_api_key_here
```

### Project Structure Notes

- **Working directory for all commands:** `resume-forge/` repo root — NOT `project Outline/`
- **All source files go in `src/`** — never in root or `bin/`
- **`bin/` is gitignored** — it is tsup build output only
- **Test file co-location:** unit tests go next to source (e.g., `src/store/schema.test.ts`); integration tests in `tests/integration/`
- **No `__tests__/` directories** — Vitest co-location pattern enforced throughout
- **Barrel import rule (enforced from day 1):** cross-module imports always from `index.ts`, never from internal files — e.g., `import { register } from './commands/index.js'`, NOT `from './commands/init.js'`

### Architecture Compliance Rules (Critical for All Future Stories)

These patterns are established in this story and enforced in every subsequent story:

| Pattern | Correct | Wrong |
|---------|---------|-------|
| Terminal output | `display.ts` functions only | `console.log()` / `console.error()` anywhere else |
| LLM prompts | `src/llm/prompts/*.ts` files | Inline template strings in adapter or business logic |
| JSON writes | `write-file-atomic` | `fs.writeFile()` on any data file |
| Session updates | `return { ...session, field: value }` | `session.field = value` mutation |
| Cross-module imports | `from '../store/index.js'` | `from '../store/matcher.js'` directly |
| Error throwing | `throw new ResumeForgeError(code, msg)` | `console.error()` + `process.exit()` |

### References

- Epic 1, Story 1.1 acceptance criteria [Source: project Outline/epics-resume-forge.md#Story-1.1]
- Initialization commands [Source: project Outline/epics-resume-forge.md#Additional-Requirements]
- TypeScript + tsup stack decision [Source: project Outline/architecture-resume-forge.md#Selected-Foundation]
- Naming conventions [Source: project Outline/architecture-resume-forge.md#Naming-Patterns]
- Directory structure [Source: project Outline/architecture-resume-forge.md#Complete-Project-Directory-Structure]
- `GenerationSession` type [Source: project Outline/architecture-resume-forge.md#Pipeline-State-Management]
- Anti-patterns list [Source: project Outline/architecture-resume-forge.md#Enforcement-Guidelines]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `import.meta.url` pattern from Dev Notes does not work in CJS module output — replaced with direct `require('../package.json')` cast
- Added `"types": ["node"]` to tsconfig to resolve `process` and `require` globals under strict mode
- Added `passWithNoTests: true` to vitest config so `npm test` exits 0 with an empty test suite

### Completion Notes List

- All 8 ACs verified: build, version, help, test (exit 0), dev via tsx, errors.ts, types.ts, all barrel stubs, .gitignore
- `vitest.config.ts` uses `passWithNoTests: true` — required for AC2 since Story 1.1 has no test files to author
- `tsconfig.json` adds `"types": ["node"]` (not in original Dev Notes template) to support `require` and `process` globals in strict mode

### File List

- `package.json`
- `tsconfig.json`
- `tsup.config.ts`
- `vitest.config.ts`
- `.gitignore`
- `.env.example`
- `src/index.ts`
- `src/errors.ts`
- `src/types.ts`
- `src/commands/index.ts`
- `src/pipeline/index.ts`
- `src/store/index.ts`
- `src/profile/index.ts`
- `src/llm/index.ts`
- `src/llm/prompts/index.ts`
- `src/history/index.ts`

### Change Log

- 2026-05-29: Story 1.1 implemented — TypeScript + commander.js CLI scaffolding, build toolchain (tsup/vitest/tsx), all type definitions and barrel stubs created, all ACs verified passing

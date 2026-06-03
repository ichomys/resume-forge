# Story 1.4: Configuration Module

Status: done

## Story

As Rainboldt,
I want a typed, schema-validated configuration module that reads and writes `~/.resume-forge/config/settings.json`,
so that tool settings persist between sessions and are always in a valid, known state.

## Acceptance Criteria

1. `src/config.ts` is implemented with a `ConfigSchema` (zod)
2. When `~/.resume-forge/config/settings.json` does not exist, `readConfig()` returns the default config object: `{ version: 1, model: "claude-sonnet-4-5", outputDir: "~/resume-forge-output", templatePath: "~/.resume-forge/templates/default/resume.html", theme: "amber", apiKeyEnvVar: "ANTHROPIC_API_KEY" }`
3. `~/.resume-forge/` is created with `0o700` permissions if it does not exist
4. When a valid `settings.json` exists, `readConfig()` parses and validates it against `ConfigSchema`; throws `ResumeForgeError` on schema violation
5. `writeConfig(config)` writes atomically via `write-file-atomic`
6. `apiKeyEnvVar` stores only the env var name (e.g., `"ANTHROPIC_API_KEY"`) — the actual key value is never written to disk
7. `ConfigSchema` carries a `version` field; a `migrateConfig` function is exported alongside it

## Tasks / Subtasks

- [x] Create `src/config.ts` (AC: 1–7)
  - [x] Import `z` from `zod`, `path`, `os`, `fs/promises`, `writeFileAtomic` from `write-file-atomic`
  - [x] Import `ResumeForgeError` and `ERROR_CODES` from `./errors.js`
  - [x] Define module-level path constants: `CONFIG_DIR`, `CONFIG_FILE`
  - [x] Define and export `ConfigSchema` (zod object) with all fields and defaults
  - [x] Export `Config` type inferred from `ConfigSchema`
  - [x] Implement `getDefaultConfig(): Config` helper
  - [x] Implement private `ensureDir(): Promise<void>` — creates `~/.resume-forge/` with `0o700`
  - [x] Implement and export `readConfig(): Promise<Config>`
  - [x] Implement and export `writeConfig(config: Config): Promise<void>`
  - [x] Implement and export `migrateConfig(raw: unknown): Config`
  - [x] Implement and export `expandPath(p: string): string` utility

- [x] Write unit tests `src/config.test.ts` (AC: 2–7)
  - [x] Mock `os.homedir()` to return a temp path
  - [x] Mock `fs/promises` (mkdir, readFile, writeFile) or use a real temp directory
  - [x] Test `readConfig()` returns default config when settings.json absent (ENOENT)
  - [x] Test `readConfig()` parses valid existing config
  - [x] Test `readConfig()` throws `ResumeForgeError` on invalid JSON schema
  - [x] Test `writeConfig()` is called with write-file-atomic (not fs.writeFile)
  - [x] Test `migrateConfig()` passes a v1 config through unchanged
  - [x] Test `expandPath()` expands `~/` to homedir, passes through absolute paths unchanged
  - [x] Run `npm test` — all tests pass

- [x] Build verification
  - [x] `npm run build` — no TypeScript errors
  - [x] `npm run lint` (`tsc --noEmit`) — type check passes

## Dev Notes

### File Location and Module Pattern

`src/config.ts` is a **top-level module file** (not a directory barrel), same as `src/display.ts`. Import from it directly:

```typescript
import { readConfig, writeConfig, expandPath } from './config.js'   // from src/
import { readConfig, writeConfig } from '../config.js'              // from src/commands/, src/pipeline/
```

Never import from a `src/config/` subdirectory — this module has no internal files.

### Critical: zod v4.4.3 is Installed

The project uses **zod v4.4.3**, NOT zod v3. The epics doc says "zod v1" — this refers to the **schema's `version` field value** (version: 1 in the JSON), not the zod library version.

For the `ConfigSchema` defined in this story, **zod v4 is backward-compatible with v3 for all patterns used here** (`z.object`, `z.string`, `z.literal`, `z.enum`, `.default()`, `.parse()`, `.safeParse()`). Write it exactly as you would for zod v3.

One difference to be aware of: zod v4's error `.message` on `ZodError` may format differently than v3. Always use `result.error.message` (string) for user-facing output, not the structured issue array.

### Critical: write-file-atomic v7.0.1

`write-file-atomic` v7 is **CJS-compatible** (unlike chalk/ora which are ESM-only). Import as a default import:

```typescript
import writeFileAtomic from 'write-file-atomic'
```

The API is: `await writeFileAtomic(path, data)` — returns a Promise. No callback form needed.

### Path Constants

```typescript
import * as path from 'path'
import * as os from 'os'

const CONFIG_DIR  = path.join(os.homedir(), '.resume-forge')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config', 'settings.json')
```

The `~` in config values (e.g., `"~/resume-forge-output"`) is stored literally in `settings.json`. It is expanded at use time via `expandPath()`, not at storage time. This keeps paths portable across users.

### Complete `src/config.ts` Implementation

```typescript
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'
import { z } from 'zod'
import writeFileAtomic from 'write-file-atomic'
import { ResumeForgeError } from './errors.js'

// ── Path constants ────────────────────────────────────────────────────────────

export const CONFIG_DIR  = path.join(os.homedir(), '.resume-forge')
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config', 'settings.json')

// ── Schema ────────────────────────────────────────────────────────────────────

export const ConfigSchema = z.object({
  version:     z.literal(1),
  apiKeyEnvVar: z.string().default('ANTHROPIC_API_KEY'),
  model:        z.string().default('claude-sonnet-4-5'),
  outputDir:    z.string().default('~/resume-forge-output'),
  templatePath: z.string().default(
    '~/.resume-forge/templates/default/resume.html'
  ),
  theme: z
    .enum(['amber', 'slate-blue', 'forest', 'charcoal'])
    .default('amber'),
})

export type Config = z.infer<typeof ConfigSchema>

// ── Defaults ──────────────────────────────────────────────────────────────────

export function getDefaultConfig(): Config {
  return ConfigSchema.parse({ version: 1 })
}

// ── Path utilities ────────────────────────────────────────────────────────────

/** Expand leading ~/ to the OS home directory. Absolute paths pass through. */
export function expandPath(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(2))
  }
  return p
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Create ~/.resume-forge/ with user-only permissions if it does not exist. */
async function ensureDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
  await fs.mkdir(path.join(CONFIG_DIR, 'config'), { recursive: true })
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read and validate the config file. Returns default config if file absent.
 * Throws ResumeForgeError on schema violation.
 */
export async function readConfig(): Promise<Config> {
  await ensureDir()

  let raw: string
  try {
    raw = await fs.readFile(CONFIG_FILE, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return getDefaultConfig()
    }
    throw err
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ResumeForgeError(
      'CONFIG_INVALID',
      'settings.json is not valid JSON. Delete it and re-run resume-forge init.'
    )
  }

  const result = ConfigSchema.safeParse(parsed)
  if (!result.success) {
    throw new ResumeForgeError(
      'CONFIG_INVALID',
      `Config schema validation failed: ${result.error.message}`
    )
  }
  return result.data
}

/**
 * Write config atomically. Creates config directory if needed.
 * Never call fs.writeFile directly on config — always use this function.
 */
export async function writeConfig(config: Config): Promise<void> {
  await ensureDir()
  await writeFileAtomic(CONFIG_FILE, JSON.stringify(config, null, 2))
}

/**
 * Migrate raw config data to the current schema version.
 * Used when reading configs written by older tool versions.
 */
export function migrateConfig(raw: unknown): Config {
  const obj = raw as Record<string, unknown>

  // Version 1 is the only version — apply defaults for any missing fields.
  // Future versions: add `if (obj.version === 2)` migration steps here.
  const merged = { version: 1, ...obj }

  const result = ConfigSchema.safeParse(merged)
  if (!result.success) {
    throw new ResumeForgeError(
      'CONFIG_INVALID',
      `Cannot migrate config: ${result.error.message}`
    )
  }
  return result.data
}
```

### Directory and File Structure Created at Runtime

```
~/.resume-forge/          ← created with mode 0o700 (user-only r/w/x)
└── config/
    └── settings.json     ← JSON written by writeConfig()
```

Only `~/.resume-forge/` itself gets the `0o700` mode. The `config/` subdirectory is created with the default umask (typically `0o755` on Linux/macOS, normal folder permissions on Windows). Windows ignores Unix `mode` flags entirely — `0o700` is a no-op on Windows but doesn't cause errors.

### Schema Design Notes

**`version: z.literal(1)`** — The `version` field is a discriminated literal. When a future schema version exists (version 2), the schema becomes a union and `migrateConfig` handles the v1→v2 transform. Callers never set `version` manually — it's always `1` in `getDefaultConfig()`.

**`apiKeyEnvVar` stores only the env var NAME** — This is a security invariant (NFR5). The config stores `"ANTHROPIC_API_KEY"`, never `"sk-ant-..."`. Callers read the actual key with:
```typescript
const key = process.env[config.apiKeyEnvVar]
```
`writeConfig()` has no knowledge of the key value — this invariant is enforced by the type (a string field that callers pass the env var name into).

**`theme` as enum** — The four valid themes are `amber`, `slate-blue`, `forest`, `charcoal`. Adding a new theme requires updating the schema enum (and bumping version in a future breaking change).

**`expandPath()` keeps `~` in storage** — Store `~/resume-forge-output` in JSON, expand to `/home/user/resume-forge-output` when creating directories or resolving file paths. This makes configs portable if `~/.resume-forge/` is shared across machines.

### `ensureDir()` Idempotency

`fs.mkdir` with `{ recursive: true }` is idempotent — calling it when the directory already exists does **not** throw. This is safe to call in both `readConfig()` and `writeConfig()`.

On the second+ call, the existing `~/.resume-forge/` directory's permissions are **not changed** — `recursive: true` + `mode` only applies at creation time. This is correct behavior.

### Unit Test Approach: `src/config.test.ts`

Two strategies available — pick one:

**Option A: Real temp directory (simpler, integration-style)**
```typescript
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs/promises'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Override homedir to use a temp dir so tests don't touch ~/.resume-forge
const tmpHome = path.join(os.tmpdir(), `resume-forge-test-${Date.now()}`)

vi.mock('os', async (importOriginal) => {
  const original = await importOriginal<typeof os>()
  return { ...original, homedir: () => tmpHome }
})
```

**Option B: Mock fs/promises (faster, unit-style)**
```typescript
vi.mock('fs/promises')
vi.mock('write-file-atomic')
```

Option A is recommended — it tests the real filesystem behavior (directory creation, permissions) without touching `~/.resume-forge`.

**Critical test cases:**

```typescript
it('readConfig returns default when settings.json absent', async () => {
  const config = await readConfig()
  expect(config.version).toBe(1)
  expect(config.model).toBe('claude-sonnet-4-5')
  expect(config.theme).toBe('amber')
  expect(config.apiKeyEnvVar).toBe('ANTHROPIC_API_KEY')
})

it('readConfig throws ResumeForgeError on invalid schema', async () => {
  const badConfig = { version: 1, theme: 'invalid-theme' }
  await fs.mkdir(path.join(tmpHome, '.resume-forge', 'config'), { recursive: true })
  await fs.writeFile(
    path.join(tmpHome, '.resume-forge', 'config', 'settings.json'),
    JSON.stringify(badConfig)
  )
  await expect(readConfig()).rejects.toThrow(ResumeForgeError)
})

it('writeConfig writes atomically and readConfig reads it back', async () => {
  const config = getDefaultConfig()
  const updated = { ...config, model: 'claude-opus-4-5' }
  await writeConfig(updated)
  const read = await readConfig()
  expect(read.model).toBe('claude-opus-4-5')
})

it('expandPath expands ~/ correctly', () => {
  // Note: with vi.mock('os'), os.homedir() returns tmpHome
  const expanded = expandPath('~/my-output')
  expect(expanded).toContain('my-output')
  expect(expanded).not.toContain('~')
})

it('expandPath passes absolute paths through unchanged', () => {
  const abs = '/absolute/path'
  expect(expandPath(abs)).toBe(abs)
})

it('migrateConfig applies defaults for missing optional fields', () => {
  const partial = { version: 1, model: 'claude-opus-4-5' }
  const migrated = migrateConfig(partial)
  expect(migrated.theme).toBe('amber')  // default applied
  expect(migrated.model).toBe('claude-opus-4-5')  // provided value kept
})
```

### Architecture Compliance

| Rule | Application |
|------|------------|
| All JSON writes via `write-file-atomic` | `writeConfig()` uses `writeFileAtomic()` — never `fs.writeFile()` |
| `ResumeForgeError` for all errors | Schema violation and JSON parse failure both throw `ResumeForgeError` |
| No `console.log` outside `display.ts` | `src/config.ts` contains zero console calls — callers handle display |
| API key never written to disk | `apiKeyEnvVar` stores only the env var name string |
| Versioned schema with migration | `version: z.literal(1)` + `migrateConfig()` exported |

**No display.ts calls in config.ts** — The config module is a pure data module. It throws `ResumeForgeError` when things go wrong. The command layer (`src/commands/init.ts`, etc.) catches errors and calls `display.error()`. This separation is intentional.

### AC9 Check (inherited from Story 1.3)

After implementing `src/config.ts`, re-verify no stray console calls:

```powershell
Select-String -Path "src\**\*.ts" -Pattern "console\.(log|error|warn)" -Recurse
```

Only `src/display.ts` should show matches.

### Previous Story Intelligence

**From Story 1.1 (scaffolding):**
- `src/errors.ts` defines `ResumeForgeError` and `ERROR_CODES` — import directly:
  ```typescript
  import { ResumeForgeError } from './errors.js'
  ```
  The `ERROR_CODES.CONFIG_INVALID` and `ERROR_CODES.CONFIG_WRITE_FAILED` codes exist. Use `'CONFIG_INVALID'` as the string literal — TypeScript will check it against the `ERROR_CODES` shape.
- CJS output: all internal imports need `.js` extension (TypeScript resolves `.ts`, bundler emits `.js`)
- `tsconfig.json` has `"types": ["node"]` — `NodeJS.ErrnoException` is available without additional imports

**From Story 1.3 (display module):**
- `src/display.ts` is now available — but config.ts should NOT call it. Config module throws; command layer displays.

**From Story 1.2 (template files):**
- `templatePath` default (`~/.resume-forge/templates/default/resume.html`) refers to the installed template location, not the repo `templates/default/` directory. The init wizard (Story 1.5) copies from `templates/default/` in the repo to `~/.resume-forge/templates/default/` at first run.

### Testing: Temp Directory Cleanup

If using the real-temp-dir approach (Option A), clean up after tests:

```typescript
afterEach(async () => {
  await fs.rm(tmpHome, { recursive: true, force: true })
})
```

This ensures each test starts with a clean slate and leaves no artifacts in the system temp dir.

### References

- Story 1.4 acceptance criteria [Source: project Outline/epics-resume-forge.md#Story-1.4]
- Config schema definition [Source: project Outline/architecture-resume-forge.md#Data-Architecture]
- `~/.resume-forge/` directory structure [Source: project Outline/architecture-resume-forge.md#Project-Structure-Boundaries]
- `0o700` permission requirement [Source: project Outline/architecture-resume-forge.md#Gap-Analysis-Results]
- Atomic write pattern [Source: project Outline/architecture-resume-forge.md#Format-Patterns]
- Zod validation pattern [Source: project Outline/architecture-resume-forge.md#Process-Patterns]
- Security invariant for API key [Source: project Outline/epics-resume-forge.md#NonFunctional-Requirements (NFR5)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (BMad Dev — Amelia)

### Debug Log References

- `tsc --noEmit` flagged `write-file-atomic` (v7) as having no declaration file. Resolved by adding a minimal ambient module declaration at `src/write-file-atomic.d.ts` (the published `@types/write-file-atomic` targets an older major). This also unblocked Story 1.7 which uses the same package.

### Completion Notes List

- Implemented `src/config.ts`: zod v4 `ConfigSchema` (`version` literal 1, `apiKeyEnvVar`, `model`, `outputDir`, `templatePath`, `theme` enum), `Config` type, `getDefaultConfig`, `readConfig`, `writeConfig`, `migrateConfig`, `expandPath`, `CONFIG_DIR`/`CONFIG_FILE` constants.
- `readConfig()` returns defaults on ENOENT; throws `ResumeForgeError('CONFIG_INVALID', …)` on malformed JSON or schema-validation failure.
- `writeConfig()` writes atomically via `write-file-atomic`; `ensureDir()` creates `~/.resume-forge/` with `0o700` (no-op on Windows) plus the `config/` subdir.
- `apiKeyEnvVar` stores only the env var name — the key value is never written to disk (NFR5).
- `expandPath()` expands leading `~/` and bare `~` to the homedir; absolute paths pass through unchanged.
- `src/config.test.ts`: 8 tests using a temp-dir `homedir` mock (via `vi.hoisted` + `vi.mock('os')`) covering defaults, valid parse, schema/JSON failure, atomic round-trip, migration, and `expandPath`.
- `npm run build`, `npm run lint`, and `npm test` all pass.

### File List

- `src/config.ts`
- `src/config.test.ts`
- `src/write-file-atomic.d.ts` (new — ambient types for write-file-atomic v7)

### Change Log

- 2026-05-29: Story 1.4 created — Configuration module with zod v4 schema, atomic writes, 0o700 directory creation, migration function, expandPath utility
- 2026-05-29: Story 1.4 implemented — config module + ambient write-file-atomic types + 8 unit tests; all ACs satisfied; status → review

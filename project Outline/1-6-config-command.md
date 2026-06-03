# Story 1.6: Config Command (`resume-forge config`)

Status: done

## Story

As Rainboldt,
I want to view and update individual config settings via `resume-forge config`,
so that I can adjust model, output directory, or theme without re-running the full init wizard.

## Acceptance Criteria

1. `resume-forge config --show` displays all current config values; the API key value is never shown, only the env var name
2. `resume-forge config --set model claude-opus-4-8` updates the `model` field and displays `✓ model updated to claude-opus-4-8`
3. `resume-forge config --set apiKeyEnvVar MY_API_KEY` stores the string `"MY_API_KEY"` — not a key value
4. `resume-forge config --set outputDir ~/custom/path` creates the directory if it does not exist and updates `outputDir`
5. `resume-forge config` with an unrecognized `--set` key displays `✗ Unknown config key: [key] → Valid keys: model, outputDir, templatePath, theme, apiKeyEnvVar`
6. `resume-forge config` is registered via `src/commands/index.ts`

## Tasks / Subtasks

- [x] Create `src/commands/config-cmd.ts` (AC: 1–5)
  - [x] Import display, readConfig, writeConfig, expandPath from correct barrel paths
  - [x] Define `VALID_KEYS` constant (the 5 settable keys)
  - [x] Implement `showConfig(config): void` — prints each config field
  - [x] Implement `setConfig(key, value, config): Promise<Config>` — validates key, applies value, returns updated config
  - [x] Implement `configAction(value, options): Promise<void>` — handles --show and --set
  - [x] Export `register(program: Command): void`

- [x] Update `src/commands/index.ts` (AC: 6)
  - [x] Import and register the `config` command alongside `init`

- [x] Build and smoke test
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes
  - [x] Manual: `npm run dev -- config --show` — verify output
  - [x] Manual: `npm run dev -- config --set model claude-haiku-4-5` — verify update

## Dev Notes

### Commander.js Signature for `--set key value`

The AC format `resume-forge config --set model claude-opus-4-8` has **two tokens after `--set`**: the key and the value. Commander.js `--set <key>` consumes exactly one token (`model`), leaving `claude-opus-4-8` as a positional argument on the command.

Registration pattern:

```typescript
export function register(program: Command): void {
  program
    .command('config [value]')         // optional positional: the new value
    .description('View or update config settings')
    .option('--show', 'Display all current settings')
    .option('--set <key>', 'Config key to update')
    .action(configAction)
}
```

In the action handler:
```typescript
async function configAction(
  value: string | undefined,
  options: { show?: boolean; set?: string }
): Promise<void> {
  // options.set = 'model', value = 'claude-opus-4-8'
}
```

This is the standard commander idiom for `--flag key value` patterns. The `[value]` argument is optional so `--show` works without a positional argument.

### Valid Config Keys and Type Mapping

```typescript
const VALID_KEYS = ['model', 'outputDir', 'templatePath', 'theme', 'apiKeyEnvVar'] as const
type ValidKey = typeof VALID_KEYS[number]

function isValidKey(key: string): key is ValidKey {
  return (VALID_KEYS as readonly string[]).includes(key)
}
```

Theme values must be one of the four defined themes. When setting `theme`, validate:
```typescript
const VALID_THEMES = ['amber', 'slate-blue', 'forest', 'charcoal'] as const
```

### Complete `src/commands/config-cmd.ts`

```typescript
import * as fs from 'fs/promises'
import type { Command } from 'commander'
import * as display from '../display.js'
import { readConfig, writeConfig, expandPath } from '../config.js'
import type { Config } from '../config.js'
import { ResumeForgeError } from '../errors.js'

const VALID_KEYS = ['model', 'outputDir', 'templatePath', 'theme', 'apiKeyEnvVar'] as const
type ValidKey = typeof VALID_KEYS[number]

const VALID_THEMES = ['amber', 'slate-blue', 'forest', 'charcoal'] as const

export function register(program: Command): void {
  program
    .command('config [value]')
    .description('View or update Resume Forge configuration')
    .option('--show', 'Display all current settings')
    .option('--set <key>', 'Config key to update')
    .action(configAction)
}

async function configAction(
  value: string | undefined,
  options: { show?: boolean; set?: string }
): Promise<void> {
  try {
    const config = await readConfig()

    if (options.show) {
      showConfig(config)
      return
    }

    if (options.set) {
      if (!isValidKey(options.set)) {
        display.error(
          `Unknown config key: ${options.set}`,
          `Valid keys: ${VALID_KEYS.join(', ')}`
        )
        process.exit(2)
      }
      if (value === undefined) {
        display.error(`No value provided for --set ${options.set}`, `Usage: resume-forge config --set ${options.set} <value>`)
        process.exit(2)
      }
      const updated = await applySet(options.set, value, config)
      await writeConfig(updated)
      display.success(`${options.set} updated to ${value}`)
      return
    }

    // No flags — show help hint
    display.status('Usage: resume-forge config --show | --set <key> <value>')
  } catch (err) {
    if (err instanceof ResumeForgeError) {
      display.error(err.message, 'Check your config with resume-forge config --show')
    } else {
      throw err
    }
    process.exit(2)
  }
}

function showConfig(config: Config): void {
  display.status('Current configuration:')
  console.log(`  version:      ${config.version}`)
  console.log(`  model:        ${config.model}`)
  console.log(`  outputDir:    ${config.outputDir}`)
  console.log(`  templatePath: ${config.templatePath}`)
  console.log(`  theme:        ${config.theme}`)
  console.log(`  apiKeyEnvVar: ${config.apiKeyEnvVar}`)
  // Never print the actual API key value — only the env var name
}

function isValidKey(key: string): key is ValidKey {
  return (VALID_KEYS as readonly string[]).includes(key)
}

async function applySet(key: ValidKey, value: string, config: Config): Promise<Config> {
  switch (key) {
    case 'theme':
      if (!(VALID_THEMES as readonly string[]).includes(value)) {
        throw new ResumeForgeError(
          'CONFIG_INVALID',
          `Invalid theme: ${value}. Valid themes: ${VALID_THEMES.join(', ')}`
        )
      }
      return { ...config, theme: value as Config['theme'] }

    case 'outputDir': {
      const expanded = expandPath(value)
      await fs.mkdir(expanded, { recursive: true })
      return { ...config, outputDir: value }  // store the original (with ~)
    }

    case 'model':
    case 'templatePath':
    case 'apiKeyEnvVar':
      return { ...config, [key]: value }

    default: {
      // TypeScript exhaustive check
      const _never: never = key
      throw new ResumeForgeError('UNKNOWN_CONFIG_KEY', `Unknown key: ${_never}`)
    }
  }
}
```

### `showConfig()` — No API Key Value

The `showConfig()` function intentionally uses `console.log` for the indented key-value lines. This is the **one and only acceptable place** outside `display.ts` where direct console output is used — it's inside a command that is itself part of the display layer. This is equivalent to `display.ts` routing.

**Alternative:** Add a `display.configLine(key, value)` function to display.ts. Either approach is acceptable — the important constraint is that the API key value is never output.

The line `apiKeyEnvVar: ANTHROPIC_API_KEY` shows the env var name. If someone asks "what's my API key?", they see the name of the env var where it's stored — never the actual secret.

### Validation: `theme` Enum

Setting theme must validate against the four defined values. Invalid theme:
```
✗  Invalid theme: navy-blue
→  Valid themes: amber, slate-blue, forest, charcoal
```

### Validation: `outputDir` Directory Creation

When setting `outputDir`, expand `~` and create the directory immediately:
```typescript
const expanded = expandPath(value)
await fs.mkdir(expanded, { recursive: true })
```

If directory creation fails (permission denied, invalid path), let the error propagate — it will be caught by the outer try/catch and displayed via `display.error()`.

Store the **unexpanded** value in config (with `~` intact), so the path remains portable.

### Updated `src/commands/index.ts`

```typescript
import type { Command } from 'commander'
import { register as registerInit } from './init.js'
import { register as registerConfig } from './config-cmd.js'

export function register(program: Command): void {
  registerInit(program)
  registerConfig(program)
  // Future: registerGenerate, registerStore, registerReview
}
```

Note the file is named `config-cmd.ts` (not `config.ts`) to avoid shadowing the `src/config.ts` module in import resolution.

### Exit Codes

- Success: `0` (default, no explicit exit needed)
- User error (unknown key, missing value): `process.exit(2)` — system error code
- Note: `process.exit(1)` is for user aborts; `process.exit(2)` is for system/config errors

### Architecture Compliance

| Rule | Application |
|------|-------------|
| All output via display.ts | `display.error()`, `display.success()`, `display.status()` used; `console.log` only for indented key-value pairs in `showConfig()` |
| Atomic writes | `writeConfig()` internally uses write-file-atomic |
| API key never to disk | `applySet('apiKeyEnvVar', 'MY_API_KEY', ...)` stores the string `"MY_API_KEY"`, not the key value |
| ResumeForgeError | `applySet` throws for invalid theme or unknown key |
| Spread for config updates | `{ ...config, [key]: value }` — never mutate the config object |

### Previous Story Intelligence

- **Story 1.3 (display.ts):** `display.error()`, `display.success()`, `display.status()` all available.
- **Story 1.4 (config.ts):** `readConfig()`, `writeConfig()`, `expandPath()`, `Config` type all exported. Note that `config.ts` at `src/` level — import as `'../config.js'` from `src/commands/`.
- **Story 1.5 (init.ts):** `src/commands/index.ts` was updated to register `init`. This story extends that barrel to also register `config`.
- **Note on import paths:** From `src/commands/config-cmd.ts`, config module is `'../config.js'` and display is `'../display.js'`. Don't confuse `config-cmd.ts` with `config.ts` — they're at different levels.

### References

- Story 1.6 acceptance criteria [Source: project Outline/epics-resume-forge.md#Story-1.6]
- Config schema and valid keys [Source: project Outline/architecture-resume-forge.md#Data-Architecture]
- Exit code conventions [Source: project Outline/architecture-resume-forge.md#Process-Patterns]
- Security: API key never to disk [Source: project Outline/epics-resume-forge.md#NonFunctional-Requirements (NFR5)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (BMad Dev — Amelia)

### Debug Log References

- Smoke-tested against the built binary (`node bin/resume-forge.js config …`): `--show` prints defaults; `--set theme forest` and `--set model claude-opus-4-8` persist and read back; `--set theme navy` and `--set bogus value` both error and exit 2. Test-written `settings.json` was removed from the home dir afterward.

### Completion Notes List

- Implemented `src/commands/config-cmd.ts`: `register`, `configAction`, `showConfig`, `isValidKey`, `applySet`.
- `--show` prints every field including `apiKeyEnvVar` (the env var NAME) — the API key value is never output.
- `--set <key> <value>` validates against `VALID_KEYS`; unknown key → `✗ Unknown config key … → Valid keys: …` and `process.exit(2)`; missing value → exit 2.
- `theme` validated against the four enum values; `outputDir` expands `~` and `mkdir -p`s the target, storing the unexpanded value; other keys set via immutable spread `{ ...config, [key]: value }`.
- Registered `config` alongside `init` in `src/commands/index.ts`; file named `config-cmd.ts` to avoid shadowing `src/config.ts`.
- AC9 note: the indented key-value `console.log` lines in `showConfig()` are the single documented exception permitted by this story (the command IS its own display layer). Build and lint pass.

### File List

- `src/commands/config-cmd.ts`
- `src/commands/index.ts` (updated)

### Change Log

- 2026-05-29: Story 1.6 created — config command with --show and --set, key validation, outputDir directory creation, theme enum validation
- 2026-05-29: Story 1.6 implemented — config command registered; --show/--set with validation; smoke-tested; all ACs satisfied; status → review

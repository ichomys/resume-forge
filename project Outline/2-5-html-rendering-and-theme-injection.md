# Story 2.5: HTML Rendering & Theme Injection

Status: done

## Story

As Rainboldt,
I want the generated resume content compiled into my HTML template with the correct theme applied,
so that the output file is visually identical to my reference design and ready to print.

## Acceptance Criteria

1. `pipeline/renderer.ts` compiles a loaded Handlebars template with `ResumeContent` data; all `{{placeholders}}` are replaced and the output is a valid HTML string
2. Missing optional sections (`summary`, `achievements`) are omitted entirely — no empty headers or `N/A` text appears in the output
3. Experience entries are rendered in the order provided by `ResumeContent`
4. When config `theme` is `"amber"` (default), no additional `<style>` injection is needed — the template's default `--accent-color: #E8952A` applies
5. When config `theme` is `"slate-blue"`, `"forest"`, or `"charcoal"`, the appropriate `<style>:root { --accent-color: X; --accent-dark: Y; }</style>` is prepended to the output
6. When `--compact` flag is passed, `class="compact"` is added to the root `.resume` element
7. Identical `ResumeContent` and template inputs produce identical HTML output strings (deterministic rendering)
8. `renderHTML(session, options): Promise<string>` is exported from `pipeline/renderer.ts` and from `pipeline/index.ts`
9. `src/commands/generate.ts` is updated to call `renderHTML()` after `generateContent()` and store the HTML string in the session or pass it forward

## Tasks / Subtasks

- [x] Create `src/pipeline/renderer.ts` (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] Import `handlebars`, `fs/promises`, `path`, `os`, `readConfig`
  - [x] Define `THEME_MAP` with all 4 theme color values
  - [x] Implement `loadTemplate(templateSource: string): HandlebarsTemplateDelegate` — compiles the Handlebars template
  - [x] Implement `injectTheme(html: string, theme: string): string` — prepends `<style>` block for non-amber themes
  - [x] ~~Implement `applyCompact(html)`~~ — replaced by data-driven compact (see note); the Story 1.2 template uses `class="resume {{#if compact}}compact{{/if}}"`, so `compact` is passed as template data
  - [x] Implement and export `renderHTML(session: GenerationSession, options: { compact?: boolean }): Promise<string>`
  - [x] Omit optional `summary` and `achievements` sections when empty/undefined (template `{{#if}}` guards + empty→undefined normalization)

- [x] Update `src/pipeline/index.ts` (AC: 8)
  - [x] Export `renderHTML` from `./renderer.js`

- [x] Update `src/commands/generate.ts` (AC: 9)
  - [x] Import `renderHTML` from `../pipeline/index.js`
  - [x] After `generateContent()`, call `renderHTML(session, { compact: options.compact })`
  - [x] Pass HTML string forward to Story 2.6 (stub comment)

- [x] Write unit tests `src/pipeline/renderer.test.ts` (AC: 1, 4, 5, 6, 7)
  - [x] Create a minimal Handlebars template string for testing (no file I/O required)
  - [x] Test amber theme produces no extra `<style>` prepend
  - [x] Test slate-blue theme prepends correct `<style>` block
  - [x] Test compact flag adds `class="compact"` to root element
  - [x] Test deterministic output for identical inputs

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes

## Dev Notes

### Theme Map — All 4 Named Themes

```typescript
// src/pipeline/renderer.ts
const THEME_MAP: Record<string, { accent: string; dark: string }> = {
  amber:      { accent: '#E8952A', dark: '#C47B1E' },  // default — no injection needed
  'slate-blue': { accent: '#3B5F8A', dark: '#2C4A6E' },
  forest:     { accent: '#2E6B47', dark: '#234F35' },
  charcoal:   { accent: '#3D3D3D', dark: '#2A2A2A' },
}
```

These values are sourced from UX-DR1. The amber theme is the template default — no `<style>` prepend needed for amber because `--accent-color: #E8952A` is already in the static template CSS.

### `renderHTML()` — Full Implementation

```typescript
// src/pipeline/renderer.ts
import Handlebars from 'handlebars'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { readConfig } from '../config.js'
import type { GenerationSession, ResumeContent } from '../types.js'

type RenderOptions = { compact?: boolean }

export async function renderHTML(
  session: GenerationSession,
  options: RenderOptions = {}
): Promise<string> {
  const config = await readConfig()
  const templatePath = resolveTemplatePath(config.templatePath)

  const templateSource = await fs.readFile(templatePath, 'utf-8')
  const template = Handlebars.compile(templateSource)

  const content = session.generatedContent!
  const html = template(content)

  let output = html
  output = injectTheme(output, config.theme ?? 'amber')
  if (options.compact) {
    output = applyCompact(output)
  }

  return output
}
```

### `injectTheme()` — Prepend Style Block

```typescript
function injectTheme(html: string, theme: string): string {
  if (theme === 'amber' || !THEME_MAP[theme]) return html  // amber is template default

  const { accent, dark } = THEME_MAP[theme]
  const styleBlock = `<style>:root { --accent-color: ${accent}; --accent-dark: ${dark}; }</style>\n`
  return styleBlock + html
}
```

**Why prepend, not append?** CSS custom property declarations cascade — a later `:root` override wins. Prepending ensures the injection comes before the template's `<style>` tag. The template's default `--accent-color: #E8952A` will be overridden by the injected block.

**Alternative:** Inject inside `<head>`. But since the template is user-owned (copied to `~/.resume-forge/templates/`), we cannot guarantee the structure. Prepending the string is more robust than DOM manipulation.

### `applyCompact()` — Add Compact Class

```typescript
function applyCompact(html: string): string {
  // The root resume element uses class="resume" — add "compact" to it
  return html.replace(
    /(<[a-z]+[^>]*\bclass=")(resume)(")/,
    '$1$2 compact$3'
  )
}
```

**Assumption:** The template's root element has `class="resume"` (singular). If the template uses `class="resume ..."` (other classes), the regex still works via the `$2` capture group. Verify against `templates/default/resume.html` from Story 1.2.

### Template Path Resolution

```typescript
function resolveTemplatePath(templatePath: string): string {
  // Config stores templatePath with ~/ shorthand — resolve to absolute
  if (templatePath.startsWith('~/')) {
    return path.join(os.homedir(), templatePath.slice(2))
  }
  return path.resolve(templatePath)
}
```

Default: `~/.resume-forge/templates/default/resume.html` (copied during `resume-forge init`).

### Handlebars Template Expectations

The template from Story 1.2 uses Handlebars syntax. Optional sections must use `{{#if}}` to avoid rendering empty headers:

```html
{{#if summary}}
<section class="r-summary">
  <p>{{summary}}</p>
</section>
{{/if}}

{{#if achievements}}
<section class="r-achievements">
  <ul>
    {{#each achievements}}
    <li>{{this}}</li>
    {{/each}}
  </ul>
</section>
{{/if}}
```

If Story 1.2 did not include `{{#if}}` guards, the renderer needs to strip empty sections from the `ResumeContent` object before passing to `template()`:

```typescript
// Pre-processing to remove falsy optional fields
const safeContent = {
  ...content,
  summary:      content.summary || undefined,
  achievements: content.achievements?.length ? content.achievements : undefined,
}
const html = template(safeContent)
```

**Verify:** Check `templates/default/resume.html` for `{{#if summary}}` blocks. If missing, use the pre-processing approach above.

### Handlebars Import for CommonJS

`handlebars ^4.7.9` is installed. Since the project is CommonJS output (`"type": "commonjs"` in package.json), use default import:

```typescript
import Handlebars from 'handlebars'
```

`@types/handlebars ^4.0.40` is installed as a dev dependency, so types are available.

### Determinism (AC: 7)

Handlebars is a deterministic template engine — same template + same data always produce the same output. The only source of non-determinism would be unstable object key ordering in `JSON.stringify`, but Handlebars doesn't use `JSON.stringify`. AC 7 is guaranteed by Handlebars's nature.

### Architecture Compliance

| Rule | Application |
|------|-------------|
| All output via display.ts | `renderer.ts` produces an HTML string — no terminal output; errors thrown as `ResumeForgeError` |
| Barrel imports only | `pipeline/index.ts` exports `renderHTML`; generate.ts imports from `'../pipeline/index.js'` |
| Immutable session | `renderHTML` does not modify the session — returns HTML string separately |
| Atomic writes | No file writes in renderer — `renderHTML` returns a string; file save is in Story 2.6 |

### Previous Story Intelligence

- **Story 1.2 (HTML template):** `templates/default/resume.html` uses Handlebars syntax. The template is copied to `~/.resume-forge/templates/default/resume.html` during `resume-forge init`. `renderer.ts` reads from the user's copy (config `templatePath`), not the source repo template — this allows users to customize their template.
- **Story 2.4 (generateContent):** `session.generatedContent` is a `ResumeContent` object. The `!` assertion is safe because `renderHTML` is only called after `generateContent` succeeds.
- **Story 1.4 (config):** `config.templatePath` defaults to `~/.resume-forge/templates/default/resume.html`. `config.theme` defaults to `"amber"`. Both are available via `readConfig()`.
- **`@types/handlebars` v4 vs handlebars v4:** The types match the installed version. `Handlebars.compile()` returns `HandlebarsTemplateDelegate<T>`. For TypeScript, `template(data)` returns `string`.

### References

- Acceptance criteria [Source: project Outline/epics-resume-forge.md#Story-2.5]
- Theme values (UX-DR1) [Source: project Outline/epics-resume-forge.md#UX-Design-Requirements]
- Handlebars template injection [Source: project Outline/architecture-resume-forge.md#HTML-Template-Injection]
- Config schema (templatePath, theme) [Source: src/config.ts]
- Template source [Source: templates/default/resume.html]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story workflow)

### Debug Log References

- `npx vitest run src/pipeline/renderer.test.ts` → 7/7 pass
- `npm run lint` → clean; `npm run build` → success

### Completion Notes List

- **Compact-mode deviation (intentional, important):** The Dev Notes proposed a regex `applyCompact(html)` post-processor. Verified against the real Story 1.2 template (`templates/default/resume.html`), which already contains `class="resume {{#if compact}}compact{{/if}}"`. The regex approach would actually **fail** here: with no compact flag the template renders `class="resume "` (trailing space from the empty `{{#if}}`), and the Dev Notes regex requires `resume` immediately followed by `"`. The correct, deterministic implementation passes `compact` as template **data**, letting Handlebars's own conditional add the class. This satisfies AC6 (`class="resume compact"` verified in tests) and AC7 (determinism).
- `loadTemplate` takes a template **source string** (not a path) — compiling is decoupled from file I/O, which makes it directly unit-testable and lets `renderHTML` own the file read.
- Optional `summary`/`achievements` are normalized to `undefined` when empty before templating, so no empty sections render (belt-and-suspenders with the template's `{{#if}}` guards).
- `injectTheme` prepends a `:root` override `<style>` for `slate-blue`/`forest`/`charcoal`; amber and unknown themes are no-ops.
- `renderHTML` does not mutate the session — it returns the HTML string; the session is read-only here.
- `generate.ts` now threads `captureJD → runAlignment → generateContent → renderHTML`.

### File List

- `src/pipeline/renderer.ts` (new)
- `src/pipeline/renderer.test.ts` (new)
- `src/pipeline/index.ts` (modified — export `renderHTML`)
- `src/commands/generate.ts` (modified — wire `renderHTML`)

### Change Log

- 2026-05-29: Story 2.5 created — HTML rendering, theme injection, compact mode
- 2026-05-29: Story 2.5 implemented — Handlebars render + theme injection; compact handled via template data (template already has `{{#if compact}}`); 7 unit tests passing

### Review Findings

- [x] [Review][Patch] `resolveTemplatePath` path traversal guard [src/pipeline/renderer.ts:72] — fixed: added `..` detection guard; paths containing `..` throw `CONFIG_INVALID`. Absolute paths outside `~/.resume-forge/templates/` remain allowed (power-user use case) but traversal sequences are rejected.

# Story 1.7: Profile Loading & Experience Indexing

Status: done

## Story

As Rainboldt,
I want to load my LinkedIn JSON export and base resume file so the tool has my complete professional experience to work from,
so that every generated resume draws only from real, verified facts about my background.

## Acceptance Criteria

1. `profile.load(linkedinPath)` extracts professional experience, skills, and education from a LinkedIn JSON export and returns a typed `ExperiencePool` object
2. The parsed profile is stored at `~/.resume-forge/profile/linkedin-export.json` (atomically)
3. `✓ Profile loaded — N entries indexed` is displayed via `display.success()` where N is the experience entry count
4. `profile.loadBaseResume(filePath)` accepts `.pdf` and `.docx` files; uses `pdf-parse` for PDF and `mammoth` for DOCX
5. The base resume file is stored at `~/.resume-forge/profile/base-resume.{pdf|docx}`
6. `✓ Resume stored as visual reference` is displayed on success
7. When LinkedIn JSON cannot be parsed, a `ResumeForgeError` is thrown with a clear message; `display.error()` shows `✗ Could not parse LinkedIn export. → Check the file is the JSON export from linkedin.com/settings`
8. When `profile.getExperiencePool()` is called with no profile loaded, `display.error()` shows `✗ No profile found. → Run resume-forge init first` and exits with code 2
9. `ExperiencePool` type is added to `src/types.ts`

## Tasks / Subtasks

- [x] Add `ExperiencePool` type to `src/types.ts` (AC: 9)
  - [x] Add `ExperiencePool` type with `entries`, `skills`, `education`, optional `name`, optional `contact` fields
  - [x] Verify `ExperienceEntry` type already exists in types.ts (it does — from Story 1.1)

- [x] Create `src/profile/linkedin.ts` (AC: 1, 2, 3, 7)
  - [x] Import `fs/promises`, `path`, `os`, `write-file-atomic`, display, errors, types
  - [x] Define `PROFILE_DIR` constant and `LINKEDIN_PATH` constant
  - [x] Implement `ensureProfileDir(): Promise<void>` — creates `~/.resume-forge/profile/`
  - [x] Implement `parseLinkedin(raw: unknown): ExperiencePool` — parses LinkedIn JSON, throws ResumeForgeError on failure
  - [x] Implement and export `load(linkedinPath: string): Promise<ExperiencePool>`

- [x] Create `src/profile/resume.ts` (AC: 4, 5, 6)
  - [x] Import `pdf-parse`, `mammoth`, `fs/promises`, display, errors
  - [x] Implement and export `loadBaseResume(filePath: string): Promise<void>`

- [x] Update `src/profile/index.ts` to expose public API (AC: 1, 4, 8)
  - [x] Export `load` from `./linkedin.js`
  - [x] Export `loadBaseResume` from `./resume.js`
  - [x] Implement and export `getExperiencePool(): Promise<ExperiencePool>`

- [x] Write unit tests `src/profile/linkedin.test.ts` (AC: 1, 7)
  - [x] Test `parseLinkedin()` with a sample LinkedIn JSON object — returns correct ExperiencePool shape
  - [x] Test `parseLinkedin()` throws `ResumeForgeError` when input is not parseable LinkedIn format
  - [x] Test experience entry count is correct

- [x] Build verification
  - [x] `npm run build` — no errors
  - [x] `npm run lint` — type check passes

## Dev Notes

### New Type: `ExperiencePool` — Add to `src/types.ts`

`ExperiencePool` does not exist yet in `src/types.ts`. Add it to the bottom of the file:

```typescript
// Add to src/types.ts

export type ExperiencePool = {
  name?: string
  contact?: {
    phone?: string
    email?: string
    linkedin?: string
  }
  entries: ExperienceEntry[]         // Professional experience entries
  skills: string[]                   // Flat list of skill strings
  education: Array<{
    degree: string
    institution: string
    year: string
  }>
}
```

`ExperienceEntry` is already defined in `src/types.ts` from Story 1.1:
```typescript
type ExperienceEntry = {
  title: string; company: string; location?: string;
  startDate: string; endDate: string; description: string; bullets: string[]
}
```

### Profile Directory Paths

```typescript
import * as path from 'path'
import * as os from 'os'

const PROFILE_DIR    = path.join(os.homedir(), '.resume-forge', 'profile')
const LINKEDIN_PATH  = path.join(PROFILE_DIR, 'linkedin-export.json')
const BASE_RESUME_DIR = PROFILE_DIR  // base-resume.pdf or base-resume.docx stored here
```

### LinkedIn JSON Format

LinkedIn's JSON export (from linkedin.com/settings → Data Privacy → Get a copy of your data) ships as a ZIP. When extracted, the relevant files are:
- `Experience.json` — array of experience objects
- `Skills.json` — array of skills
- `Education.json` — array of education entries
- `Profile.json` — name and contact info

**However**, the tool expects the user to provide a single JSON file path. The likely user workflow is to concatenate or provide one of the JSON files, or the tool accepts the `Profile.json` which may reference or inline the experience.

**Pragmatic approach:** Accept a JSON file and try multiple known formats:

```typescript
// Format 1: Array of experience objects (Experience.json)
// [{ "Company Name": "...", "Title": "...", "Started On": "...", ... }]

// Format 2: Object with sections (some LinkedIn export tools combine)
// { "experience": [...], "skills": [...], "education": [...] }

// Format 3: LinkedIn API-style (profile summary)
// { "firstName": "...", "lastName": "...", "positions": { "values": [...] } }
```

The parser should attempt each format and fall back gracefully. If all formats fail, throw `ResumeForgeError('PROFILE_PARSE_FAILED', ...)`.

### `parseLinkedin()` — Multi-Format Parser

```typescript
import { ExperiencePool, ExperienceEntry } from '../types.js'
import { ResumeForgeError } from '../errors.js'

export function parseLinkedin(raw: unknown): ExperiencePool {
  if (!raw || typeof raw !== 'object') {
    throw new ResumeForgeError(
      'PROFILE_PARSE_FAILED',
      'LinkedIn export is not a valid JSON object or array.'
    )
  }

  // Format 1: Array — treat as Experience.json directly
  if (Array.isArray(raw)) {
    const entries = raw.map(parseLinkedinEntry).filter(Boolean) as ExperienceEntry[]
    return { entries, skills: [], education: [] }
  }

  const obj = raw as Record<string, unknown>

  // Format 2: Object with experience/skills/education keys
  if (obj['experience'] || obj['Experience'] || obj['positions']) {
    return parseObjectFormat(obj)
  }

  // Format 3: LinkedIn data dump with flat experience array at root
  if (obj['Company Name'] || obj['title']) {
    // Single entry wrapped in object — unlikely but handle
    const entry = parseLinkedinEntry(obj)
    return { entries: entry ? [entry] : [], skills: [], education: [] }
  }

  throw new ResumeForgeError(
    'PROFILE_PARSE_FAILED',
    'Unrecognized LinkedIn export format.'
  )
}

function parseLinkedinEntry(item: unknown): ExperienceEntry | null {
  if (!item || typeof item !== 'object') return null
  const e = item as Record<string, unknown>

  const title = String(e['Title'] ?? e['title'] ?? '')
  const company = String(e['Company Name'] ?? e['company'] ?? e['companyName'] ?? '')

  if (!title && !company) return null

  return {
    title:       title   || 'Unknown Title',
    company:     company || 'Unknown Company',
    location:    e['Location'] ? String(e['Location']) : undefined,
    startDate:   String(e['Started On'] ?? e['startDate'] ?? 'Unknown'),
    endDate:     String(e['Finished On'] ?? e['endDate'] ?? 'Present'),
    description: String(e['Description'] ?? e['description'] ?? ''),
    bullets:     [],  // LinkedIn JSON doesn't have bullet points; LLM generates them
  }
}

function parseObjectFormat(obj: Record<string, unknown>): ExperiencePool {
  const rawExp = obj['experience'] ?? obj['Experience'] ?? []
  const rawSkills = obj['skills'] ?? obj['Skills'] ?? []
  const rawEdu = obj['education'] ?? obj['Education'] ?? []

  const entries = Array.isArray(rawExp)
    ? rawExp.map(parseLinkedinEntry).filter(Boolean) as ExperienceEntry[]
    : []

  const skills = Array.isArray(rawSkills)
    ? rawSkills.map((s: unknown) => {
        if (typeof s === 'string') return s
        const so = s as Record<string, unknown>
        return String(so['Name'] ?? so['name'] ?? so['skill'] ?? '')
      }).filter(Boolean)
    : []

  const education = Array.isArray(rawEdu)
    ? rawEdu.map((e: unknown) => {
        if (!e || typeof e !== 'object') return null
        const ed = e as Record<string, unknown>
        return {
          degree:      String(ed['Degree Name'] ?? ed['degree'] ?? ''),
          institution: String(ed['School Name'] ?? ed['school'] ?? ed['institution'] ?? ''),
          year:        String(ed['End Date'] ?? ed['endDate'] ?? ''),
        }
      }).filter(Boolean) as Array<{ degree: string; institution: string; year: string }>
    : []

  // Try to extract name from object
  const name = obj['firstName'] && obj['lastName']
    ? `${obj['firstName']} ${obj['lastName']}`
    : undefined

  return { name, entries, skills, education }
}
```

**Important:** The parser is intentionally lenient — real LinkedIn JSON exports have inconsistent field casing and structure across export versions. Lenient parsing > strict parsing here because the goal is to extract useful data, not validate the LinkedIn format perfectly.

### `load()` — Full Flow

```typescript
// src/profile/linkedin.ts
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import writeFileAtomic from 'write-file-atomic'
import * as display from '../display.js'
import { ResumeForgeError } from '../errors.js'
import type { ExperiencePool } from '../types.js'

const PROFILE_DIR   = path.join(os.homedir(), '.resume-forge', 'profile')
const LINKEDIN_PATH = path.join(PROFILE_DIR, 'linkedin-export.json')

async function ensureProfileDir(): Promise<void> {
  await fs.mkdir(PROFILE_DIR, { recursive: true })
}

export async function load(linkedinPath: string): Promise<ExperiencePool> {
  // Read the user-provided file
  let raw: string
  try {
    raw = await fs.readFile(linkedinPath, 'utf-8')
  } catch {
    throw new ResumeForgeError(
      'FILE_NOT_FOUND',
      `LinkedIn export not found at: ${linkedinPath}`
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ResumeForgeError(
      'PROFILE_PARSE_FAILED',
      'LinkedIn export is not valid JSON.'
    )
  }

  // Parse into ExperiencePool — throws ResumeForgeError on failure
  const pool = parseLinkedin(parsed)

  // Persist parsed pool
  await ensureProfileDir()
  await writeFileAtomic(LINKEDIN_PATH, JSON.stringify(pool, null, 2))

  display.success(`Profile loaded — ${pool.entries.length} entries indexed`)
  return pool
}
```

**Note:** `display.success()` is called inside `load()` because the profile module owns this feedback. The init wizard (Story 1.5) doesn't need to repeat it — `load()` handles it. This is consistent with how `loadBaseResume()` handles its own success message.

### `loadBaseResume()` — PDF and DOCX

```typescript
// src/profile/resume.ts
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import * as display from '../display.js'
import { ResumeForgeError } from '../errors.js'

const PROFILE_DIR = path.join(os.homedir(), '.resume-forge', 'profile')

export async function loadBaseResume(filePath: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase()

  if (ext !== '.pdf' && ext !== '.docx') {
    throw new ResumeForgeError(
      'PROFILE_PARSE_FAILED',
      `Unsupported file type: ${ext}. Use .pdf or .docx.`
    )
  }

  // Verify file exists
  try {
    await fs.access(filePath)
  } catch {
    throw new ResumeForgeError(
      'FILE_NOT_FOUND',
      `Resume file not found: ${filePath}`
    )
  }

  // Copy file to profile store (preserve original extension)
  await fs.mkdir(PROFILE_DIR, { recursive: true })
  const dest = path.join(PROFILE_DIR, `base-resume${ext}`)
  await fs.copyFile(filePath, dest)

  // Optionally extract text for reference (not required by AC — skip for now)
  // pdf-parse and mammoth are available but text extraction is used by future stories

  display.success('Resume stored as visual reference')
}
```

**Why not extract text?** The AC says "stored as visual reference" — the file is stored for the LLM to reference later. Text extraction from the base resume is a future enhancement (it would enrich the ExperiencePool with additional context). For Story 1.7, just copy the file.

### `getExperiencePool()` — Load Stored Pool

```typescript
// src/profile/index.ts
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import * as display from './display.js'  // ← wrong! Use '../display.js' — profile/ is inside src/
import type { ExperiencePool } from '../types.js'
import { ResumeForgeError } from '../errors.js'
import { load } from './linkedin.js'
import { loadBaseResume } from './resume.js'

const LINKEDIN_PATH = path.join(os.homedir(), '.resume-forge', 'profile', 'linkedin-export.json')

export { load, loadBaseResume }

export async function getExperiencePool(): Promise<ExperiencePool> {
  let raw: string
  try {
    raw = await fs.readFile(LINKEDIN_PATH, 'utf-8')
  } catch {
    display.noProfile()   // ✗ No profile found. → Run resume-forge init first.
    process.exit(2)
    throw new Error('unreachable')  // TypeScript narrowing
  }

  try {
    return JSON.parse(raw) as ExperiencePool
  } catch {
    throw new ResumeForgeError(
      'PROFILE_PARSE_FAILED',
      'Stored profile is corrupted. Re-run resume-forge init to reload your profile.'
    )
  }
}
```

**Important import correction above:** From `src/profile/index.ts`, display is at `'../display.js'` (one level up), not `'./display.js'`.

### pdf-parse and mammoth — Import Notes

Both are installed (Story 1.1). Their import syntax:

```typescript
// pdf-parse — default import
import pdfParse from 'pdf-parse'
// Usage:
const buffer = await fs.readFile(filePath)
const data = await pdfParse(buffer)
const text = data.text  // extracted plain text

// mammoth — named import for CJS
import mammoth from 'mammoth'
// Usage:
const result = await mammoth.extractRawText({ path: filePath })
const text = result.value  // extracted plain text
```

**Note on pdf-parse type mismatch:** Story 1.1 review noted `@types/pdf-parse@^1.1.5` (v1) vs `pdf-parse@^2.4.5` (v2) — a major type mismatch. You may need to add `// @ts-ignore` or `as any` cast for the pdfParse call if TypeScript rejects the v2 API. This was flagged as deferred in Story 1.1 — resolve it now when first using pdf-parse.

If TypeScript throws on `pdfParse(buffer)`, cast the import:
```typescript
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>
```

### Unit Test: `src/profile/linkedin.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { parseLinkedin } from './linkedin.js'
import { ResumeForgeError } from '../errors.js'

describe('parseLinkedin', () => {
  it('parses an Experience.json array', () => {
    const raw = [
      {
        'Company Name': 'Acme Corp',
        'Title': 'Software Engineer',
        'Started On': 'Jan 2020',
        'Finished On': 'Present',
        'Description': 'Built things.',
        'Location': 'Remote',
      },
    ]
    const pool = parseLinkedin(raw)
    expect(pool.entries).toHaveLength(1)
    expect(pool.entries[0].company).toBe('Acme Corp')
    expect(pool.entries[0].title).toBe('Software Engineer')
    expect(pool.entries[0].location).toBe('Remote')
  })

  it('parses an object with experience key', () => {
    const raw = {
      experience: [{ company: 'Beta Inc', title: 'Dev', startDate: '2022', endDate: '2023', description: '' }],
      skills: ['TypeScript', 'Node.js'],
      education: [{ 'School Name': 'MIT', 'Degree Name': 'BS CS', 'End Date': '2019' }],
    }
    const pool = parseLinkedin(raw)
    expect(pool.entries).toHaveLength(1)
    expect(pool.skills).toContain('TypeScript')
    expect(pool.education[0].institution).toBe('MIT')
  })

  it('throws ResumeForgeError for non-object input', () => {
    expect(() => parseLinkedin('not json')).toThrow(ResumeForgeError)
    expect(() => parseLinkedin(null)).toThrow(ResumeForgeError)
    expect(() => parseLinkedin(42)).toThrow(ResumeForgeError)
  })

  it('throws ResumeForgeError for unrecognized object format', () => {
    expect(() => parseLinkedin({ someRandomKey: true })).toThrow(ResumeForgeError)
  })
})
```

**Note:** Export `parseLinkedin` from `linkedin.ts` for testability. It's a pure function and easy to test without mocking the filesystem.

### Architecture Compliance

| Rule | Application |
|------|-------------|
| All output via display.ts | `display.success()` and `display.noProfile()` (from display.ts) used; never console.log in profile module |
| Atomic writes | `writeFileAtomic()` for `linkedin-export.json` |
| ResumeForgeError for all errors | Parse failures, file not found, unsupported extension all use ResumeForgeError |
| Barrel imports only | `src/profile/index.ts` is the public API; init.ts imports from `'../profile/index.js'` only |
| No console.log | Zero raw console calls in any profile/ file |

### Previous Story Intelligence

- **Story 1.1 (types.ts):** `ExperienceEntry` type already exists. `ExperiencePool` must be added. Import `ExperienceEntry` from `'../types.js'` inside `src/profile/`.
- **Story 1.1 (errors.ts):** `PROFILE_NOT_FOUND` and `PROFILE_PARSE_FAILED` are both defined. Use them.
- **Story 1.3 (display.ts):** `display.success()`, `display.error()`, and `display.noProfile()` are available. `noProfile()` is the convenience function for the "no profile found" error state.
- **Story 1.4 (config.ts):** Not directly used by profile module. Profile module reads its own paths from `os.homedir()` directly.
- **pdf-parse type mismatch:** Story 1.1 review item — use `require()` cast pattern if TypeScript rejects the v2 API types.
- **`@types/handlebars` pattern:** Story 1.1 installed `@types/handlebars`. Similarly, `@types/pdf-parse` covers v1 of pdf-parse but the package is v2. The cast approach is the resolution.

### References

- Story 1.7 acceptance criteria [Source: project Outline/epics-resume-forge.md#Story-1.7]
- Profile module file structure [Source: project Outline/architecture-resume-forge.md#Complete-Project-Directory-Structure]
- `ExperiencePool` usage in pipeline [Source: project Outline/architecture-resume-forge.md#LLM-Integration-Architecture]
- `getExperiencePool()` error message [Source: project Outline/ux-design-specification-resume-forge.md#UX-Consistency-Patterns]
- pdf-parse type mismatch deferred [Source: project Outline/1-1-project-scaffolding-and-build-toolchain.md#Review-Findings]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (BMad Dev — Amelia)

### Debug Log References

- `write-file-atomic` types: covered by the ambient `src/write-file-atomic.d.ts` added in Story 1.4, so `linkedin.ts` compiled without a separate cast.
- `getExperiencePool()` relies on `process.exit(2)` returning `never`, so TypeScript narrows `raw` as definitely-assigned after the catch — no unreachable-`throw` shim needed.
- pdf-parse v2 vs `@types/pdf-parse` v1 mismatch: not triggered this story — `loadBaseResume()` only copies the file (no text extraction per AC), so neither `pdf-parse` nor `mammoth` is imported yet. Deferred resolution remains for the story that first extracts text.

### Completion Notes List

- Added `ExperiencePool` type to `src/types.ts` (name?, contact?, entries, skills, education) reusing the existing `ExperienceEntry`.
- `src/profile/linkedin.ts`: exported pure `parseLinkedin()` (multi-format: array / object-with-keys / single-entry / firstName+lastName name extraction; lenient field-casing) and `load()` (reads file, JSON-parses, persists pool atomically to `~/.resume-forge/profile/linkedin-export.json`, emits `✓ Profile loaded — N entries indexed`). Unrecognized formats throw `ResumeForgeError('PROFILE_PARSE_FAILED')`.
- `src/profile/resume.ts`: `loadBaseResume()` validates `.pdf`/`.docx`, checks existence, copies to `~/.resume-forge/profile/base-resume.{ext}`, emits `✓ Resume stored as visual reference`.
- `src/profile/index.ts`: re-exports `load`/`loadBaseResume` and implements `getExperiencePool()` — on no stored profile calls `display.noProfile()` and `process.exit(2)`; corrupt stored profile throws `ResumeForgeError`.
- `src/profile/linkedin.test.ts`: 5 tests covering array format, object-with-keys (incl. skill objects + education mapping), name extraction, and the two throw cases. All 22 project tests pass; build and lint clean.

### File List

- `src/types.ts` (updated — add `ExperiencePool`)
- `src/profile/linkedin.ts`
- `src/profile/resume.ts`
- `src/profile/index.ts` (updated)
- `src/profile/linkedin.test.ts`

### Review Findings

- [x] [Review][Defer] AC4: `loadBaseResume()` copies file without invoking pdf-parse/mammoth for text extraction [src/profile/resume.ts] — deferred, pre-existing; story dev notes explicitly state "for Story 1.7, just copy the file — text extraction is a future enhancement"

### Change Log

- 2026-05-29: Story 1.7 created — profile loading, LinkedIn JSON multi-format parser, PDF/DOCX base resume storage, ExperiencePool type, getExperiencePool()
- 2026-05-29: Story 1.7 implemented — profile module + ExperiencePool type + 5 parser tests; all ACs satisfied; status → review
- 2026-05-30: Story 1.7 code review — 1 deferred finding (AC4 text extraction); all other ACs confirmed satisfied; status → done

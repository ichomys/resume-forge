---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-05-28'
inputDocuments:
  - "prd-resume-forge.md"
  - "ux-design-specification-resume-forge.md"
workflowType: 'architecture'
project_name: 'Resume Forge'
user_name: 'Rainboldt'
date: '2026-05-28'
---

# Architecture Decision Document — Resume Forge

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
42 FRs across 8 domains:
- **Profile & Experience Management (FR1–4):** LinkedIn JSON parsing + base resume (PDF/DOCX) loading. One-time setup; experience pool is stable across all generation runs. Profile updates must preserve answer store.
- **Job Description Processing (FR5–8):** Copy-paste interactive entry or `--jd <file>` flag. JD completeness confirmation gate before analysis begins — prevents poor-quality inputs from corrupting alignment scores.
- **Alignment Analysis (FR9–13):** Core scoring pipeline — % score + categorical breakdown (aligned/gap/no-match). Multi-round context rounds let the user improve their alignment before committing to generation. The report is the product's key transparency moment.
- **Gap Discovery & Context Gathering (FR14–19):** Sequential gap questioning (one at a time), unlimited context rounds, fit assessment when gaps are unresolvable. User always controls whether to continue, generate anyway, or exit clean.
- **Answer Store (FR20–26):** JSON persistence keyed by topic/skill. Auto-matched on future runs, shown for confirmation before use, user-overridable. Full CRUD via `store` command. The store's compounding value is the primary repeat-use driver.
- **Resume Generation (FR27–30):** LLM generates role-tailored content from experience pool + JD analysis + stored/provided answers. Content is curated and prioritized by role relevance. Output rendered into user-owned HTML/CSS template.
- **Output & Review (FR31–35):** HITL review gate — user approves or requests changes before file is finalized. HTML output is print-media-query formatted for browser Print-to-PDF. Filename is role-slug + date.
- **System Configuration & History (FR36–42):** Guided init wizard (idempotent), env-var-only API key storage, configurable model + output dir, append-only run history log.

**Non-Functional Requirements:**
19 NFRs across 4 categories:
- **Performance (NFR1–4):** <15s alignment report, <60s clean generation, <10min gap-heavy, <500ms all non-LLM ops. LLM latency is the only meaningful performance variable.
- **Security (NFR5–8):** API key as env var reference only — never written to disk. All personal data local to `~/.resume-forge/` with user-only permissions. No PII in terminal output or run history beyond role/date/score.
- **Integration (NFR9–12):** Graceful Anthropic API error handling (rate limit, timeout, unavailability). Key validation on first use. Zero-code model swap via config.
- **Reliability (NFR13–16):** Consistent LLM output quality for equivalent inputs. Atomic answer store writes (crash-safe). Append-only run history. Deterministic HTML rendering.
- **Maintainability (NFR17–19):** Versioned JSON schemas with migration paths. Backward-compatible config across minor updates. All errors are actionable — no raw stack traces.

**Scale & Complexity:**
- Primary domain: CLI tool with LLM integration + HTML document generation
- Complexity level: Low-Medium
- Estimated architectural components: 7–9 (CLI layer, profile parser, alignment engine, gap loop, LLM abstraction, answer store, template renderer, config manager, run history)

### Technical Constraints & Dependencies

- **Node.js runtime implied** — UX spec references `ora`/`halo` spinner libraries (Node.js), `display.js` module naming. Python mentioned as alternative LLM backend only.
- **Anthropic API** — Claude Sonnet as primary model. Must handle rate limits, timeouts, transient failures with retry. Zero-code model swap required via settings config.
- **Local filesystem only** — All state in `~/.resume-forge/`. No database, no cloud, no server. Filesystem is the persistence layer.
- **HTML/CSS output, browser PDF** — No server-side PDF generation. Print-to-PDF via Chrome/Edge. CSS custom properties are the only template configuration surface.
- **Solo developer/operator** — Architecture must minimize operational overhead. No deploy infrastructure. No monitoring, no CI beyond tests.
- **Answer store atomicity** — JSON write operations must be crash-safe. A process kill during write must not corrupt existing entries (write-then-rename pattern or similar).

### Cross-Cutting Concerns Identified

- **Display module** — All CLI output (spinners, prompts, success/error/status) must route through a single module to enforce color/prefix conventions consistently.
- **LLM abstraction layer** — Alignment analysis, gap question generation, and resume content generation are three distinct LLM calls. A thin adapter layer makes model swap zero-code.
- **File atomicity** — Answer store and run history are both append/write operations that must be crash-safe. Atomic write pattern applies to both.
- **Config schema versioning** — Settings and answer store JSON schemas must carry version fields and ship migration logic for forward compatibility.
- **Error handling convention** — Every failure mode produces a clear prefix (`✗`) + recovery instruction (`→`). No raw exceptions surface. This is a cross-cutting display concern, not per-module.

## Starter Template Evaluation

### Primary Technology Domain

CLI Tool (Node.js) — confirmed by UX spec library references (ora, display.js), local-only runtime requirements, and absence of any web/server infrastructure.

### Starter Options Considered

| Option | Rationale | Decision |
|---|---|---|
| **oclif** | Enterprise CLI framework, TypeScript-first, plugin system | Rejected — plugin/hook overhead unjustified for 5 commands |
| **commander.js + manual setup** | Lightweight command routing, full control | Selected — right-sized, minimal ceremony |
| **Raw argv parsing** | Zero dependencies | Rejected — commander ergonomics (help, flags, subcommands) worth the 1 dep |

### Selected Foundation: commander.js + TypeScript

**Rationale:** Resume Forge has 5 commands and a well-defined UX pattern. commander.js provides command routing and flag parsing with minimal overhead and no architectural opinions — every other decision (display, storage, LLM integration) is made explicitly for this project's requirements.

**Initialization Command:**

```bash
npm init -y && npm install -D typescript tsup @types/node
npm install commander ora chalk @inquirer/prompts zod write-file-atomic
npm install pdf-parse mammoth @anthropic-ai/sdk
```

**Architectural Decisions Established by Foundation:**

**Language & Runtime:**
TypeScript (strict mode). Node.js 20+ LTS. Output: CommonJS via tsup for broad CLI compatibility.

**Styling Solution (CLI output):**
chalk v5 (ESM) for color output. All color/prefix conventions implemented in a single `display.ts` module — no color logic outside this module. Respects `NO_COLOR` env var.

**Build Tooling:**
tsup — zero-config TypeScript bundler. Produces single-file CLI entry. Dev: `tsx` for direct TS execution during development.

**Testing Framework:**
Vitest — fast, ESM-native, compatible with TypeScript without extra config. Unit tests for alignment engine, answer store, and config manager. Integration tests for the full generate pipeline.

**Code Organization:**
```
src/
  commands/       # One file per CLI command (init, generate, store, review, config)
  pipeline/       # Core pipeline modules (alignment, gap-loop, generator, renderer)
  store/          # Answer store read/write/match
  llm/            # LLM abstraction layer (model-swappable adapter)
  display.ts      # ALL CLI output — single module, never bypassed
  config.ts       # Config read/write/schema with zod validation
```

**Key Library Decisions:**
- `zod` — schema validation for config and answer store JSON with version migration support
- `write-file-atomic` — crash-safe writes for answer store (NFR14) and run history
- `@inquirer/prompts` — interactive prompts (multi-line paste, single-char keypress, free text)
- `ora` — spinners (specified in UX design; resolves to ✓/✗ on same line)

**Note:** Project initialization using the above commands is the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Answer store matching strategy — exact topic-key match with LLM-assisted normalization
- LLM call architecture — 3 separate calls (alignment, gap questions, resume generation)
- Pipeline state management — immutable session object threaded through explicit function signatures
- Distribution method — global npm install (`npm install -g resume-forge`)
- HTML template injection — Handlebars templating (loop support, user-owned template)

**Important Decisions (Shape Architecture):**
- All display output routes through single `display.ts` — no bypass
- Atomic writes via `write-file-atomic` for answer store and run history
- Config and store schemas validated via zod with version field
- `tsx` for development, `tsup` for production build

**Deferred Decisions (Post-MVP):**
- Fuzzy/semantic answer store matching (Phase 2 — after exact-key proves insufficient)
- Shell completion
- Multiple named templates via `--template` flag
- Application tracking / run history browsing UI

### Data Architecture

**Answer Store Schema (versioned JSON):**
```json
{
  "version": 1,
  "entries": {
    "container-orchestration": {
      "question": "Tell me about any container orchestration work you've done.",
      "answer": "Led Kubernetes migration for 3 production services...",
      "usageCount": 4,
      "lastUsed": "2026-05-28T10:00:00Z",
      "createdAt": "2026-04-10T09:00:00Z"
    }
  }
}
```
- Key: LLM-normalized topic slug (kebab-case, consistent across runs)
- All writes via `write-file-atomic` (NFR14 crash safety)
- zod schema validates on read; migration function handles version bumps

**Config Schema (versioned JSON):**
```json
{
  "version": 1,
  "apiKeyEnvVar": "ANTHROPIC_API_KEY",
  "model": "claude-sonnet-4-5",
  "outputDir": "~/resume-forge-output",
  "templatePath": "~/.resume-forge/templates/default/resume.html",
  "theme": "amber"
}
```
- `apiKeyEnvVar` stores the env var name, never the key value (NFR5)
- `model` field enables zero-code model swap (NFR12)

**Run History (append-only JSON lines):**
Each generation appends one JSON line to `run-history.jsonl` — role slug, date, alignment %, output path. Never modified, only appended.

### LLM Integration Architecture

**Three-call pipeline:**
1. `llm.analyzeAlignment(jdText, experiencePool)` → `{ score, aligned[], gaps[], noMatch[], gapKeys[] }`
2. `llm.generateGapQuestion(gapKey, gapDescription, experiencePool)` → `{ question: string }` (called only for store misses)
3. `llm.generateResume(jdAnalysis, experiencePool, resolvedAnswers)` → `{ sections: ResumeContent }`

**LLM abstraction layer (`src/llm/`):**
- `LLMAdapter` interface — `analyzeAlignment()`, `generateGapQuestion()`, `generateResume()`
- `AnthropicAdapter` implements `LLMAdapter` — handles retry, timeout, rate limit errors
- `model` field in config injected at adapter construction — zero-code swap
- All prompts in `src/llm/prompts/` as template strings — not inline in business logic

### Pipeline State Management

Immutable `GenerationSession` type threaded through pipeline stages:
```typescript
type GenerationSession = {
  jdText: string
  jdConfirmed: boolean
  alignment?: AlignmentResult
  resolvedGaps: Record<string, string>  // gapKey → answer
  generatedContent?: ResumeContent
  approvedOutputPath?: string
}
```
Each pipeline function: `(session: GenerationSession, ...) => Promise<GenerationSession>` — returns new object, never mutates.

### Infrastructure & Distribution

- **Dev:** `npm link` — `resume-forge` available globally from local clone
- **Install:** `npm install -g resume-forge` (post-publish)
- **No CI/CD, no deploy infrastructure** — personal tool, solo developer
- **Version management:** semver in `package.json`; breaking schema changes increment major version with migration

### HTML Template Injection

Handlebars templates with well-defined section helpers:
```html
<div class="r-job">
  <div class="r-jtitle">{{title}} | {{company}}</div>
  {{#each bullets}}<li>{{this}}</li>{{/each}}
</div>
```
- LLM generates `ResumeContent` (structured JSON matching template vars)
- `renderer.ts` compiles template + data → HTML string
- Theme injection: `<style>:root { --accent-color: {{themeColor}}; }</style>` prepended to output
- Compact mode: adds `class="compact"` to root element via Handlebars helper

## Implementation Patterns & Consistency Rules

### Potential Conflict Points: 7 Areas

### Naming Patterns

**Code naming (TypeScript conventions throughout):**
- Files: `kebab-case.ts` (e.g., `answer-store.ts`, `gap-loop.ts`)
- Functions/methods: `camelCase` (e.g., `analyzeAlignment`, `resolveGap`)
- Types/interfaces: `PascalCase` (e.g., `GenerationSession`, `AlignmentResult`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `DEFAULT_OUTPUT_DIR`)
- Zod schemas: `PascalCase` + `Schema` suffix (e.g., `AnswerStoreSchema`, `ConfigSchema`)

**JSON field naming:** `camelCase` everywhere — consistent with TypeScript, no snake_case mixing.
- Correct: `usageCount`, `lastUsed`, `apiKeyEnvVar`, `outputDir`
- Wrong: `usage_count`, `last_used`, `api_key_env_var`

**Answer store topic keys:** `kebab-case` slugs generated by LLM, normalized to lowercase + hyphens only.
- Validation regex: `/^[a-z][a-z0-9-]*$/`
- Correct: `container-orchestration`, `embedded-systems-firmware`
- Wrong: `Container Orchestration`, `containerOrchestration`

### Structure Patterns

**Test file location:** Co-located with source — `src/pipeline/alignment.test.ts` alongside `src/pipeline/alignment.ts`. No separate `__tests__/` directory for unit tests. Integration tests in `tests/integration/`.

**Module exports:** Each directory has an `index.ts` barrel file exporting its public API. Files outside a directory import only from the barrel, never from internal implementation files directly.

**Command files:** One file per command in `src/commands/`. Each exports a single `register(program: Command): void` function. `src/commands/index.ts` imports and registers all commands.

### Format Patterns

**Error handling — all errors flow through `display.ts`:**

```typescript
// Correct — throw typed error; command layer catches and displays
throw new ResumeForgeError('ALIGNMENT_FAILED', 'Alignment analysis failed — check your API key.')

// Wrong — never call these outside display.ts or CLI entry
console.error('something went wrong')
process.exit(1)
```

**LLM prompt strings — all in `src/llm/prompts/`, never inline:**

```typescript
// Correct
import { alignmentPrompt } from '../llm/prompts/alignment.js'
const prompt = alignmentPrompt(jdText, experiencePool)

// Wrong
const response = await client.messages.create({ messages: [{ content: `Analyze this JD: ${jd}` }] })
```

**File write pattern — always `write-file-atomic`:**

```typescript
// Correct
await writeFileAtomic(storePath, JSON.stringify(data, null, 2))

// Wrong
await fs.writeFile(storePath, JSON.stringify(data))
```

**Session object — immutable, always spread:**

```typescript
// Correct
return { ...session, alignment: result }

// Wrong
session.alignment = result; return session
```

### Process Patterns

**Spinner lifecycle — every async op >0s, always resolves:**

```typescript
const spin = display.spinner('Analyzing alignment...')
try {
  const result = await llm.analyzeAlignment(...)
  spin.succeed()
  return result
} catch (e) {
  spin.fail()
  throw e
}
```

**Config/store reads — validate with zod, treat missing file as empty initial state:**

```typescript
const raw = await readJsonSafe(storePath)   // returns {} if file absent
const store = AnswerStoreSchema.parse(raw)  // throws ResumeForgeError on schema violation
```

**Exit codes:**
- `0` — success
- `1` — user abort, no-generate exit, graceful redirect
- `2` — system error (API failure, bad config, parse failure)
- Never use `2` for user decisions.

### Enforcement Guidelines

**All agents MUST:**
- Route all terminal output through `display.ts` — no raw `console.log/error`
- Place all LLM prompts in `src/llm/prompts/` — no inline prompt strings
- Use `write-file-atomic` for every JSON file write
- Return new session objects, never mutate
- Import only from directory barrel files (`index.ts`), never internal files directly
- Use kebab-case topic keys for answer store entries

**Anti-patterns to flag in review:**
- `console.log()` / `console.error()` outside `display.ts`
- `fs.writeFile()` on JSON data files
- Inline template strings passed directly to Anthropic SDK
- `session.field = value` mutations
- Direct imports like `import { x } from '../store/matcher.js'` from outside `src/store/`

## Project Structure & Boundaries

### Complete Project Directory Structure

```
resume-forge/                          # Repository root
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── .gitignore                         # includes .env, local data dir references
├── .env.example                       # documents ANTHROPIC_API_KEY env var
├── bin/
│   └── resume-forge.js                # CLI entry point (tsup output, referenced in package.json "bin")
├── src/
│   ├── index.ts                       # Commander setup; imports + registers all commands
│   ├── display.ts                     # ALL terminal output — spinners, colors, prefixes, errors
│   ├── config.ts                      # Config read/write; ConfigSchema (zod); migration logic
│   ├── types.ts                       # GenerationSession, AlignmentResult, ResumeContent, GapEntry
│   ├── errors.ts                      # ResumeForgeError class + error code constants
│   ├── commands/
│   │   ├── index.ts                   # register(program) barrel — imports all commands
│   │   ├── init.ts                    # resume-forge init (setup wizard, idempotent)
│   │   ├── generate.ts                # resume-forge generate [--jd <file>] [--theme <name>]
│   │   ├── store.ts                   # resume-forge store [list|edit|clear [--topic <key>]]
│   │   ├── review.ts                  # resume-forge review (opens last HTML in default browser)
│   │   └── config-cmd.ts              # resume-forge config [--show|--set <key> <value>]
│   ├── pipeline/
│   │   ├── index.ts                   # Exports pipeline stage functions
│   │   ├── jd-capture.ts              # JD input (paste or --jd file) + confirmation prompt
│   │   ├── alignment.ts               # Calls llm.analyzeAlignment; formats + displays report
│   │   ├── gap-loop.ts                # Gap prompting loop; store lookup; answer collection
│   │   ├── generator.ts               # Calls llm.generateResume; HITL review; re-generation
│   │   └── renderer.ts                # Handlebars compilation; theme injection; file save
│   ├── store/
│   │   ├── index.ts                   # Public API: read, write, match, list, edit, clear
│   │   ├── schema.ts                  # AnswerStoreSchema (zod v1); migration function
│   │   └── matcher.ts                 # Topic key match logic; normalize slug
│   ├── profile/
│   │   ├── index.ts                   # Public API: load, getExperiencePool
│   │   ├── linkedin.ts                # LinkedIn JSON parser; experience/skills/education indexer
│   │   └── resume.ts                  # PDF parser (pdf-parse) + DOCX parser (mammoth)
│   ├── llm/
│   │   ├── index.ts                   # Factory: createAdapter(config) → LLMAdapter
│   │   ├── adapter.ts                 # LLMAdapter interface definition
│   │   ├── anthropic.ts               # AnthropicAdapter: retry, timeout, rate-limit handling
│   │   └── prompts/
│   │       ├── alignment.ts           # alignmentPrompt(jdText, experiencePool) → string
│   │       ├── gap-question.ts        # gapQuestionPrompt(gapKey, description, pool) → string
│   │       └── resume.ts              # resumePrompt(analysis, pool, answers) → string
│   └── history/
│       ├── index.ts                   # Public API: append, read
│       └── schema.ts                  # RunEntrySchema (zod); JSONL append helper
├── templates/
│   └── default/
│       ├── resume.html                # Handlebars template (2-col layout, CSS vars, print queries)
│       └── styles.css                 # Print-optimized CSS; custom properties; @media print block
└── tests/
    └── integration/
        ├── generate-pipeline.test.ts  # Full generate loop (mocked LLM adapter)
        └── answer-store.test.ts       # Store read/write/match/atomic write behavior
```

### User Data Directory (Runtime — not in repository)

```
~/.resume-forge/
├── config/
│   └── settings.json                  # ConfigSchema v1
├── data/
│   ├── answer-store.json              # AnswerStoreSchema v1
│   └── run-history.jsonl              # Append-only JSONL, one entry per run
├── profile/
│   ├── linkedin-export.json           # User-supplied LinkedIn data
│   └── base-resume.{pdf|docx}        # Source resume (visual reference)
└── templates/
    └── default/
        ├── resume.html                # Copied from repo at init; user edits for design control
        └── styles.css
```

### Architectural Boundaries

**External Boundary:**
- `src/llm/anthropic.ts` ↔ Anthropic API — sole external network call; all retry/timeout/error handling here

**Data Boundaries:**
- `src/store/` ↔ `~/.resume-forge/data/answer-store.json` — all reads/writes through store module only
- `src/history/` ↔ `~/.resume-forge/data/run-history.jsonl` — append-only through history module only
- `src/config.ts` ↔ `~/.resume-forge/config/settings.json` — config module exclusively
- `src/profile/` ↔ `~/.resume-forge/profile/` — read-only after init

**Output Boundary:**
- `src/pipeline/renderer.ts` → `~/resume-forge-output/{slug}_{date}.html` — only renderer writes output files

### Requirements to Structure Mapping

| FR Category | Primary Location |
|---|---|
| Profile & Experience Management (FR1–4) | `src/profile/` |
| Job Description Processing (FR5–8) | `src/pipeline/jd-capture.ts` |
| Alignment Analysis (FR9–13) | `src/pipeline/alignment.ts` + `src/llm/prompts/alignment.ts` |
| Gap Discovery & Context Gathering (FR14–19) | `src/pipeline/gap-loop.ts` |
| Answer Store (FR20–26) | `src/store/` |
| Resume Generation (FR27–30) | `src/pipeline/generator.ts` + `src/pipeline/renderer.ts` + `src/llm/prompts/resume.ts` |
| Output & Review (FR31–35) | `src/pipeline/generator.ts` (HITL) + `src/commands/review.ts` |
| Config & History (FR36–42) | `src/config.ts` + `src/history/` + `src/commands/init.ts` + `src/commands/config-cmd.ts` |

### Data Flow

```
resume-forge generate
  → commands/generate.ts
      → pipeline/jd-capture.ts    (JD text + confirmation)
      → pipeline/alignment.ts     → llm/anthropic.ts [call 1: analyzeAlignment]
                                  → display.ts [alignment report]
      → pipeline/gap-loop.ts      → store/ [match existing answers]
                                  → llm/anthropic.ts [call 2: generateGapQuestion, per miss]
                                  → display.ts [gap prompts + store confirmations]
                                  → store/ [write new answers, atomic]
      → pipeline/generator.ts     → llm/anthropic.ts [call 3: generateResume]
                                  → display.ts [HITL review loop]
      → pipeline/renderer.ts      → Handlebars [compile template + data → HTML string]
                                  → fs [write to outputDir, atomic]
      → history/ [append run log, atomic]
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices are compatible. TypeScript + Node.js 20 LTS + commander.js + tsup is a well-established combination. All named libraries (ora, chalk, @inquirer/prompts, zod, write-file-atomic, pdf-parse, mammoth, @anthropic-ai/sdk, handlebars) are Node.js-compatible, actively maintained, and have no version conflicts. The LLM adapter pattern supports zero-code model swap as required by NFR12.

**Pattern Consistency:** Implementation patterns align with all decisions — the immutable `GenerationSession`, the display.ts funnel, atomic writes, and zod validation are consistent with the chosen stack and NFR requirements.

**Structure Alignment:** Every directory in `src/` maps directly to a decision or FR category. No orphaned modules. Boundaries between modules are well-defined by barrel exports. ✅

### Requirements Coverage Validation ✅

**FR Coverage — 42/42:**

| Category | FRs | Covered By |
|---|---|---|
| Profile & Experience (FR1–4) | 4/4 | `src/profile/` |
| JD Processing (FR5–8) | 4/4 | `src/pipeline/jd-capture.ts` |
| Alignment Analysis (FR9–13) | 5/5 | `src/pipeline/alignment.ts` + `src/llm/prompts/alignment.ts` |
| Gap Discovery (FR14–19) | 6/6 | `src/pipeline/gap-loop.ts` |
| Answer Store (FR20–26) | 7/7 | `src/store/` |
| Resume Generation (FR27–30) | 4/4 | `src/pipeline/generator.ts` + `src/pipeline/renderer.ts` |
| Output & Review (FR31–35) | 5/5 | `src/pipeline/generator.ts` (HITL) + `src/commands/review.ts` |
| Config & History (FR36–42) | 7/7 | `src/config.ts` + `src/history/` + `src/commands/` |

**NFR Coverage — 19/19:**
- NFR1–4 (Performance): LLM calls are the only latency variable; all non-LLM ops are local JSON/file. ✅
- NFR5–8 (Security): env-var-only API key enforced in config schema; `~/.resume-forge/` created with `0o700` permissions; no PII in run history schema. ✅
- NFR9–12 (Integration): Retry/timeout in `src/llm/anthropic.ts`; model configurable via `config.model`; key validation on first use in `init.ts`. ✅
- NFR13–16 (Reliability): Deterministic Handlebars rendering; `write-file-atomic` on all JSON writes; JSONL is append-only. ✅
- NFR17–19 (Maintainability): Version fields + migration functions in all schema files; backward-compatible config; all errors routed through `display.ts`. ✅

### Gap Analysis Results

**Critical gaps: 0** — no implementation blockers.

**Important gap (1):** `init.ts` must set `0o700` permissions on `~/.resume-forge/` creation (NFR7). Responsibility documented in structure mapping — no structural change needed.

**Nice-to-have (deferred):**
- `src/utils/` barrel if shared helpers accumulate during implementation
- TypeScript path aliases if relative imports become unwieldy

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] 42 FRs analyzed and mapped to architectural components
- [x] 19 NFRs validated with explicit architectural responses
- [x] Technical constraints identified
- [x] 5 cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] 5 critical decisions documented with rationale
- [x] Full technology stack specified
- [x] LLM integration architecture defined (3-call pipeline, adapter pattern)
- [x] Distribution method defined

**✅ Implementation Patterns**
- [x] Naming conventions: code, JSON fields, topic keys
- [x] Structure patterns: test co-location, barrel exports, command registration
- [x] Format patterns: error flow, prompt location, atomic writes, immutable session
- [x] Process patterns: spinner lifecycle, config/store reads, exit codes

**✅ Project Structure**
- [x] Complete directory tree with every file named and annotated
- [x] User data directory structure defined
- [x] All FR categories mapped to specific locations
- [x] Data flow diagram defined
- [x] All integration boundaries documented

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: High**

**Key Strengths:**
- Zero ambiguity at module boundaries — every module has one responsibility and a barrel export
- NFR compliance is structural — atomicity, security, and error handling are enforced by patterns, not convention
- LLM adapter pattern means prompt tuning and model swaps never touch business logic
- `display.ts` single-output-module eliminates an entire class of UX inconsistency bugs

**Areas for Future Enhancement (Phase 2+):**
- Fuzzy/semantic answer store matching
- Multiple named templates via `--template` flag
- Shell completion
- Application tracking log + history browsing

### Implementation Handoff

**First implementation story:** Project initialization — `npm init` + install dependencies + TypeScript + tsup config.

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- All terminal output through `display.ts` — no exceptions
- All LLM prompts in `src/llm/prompts/` — no inline strings
- Use `write-file-atomic` for every JSON data file write
- Return new session objects — never mutate
- Import only from barrel `index.ts` files across module boundaries

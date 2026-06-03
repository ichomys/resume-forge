---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
inputDocuments:
  - "prd-resume-forge.md"
  - "architecture-resume-forge.md"
  - "ux-design-specification-resume-forge.md"
---

# Resume Forge - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Resume Forge, decomposing the requirements from the PRD, Architecture, and UX Design Specification into implementable stories.

## Requirements Inventory

### Functional Requirements

**Profile & Experience Management**
- FR1: User can load a LinkedIn profile export (JSON) as the primary experience source
- FR2: User can provide a base resume file (PDF or DOCX) as a supplementary experience source
- FR3: System can parse and index professional experience, skills, education, and dates from loaded profile data
- FR4: User can update loaded profile data without losing existing answer store entries

**Job Description Processing**
- FR5: User can provide a job description via interactive copy-paste entry at generation time
- FR6: User can provide a job description via a pre-saved file using a `--jd` flag
- FR7: User can provide a plain-text role title as a target in place of a full job description
- FR8: System can prompt user to confirm JD capture is complete before proceeding to analysis

**Alignment Analysis**
- FR9: System can analyze alignment between the user's experience pool and a provided job description
- FR10: System can produce an alignment score expressed as a percentage
- FR11: System can produce a categorical alignment breakdown (aligned areas, gap areas, unresolvable gaps)
- FR12: System can display the full alignment report before the user commits to resume generation
- FR13: User can provide additional context across multiple rounds to improve alignment score

**Gap Discovery & Context Gathering**
- FR14: System can identify specific experience gaps relative to job description requirements
- FR15: System can generate a targeted question for each identified gap
- FR16: User can provide answers across unlimited context rounds without a system-forced exit
- FR17: System can recalculate alignment score after each round of user-provided context
- FR18: System can assess when remaining gaps are unresolvable and surface a fit assessment
- FR19: User can choose to continue adding context, proceed to generation despite gaps, or exit without generating when a poor-fit assessment is surfaced

**Answer Store**
- FR20: System can persist user-provided gap answers to a local store keyed by topic/skill area
- FR21: System can retrieve relevant stored answers and pre-fill gap prompts on future runs
- FR22: System can display retrieved stored answers to the user for confirmation before applying them
- FR23: User can override a retrieved stored answer with a new response during any generation run
- FR24: User can list all stored topic/answer pairs
- FR25: User can edit a specific stored answer entry
- FR26: User can clear individual answer store entries or the entire store

**Resume Generation**
- FR27: System can generate role-tailored resume content using the experience pool, JD analysis, and stored/provided answers
- FR28: System can curate and prioritize experience items by relevance to the target role
- FR29: System can frame experience descriptions to emphasize alignment with target role requirements
- FR30: System can render generated content into an HTML file using the user's configured visual template

**Output & Review**
- FR31: User can review the generated HTML resume before it is considered final
- FR32: User can request changes to the generated draft and receive a revised version
- FR33: System can save finalized HTML output to a configurable directory with a role-and-date-based filename
- FR34: User can open the most recently generated HTML output in the default browser
- FR35: System can produce HTML output formatted for accurate browser-native PDF export

**System Configuration & History**
- FR36: User can run a guided setup wizard for first-time tool configuration
- FR37: User can store API credentials via environment variable reference without hardcoding values in config files
- FR38: User can configure LLM model selection without modifying source code
- FR39: User can configure the output directory path
- FR40: User can re-run setup without losing existing answer store data or run history
- FR41: System can maintain a log of past generation runs including role, date, alignment score, and output file path
- FR42: User can view and update individual configuration settings without re-running full initialization

### NonFunctional Requirements

**Performance**
- NFR1: Alignment report displays within 15 seconds of JD submission under normal API conditions
- NFR2: Full generation cycle for a high-overlap role (no gap prompting) completes in under 60 seconds
- NFR3: Full generation cycle including gap prompting completes within 10 minutes when the user responds promptly
- NFR4: All non-LLM operations (answer store read/write, file save, config load) complete in under 500ms

**Security**
- NFR5: API key is stored only as an environment variable reference — never written to config files, log files, or terminal output
- NFR6: LinkedIn profile data and resume files are stored only in `~/.resume-forge/` — no network transmission of personal data
- NFR7: The local config directory is created with user-only read/write permissions (0o700)
- NFR8: Terminal output and run history contain no PII beyond role name, date, and alignment score

**Integration**
- NFR9: API rate limit errors surface a user-readable message with retry guidance — no silent failures
- NFR10: API timeout or unavailability produces a clear error message and exits without corrupting in-progress state
- NFR11: API key is validated on first use with explicit success/failure feedback before generation proceeds
- NFR12: LLM model selection is fully configurable via settings — swapping models requires zero code changes

**Reliability & Consistency**
- NFR13: Same experience pool + same JD produces the same quality level of resume across independent runs
- NFR14: Answer store write operations are atomic — a process crash during write must not corrupt existing entries
- NFR15: Run history is append-only — the tool never modifies or deletes existing history entries
- NFR16: HTML template rendering produces identical visual output across runs for identical content inputs

**Maintainability**
- NFR17: Answer store JSON schema is versioned — any format change ships with a documented migration path
- NFR18: Config schema is backward-compatible across minor version updates — existing installs must not break on update
- NFR19: All failure modes produce clear, actionable error messages — no raw stack traces surfaced in normal operation

### Additional Requirements

Architecture-derived technical requirements that shape implementation:

- **Project initialization starter:** `npm init -y && npm install -D typescript tsup @types/node` + `npm install commander ora chalk @inquirer/prompts zod write-file-atomic pdf-parse mammoth @anthropic-ai/sdk` — this is the first implementation story
- **Runtime:** Node.js 20+ LTS; TypeScript strict mode; CommonJS output via tsup
- **Build toolchain:** tsup (production bundle), tsx (dev), Vitest (tests)
- **Directory structure:** `src/commands/`, `src/pipeline/`, `src/store/`, `src/profile/`, `src/llm/`, `src/history/`, `bin/`, `templates/`, `tests/integration/`
- **Barrel export pattern:** Each `src/` subdirectory exposes a single `index.ts` — cross-module imports from barrels only, never internal files
- **Display module enforcement:** All terminal output (spinners, prompts, colors, errors) routed through `src/display.ts` exclusively — no raw `console.log/error` permitted anywhere else
- **LLM abstraction:** Three-call pipeline (analyzeAlignment → generateGapQuestion per gap miss → generateResume); `LLMAdapter` interface in `src/llm/adapter.ts`; all prompts in `src/llm/prompts/`
- **Atomic writes:** `write-file-atomic` on every JSON data file write (answer store, run history)
- **Schema validation:** Zod for all JSON reads (config, answer store); version field in every schema with migration function
- **Immutable session:** `GenerationSession` type threaded through pipeline via spread (`{ ...session, field: value }`); never mutated in place
- **API key:** Stored as env var name only in config (`apiKeyEnvVar: "ANTHROPIC_API_KEY"`) — actual key never written to disk
- **Directory permissions:** `~/.resume-forge/` created with `0o700`
- **Distribution:** `npm install -g resume-forge` (post-MVP); dev via `npm link`
- **HTML templating:** Handlebars; `renderer.ts` compiles template + data → HTML string; theme injection via `<style>:root { --accent-color: ... }</style>`
- **Exit codes:** `0` success · `1` user abort/redirect · `2` system error

### UX Design Requirements

Requirements derived from the UX Design Specification that require explicit implementation:

- **UX-DR1:** Implement CSS custom property color system with 4 named themes (amber `#E8952A`, slate-blue `#3B5F8A`, forest `#2E6B47`, charcoal `#3D3D3D`); theme injected at generation time via prepended `<style>` block
- **UX-DR2:** Implement alignment report as a structured terminal block — horizontal rule header, progress bar (`████░░`), three categorical lines (✓ Aligned / ✦ Gaps / ✗ No match), and `[G/C/X]` menu
- **UX-DR3:** Implement gap prompting as sequential conversational prompts with visible counter (`Gap N of M — topic`) and inline alignment update after each round
- **UX-DR4:** Implement answer store confirmation flow: display stored answer preview, `[Enter] confirm · [E] edit · [S] skip` — Enter is the zero-friction path; E updates the store
- **UX-DR5:** Implement all CLI prefix/color conventions in `display.ts`: `✦` amber = prompts, `✓` green = success, `→` gray = status, `✗` red = errors, `⠋` gray = spinner (via `ora`); every `✗` followed by `→` recovery instruction
- **UX-DR6:** Implement HTML resume two-column layout using CSS grid — left 27% (contact, skills, anchors), right 73% (experience, summary, achievements); `--col-left` and `--col-right` as CSS variables
- **UX-DR7:** Implement resume header with geometric accent shape (top-left), 28px bold name, 13px gray subtitle; accent shape color driven by `--accent-color`
- **UX-DR8:** Implement section header with `+ SECTION NAME` pattern — `+` rendered in `--accent-color`, label in 11px bold uppercase
- **UX-DR9:** Implement experience entry component: Title | Company (11px bold) → Location | Date (10px italic) → description → bullet list; `page-break-inside: avoid` on each entry
- **UX-DR10:** Implement contact block: 14px icon square with accent background + white symbol + bold text; Phone, Email, LinkedIn items rendered identically
- **UX-DR11:** Implement skill and achievement lists with large filled circle bullets (`●`) at 6–7px matching text color
- **UX-DR12:** Implement compact mode — a `.compact` CSS class on the root element that overrides spacing tokens for content-dense resumes; applied via `--compact` flag
- **UX-DR13:** Implement `@media print` block: `@page { size: letter; margin: 0.75in; }`, `color-adjust: exact`, `width: 100%`; this is the only layout transition and must be correct
- **UX-DR14:** Implement Inter font (Google Fonts) with correct type scale: 28px name, 13px subtitle, 11px section/company/title, 10px body/dates/bullets, 9.5px proficiency items
- **UX-DR15:** Implement all empty/first-run state messages (no profile, LinkedIn not loaded, empty store, no prior run for `review`)
- **UX-DR16:** Implement HITL review interaction: `[O] Open in browser · [R] Request changes · [A] Approve & save`; O opens HTML without finalizing; R triggers regeneration loop; A writes file and exits

### FR Coverage Map

```
FR1:  Epic 1 — LinkedIn JSON load (profile module)
FR2:  Epic 1 — Base resume (PDF/DOCX) load
FR3:  Epic 1 — Parse + index experience, skills, education
FR4:  Epic 4 — Profile update preserves answer store
FR5:  Epic 2 — Interactive JD paste input
FR6:  Epic 2 — JD from --jd file flag
FR7:  Epic 3 — Role title as JD target
FR8:  Epic 2 — JD completeness confirmation gate
FR9:  Epic 2 — Alignment analysis (LLM call 1)
FR10: Epic 2 — Alignment percentage score
FR11: Epic 2 — Categorical breakdown (aligned/gap/no-match)
FR12: Epic 2 — Alignment report displayed before generation
FR13: Epic 3 — Multi-round context to improve alignment
FR14: Epic 3 — Identify specific experience gaps
FR15: Epic 3 — Generate targeted question per gap
FR16: Epic 3 — Unlimited context rounds, no forced exit
FR17: Epic 3 — Recalculate alignment after each round
FR18: Epic 3 — Unresolvable gap assessment
FR19: Epic 3 — Continue/generate/exit choice at poor-fit
FR20: Epic 3 — Persist answers to local store (topic-keyed)
FR21: Epic 4 — Retrieve stored answers, pre-fill prompts
FR22: Epic 4 — Display stored answer for confirmation
FR23: Epic 4 — Override stored answer during generation
FR24: Epic 4 — store list command
FR25: Epic 4 — store edit command
FR26: Epic 4 — store clear command
FR27: Epic 2 — LLM generates role-tailored content (call 3)
FR28: Epic 2 — Curate and prioritize experience by relevance
FR29: Epic 2 — Frame experience around role requirements
FR30: Epic 2 — Render content into HTML via Handlebars
FR31: Epic 2 — HITL review gate before finalization
FR32: Epic 2 — Request changes and receive revised draft
FR33: Epic 2 — Save HTML with role-slug_date filename
FR34: Epic 2 — resume-forge review opens HTML in browser
FR35: Epic 2 — HTML formatted for browser Print-to-PDF
FR36: Epic 1 — Guided init setup wizard
FR37: Epic 1 — Env-var API key reference (never to disk)
FR38: Epic 1 — Configurable LLM model selection
FR39: Epic 1 — Configurable output directory
FR40: Epic 1 — Idempotent init (preserves existing data)
FR41: Epic 4 — Append-only run history log
FR42: Epic 1 — View/update individual config settings
```

## Epic List

### Epic 1: Tool Foundation & Initialization
User can install Resume Forge, run `resume-forge init`, and have a fully configured working tool — profile loaded, template ready, API connected. Includes project scaffolding, HTML/CSS resume template, display module, config management, the init wizard, and the profile loading module.
**FRs covered:** FR1, FR2, FR3, FR36, FR37, FR38, FR39, FR40, FR42

### Epic 2: Core Generation Pipeline
User can paste a job description, see a clear alignment report, generate a role-tailored resume, review it via HITL, and save the final HTML file ready for browser Print-to-PDF. Depends on the profile module delivered in Epic 1.
**FRs covered:** FR5, FR6, FR8, FR9, FR10, FR11, FR12, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35

### Epic 3: Gap Discovery & Honest Fit Assessment
User can answer targeted gap questions across unlimited rounds, watch alignment improve in real time, and receive an honest fit assessment when gaps remain unresolvable — with a clean exit path at any point. Includes the answer store write capability needed by the gap loop.
**FRs covered:** FR7, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20

### Epic 4: Answer Store — Compounding Knowledge Base
User's stored gap answers pre-fill future prompts automatically, reducing prompting over time. User can list, edit, and clear stored entries. Run history is maintained for reference. Depends on the answer store write foundation delivered in Epic 3.
**FRs covered:** FR4, FR21, FR22, FR23, FR24, FR25, FR26, FR41

---

## Epic 1: Tool Foundation & Initialization

User can install Resume Forge, run `resume-forge init`, and have a fully configured working tool — profile loaded, template ready, API connected. Includes project scaffolding, HTML/CSS resume template, display module, config management, the init wizard, and the profile loading module.

### Story 1.1: Project Scaffolding & Build Toolchain

As a developer,
I want a complete TypeScript + commander.js project with build and test tooling configured,
So that I can develop, build, and run the Resume Forge CLI from source.

**Acceptance Criteria:**

**Given** a clean directory
**When** I run the initialization commands (`npm init`, install deps, configure tsup + vitest)
**Then** `npm run build` produces a working CLI entry in `bin/resume-forge.js`
**And** `npm test` runs the Vitest suite with zero failures on an empty test suite
**And** `npm run dev` executes TypeScript source directly via `tsx`
**And** `src/index.ts` registers commander.js with `--version` and `--help` working
**And** `src/errors.ts` defines `ResumeForgeError` with error code constants
**And** `src/types.ts` defines `GenerationSession`, `AlignmentResult`, `ResumeContent`, `GapEntry` as stub types
**And** all `src/` subdirectories (`commands/`, `pipeline/`, `store/`, `profile/`, `llm/`, `history/`) exist with stub `index.ts` barrel files
**And** `.gitignore` excludes `.env`, `node_modules/`, `bin/`, and local data dir references

---

### Story 1.2: HTML Resume Template

As Rainboldt,
I want a functional two-column HTML/CSS resume template matching my reference design,
So that every generated resume renders consistently in my visual style and prints cleanly as a PDF.

**Acceptance Criteria:**

**Given** `templates/default/resume.html` and `templates/default/styles.css` exist
**When** I open the template in Chrome or Edge with placeholder content
**Then** the layout renders as two columns — left ~27% (contact, skills), right ~73% (experience, summary)
**And** the header shows a geometric accent shape (top-left), bold name at 28px, italic subtitle at 13px
**And** section headers display as `+ SECTION NAME` with `+` in `--accent-color` (#E8952A amber default), label in 11px bold uppercase
**And** experience entries render: Title | Company (11px bold) → Location | Date (10px italic) → description → bullet list with `●` bullets
**And** contact block renders icon squares (14px accent background, white symbol) + bold text for Phone, Email, LinkedIn
**And** Inter font loads via Google Fonts with fallback chain `'Inter', 'Calibri', 'Segoe UI', system-ui, sans-serif`
**And** CSS custom properties define all tokens: `--accent-color`, `--accent-dark`, `--text-primary`, `--text-secondary`, `--col-left`, `--col-right`, `--page-margin`, and spacing scale (`--space-xs` through `--space-xl`)
**And** `@media print` block sets `@page { size: letter; margin: 0.75in; }` and `color-adjust: exact`
**And** `page-break-inside: avoid` is applied to each `.r-job` experience entry
**And** Handlebars syntax (`{{name}}`, `{{#each bullets}}`) is present at all dynamic content insertion points
**And** a `.compact` CSS class exists that overrides spacing tokens for content-dense resumes

---

### Story 1.3: CLI Display Module

As Rainboldt,
I want all terminal output to follow consistent color and prefix conventions through a single module,
So that prompts, status updates, and errors are instantly distinguishable at a glance across every command.

**Acceptance Criteria:**

**Given** `src/display.ts` is implemented
**When** any command needs to output to the terminal
**Then** `display.prompt(msg)` outputs `✦` in amber + message
**And** `display.success(msg)` outputs `✓` in green + message
**And** `display.status(msg)` outputs `→` in gray + message
**And** `display.error(msg, recovery)` outputs `✗` in red + message, then `→` gray recovery instruction on the next line
**And** `display.spinner(msg)` returns an `ora` spinner instance; `.succeed()` resolves to `✓`, `.fail()` resolves to `✗` on the same line
**And** when `NO_COLOR=1` is set, chalk color is suppressed and only symbol prefixes remain (still readable)
**And** all output lines are ≤78 characters
**And** no `console.log` or `console.error` calls exist outside `display.ts` in any source file
**And** empty/first-run state messages are implemented: no profile found, LinkedIn not loaded, empty answer store, no prior run for `review`

---

### Story 1.4: Configuration Module

As Rainboldt,
I want a typed, schema-validated configuration module that reads and writes `~/.resume-forge/config/settings.json`,
So that tool settings persist between sessions and are always in a valid, known state.

**Acceptance Criteria:**

**Given** `src/config.ts` is implemented with a `ConfigSchema` (zod v1)
**When** the config file does not exist
**Then** `readConfig()` returns the default config object (version: 1, model: "claude-sonnet-4-5", outputDir: "~/resume-forge-output", templatePath: "~/.resume-forge/templates/default/resume.html", theme: "amber")
**And** `~/.resume-forge/` is created with `0o700` permissions if it does not exist

**Given** a valid `settings.json` exists
**When** `readConfig()` is called
**Then** the config is parsed and validated against `ConfigSchema`; a `ResumeForgeError` is thrown on schema violation

**Given** `writeConfig(config)` is called
**When** the write completes
**Then** the file is written atomically via `write-file-atomic`
**And** `apiKeyEnvVar` stores only the env var name (e.g., `"ANTHROPIC_API_KEY"`) — the actual key value is never written to disk
**And** `ConfigSchema` carries a `version` field with a migration function exported alongside it

---

### Story 1.5: Init Wizard (`resume-forge init`)

As Rainboldt,
I want to run `resume-forge init` and be guided through a 4-step setup wizard,
So that the tool is fully configured and ready to generate resumes after a single session.

**Acceptance Criteria:**

**Given** I run `resume-forge init` for the first time
**When** the wizard starts
**Then** Step 1/4 prompts for the LinkedIn JSON export path; on success displays `✓ Profile loaded — N entries indexed`
**And** Step 2/4 prompts for the base resume file path (PDF or DOCX); on success displays `✓ Resume stored as visual reference`
**And** Step 3/4 prompts to set the env var and press Enter; validates the API key with a live Anthropic ping; displays `✓ API connection verified` or `✗ [error] → [recovery]` on failure with retry
**And** Step 4/4 prompts for output directory with default `~/resume-forge-output/` shown in brackets; Enter accepts default
**And** on completion displays `✓ Ready — run resume-forge generate`
**And** the HTML/CSS template is copied from `templates/default/` to `~/.resume-forge/templates/default/`

**Given** I run `resume-forge init` when `~/.resume-forge/` already exists
**When** the wizard completes
**Then** existing `answer-store.json` and `run-history.jsonl` are preserved (not overwritten)
**And** the wizard shows `→ Updating config · Answer store preserved` before starting

**Given** LinkedIn JSON parsing fails
**When** Step 1/4 reports an error
**Then** `✗ Could not parse LinkedIn export. → Check the file is the JSON export from linkedin.com/settings` is displayed with a retry option

---

### Story 1.6: Config Command (`resume-forge config`)

As Rainboldt,
I want to view and update individual config settings via `resume-forge config`,
So that I can adjust model, output directory, or theme without re-running the full init wizard.

**Acceptance Criteria:**

**Given** I run `resume-forge config --show`
**When** the command executes
**Then** all current config values are displayed — the actual API key value is never shown, only the env var name

**Given** I run `resume-forge config --set model claude-opus-4-8`
**When** the command executes
**Then** the `model` field is updated in `settings.json` and `✓ model updated to claude-opus-4-8` is displayed

**Given** I run `resume-forge config --set apiKeyEnvVar MY_API_KEY`
**When** the command executes
**Then** `apiKeyEnvVar` stores the string `"MY_API_KEY"` — not a key value

**Given** I run `resume-forge config --set outputDir ~/custom/path`
**When** the command executes
**Then** the directory is created if it does not exist and `outputDir` is updated

**Given** I run `resume-forge config` with an unrecognized `--set` key
**When** the command executes
**Then** `✗ Unknown config key: [key] → Valid keys: model, outputDir, templatePath, theme, apiKeyEnvVar` is displayed

---

### Story 1.7: Profile Loading & Experience Indexing

As Rainboldt,
I want to load my LinkedIn JSON export and base resume file so the tool has my complete professional experience to work from,
So that every generated resume draws only from real, verified facts about my background.

**Acceptance Criteria:**

**Given** a valid LinkedIn JSON export file path is provided
**When** `profile.load(linkedinPath)` is called
**Then** professional experience entries (title, company, dates, description), skills, and education are extracted and returned as a typed `ExperiencePool` object
**And** the parsed profile is stored at `~/.resume-forge/profile/linkedin-export.json`
**And** a `✓ Profile loaded — N entries indexed` message is displayed via `display.success()`

**Given** a PDF or DOCX base resume file path is provided
**When** `profile.loadBaseResume(filePath)` is called
**Then** `pdf-parse` is used for `.pdf` files and `mammoth` is used for `.docx` files
**And** the file is stored at `~/.resume-forge/profile/base-resume.{ext}`
**And** a `✓ Resume stored as visual reference` message is displayed

**Given** the LinkedIn JSON format cannot be parsed
**When** `profile.load()` encounters a parse error
**Then** a `ResumeForgeError` is thrown with a clear message (never a raw stack trace)
**And** `display.error()` shows `✗ Could not parse LinkedIn export. → Check the file is the JSON export from linkedin.com/settings`

**Given** `profile.getExperiencePool()` is called
**When** no profile has been loaded
**Then** `display.error()` shows `✗ No profile found. → Run resume-forge init first` and exits with code 2

---

## Epic 2: Core Generation Pipeline

User can paste a job description, see a clear alignment report, generate a role-tailored resume, review it via HITL, and save the final HTML file ready for browser Print-to-PDF. Depends on the profile module delivered in Epic 1.

### Story 2.1: Job Description Capture

As Rainboldt,
I want to provide a job description either by pasting it interactively or pointing to a saved file,
So that the tool always works from a complete, confirmed JD before any analysis begins.

**Acceptance Criteria:**

**Given** I run `resume-forge generate` with no flags
**When** the JD capture prompt appears
**Then** `✦ Paste job description below. Press Enter twice when done.` is displayed
**And** the tool captures multi-line text until two consecutive empty newlines
**And** after capture: `→ Captured N words. Does this look complete? [Y/n]` is displayed
**And** pressing `Y` or Enter proceeds; pressing `N` returns to the paste prompt

**Given** I run `resume-forge generate --jd senior-engineer-acme.txt`
**When** the file is read
**Then** the JD text is loaded from the file (supports `.txt` and `.html`)
**And** the same completeness confirmation prompt is shown before proceeding
**And** a `ResumeForgeError` is thrown if the file does not exist, with `✗ File not found: [path] → Check the path and try again`

**Given** the JD capture is confirmed
**When** the `GenerationSession` is created
**Then** `session.jdText` contains the confirmed JD text and `session.jdConfirmed` is `true`
**And** the session object is immutable — subsequent pipeline stages spread rather than mutate it

---

### Story 2.2: LLM Adapter Layer

As a developer,
I want a thin LLM abstraction layer with retry, timeout, and error handling built in,
So that the alignment, gap, and generation calls all work reliably and I can swap models without touching business logic.

**Acceptance Criteria:**

**Given** `src/llm/adapter.ts` defines the `LLMAdapter` interface
**When** implemented
**Then** the interface declares three methods: `analyzeAlignment(jdText, pool)`, `generateGapQuestion(gapKey, description, pool)`, `generateResume(analysis, pool, answers)`
**And** `src/llm/anthropic.ts` implements `LLMAdapter` as `AnthropicAdapter`

**Given** `AnthropicAdapter` is constructed with a config object
**When** the `model` field in config is changed
**Then** the adapter uses the configured model with zero code changes

**Given** an Anthropic API call returns a rate limit error (429)
**When** `AnthropicAdapter` catches it
**Then** `display.error()` shows `✗ Rate limit reached. → Wait a moment and try again` and exits with code 2

**Given** an Anthropic API call times out or the network is unavailable
**When** `AnthropicAdapter` catches it
**Then** `display.error()` shows `✗ API unavailable. → Check your connection and retry` with no in-progress state corrupted

**Given** `src/llm/prompts/` contains `alignment.ts`, `gap-question.ts`, and `resume.ts`
**When** any LLM call is made
**Then** the prompt string is imported from the prompts module — no inline template strings exist in `anthropic.ts` or any business logic file

---

### Story 2.3: Alignment Analysis & Report

As Rainboldt,
I want to see a clear alignment report — percentage score, categorized skills, and a proceed/add-context/exit menu — before committing to generation,
So that I understand exactly where I stand against a role before investing time in a resume.

**Acceptance Criteria:**

**Given** a confirmed JD and a loaded experience pool
**When** `pipeline/alignment.ts` calls `llm.analyzeAlignment(jdText, pool)`
**Then** a spinner `⠋ Analyzing alignment with your experience profile...` is shown during the API call
**And** the spinner resolves to `✓` on success or `✗` on failure
**And** the response populates `AlignmentResult` with `{ score: number, aligned: string[], gaps: string[], noMatch: string[], gapKeys: string[] }`

**Given** `AlignmentResult` is returned
**When** the alignment report is displayed
**Then** the terminal block renders correctly — horizontal rule header, `████░░` progress bar + percentage, three categorical lines (`✓ Aligned`, `✦ Gaps`, `✗ No match`), and `[G] Generate  [C] Add context  [X] Exit` menu
**And** the report appears within 15 seconds of JD submission under normal API conditions

**Given** the alignment report is displayed
**When** I press `G`
**Then** the session proceeds to resume generation

**Given** the alignment report is displayed
**When** I press `X`
**Then** the process exits with code 1 (user abort)

**Given** alignment is ≥80% with no gaps
**When** the report is displayed
**Then** `✗ No match` and `✦ Gaps` lines both show `(none)`
**And** pressing `G` immediately proceeds to generation with no gap prompting

---

### Story 2.4: Resume Content Generation

As Rainboldt,
I want the tool to generate role-tailored resume content from my experience pool, JD analysis, and any provided answers,
So that the output reflects my strongest relevant experience framed around this specific role's requirements.

**Acceptance Criteria:**

**Given** a complete `GenerationSession` with `alignment`, `resolvedGaps`, and confirmed JD
**When** `pipeline/generator.ts` calls `llm.generateResume(alignment, pool, resolvedGaps)`
**Then** a spinner `⠋ Generating resume for [role title], [company]...` is shown during the API call
**And** the response populates a `ResumeContent` object with typed sections (summary, experience entries, skills, education)
**And** experience entries are ordered by relevance to the role — most aligned roles/projects first
**And** bullet points frame accomplishments around the target role's requirements

**Given** `llm.generateResume()` is called with the same pool + JD + answers across two independent runs
**When** both responses are received
**Then** both outputs are at equivalent quality level — same sections covered, same relevance ordering

**Given** the Anthropic API call fails during generation
**When** the error is caught
**Then** `display.error()` shows `✗ Generation failed. → [specific reason] Check your API key or retry` and the in-progress session state is not corrupted

---

### Story 2.5: HTML Rendering & Theme Injection

As Rainboldt,
I want the generated resume content compiled into my HTML template with the correct theme applied,
So that the output file is visually identical to my reference design and ready to print.

**Acceptance Criteria:**

**Given** a `ResumeContent` object and a loaded Handlebars template
**When** `pipeline/renderer.ts` compiles template + data
**Then** the output is a valid HTML string with all `{{placeholders}}` replaced by generated content
**And** missing optional sections are omitted entirely — no empty headers or `N/A` text
**And** experience entries are rendered in the order provided by `ResumeContent`

**Given** config `theme` is `"amber"` (default)
**When** the renderer produces the HTML string
**Then** no additional `<style>` injection is needed — the template's default `--accent-color: #E8952A` applies

**Given** config `theme` is `"slate-blue"`
**When** the renderer produces the HTML string
**Then** `<style>:root { --accent-color: #3B5F8A; --accent-dark: #2C4A6E; }</style>` is prepended to the output

**Given** `--compact` flag is passed to `resume-forge generate`
**When** the renderer produces the HTML string
**Then** `class="compact"` is added to the root `.resume` element

**Given** identical `ResumeContent` and template inputs across two calls
**When** `renderer.ts` compiles both
**Then** the output HTML strings are identical

---

### Story 2.6: HITL Review & File Output

As Rainboldt,
I want to review the generated HTML draft in my browser before approving, request changes if needed, and save the final file with a predictable filename,
So that I have full control over every resume that leaves this tool.

**Acceptance Criteria:**

**Given** `ResumeContent` has been rendered to an HTML string
**When** the HITL review prompt appears
**Then** `✓ Draft ready.` is displayed followed by `[O] Open in browser  [R] Request changes  [A] Approve & save`

**Given** I press `O` at the HITL prompt
**When** the command executes
**Then** the HTML is written to a temp path and opened in the system default browser
**And** the `[O/R/A]` menu is redisplayed — pressing O again reopens without finalizing

**Given** I press `R` at the HITL prompt
**When** I describe the requested change in free text
**Then** a spinner `⠋ Revising...` appears during the LLM re-generation call
**And** the revised `ResumeContent` is re-rendered and the `[O/R/A]` menu is redisplayed

**Given** I press `A` at the HITL prompt
**When** the file is saved
**Then** the HTML is written atomically to `{outputDir}/{role-slug}_{YYYY-MM-DD}.html`
**And** `✓ Resume saved → {full path}` is displayed
**And** `→ Run resume-forge review to reopen at any time.` is displayed as the next step hint

**Given** I run `resume-forge review`
**When** the command executes
**Then** the most recently saved HTML file path is read from run history and opened in the default browser
**And** if no prior run exists: `✗ No generated resume found. → Run resume-forge generate first`

**Given** the saved HTML file is opened in Chrome or Edge and printed to PDF
**When** the Print dialog is used
**Then** the PDF matches the two-column layout, correct font sizing, and accent color — no reformatting required

---

## Epic 3: Gap Discovery & Honest Fit Assessment

User can answer targeted gap questions across unlimited rounds, watch alignment improve in real time, and receive an honest fit assessment when gaps are unresolvable — with a clean exit path at any point. Includes the answer store write capability needed by the gap loop.

### Story 3.1: Answer Store Persistence

As Rainboldt,
I want every gap answer I provide to be saved automatically to a local store keyed by topic,
So that the tool builds a growing record of my professional knowledge without any extra effort on my part.

**Acceptance Criteria:**

**Given** I answer a gap question during `resume-forge generate`
**When** the answer is submitted
**Then** `store.write(topicKey, { question, answer, createdAt, usageCount: 1 })` is called
**And** the write is performed atomically via `write-file-atomic` — a process crash during write must not corrupt existing entries
**And** `~/.resume-forge/data/answer-store.json` is created if it does not exist
**And** `→ Answer saved to store (topic: [key])` is displayed via `display.status()`

**Given** `answer-store.json` is read on any operation
**When** `store.read()` is called
**Then** the file is parsed and validated against `AnswerStoreSchema` (zod v1)
**And** if the file is absent, an empty store `{ version: 1, entries: {} }` is returned — no error
**And** if the schema version is mismatched, a documented migration function is applied before use

**Given** a topic key is generated by the LLM
**When** `store/matcher.ts` normalizes it
**Then** the key matches `/^[a-z][a-z0-9-]*$/` — lowercase kebab-case only (e.g., `container-orchestration`)

**Given** `store.write()` completes
**When** measured
**Then** the write completes in under 500ms

---

### Story 3.2: Gap Identification & Question Generation

As Rainboldt,
I want the tool to identify each experience gap from my alignment results and generate a specific, human-phrased question for it,
So that I'm prompted only about things that actually matter to this role — not generic questions.

**Acceptance Criteria:**

**Given** an `AlignmentResult` with one or more `gaps[]` entries
**When** `pipeline/gap-loop.ts` begins the gap prompting sequence
**Then** each gap in `gaps[]` is processed one at a time — never as a list
**And** for each gap, `llm.generateGapQuestion(gapKey, description, pool)` is called (LLM call 2)
**And** the generated question is human-phrased (e.g., "Tell me about your experience with Kubernetes orchestration")
**And** the prompt displays as: `✦ Gap N of M — [topic]` on line one, a blank line, the question text, then `>` on a new line for input

**Given** the gap prompting sequence starts
**When** I press `C` at the alignment report
**Then** the gap loop begins with `Gap 1 of N` regardless of current alignment score

---

### Story 3.3: Multi-Round Context Collection

As Rainboldt,
I want to answer gap questions across as many rounds as I need without the tool ever forcing me to stop,
So that I can surface experience I have but haven't yet articulated — on my own timeline.

**Acceptance Criteria:**

**Given** a gap question is displayed with a `>` input prompt
**When** I type my answer and press Enter
**Then** the answer is accepted with no minimum or maximum length constraint
**And** `→ Answer saved to store (topic: [key])` is displayed after each new answer
**And** the session proceeds to the next gap in sequence

**Given** all gaps in the current round have been answered
**When** the last gap answer is submitted
**Then** the updated alignment report is displayed inline: `→ Alignment updated: [old]% → [new]%`
**And** the `[G] Generate  [C] Add context  [X] Exit` menu is redisplayed with the new score

**Given** I press `C` again at the updated alignment menu
**When** a new context round begins
**Then** only gaps that remain unresolved are re-prompted — already-answered gaps are skipped
**And** the `Gap N of M` counter reflects the remaining unresolved count, not the original total

**Given** I have answered gaps across multiple rounds and press `G`
**When** generation begins
**Then** all answers from all rounds are included in `session.resolvedGaps` passed to `llm.generateResume()`
**And** the full generation cycle completes within 10 minutes when I respond promptly

---

### Story 3.4: Alignment Recalculation After Context

As Rainboldt,
I want to see my alignment score update after each round of answers,
So that I can watch the gap close in real time and make an informed decision about whether to generate or keep adding context.

**Acceptance Criteria:**

**Given** I have submitted answers for one or more gaps
**When** the round completes
**Then** `llm.analyzeAlignment()` is called again with the original JD + experience pool + all provided answers
**And** the updated score is displayed as `→ Alignment updated: 61% → 76%`
**And** the updated alignment report block is re-rendered with the new score, updated `✓ Aligned` list, and remaining `✦ Gaps`

**Given** the recalculated alignment is ≥80%
**When** the updated report is displayed
**Then** the `[G] Generate  [C] Add context  [X] Exit` menu is presented
**And** pressing `G` proceeds directly to generation with no further prompting

**Given** the recalculated score is lower than or equal to the previous score
**When** the updated report is displayed
**Then** the new score is shown honestly without softening
**And** the same `[G/C/X]` menu is presented — the user always controls whether to proceed

---

### Story 3.5: Honest Fit Assessment & Graceful Exit

As Rainboldt,
I want the tool to surface a clear fit assessment when my remaining gaps are unresolvable,
So that I can make an informed decision to redirect rather than waste an application on a role that isn't right.

**Acceptance Criteria:**

**Given** the alignment report shows one or more `noMatch[]` gaps (unresolvable)
**When** the assessment is displayed
**Then** a below-report message reads: `→ Core requirements [A], [B] remain unaddressed. This role may not be the right target.`
**And** the menu expands to: `[G] Generate anyway  [C] Add more context  [X] Exit`
**And** the framing is "here's what's missing" — never a hard stop or failure message

**Given** I press `X` at the poor-fit assessment
**When** the process exits
**Then** the process exits cleanly with code 1 (user abort — not a system error)
**And** no resume file is written and no run history entry is appended

**Given** I press `G` at the poor-fit assessment
**When** generation proceeds
**Then** the resume is generated with all available answers
**And** `→ Generating with available context — some gaps remain unaddressed` is shown before the spinner

**Given** I press `C` at the poor-fit assessment
**When** a new context round begins
**Then** only the `noMatch[]` gaps are re-prompted, giving another opportunity to provide supporting context

---

### Story 3.6: Role Title as Generation Target

As Rainboldt,
I want to provide a plain-text role title instead of a full job description,
So that I can generate a targeted resume quickly without needing a specific job posting.

**Acceptance Criteria:**

**Given** I run `resume-forge generate` and choose to enter a role title
**When** I type a role title (e.g., "Senior Software Engineer") and confirm
**Then** `→ Using role title as target: "Senior Software Engineer"` is displayed before analysis begins
**And** the alignment report and gap loop behave identically to the full JD path

**Given** a role title is entered
**When** the confirmation step runs
**Then** `→ Captured role title: "[title]". Does this look complete? [Y/n]` is displayed before analysis proceeds

**Given** no experience pool is loaded
**When** `resume-forge generate` is invoked with a role title
**Then** `✗ No profile found. → Run resume-forge init first` is displayed and exits with code 2

---

## Epic 4: Answer Store — Compounding Knowledge Base

User's stored gap answers pre-fill future prompts automatically, reducing prompting over time. User can list, edit, and clear stored entries. Run history is maintained for reference. Depends on the answer store write foundation delivered in Epic 3.

### Story 4.1: Answer Store Pre-fill on Return Runs

As Rainboldt,
I want the tool to automatically match stored answers to new gap prompts and show them to me for confirmation,
So that questions I've already answered don't require re-typing — I just press Enter.

**Acceptance Criteria:**

**Given** the gap loop encounters a gap with a matching topic key in the answer store
**When** the gap is processed
**Then** the stored answer is displayed in the confirmation format:
  `→ Using stored answer for '[topic]'`
  `   "[first ~80 chars of stored answer]..."`
  `   [Enter] confirm · [E] edit · [S] skip`

**Given** I press Enter at the store confirmation
**When** the answer is applied
**Then** `session.resolvedGaps[topicKey]` is set to the stored answer
**And** `entry.usageCount` is incremented and `entry.lastUsed` is updated in the store
**And** `✓ Stored answer applied` is displayed

**Given** I press `E` at the store confirmation
**When** I type a new answer and submit
**Then** the store entry is updated with the new answer text, updated `lastUsed`, and incremented `usageCount`
**And** `✓ Answer updated` is displayed
**And** the session uses the new answer for generation

**Given** I press `S` at the store confirmation
**When** the skip is processed
**Then** the gap is left unresolved in `session.resolvedGaps`
**And** the gap contributes to the unresolved count in alignment recalculation
**And** the store entry is not modified

**Given** a gap topic key has no match in the store
**When** the gap is processed
**Then** `llm.generateGapQuestion()` is called and the question is presented as a new free-text prompt

---

### Story 4.2: Answer Store Management (`resume-forge store`)

As Rainboldt,
I want to list, edit, and clear my stored answers via the `resume-forge store` command,
So that I can keep my knowledge base accurate and remove stale or incorrect entries.

**Acceptance Criteria:**

**Given** I run `resume-forge store list`
**When** the command executes
**Then** all stored entries are displayed: topic key, first ~60 chars of answer, usage count, and last used date
**And** entries are sorted by `lastUsed` descending (most recently used first)
**And** if the store is empty: `→ Answer store is empty. Answers save automatically during resume-forge generate.`

**Given** I run `resume-forge store edit --topic container-orchestration`
**When** the editor prompt opens
**Then** the current answer text is displayed above the `>` input
**And** I can type a replacement answer and submit
**And** the entry is updated atomically and `✓ Entry updated: container-orchestration` is displayed

**Given** I run `resume-forge store clear --topic container-orchestration`
**When** the command executes
**Then** only the matching entry is removed atomically and `✓ Cleared: container-orchestration` is displayed

**Given** I run `resume-forge store clear` with no `--topic` flag
**When** the command executes
**Then** `✦ Clear entire answer store? This cannot be undone. [y/N]` is displayed (capital N = default no)
**And** pressing `y` clears all entries atomically and displays `✓ Answer store cleared`
**And** pressing Enter or `N` cancels with `→ Cancelled`

**Given** I run `resume-forge store edit` with a topic key that does not exist
**When** the command executes
**Then** `✗ No entry found for topic: [key] → Run resume-forge store list to see all stored topics` is displayed

---

### Story 4.3: Profile Update Without Data Loss

As Rainboldt,
I want to re-run `resume-forge init` to update my LinkedIn profile or base resume without losing my answer store,
So that I can refresh my experience pool as my career evolves without starting over.

**Acceptance Criteria:**

**Given** `~/.resume-forge/data/answer-store.json` exists with entries
**When** I run `resume-forge init` again
**Then** `→ Updating config · Answer store preserved` is displayed before the wizard starts
**And** `answer-store.json` is not modified, overwritten, or deleted during the init run
**And** `run-history.jsonl` is also preserved

**Given** I update my LinkedIn JSON export in Step 1/4 of the re-run wizard
**When** the new profile is parsed and stored
**Then** the previous `linkedin-export.json` is replaced with the new file
**And** existing answer store entries remain valid and accessible on the next `resume-forge generate` run

**Given** I run `resume-forge init` and skip a step
**When** the wizard completes
**Then** the skipped item retains its previous value from config
**And** no data files are affected by the skipped step

---

### Story 4.4: Run History Log

As Rainboldt,
I want each completed resume generation logged automatically with role, date, alignment score, and output path,
So that I have a reliable record of every application I've prepared without any manual tracking.

**Acceptance Criteria:**

**Given** I press `A` at the HITL review to approve and save a resume
**When** the file is written
**Then** a JSON line is appended to `~/.resume-forge/data/run-history.jsonl` with: `{ role, company, date, alignmentScore, outputPath, timestamp }`
**And** the append is performed atomically via `write-file-atomic`
**And** existing entries in `run-history.jsonl` are never modified or deleted — the file is append-only

**Given** a generation run is aborted (user presses `X` at alignment or fit assessment)
**When** the process exits with code 1
**Then** no entry is appended to `run-history.jsonl`

**Given** `resume-forge review` is run
**When** the command reads run history
**Then** the most recent `outputPath` from `run-history.jsonl` is used to open the file in the default browser
**And** if `run-history.jsonl` does not exist or is empty: `✗ No generated resume found. → Run resume-forge generate first`

**Given** a process crash occurs while appending to `run-history.jsonl`
**When** the file is next read
**Then** all previously completed entries remain intact — the atomic write prevents partial-line corruption

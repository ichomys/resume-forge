---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
documentsIncluded:
  prd: "D:/CClaude/resume-forge/project Outline/prd-resume-forge.md"
  architecture: "D:/CClaude/resume-forge/project Outline/architecture-resume-forge.md"
  epics: "D:/CClaude/resume-forge/project Outline/epics-resume-forge.md"
  ux: "D:/CClaude/resume-forge/project Outline/ux-design-specification-resume-forge.md"
---

# Implementation Readiness Assessment Report

**Date:** 2026-05-29
**Project:** resume-forge

---

## Document Inventory

| Type | File | Size | Last Modified |
|------|------|------|---------------|
| PRD | `project Outline/prd-resume-forge.md` | 24KB | 2026-05-28 6:51 PM |
| Architecture | `project Outline/architecture-resume-forge.md` | 29KB | 2026-05-28 11:11 PM |
| Epics & Stories | `project Outline/epics-resume-forge.md` | 49KB | 2026-05-29 8:14 AM |
| UX Design | `project Outline/ux-design-specification-resume-forge.md` | 39KB | 2026-05-28 9:55 PM |

**Supplementary:** `project Outline/ux-design-directions-resume-forge.html` (17KB, 2026-05-28 9:45 PM)

---

## PRD Analysis

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

**Total FRs: 42**

---

### Non-Functional Requirements

**Performance**
- NFR1: Alignment report displays within 15 seconds of JD submission under normal API conditions
- NFR2: Full generation cycle for a high-overlap role completes in under 60 seconds
- NFR3: Full generation cycle including gap prompting completes within 10 minutes when user responds promptly
- NFR4: All non-LLM operations (answer store read/write, file save, config load) complete in under 500ms

**Security**
- NFR5: API key is stored only as an environment variable reference — never written to config files, log files, or terminal output
- NFR6: LinkedIn profile data and resume files are stored only in `~/.resume-forge/` — no network transmission of personal data
- NFR7: The local config directory is created with user-only read/write permissions
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

**Total NFRs: 19**

---

### Additional Requirements & Constraints

- **Phasing:** MVP covers Journeys 1–3 (Clean Match, Stretch Role, Honest Redirect); Phase 2 adds cover letters, multiple templates, application tracking; Phase 3 adds pattern recognition and DOCX export
- **Out of MVP scope:** Cover letter generation, multiple templates, application tracking log, shell completion, web scraping or URL fetching
- **CLI commands:** `init`, `generate [--jd <file>]`, `store [list|edit|clear]`, `review`, `config [--show|--set]`
- **LLM:** Claude Sonnet via Anthropic API; model switchable via config; cost ~$0.05–0.15/run
- **Data locality:** All data in `~/.resume-forge/` — no cloud sync, no telemetry
- **Exit codes:** 0 success, 1 user abort/redirect, 2 error

### PRD Completeness Assessment

The PRD is thorough and well-structured. Requirements are clearly numbered, categorized, and traceable to user journeys. Phasing is explicit. The only minor observation: FR7 (role title as target in place of full JD) is listed but not featured in any of the four user journeys — its handling in the alignment pipeline is not described. This warrants validation in epic coverage.

---

## Epic Coverage Validation

### Coverage Matrix

| FR | Requirement (short) | Epic | Story | Status |
|----|---------------------|------|-------|--------|
| FR1 | Load LinkedIn JSON export | Epic 2 | Story 2.1 | ✓ Covered |
| FR2 | Load base resume (PDF/DOCX) | Epic 2 | Story 2.1 | ✓ Covered |
| FR3 | Parse + index experience/skills/education | Epic 2 | Story 2.1 | ✓ Covered |
| FR4 | Update profile without losing answer store | Epic 4 | Story 4.4 | ✓ Covered |
| FR5 | JD via interactive copy-paste | Epic 2 | Story 2.2 | ✓ Covered |
| FR6 | JD via `--jd` file flag | Epic 2 | Story 2.2 | ✓ Covered |
| FR7 | Role title as generation target | Epic 3 | Story 3.5 | ✓ Covered |
| FR8 | JD completeness confirmation gate | Epic 2 | Story 2.2 | ✓ Covered |
| FR9 | Alignment analysis (LLM call 1) | Epic 2 | Story 2.4 | ✓ Covered |
| FR10 | Alignment score as percentage | Epic 2 | Story 2.4 | ✓ Covered |
| FR11 | Categorical breakdown (aligned/gap/no-match) | Epic 2 | Story 2.4 | ✓ Covered |
| FR12 | Alignment report shown before commit | Epic 2 | Story 2.4 | ✓ Covered |
| FR13 | Multi-round context to improve alignment | Epic 3 | Story 3.2 | ✓ Covered |
| FR14 | Identify specific experience gaps | Epic 3 | Story 3.1 | ✓ Covered |
| FR15 | Generate targeted question per gap | Epic 3 | Story 3.1 | ✓ Covered |
| FR16 | Unlimited context rounds, no forced exit | Epic 3 | Story 3.2 | ✓ Covered |
| FR17 | Recalculate alignment after each round | Epic 3 | Story 3.3 | ✓ Covered |
| FR18 | Unresolvable gap / fit assessment surface | Epic 3 | Story 3.4 | ✓ Covered |
| FR19 | Continue / generate / exit choice at poor-fit | Epic 3 | Story 3.4 | ✓ Covered |
| FR20 | Persist gap answers (topic-keyed) | Epic 4 | Story 4.1 | ✓ Covered |
| FR21 | Retrieve + pre-fill stored answers | Epic 4 | Story 4.2 | ✓ Covered |
| FR22 | Display stored answer for confirmation | Epic 4 | Story 4.2 | ✓ Covered |
| FR23 | Override stored answer during generation | Epic 4 | Story 4.2 | ✓ Covered |
| FR24 | `store list` command | Epic 4 | Story 4.3 | ✓ Covered |
| FR25 | `store edit` command | Epic 4 | Story 4.3 | ✓ Covered |
| FR26 | `store clear` command | Epic 4 | Story 4.3 | ✓ Covered |
| FR27 | Generate role-tailored resume content | Epic 2 | Story 2.5 | ✓ Covered |
| FR28 | Curate + prioritize experience by relevance | Epic 2 | Story 2.5 | ✓ Covered |
| FR29 | Frame experience around role requirements | Epic 2 | Story 2.5 | ✓ Covered |
| FR30 | Render content into HTML via template | Epic 2 | Story 2.6 | ✓ Covered |
| FR31 | HITL review gate before finalization | Epic 2 | Story 2.7 | ✓ Covered |
| FR32 | Request changes + receive revised draft | Epic 2 | Story 2.7 | ⚠️ Partial — see below |
| FR33 | Save HTML with role-slug_date filename | Epic 2 | Story 2.7 | ✓ Covered |
| FR34 | `review` opens HTML in browser | Epic 2 | Story 2.7 | ✓ Covered |
| FR35 | HTML formatted for browser Print-to-PDF | Epic 1 / Epic 2 | Story 1.2 + Story 2.6 | ✓ Covered |
| FR36 | Guided init setup wizard | Epic 1 | Story 1.5 | ✓ Covered |
| FR37 | Env-var API key reference (never to disk) | Epic 1 | Story 1.4 + 1.5 | ✓ Covered |
| FR38 | Configurable LLM model selection | Epic 1 | Story 1.4 + 2.3 | ✓ Covered |
| FR39 | Configurable output directory | Epic 1 | Story 1.5 | ✓ Covered |
| FR40 | Idempotent init (preserves data) | Epic 1 | Story 1.5 + 4.4 | ✓ Covered |
| FR41 | Append-only run history log | Epic 4 | Story 4.5 | ✓ Covered |
| FR42 | View/update individual config settings | Epic 1 | Story 1.6 | ✓ Covered |

### Missing or Partial Requirements

#### ⚠️ FR32 — Revision Mechanism Underspecified

**Requirement:** User can request changes to the generated draft and receive a revised version.

Story 2.7 correctly describes the UX (press `R`, describe change in free text, spinner, revised output shown). However, **Story 2.3 (LLM Adapter)** defines only three methods: `analyzeAlignment`, `generateGapQuestion`, `generateResume`. None is a `reviseResume()` or equivalent call. The revision path (passing change description to the LLM) is not specified in the adapter interface.

**Impact:** Implementer has no contract for how the revision request text is passed to the LLM. They may reasonably re-call `generateResume()` with the change appended to `resolvedGaps`, but this is implicit and could produce inconsistent behavior.

**Recommendation:** Add a `reviseResume(content, changeRequest, pool)` method (or equivalent parameter extension) to the `LLMAdapter` interface definition in Story 2.3, and add a prompt file `src/llm/prompts/revision.ts` to the list in that story.

---

#### ⚠️ File Format Inconsistency — `run-history.json` vs `run-history.jsonl`

**PRD Config Schema:** specifies `data/run-history.json`
**Story 4.5:** uses `run-history.jsonl` throughout (append semantics, JSON Lines format)

The JSONL choice is technically sound (append-only log is idiomatic in JSONL), and NFR15 (append-only) is correctly implemented by it. However, the PRD and the stories conflict on filename and format. Any developer reading the PRD config schema and Story 4.5 side-by-side will encounter confusion.

**Recommendation:** Update the PRD config schema section (or confirm in Story 4.5's notes) that `run-history.jsonl` is the correct format, and amend Story 1.1's file structure to reflect `.jsonl`.

---

#### ℹ️ FR7 Placement — Role Title in Epic 3, Not Epic 2

**Observation (not a gap):** FR7 (role title as JD substitute) is placed in Epic 3 (Story 3.5) rather than Epic 2 with the other input methods (FR5, FR6). A developer completing Epic 2 will have a generation pipeline that cannot accept a role title; this becomes available only after Epic 3.

The PRD lists FR7 under "Job Description Processing" alongside FR5 and FR6, suggesting it belongs in Epic 2. Placing it in Epic 3 is defensible (it depends on the gap loop infrastructure) but creates an incomplete Epic 2 experience.

**Recommendation:** Confirm intentional placement. If role-title input is MVP-critical alongside the other JD modes, consider moving Story 3.5 to Epic 2 (or making it the first story of Epic 3 with an explicit note it must be demoed with Epic 2). No story rewrite required — just a sequencing decision.

---

### Coverage Statistics

- **Total PRD FRs:** 42
- **FRs fully covered in epics:** 41
- **FRs partially covered:** 1 (FR32 — revision mechanism UX defined, adapter interface incomplete)
- **FRs missing:** 0
- **Coverage percentage:** 97.6% (100% at story level; 1 adapter gap flagged)
- **Total NFRs:** 19 — all 19 are addressed within story acceptance criteria; no standalone NFR stories required given the scope

---

## UX Alignment Assessment

### UX Document Status

**Found** — `project Outline/ux-design-specification-resume-forge.md` (39KB, 2026-05-28). Comprehensive: covers two UX surfaces (CLI interaction layer + HTML resume output), design system, component strategy, user journey flows, emotional design, accessibility, and explicit UX Design Requirements (UX-DR1 through UX-DR16) that are formally imported into the epics document.

---

### UX ↔ PRD Alignment

| UX-DR | What It Specifies | PRD Basis | Status |
|-------|-------------------|-----------|--------|
| UX-DR1 | 4 named CSS color themes (amber, slate-blue, forest, charcoal) | Implied by FR30, FR38 | ✓ Aligned |
| UX-DR2 | Structured alignment report terminal block | FR10, FR11, FR12 | ✓ Aligned |
| UX-DR3 | Gap prompting with sequential counter | FR14, FR15, FR16 | ✓ Aligned |
| UX-DR4 | Answer store confirmation flow (Enter/E/S) | FR22, FR23 | ✓ Aligned |
| UX-DR5 | All CLI output through `display.ts` with prefix/color conventions | NFR19 | ✓ Aligned |
| UX-DR6 | Two-column HTML grid (27%/73%) | FR30 | ✓ Aligned |
| UX-DR7 | Resume header with geometric accent shape | FR30 | ✓ Aligned |
| UX-DR8 | Section header `+ SECTION NAME` pattern | FR30 | ✓ Aligned |
| UX-DR9 | Experience entry component format | FR30 | ✓ Aligned |
| UX-DR10 | Contact block icon squares | FR30 | ✓ Aligned |
| UX-DR11 | Skill/achievement `●` bullets | FR30 | ✓ Aligned |
| UX-DR12 | Compact mode (`.compact` CSS class, `--compact` flag) | **No PRD FR** | ⚠️ See below |
| UX-DR13 | `@media print` block for PDF export | FR35 | ✓ Aligned |
| UX-DR14 | Inter font + full type scale | FR30 | ✓ Aligned |
| UX-DR15 | Empty/first-run state messages | NFR19 | ✓ Aligned |
| UX-DR16 | HITL review interaction (O/R/A) | FR31, FR32 | ✓ Aligned |

---

### Alignment Issues

#### ⚠️ Phase Conflict — Compact Mode & Color Theme Injection (UX spec Phase 2 vs. Epics Phase 1)

The UX spec's **Implementation Roadmap** (Component Strategy section) explicitly places these in **Phase 2 — Growth**:
- Compact mode CSS (`.compact`)
- Bold header variant
- Color theme injection

However, the **epics document** imports UX-DR1 (4 color themes) and UX-DR12 (compact mode) as Phase 1 implementation requirements, and **Story 2.6** fully implements both (theme injection via `<style>` prepend, compact mode via `class="compact"` and `--compact` flag).

**Impact:** The `--compact` flag and theme switching are tested and required to pass Story 2.6 acceptance criteria. If the UX spec is the authority and these are Phase 2, the current story acceptance criteria are over-scoped for MVP. If the epics are the authority (they were written after the UX spec), the UX spec's Phase 2 roadmap is outdated.

**Recommendation:** Confirm whether compact mode and theme injection are MVP. The architectural cost is low (they are already in Story 2.6), but the Phase 2 language in the UX spec should be corrected to avoid confusion during implementation. Suggest updating the UX spec's Implementation Roadmap to align with the epics' Phase 1 scope.

---

#### ⚠️ `--compact` and `--theme` Flags Not in PRD Command Structure

The PRD defines the `generate` command as:
> `resume-forge generate [--jd <file>]`

The UX spec introduces `--compact` and `--theme <name>` flags for `generate`. These appear in Story 2.6 and UX-DR1/UX-DR12 but are absent from the PRD command structure table.

**Impact:** Minor — developers reading the PRD for the command contract won't find these flags. No behavior gap, but the PRD command schema is incomplete.

**Recommendation:** Add `[--compact] [--theme <name>]` to the PRD's `generate` command definition.

---

#### ⚠️ Page Overflow Detection — UX Spec Specifies, No Story Covers It

The UX spec (HTML Template Rendering Patterns) states:
> "Content overflow: Tool warns if output may exceed one page; suggests `--compact`; never auto-applies"

No story in the epics implements overflow detection or the warning message. No FR in the PRD addresses it.

**Impact:** Developers won't implement overflow detection unless they read the UX spec carefully. The behavior will silently produce two-page resumes without any user warning.

**Recommendation:** Add a story (or extend Story 2.6) to detect approximate content length and surface `→ Output may exceed one page. Run with --compact to reduce spacing.` This is a small implementation but has a meaningful UX impact.

---

#### ℹ️ Bold Header Template Variant (Direction F) — UX Spec Only, No Story

The UX spec documents Direction F as a `resume-bold.html` alternate template variant and includes it in the design rationale. No epic or story covers creating this template. The PRD doesn't reference it.

**Impact:** None for MVP — Direction F is explicitly presented as an optional alternate. Flagging for completeness.

**Recommendation:** If Direction F is ever promoted to a user-selectable option (Phase 2), a story will be needed. No action required now.

---

#### ℹ️ Ctrl+C Signal Handling — UX Pattern, No Story

The UX spec (Journey Patterns) states: "Ctrl+C exits cleanly from any state." No story covers `SIGINT` handler registration or graceful cleanup on interrupt. If the process crashes mid-write during a Ctrl+C, NFR14 (atomic writes) provides protection, but the UX promise of a "clean exit" message is not enforced anywhere.

**Recommendation:** Add a note to Story 1.1 (project scaffolding) or Story 2.2 (JD capture) to register a `SIGINT` handler that exits with code 1 and a `→ Interrupted. No files were written.` message.

---

### Warnings

None that are blocking. The UX specification is detailed, well-integrated with the epics via the UX-DR system, and largely consistent with the PRD. The phase conflict on compact mode and theme injection is the most meaningful issue and should be clarified before implementation begins to avoid scope confusion.

---

## Epic Quality Review

### Best Practices Compliance Summary

| | Epic 1 | Epic 2 | Epic 3 | Epic 4 |
|--|--------|--------|--------|--------|
| Delivers user value | ⚠️ Mixed | ✓ | ✓ | ✓ |
| Can function independently | ❌ | ✓ | ❌ | ✓ |
| Stories appropriately sized | ✓ | ✓ | ✓ | ✓ |
| No forward dependencies | ❌ | ✓ | ❌ | ✓ |
| Clear acceptance criteria | ✓ | ✓ | ✓ | ✓ |
| FR traceability maintained | ✓ | ✓ | ✓ | ✓ |

---

### 🔴 Critical Violations

#### VIOLATION 1: Cross-Epic Forward Dependency — Epic 1 Story 1.5 → Epic 2 Story 2.1

**Problem:** Story 1.5 (Init Wizard, Epic 1) requires the profile loading module (`profile.load()`, `profile.loadBaseResume()`) to satisfy its own acceptance criteria:
> "Step 1/4 prompts for the LinkedIn JSON export path; on success displays `✓ Profile loaded — N entries indexed`"

That parse-and-index behavior is defined and implemented in **Story 2.1 (Epic 2)**. Epic 1 cannot be completed without Epic 2 Story 2.1 existing first.

**Impact:** If a developer completes Epic 1 in isolation, Story 1.5 will either fail its acceptance criteria (no `N entries indexed` count) or require them to jump ahead to Story 2.1. Epic sequencing is broken.

**Remediation Options:**
- **Option A (recommended):** Move Story 2.1 (Profile Loading & Experience Indexing) to Epic 1 as Story 1.7, making it a prerequisite of the init wizard. Epic 2 then refers to the already-implemented profile module.
- **Option B:** Scope Story 1.5 to use a stub profile loader (validates file exists, returns placeholder count) and explicitly note that full indexing is deferred to Story 2.1. Acceptance criteria must be adjusted to match.

---

#### VIOLATION 2: Cross-Epic Forward Dependency — Epic 3 Stories 3.1–3.2 → Epic 4 Story 4.1

**Problem:** Story 3.2 (Multi-Round Context Collection) includes this acceptance criterion:
> "→ Answer saved to store (topic: [key]) is displayed after each new answer"

This requires calling `store.write()`. The answer store module and its atomic write behavior are defined and implemented in **Story 4.1 (Epic 4)**. Similarly, Story 3.1's gap prompting needs the store key normalization logic from Story 4.1.

**Impact:** Epic 3 stories cannot satisfy their own acceptance criteria without Epic 4 Story 4.1. Epic 3 is not independently completable.

**Remediation Options:**
- **Option A (recommended):** Move Story 4.1 (Answer Store Persistence) to Epic 3, either as Story 3.0 (first story of Epic 3) or as a new Story 3.6. The remaining Epic 4 stories (pre-fill, management commands, run history) remain in Epic 4.
- **Option B:** Split answer store into "basic write" (Epic 3) and "full read/pre-fill/management" (Epic 4). Story 4.1 in its current form covers more than the minimum needed for Epic 3 to work.

---

### 🟠 Major Issues

#### ISSUE 1: Story 3.5 (Role Title as Target) Misplaced in Epic 3

**Problem:** FR7 (role title as JD substitute) is a **JD input method** alongside FR5 (copy-paste) and FR6 (`--jd` flag), all of which are under "Job Description Processing" in the PRD. FR5 and FR6 are in Epic 2 Story 2.2; FR7 is in Epic 3 Story 3.5.

A developer completing Epic 2 will have a generation pipeline that cannot accept a role title as input. The Epic 2 generation pipeline is incomplete without this input mode, even though all other Epic 2 ACs pass.

**Impact:** The Epic 2 demo/validation cannot cover the full "JD input" requirement set. This may be an intentional deferral, but it is not labeled as such in the epics document.

**Remediation:** Move Story 3.5 to Epic 2 (as Story 2.2a or appended to Story 2.2 as an additional scenario). If it truly depends on gap loop infrastructure from Epic 3, document that dependency explicitly. Current Story 3.5 ACs have no dependency on Stories 3.1–3.4.

---

#### ISSUE 2: Stories 1.1, 1.3, 2.3 are Technical/Developer Stories

**Problem:** Three stories violate the user-value principle:

| Story | As-Written Role | Issue |
|-------|-----------------|-------|
| Story 1.1 | "As a **developer**" | Project scaffolding and build toolchain — zero standalone user value |
| Story 1.3 | "As Rainboldt" but technical | The display module has no user-visible feature until it's used by other stories |
| Story 2.3 | "As a developer" | LLM adapter is pure infrastructure — no user outcome possible from this story alone |

None of these deliver user value in isolation. They are technical milestones embedded within epics to support future stories.

**Impact:** This is acceptable practice for a CLI tool project (some infrastructure stories are unavoidable), but it means the user cannot test or validate any user-facing behavior after completing these stories alone. The risk is that these stories become "comfort work" that delays actual feature delivery.

**Remediation:** No structural change required, but annotate each with an explicit "Developer Story — no user-visible behavior until Story X.Y." This sets correct expectations and prevents these from being used to claim epic completion prematurely.

---

### 🟡 Minor Concerns

#### CONCERN 1: Story 1.4 (Config Module) User Story Framing is a Stretch

Story 1.4 opens "As Rainboldt, I want a typed, schema-validated configuration module..." — a user would never phrase a want this way. The actual user story is captured in Story 1.5 (init wizard) and Story 1.6 (config command). Story 1.4 is the implementation layer that makes those work.

Not a structural problem, but the user story framing is misleading. Suggest re-framing as a developer story or merging into Story 1.5's acceptance criteria as technical implementation requirements.

---

#### CONCERN 2: `run-history.jsonl` Not Reflected in Story 1.1 File Structure

Story 1.1 establishes the file structure for `src/` subdirectories but does not define `~/.resume-forge/data/run-history.jsonl`. Story 4.5 introduces this file but Story 1.1's scaffolding ACs don't mention creating the `data/` directory structure or the `.jsonl` format. A developer implementing Story 1.1 won't know to create this file or directory.

**Remediation:** Add to Story 1.1 ACs: the `~/.resume-forge/data/` directory is created on first init, with `answer-store.json` and `run-history.jsonl` as the two expected data files (both empty on first run).

---

#### CONCERN 3: Story 4.4 Duplicates Story 1.5 Validation Scope

Story 4.4 (Profile Update Without Data Loss) verifies that re-running `resume-forge init` preserves `answer-store.json` and `run-history.jsonl`. Story 1.5 already includes acceptance criteria for the same behavior:
> "Given I run `resume-forge init` when `~/.resume-forge/` already exists... existing `answer-store.json` and `run-history.jsonl` are preserved"

These stories test the same behavior from different angles. This creates duplicate test coverage and could cause confusion about which story "owns" the init idempotency requirement.

**Remediation:** Remove the duplicate from Story 1.5 (it can't truly be verified until the data files exist anyway) and let Story 4.4 own the full idempotency validation.

---

### Epic-Level Independence Verdict

| Epic | Verdict | Reason |
|------|---------|--------|
| Epic 1 | ❌ Not independent | Story 1.5 requires profile module from Epic 2 Story 2.1 |
| Epic 2 | ✓ Independent | All dependencies are backward (Epic 1 only) |
| Epic 3 | ❌ Not independent | Stories 3.1/3.2 require answer store from Epic 4 Story 4.1 |
| Epic 4 | ✓ Independent | All dependencies are backward (Epics 1–3) |

The two independence violations both have clear, low-effort remediations. Neither requires story rewrites — only story relocation between epics.

---

## Summary and Recommendations

### Overall Readiness Status

**READY FOR IMPLEMENTATION — 2 critical structural issues resolved (2026-05-29). Remaining items are minor and can be addressed per-story during sprint planning.**

The planning artifacts are genuinely strong: the PRD is comprehensive and fully numbered (42 FRs, 19 NFRs), all 42 FRs trace to specific stories, acceptance criteria are detailed and testable, and the UX specification is thorough. None of the issues found require rewriting the core product vision or generating new content. All are resolved by story relocation, scope clarification, or small additions to existing acceptance criteria.

---

### Issues by Severity

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | ✅ Resolved | Epic 1 → Epic 2 forward dependency — Story 2.1 moved to Epic 1 as Story 1.7 | Epic Quality |
| 2 | ✅ Resolved | Epic 3 → Epic 4 forward dependency — Story 4.1 moved to Epic 3 as Story 3.1 | Epic Quality |
| 3 | 🟠 Major | FR32 revision mechanism not specified in LLM adapter interface (Story 2.3) | Epic Coverage |
| 4 | 🟠 Major | `run-history.json` (PRD) vs `run-history.jsonl` (Story 4.5) file format inconsistency | Epic Coverage |
| 5 | 🟠 Major | Story 3.5 (FR7 role title) misplaced — JD input method isolated in Epic 3, not Epic 2 | Epic Quality |
| 6 | 🟠 Major | UX spec places compact mode + theme injection in Phase 2; epics implement in Phase 1 | UX Alignment |
| 7 | 🟠 Major | Stories 1.1, 1.3, 2.3 are developer/infrastructure stories with no standalone user value | Epic Quality |
| 8 | 🟡 Minor | `--compact` and `--theme` flags absent from PRD `generate` command definition | UX Alignment |
| 9 | 🟡 Minor | Page overflow detection (warn + suggest --compact) specified in UX spec but no story covers it | UX Alignment |
| 10 | 🟡 Minor | Ctrl+C signal handler ("exits cleanly from any state") not covered in any story | UX Alignment |
| 11 | 🟡 Minor | Story 1.4 user story framing is misleading for infrastructure code | Epic Quality |
| 12 | 🟡 Minor | `run-history.jsonl` not in Story 1.1 file structure scaffolding | Epic Quality |
| 13 | 🟡 Minor | Story 4.4 duplicates init idempotency ACs already in Story 1.5 | Epic Quality |

**Total: 2 Critical · 5 Major · 6 Minor = 13 issues**

---

### Critical Issues Requiring Immediate Action

#### Action 1 — Resolve Profile Module Placement (Critical, ~30 min)

Move **Story 2.1 (Profile Loading & Experience Indexing)** from Epic 2 to become the final story of **Epic 1** (Story 1.7). Update Epic 2's scope statement to remove FR1, FR2, FR3 and note they are covered in Epic 1. Update the FR Coverage Map accordingly.

**Why:** Story 1.5 (Init Wizard) cannot satisfy its acceptance criteria without `profile.load()` existing. Epic 1 must be self-contained.

---

#### Action 2 — Resolve Answer Store Placement (Critical, ~30 min)

Move **Story 4.1 (Answer Store Persistence)** from Epic 4 to become the first story of **Epic 3** (Story 3.0 or Story 3.1, renumbering others). Epic 4 retains: pre-fill (former 4.2), store management commands (former 4.3), profile update (former 4.4), run history (former 4.5).

**Why:** Stories 3.2 and 3.1 require `store.write()` and key normalization to pass their acceptance criteria. Epic 3 must own the write capability it depends on.

---

### Recommended Next Steps

**Immediate (before first story begins):**
1. ✅ Story 2.1 relocated → Epic 1 Story 1.7 (Critical #1 resolved)
2. ✅ Story 4.1 relocated → Epic 3 Story 3.1; existing 3.1–3.5 renumbered 3.2–3.6; Epic 4 renumbered 4.1–4.4 (Critical #2 resolved)
3. Add `reviseResume()` (or equivalent) to Story 2.3's LLM adapter interface definition (resolves Major #3)
4. Confirm `run-history.jsonl` as the canonical format; update PRD config schema (resolves Major #4)

**Before Epic 2 implementation begins:**
5. Decide: is compact mode + theme injection MVP or Phase 2? Update whichever document is wrong (resolves Major #6)
6. Move Story 3.5 to Epic 2 if role-title input is expected to work after Epic 2 demo (resolves Major #5)
7. Add `--compact` and `[--theme <name>]` to PRD `generate` command definition (resolves Minor #8)

**Acceptance criteria additions (can be done per story during sprint planning):**
8. Story 1.1: add `~/.resume-forge/data/` directory with `run-history.jsonl` to scaffolding ACs (Minor #12)
9. Story 2.6 or new story: add page overflow detection warning + `--compact` suggestion (Minor #9)
10. Story 1.1 or 2.2: add `SIGINT` handler registration to ACs (Minor #10)
11. Remove duplicate idempotency ACs from Story 1.5; let Story 4.4 own them (Minor #13)

---

### Strengths Worth Preserving

- The PRD's requirement numbering (FR1–FR42, NFR1–NFR19) is clean and complete — every story traces back to it
- Acceptance criteria across all 18 stories are written in proper BDD format with specific, measurable outcomes
- The UX Design Requirements (UX-DR1–UX-DR16) bridging the UX spec into the epics is excellent practice
- The `GenerationSession` immutability pattern (spread, never mutate) in the architecture is clearly specified and will pay dividends during implementation
- The `display.ts` single-module output constraint is well-defined and easy to enforce in code review

---

### Final Note

This assessment identified **13 issues across 4 categories**. The 2 critical structural issues (cross-epic forward dependencies) are straightforward to fix: they require only story relocation, not new content. No epics need to be added or removed. The product vision, requirement set, and acceptance criteria are implementation-ready once these issues are resolved.

**Assessor:** Claude Code (Sonnet 4.6)
**Assessment Date:** 2026-05-29
**Documents Assessed:** prd-resume-forge.md · architecture-resume-forge.md · epics-resume-forge.md · ux-design-specification-resume-forge.md

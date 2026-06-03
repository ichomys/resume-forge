---
stepsCompleted: ["step-01-init", "step-02-discovery", "step-02b-vision", "step-02c-executive-summary", "step-03-success", "step-04-journeys", "step-05-domain", "step-06-innovation", "step-07-project-type", "step-08-scoping", "step-09-functional", "step-10-nonfunctional", "step-11-polish", "step-12-complete"]
inputDocuments: []
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 0
workflowType: 'prd'
classification:
  projectType: "CLI Tool"
  domain: "Personal Productivity / Career Tools"
  complexity: "Low-Medium"
  projectContext: "Greenfield"
---

# Product Requirements Document — Resume Forge

**Author:** Rainboldt
**Date:** 2026-05-28

---

## Executive Summary

Resume Forge is a personal CLI tool that converts a stable professional experience pool — sourced from a LinkedIn profile and base resume — into role-specific, visually consistent resume documents on demand. It targets a single user navigating a job market that rewards tailored applications but penalizes the overhead of maintaining multiple resume versions across varied role interests.

The core problem: a multidimensional professional background doesn't map cleanly to any single resume. Per-role customization is O(n) effort. Resume Forge makes it O(1) — the experience data stays fixed; the tool generates targeted output.

**Inputs:** LinkedIn profile export, base resume (PDF/DOCX), job description (copy-paste or file), or plain-text role title.
**Output:** An HTML resume file styled to match the user's reference design, ready for browser Print-to-PDF finalization.

### What Makes This Special

Resume Forge is integrity-first by design. Where most AI resume tools fill gaps with plausible fiction, Resume Forge treats missing information as a signal. When the experience pool can't credibly address a role requirement, the tool prompts for additional context. If the user's answers still don't close the gap, the tool surfaces a fit assessment — this role may not be the right target — and lets the user decide whether to continue or redirect.

Every generated resume reflects what the user can actually defend in an interview. The tool's value is application quality and fit confidence per submission, not output volume.

---

## Success Criteria

### User Success

- High-overlap roles (≥80% JD-to-experience alignment): full resume generated in < 1 minute with zero or minimal prompting
- Gap-heavy roles: complete gap-prompting cycle and resume generation finishes within 5–10 minutes
- Every generation includes a human review step before the file is considered final — no auto-finalize behavior
- Answer store reduces repeat prompting for the same topics; by ~10 cumulative runs, most common gap areas are pre-filled
- Every generation begins with an explicit alignment report (percentage match, aligned areas, gap areas) before the user commits to generation
- User can add context and re-evaluate fit at any point — no hard cutoff on context rounds

### Business Success

- Supports 3–5 resume generations per week during active job search without tool friction as a bottleneck
- Answer store shows measurable prompting reduction after the first 10 uses
- Tool saves ≥20 minutes per resume compared to manual tailoring
- Ultimate validation: interview callback rate improves vs. generic resume baseline (lagging indicator, user-assessed)

### Technical Success

- LinkedIn profile parsing reliably extracts experience, skills, education, and dates from exported JSON
- JD copy-paste input is confirmed complete before analysis proceeds
- Alignment analysis produces a defensible percentage score tied to keyword, skill, and requirement matching
- HTML output matches reference visual template with no layout drift
- Answer store persists reliably between sessions and correctly surfaces stored answers for relevant future prompts
- LLM output is consistent in tone, style, and quality across runs for equivalent inputs

### Measurable Outcomes

| Outcome | Target |
|---|---|
| High-overlap generation time | < 1 min |
| Gap-heavy generation time | 5–10 min |
| Supported volume | 3–5/week |
| Prompting reduction after 10 runs | Measurable decrease in prompted gaps |
| Visual template fidelity | No post-edit required on formatting |
| Fit report transparency | Alignment % shown before every generation |

---

## User Journeys

### Journey 1: The Clean Match

Rainboldt opens his terminal on a Tuesday morning with a role he's excited about. He pastes the job description text and runs the tool.

The alignment report appears: **84% match**. His last three roles map directly to the core requirements. One minor gap — a specific framework he's used tangentially. The tool asks a single question. He answers in two sentences. The answer saves to the store.

Forty-five seconds later, the draft appears — his most relevant projects front and center, framed around the problems this company is trying to solve. He skims it, approves, and gets an HTML file. He opens it in the browser, prints to PDF, and sends the application before his coffee gets cold.

**Capabilities revealed:** alignment analysis, content prioritization, minimal prompting for high-overlap roles, HITL review, HTML output, answer store capture on clean runs.

---

### Journey 2: The Stretch Role

Rainboldt finds a role that excites him — 55% aligned on paper. The JD asks for things he's done but never documented clearly. The tool flags 6 gap areas and begins prompting.

"Tell me about your experience with embedded systems firmware." He answers — two paragraphs, a specific project. Four more questions follow, each one surfacing experience he has but hadn't crystallized.

Every answer lands in the answer store, tagged by topic. Alignment climbs to 76%. The tool generates the draft — not fabricated, but *surfaced*. He reviews, tweaks one bullet, approves. The next time a role asks about firmware, the prompt doesn't appear. The answer is already there.

**Capabilities revealed:** multi-round prompting loop, answer store accumulation by topic, alignment recalculation after context rounds, gap-to-draft pipeline.

---

### Journey 3: The Honest Redirect

Rainboldt runs a role with an interesting title. Alignment: **34%**. The tool lists core gaps in areas he genuinely hasn't worked in and offers to prompt for context.

Two rounds of questions. His answers are honest but thin — adjacent experience, not direct. Alignment moves to 44%. The tool surfaces: *"Core requirements A, B, and D remain unaddressed. This role may not be the right target. Continue adding context, or redirect to a better-fit opportunity."*

He pauses. The tool is right — he was chasing the title, not the work. He exits without generating. He doesn't waste the application or the interviewer's time.

**Capabilities revealed:** fit percentage display, gap breakdown, multi-round context attempts, honest fit assessment, graceful no-generate exit.

---

### Journey 4: The Return Run

Three weeks and 18 runs later. Rainboldt opens another posting — alignment: 79%. Prompting begins, but most questions are pre-filled from the answer store. One new question, specific to this JD. He answers in 30 seconds. Total interaction: under 2 minutes.

The draft reflects language refined across 18 iterations. The resume feels like *his voice*, not a template's.

**Capabilities revealed:** answer store maturity, prompting reduction over time, voice consistency through accumulated use.

---

### Journey Requirements Summary

| Journey | Key Capabilities Revealed |
|---|---|
| Clean Match | Alignment analysis, content prioritization, HTML output, HITL review, answer store capture |
| Stretch Role | Multi-round prompting, answer store write/tag, alignment recalculation, gap-to-draft pipeline |
| Honest Redirect | Fit % display, gap breakdown, multi-round context, graceful no-generate exit |
| Return Run | Answer store read/match, prompting reduction, voice consistency |

---

## Domain-Specific Requirements

### Input & Data Sourcing

- Job description input: copy-paste text entry only — no web scraping, no URL fetching
- LinkedIn profile input: exported JSON file or manual paste — user provides, tool does not fetch
- Base resume input: user-supplied PDF or DOCX — parsed once at setup, stored in local config
- No external API calls for input data; all sourcing is user-initiated
- Tool prompts user to confirm JD capture is complete before proceeding to analysis

### LLM Integration

- Primary model: Claude Sonnet via Anthropic API (user subscription)
- API key stored via environment variable reference — never hardcoded or committed to source
- Model selection configurable via config file; switching to a local model (e.g., Ollama + Llama 3) requires no code changes
- Cost at 3–5 runs/week: ~$0.05–0.15/run — no throttling required

### Local Data Storage

- All persistent data in `~/.resume-forge/` — no cloud sync, no telemetry, fully local
- Directory structure: `config/` (settings), `data/` (answer store, run history), `profile/` (LinkedIn export, base resume), `templates/` (HTML/CSS)
- Portable: clone repo + configure local dir = working install for any user
- Answer store: JSON file in `data/`, keyed by topic/skill area

### Output & Rendering

- Output: HTML file rendered from user-owned template
- Final PDF: browser Print-to-PDF — no server-side PDF library required
- Filename convention: `{role-slug}_{YYYY-MM-DD}.html`
- Output directory configurable; defaults to `~/resume-forge-output/`
- HTML includes print media queries for correct layout and margins when printed

### Risk Mitigations

| Risk | Mitigation |
|---|---|
| API key exposure | Stored as env var reference only; `.gitignore` enforced on config dir |
| LinkedIn data privacy | Data never leaves local machine; no upload, no external logging |
| JD copy-paste quality variance | Tool confirms JD completeness before analysis |
| Browser Print-to-PDF inconsistency | CSS uses print media queries; tested against Chrome/Edge defaults |

---

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. The Answer Store — Compounding Personal Knowledge Base**
Unlike stateless CLI tools, each Resume Forge interaction contributes to a growing, topic-keyed articulation of the user's professional identity. The store reduces prompting over time, enforces voice consistency across all outputs, and functions as a user-controlled professional memory layer — entirely local, entirely private. By run 20, the tool represents the user with minimal friction.

**2. Integrity-First AI Design**
Resume Forge optimizes for fit confidence and interview defensibility, not output volume. It surfaces misalignment and actively redirects users from poor-fit applications — inverting the standard AI writing tool value function (maximize content completeness) in favor of application quality per submission. The honest redirect is a core product feature, not an edge case handler.

**3. Quantified Fit Transparency**
Role-to-experience alignment is made explicit as a percentage with categorical breakdown (aligned, gap, unresolvable). This transforms an opaque judgment call into a traceable signal. Multi-round context refinement lets the user watch their alignment score improve in real time.

### Market Context

Existing resume tools (Kickresume, Resume.io, Teal, Rezi) focus on formatting, ATS optimization, and AI-assisted writing from scratch. None combine local persistent learning, explicit fit scoring, and integrity-enforced generation in a CLI tool. Resume Forge occupies a gap: automated, honest, and improving over time.

### Innovation Validation Approach

| Innovation | Validation Method |
|---|---|
| Answer store value | Track prompted gap count per run; expect downward trend after 10 uses |
| Integrity-first | User assesses whether redirected roles were genuinely poor fits in retrospect |
| Fit transparency | User assesses whether alignment % matches intuition; refine scoring weights based on feedback |

### Innovation Risk Mitigations

| Risk | Mitigation |
|---|---|
| Answer store grows stale | `--review-store` command to audit and update stored answers |
| Alignment % feels arbitrary | Show breakdown alongside score so the user understands the basis |
| Honest redirect frustrates user | Frame as "here's what's missing" + clear path to add context; never a hard stop |

---

## CLI Tool Specific Requirements

### Command Structure

| Command | Description |
|---|---|
| `resume-forge init` | First-time setup: load LinkedIn export, load base resume, configure API key and output directory |
| `resume-forge generate [--jd <file>]` | Main generation loop: JD input → alignment analysis → gap prompting → answer store write → LLM generation → HITL review → HTML output |
| `resume-forge store [list\|edit\|clear]` | Manage the answer store: list entries, edit a specific entry, or clear by topic or entirely |
| `resume-forge review` | Open the most recently generated HTML output in the default browser |
| `resume-forge config [--show\|--set <key> <value>]` | View or update individual config values without re-running full init |

### Config Schema

```
~/.resume-forge/
├── config/
│   └── settings.json          # model, output_dir, template_path, api_key_env_var
├── data/
│   ├── answer-store.json      # topic-keyed answer pairs, timestamps, usage count
│   └── run-history.json       # log: role, date, alignment %, output path
├── profile/
│   ├── linkedin-export.json   # user-supplied LinkedIn data
│   └── base-resume.{pdf|docx} # source resume + visual reference
└── templates/
    └── default/
        ├── resume.html        # HTML template mirroring reference design
        └── styles.css
```

### Scripting Support

- `--jd <filepath>` accepts `.txt` or `.html` files — enables pre-saving job postings for batch processing
- When answer store covers all detected gaps: generation runs with zero prompts (fully automated path)
- Exit codes: `0` success, `1` user abort/redirect, `2` error (API failure, missing config, parse failure)
- All errors surface as clear, actionable messages — no raw stack traces in normal operation

### Implementation Constraints

- `init` is idempotent — re-running updates config without destroying answer store or run history
- API key is never written to `settings.json` — only the env var name is stored (`ANTHROPIC_API_KEY`)
- Visual template is a user-owned HTML/CSS file (Option B: manual template) — parsed from the reference resume once at setup, then edited by the user for precise design control
- Shell completion: deferred post-MVP

---

## Product Scope & Phased Development

### MVP Strategy

**Approach:** Problem-solving MVP — the minimum that makes the core generation loop work end-to-end and demonstrably saves time vs. manual tailoring. A single clean run from JD input to reviewable HTML in under 10 minutes constitutes MVP success.

**Constraints:** Solo developer, personal project; timeline self-directed.

### Phase 1 — MVP

**Journeys supported:** Clean Match, Stretch Role, Honest Redirect (Journeys 1–3)

**Must-have capabilities:**
- `init` setup wizard: LinkedIn JSON, base resume, API key, template initialization
- `generate [--jd <file>]`: full pipeline — JD input → alignment analysis → gap prompting → answer store → LLM generation → HITL review → HTML output
- Alignment scoring with % and categorical breakdown
- Over-prompt gap detection: every unresolved requirement flagged
- Answer store: JSON persistence, topic-keyed, auto-matched on future runs
- HTML output with print media queries
- `store list|edit|clear`, `review`, `config` commands
- Manual HTML/CSS visual template (user edits once, controls output precisely)

**Out of MVP scope:** Cover letter generation, multiple templates, application tracking log, shell completion, web scraping or URL fetching.

### Phase 2 — Growth

- Cover letter generation from the same experience pool + JD analysis
- Multiple named templates (`--template <name>` flag)
- Answer store browse/search interface (TUI or paginated list)
- Application tracking log: role, date sent, outcome field
- `resume-forge history` — browse past generated resumes

### Phase 3 — Expansion

- Application readiness score: composite of fit %, answer store coverage %, template quality
- Pattern recognition: traits common to high-performing applications across run history
- Automatic gap prediction: pre-surface likely gaps before full JD analysis
- DOCX export for users requiring editable output

### Scoping Risk Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Template parsing (PDF→HTML) | High | Manual HTML/CSS template — user edits once, controls output precisely |
| LinkedIn JSON format changes | Medium | Parse defensively; fallback to manual profile paste |
| Alignment % trust | Medium | Show breakdown alongside score; user calibrates trust |
| Claude API latency | Low | Non-blocking; show progress indicators during generation |
| Answer store topic mismatch | Low | Display matched answer before applying; user can override |

---

## Functional Requirements

> **Capability contract.** UX design, architecture, and epics will only implement capabilities listed here.

### Profile & Experience Management

- **FR1:** User can load a LinkedIn profile export (JSON) as the primary experience source
- **FR2:** User can provide a base resume file (PDF or DOCX) as a supplementary experience source
- **FR3:** System can parse and index professional experience, skills, education, and dates from loaded profile data
- **FR4:** User can update loaded profile data without losing existing answer store entries

### Job Description Processing

- **FR5:** User can provide a job description via interactive copy-paste entry at generation time
- **FR6:** User can provide a job description via a pre-saved file using a `--jd` flag
- **FR7:** User can provide a plain-text role title as a target in place of a full job description
- **FR8:** System can prompt user to confirm JD capture is complete before proceeding to analysis

### Alignment Analysis

- **FR9:** System can analyze alignment between the user's experience pool and a provided job description
- **FR10:** System can produce an alignment score expressed as a percentage
- **FR11:** System can produce a categorical alignment breakdown (aligned areas, gap areas, unresolvable gaps)
- **FR12:** System can display the full alignment report before the user commits to resume generation
- **FR13:** User can provide additional context across multiple rounds to improve alignment score

### Gap Discovery & Context Gathering

- **FR14:** System can identify specific experience gaps relative to job description requirements
- **FR15:** System can generate a targeted question for each identified gap
- **FR16:** User can provide answers across unlimited context rounds without a system-forced exit
- **FR17:** System can recalculate alignment score after each round of user-provided context
- **FR18:** System can assess when remaining gaps are unresolvable and surface a fit assessment
- **FR19:** User can choose to continue adding context, proceed to generation despite gaps, or exit without generating when a poor-fit assessment is surfaced

### Answer Store

- **FR20:** System can persist user-provided gap answers to a local store keyed by topic/skill area
- **FR21:** System can retrieve relevant stored answers and pre-fill gap prompts on future runs
- **FR22:** System can display retrieved stored answers to the user for confirmation before applying them
- **FR23:** User can override a retrieved stored answer with a new response during any generation run
- **FR24:** User can list all stored topic/answer pairs
- **FR25:** User can edit a specific stored answer entry
- **FR26:** User can clear individual answer store entries or the entire store

### Resume Generation

- **FR27:** System can generate role-tailored resume content using the experience pool, JD analysis, and stored/provided answers
- **FR28:** System can curate and prioritize experience items by relevance to the target role
- **FR29:** System can frame experience descriptions to emphasize alignment with target role requirements
- **FR30:** System can render generated content into an HTML file using the user's configured visual template

### Output & Review

- **FR31:** User can review the generated HTML resume before it is considered final
- **FR32:** User can request changes to the generated draft and receive a revised version
- **FR33:** System can save finalized HTML output to a configurable directory with a role-and-date-based filename
- **FR34:** User can open the most recently generated HTML output in the default browser
- **FR35:** System can produce HTML output formatted for accurate browser-native PDF export

### System Configuration & History

- **FR36:** User can run a guided setup wizard for first-time tool configuration
- **FR37:** User can store API credentials via environment variable reference without hardcoding values in config files
- **FR38:** User can configure LLM model selection without modifying source code
- **FR39:** User can configure the output directory path
- **FR40:** User can re-run setup without losing existing answer store data or run history
- **FR41:** System can maintain a log of past generation runs including role, date, alignment score, and output file path
- **FR42:** User can view and update individual configuration settings without re-running full initialization

---

## Non-Functional Requirements

### Performance

- **NFR1:** Alignment report displays within 15 seconds of JD submission under normal API conditions
- **NFR2:** Full generation cycle for a high-overlap role (no gap prompting) completes in under 60 seconds
- **NFR3:** Full generation cycle including gap prompting completes within 10 minutes when the user responds promptly
- **NFR4:** All non-LLM operations (answer store read/write, file save, config load) complete in under 500ms

### Security

- **NFR5:** API key is stored only as an environment variable reference — never written to config files, log files, or terminal output
- **NFR6:** LinkedIn profile data and resume files are stored only in `~/.resume-forge/` — no network transmission of personal data
- **NFR7:** The local config directory is created with user-only read/write permissions
- **NFR8:** Terminal output and run history contain no PII beyond role name, date, and alignment score

### Integration

- **NFR9:** API rate limit errors surface a user-readable message with retry guidance — no silent failures
- **NFR10:** API timeout or unavailability produces a clear error message and exits without corrupting in-progress state
- **NFR11:** API key is validated on first use with explicit success/failure feedback before generation proceeds
- **NFR12:** LLM model selection is fully configurable via settings — swapping models requires zero code changes

### Reliability & Consistency

- **NFR13:** Same experience pool + same JD produces the same quality level of resume across independent runs
- **NFR14:** Answer store write operations are atomic — a process crash during write must not corrupt existing entries
- **NFR15:** Run history is append-only — the tool never modifies or deletes existing history entries
- **NFR16:** HTML template rendering produces identical visual output across runs for identical content inputs

### Maintainability

- **NFR17:** Answer store JSON schema is versioned — any format change ships with a documented migration path
- **NFR18:** Config schema is backward-compatible across minor version updates — existing installs must not break on update
- **NFR19:** All failure modes produce clear, actionable error messages — no raw stack traces surfaced in normal operation

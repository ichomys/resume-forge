# Resume Forge

A CLI tool that generates role-tailored resumes from your LinkedIn profile, using Claude AI to align your experience with each job description — including an interactive gap-discovery loop that turns missing context into stronger bullet points.

## How it works

1. **Init** — import your LinkedIn data export and verify your API key
2. **Generate** — paste or point to a job description; the AI scores alignment and surfaces gaps
3. **Close gaps** — answer targeted questions to enrich weak areas; alignment score updates in real time
4. **Review** — open the resume in your browser, request plain-language edits, then approve and save

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- An [Anthropic API key](https://console.anthropic.com/)
- A LinkedIn data export — ZIP (full archive) or JSON (see [Obtaining your LinkedIn export](#obtaining-your-linkedin-export))

## Installation

```bash
git clone https://github.com/ichomys/resume-forge.git
cd resume-forge
npm install
```

### Set your API key

Resume Forge loads a `.env` file automatically on startup. Copy the example and add your key:

```bash
cp .env.example .env
# edit .env and replace the placeholder with your real key
```

**.env:**
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

The `.env` file is listed in `.gitignore` and is **never committed**. Alternatively, export the variable directly — the environment variable takes precedence over `.env`:

**macOS / Linux:**
```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Windows (PowerShell):**
```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-your-key-here"
```

## First-time setup

Run the setup wizard once before generating any resumes:

```bash
npm run dev -- init
```

The wizard walks through four steps:

| Step | What it does |
|------|-------------|
| 1/4 LinkedIn profile | Parses your LinkedIn export (ZIP or JSON) and indexes your experience, skills, and education |
| 2/4 Contact info | Optionally stores phone, email, and LinkedIn URL for the resume header |
| 3/4 API key | Verifies `ANTHROPIC_API_KEY` is set and the connection works |
| 4/4 Output directory | Sets where generated resumes are saved (default: `~/resume-forge-output`) |

Config, templates, and cached profile data are stored under `~/.resume-forge/`. Re-run `init` at any time to update your profile or change settings.

### Obtaining your LinkedIn export

**ZIP archive (recommended):**

1. Go to **LinkedIn → Settings & Privacy → Data privacy → Get a copy of your data**
2. Select **"Want something in particular? Select the data files you're most interested in"**
3. Check all profile-related data and request the archive
4. Once the email arrives, download the `.zip` — provide that path directly during `init`

The ZIP is parsed automatically for `Positions.csv`, `Skills.csv`, `Education.csv`, and `Profile.csv`.

**JSON (alternative):**

If you already have a `Profile.json` export, provide that path instead. Both formats are supported.

## Usage

### Generate a resume

**Interactive (paste a job description at the prompt):**
```bash
npm run dev -- generate
```

**From a file:**
```bash
npm run dev -- generate --jd path/to/job-description.txt
```

**By role title (no full JD required):**
```bash
npm run dev -- generate --role "Senior Software Engineer"
```

**Compact layout** (reduced whitespace for content-dense roles):
```bash
npm run dev -- generate --jd job.txt --compact
```

#### Alignment report and gap loop

After the JD is captured, the tool shows an alignment score and surfaces gaps between the role requirements and your profile:

```
Alignment  82%   ████████░░░
Matched    8 of 10 requirements
Gaps       Salesforce CPQ, territory management

[G] Generate now   [C] Add context   [X] Exit
```

- **[G]** Generate immediately with current alignment
- **[C]** Enter the gap loop — answer targeted questions to improve the score, then choose G again
- **[X]** Abort

The gap loop recalculates alignment after each round and shows the delta (`78% → 85%`). If core requirements genuinely cannot be addressed, a candid fit assessment is shown before continuing.

#### Review menu

Once a draft is ready:

- **[O]** Open in browser
- **[R]** Request changes — describe edits in plain language; the resume regenerates
- **[A]** Approve and save to your output directory

### Reopen the last resume

```bash
npm run dev -- review
```

Opens the most recently saved resume in your default browser.

### View or change config

```bash
# Show all current settings
npm run dev -- config --show

# Change a setting
npm run dev -- config --set outputDir ~/Documents/resumes
npm run dev -- config --set theme slate-blue
npm run dev -- config --set model claude-opus-4-5
```

**Configurable keys:**

| Key | Default | Description |
|-----|---------|-------------|
| `model` | `claude-sonnet-4-5` | Anthropic model to use |
| `outputDir` | `~/resume-forge-output` | Where saved resumes are written |
| `templatePath` | `~/.resume-forge/templates/default/resume.html` | Handlebars HTML template |
| `theme` | `amber` | Accent colour — `amber`, `slate-blue`, `forest`, `charcoal` |
| `apiKeyEnvVar` | `ANTHROPIC_API_KEY` | Environment variable name for your API key |

### Manage stored gap answers

Answers you provide during generation are saved so the same question is never asked twice. On return runs, the stored answer is shown with options to confirm, edit, or skip.

```bash
npm run dev -- store list                   # see all saved answers
npm run dev -- store edit --topic <key>     # update a specific answer
npm run dev -- store clear --topic <key>    # remove one answer
npm run dev -- store clear                  # remove all answers
```

## Output

Approved resumes are saved as HTML files named by role and date:

```
~/resume-forge-output/senior-software-engineer_2026-05-31.html
```

Open any `.html` file in a browser to view or print. Use **File → Print → Save as PDF** for a PDF copy.

## Build and install

```bash
npm run build
node bin/resume-forge.js init
node bin/resume-forge.js generate --jd job.txt
```

Or link globally so `resume-forge` works as a bare command:

```bash
npm link
resume-forge init
resume-forge generate --jd job.txt
```

## Development

```bash
npm run dev -- <command>   # run from source via tsx (no build step)
npm test                   # run test suite
npm run lint               # TypeScript type-check
npm run build              # compile to bin/resume-forge.js
```

## Local data layout

All data lives under `~/.resume-forge/` — nothing is sent anywhere beyond the Anthropic API call:

```
~/.resume-forge/
  config/
    settings.json             # tool configuration
  profile/
    linkedin-export.json      # parsed experience pool
    contact.json              # phone / email / LinkedIn URL
    base-resume.pdf           # (optional) visual reference
  templates/
    default/
      resume.html             # Handlebars HTML template
      styles.css
  data/
    answer-store.json         # saved gap answers
    run-history.jsonl         # log of past generation runs
```

## Troubleshooting

**"API key not found or invalid"** — Check that `.env` exists in the project root with a valid `ANTHROPIC_API_KEY=sk-ant-...` line, or that the variable is exported in your current shell session.

**"Positions.csv not found in ZIP"** — LinkedIn's "Quick" export doesn't include position data. Download the full archive: Settings → Data Privacy → Get a copy of your data → select all profile files.

**"Could not parse LinkedIn export"** — If providing a JSON file, make sure it is the unzipped JSON export, not the ZIP itself.

**Resume runs off the page** — Re-run with `--compact`, or press `R` during review to request shorter bullet points.

**Alignment score seems low** — Use `[C]` to enter the gap loop and answer the targeted questions. Even one or two answers typically raise the score 5–15 points.

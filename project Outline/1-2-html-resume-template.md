# Story 1.2: HTML Resume Template

Status: done

## Story

As Rainboldt,
I want a functional two-column HTML/CSS resume template matching my reference design,
so that every generated resume renders consistently in my visual style and prints cleanly as a PDF.

## Acceptance Criteria

1. `templates/default/resume.html` and `templates/default/styles.css` exist in the repository root
2. Layout renders as two columns — left ~27% (contact, skills), right ~73% (experience, summary) — using CSS grid
3. Header shows a geometric accent shape (top-left), bold name at 28px, italic subtitle at 13px
4. Section headers display as `+ SECTION NAME` — `+` in `--accent-color` (#E8952A amber default), label in 11px bold uppercase
5. Experience entries render: Title | Company (11px bold) → Location | Date (10px italic) → description → bullet list with `●` bullets
6. Contact block renders icon squares (14px accent background, white symbol) + bold text for Phone, Email, LinkedIn
7. Inter font loads via Google Fonts with fallback chain `'Inter', 'Calibri', 'Segoe UI', system-ui, sans-serif`
8. CSS custom properties define all tokens: `--accent-color`, `--accent-dark`, `--text-primary`, `--text-secondary`, `--col-left`, `--col-right`, `--page-margin`, and spacing scale (`--space-xs` through `--space-xl`)
9. `@media print` block sets `@page { size: letter; margin: 0.75in; }` and `color-adjust: exact`
10. `page-break-inside: avoid` is applied to each `.r-job` experience entry
11. Handlebars syntax (`{{name}}`, `{{#each bullets}}`) is present at all dynamic content insertion points
12. A `.compact` CSS class exists that overrides spacing tokens for content-dense resumes

## Tasks / Subtasks

- [x] Create `templates/default/` directory structure (AC: 1)
  - [x] Create `templates/default/resume.html`
  - [x] Create `templates/default/styles.css`

- [x] Implement `styles.css` — CSS custom properties and design tokens (AC: 8)
  - [x] Define `:root` block with all color tokens (`--accent-color`, `--accent-dark`, `--text-primary`, `--text-secondary`, `--text-italic`, `--bg-primary`, `--divider`)
  - [x] Define layout tokens (`--col-left: 27%`, `--col-right: 73%`, `--page-margin: 0.75in`)
  - [x] Define spacing scale (`--space-xs: 4px`, `--space-sm: 8px`, `--space-md: 14px`, `--space-lg: 20px`, `--space-xl: 28px`)
  - [x] Set `:root { font-size: 10px; }` as rem baseline (all font sizes use rem)

- [x] Implement `styles.css` — page layout (AC: 2)
  - [x] `.resume` — CSS grid container, two-column layout using `--col-left` and `--col-right`
  - [x] `.r-left` — left sidebar column (contact, skills, section anchors)
  - [x] `.r-right` — right main column (experience, summary, achievements)
  - [x] Column gap: `--space-lg` (20px)

- [x] Implement `styles.css` — resume header (AC: 3)
  - [x] `.r-header` — header container, `page-break-after: avoid`
  - [x] `.r-header-accent` — geometric accent shape, positioned top-left, background `--accent-color`
  - [x] `.r-name` — 28px (2.8rem) bold, `--text-primary`
  - [x] `.r-subtitle` — 13px (1.3rem) normal, `--text-secondary`

- [x] Implement `styles.css` — section headers (AC: 4)
  - [x] `.r-sh` — 11px (1.1rem) bold uppercase, `--text-primary`, margin-top `--space-md`
  - [x] `.r-sh::before { content: '+ '; color: var(--accent-color); }` — accent prefix, no bold/font-weight override

- [x] Implement `styles.css` — experience entries (AC: 5, 10)
  - [x] `.r-job` — experience entry container, `page-break-inside: avoid`
  - [x] `.r-jtitle` — "Title | Company" line, 11px bold, `--text-primary`
  - [x] `.r-jmeta` — "Location | Date" line, 10px italic, `--text-italic`
  - [x] `.r-jdesc` — description text, 10px normal, `--text-primary`
  - [x] `.r-jbullets li` — bullet list, 10px, large filled circle `●` at 6–7px

- [x] Implement `styles.css` — contact block (AC: 6)
  - [x] `.r-ci` — contact item container, flex row
  - [x] `.r-icon` — icon square, 14px, `--accent-color` background, white text/symbol, flex-shrink: 0
  - [x] Contact text — 10px bold

- [x] Implement `styles.css` — skill and achievement lists (AC: 5)
  - [x] `.r-skills li::before`, `.r-achiev li::before` — large filled circle `●` bullet at matching text color
  - [x] Proficiency category labels — 10px bold, `--text-primary`
  - [x] Proficiency items — 9.5px normal, `--text-secondary`

- [x] Implement `styles.css` — compact mode (AC: 12)
  - [x] `.compact` root class — overrides spacing tokens to tighter values
  - [x] Compact overrides: `--space-xs: 2px`, `--space-sm: 4px`, `--space-md: 8px`, `--space-lg: 12px`, `--space-xl: 16px`

- [x] Implement `styles.css` — print media query (AC: 9)
  - [x] `@media print` block at bottom of `styles.css`
  - [x] `@page { size: letter; margin: 0.75in; }` inside `@media print`
  - [x] `* { -webkit-print-color-adjust: exact; color-adjust: exact; }` for accurate color reproduction
  - [x] `.resume { width: 100%; }` to enforce full-width in print context

- [x] Implement `resume.html` — document structure (AC: 7, 11)
  - [x] `<!DOCTYPE html>` · `<html lang="en">` · `<meta charset="UTF-8">` · `<meta name="viewport" ...>`
  - [x] Google Fonts `<link>` for Inter (weights 400, 700) in `<head>`
  - [x] `<link rel="stylesheet" href="styles.css">` in `<head>`
  - [x] Root `<div class="resume {{#if compact}}compact{{/if}}">` for compact mode toggle

- [x] Implement `resume.html` — header block (AC: 3, 11)
  - [x] `<div class="r-header">` with `<div class="r-header-accent"></div>`
  - [x] `<h1 class="r-name">{{name}}</h1>`
  - [x] `<p class="r-subtitle">{{subtitle}}</p>`

- [x] Implement `resume.html` — left column: contact block (AC: 6, 11)
  - [x] `{{#if contact.phone}}` guard around phone item
  - [x] `{{#if contact.email}}` guard around email item
  - [x] `{{#if contact.linkedin}}` guard around LinkedIn item
  - [x] Each: `<div class="r-ci"><div class="r-icon">…</div><span>{{contact.phone}}</span></div>`

- [x] Implement `resume.html` — left column: skills section (AC: 4, 5, 11)
  - [x] `<h2 class="r-sh">Skills</h2>`
  - [x] `<ul class="r-skills">{{#each skills}}<li>{{this}}</li>{{/each}}</ul>`

- [x] Implement `resume.html` — right column: experience section (AC: 4, 5, 10, 11)
  - [x] `<h2 class="r-sh">Experience</h2>`
  - [x] `{{#each experience}}<div class="r-job">` block
  - [x] `<div class="r-jtitle">{{title}} | {{company}}</div>`
  - [x] `<div class="r-jmeta">{{#if location}}{{location}} | {{/if}}{{startDate}} – {{endDate}}</div>`
  - [x] `{{#if description}}<p class="r-jdesc">{{description}}</p>{{/if}}`
  - [x] `{{#if bullets}}<ul class="r-jbullets">{{#each bullets}}<li>{{this}}</li>{{/each}}</ul>{{/if}}`

- [x] Implement `resume.html` — optional sections (AC: 11)
  - [x] `{{#if summary}}<section>...</section>{{/if}}` — summary section in right column
  - [x] `{{#if education}}` guard — education section in right or left column
  - [x] `{{#if achievements}}` guard — achievements section with `<ul class="r-achiev">`

- [x] Verify all acceptance criteria (AC: 1–12)
  - [x] Open `templates/default/resume.html` in Chrome with placeholder content — confirm two-column layout renders correctly
  - [x] Verify header accent shape, 28px name, 13px subtitle
  - [x] Verify section headers show `+ SECTION NAME` pattern with amber `+`
  - [x] Verify experience entry structure and `●` bullets
  - [x] Verify contact block icon squares
  - [x] Verify Inter font loads via Google Fonts in browser
  - [x] Use Chrome DevTools to confirm all CSS custom properties are defined
  - [x] Use Chrome Print Preview to confirm `@media print` applies correctly
  - [x] Verify `.compact` class tightens spacing when applied manually
  - [x] Confirm all Handlebars tokens present at dynamic insertion points

## Dev Notes

### Critical Context: This is a Static Template Story

Story 1.2 produces **only two files** — `templates/default/resume.html` and `templates/default/styles.css`. There is no TypeScript to write, no compilation step, and no test file required. These files live in the repository root `templates/` directory and will be copied to `~/.resume-forge/templates/default/` during `resume-forge init` (Story 1.5).

The `handlebars` package is already installed (added in Story 1.1 Dev Notes). `renderer.ts` (Story 2.5) will use `handlebars.compile(templateString)` to produce the final HTML from `ResumeContent` data. This story creates the template; the renderer is a later story.

### File Locations

```
resume-forge/
└── templates/
    └── default/
        ├── resume.html    ← Handlebars template
        └── styles.css     ← CSS with custom properties, print media query
```

**Never place these in `src/`, `bin/`, or the project root.** They are static assets, not TypeScript source.

### ResumeContent Data Shape (from `src/types.ts`)

The Handlebars template must match this type exactly — every `{{token}}` in the template corresponds to a field here:

```typescript
type ResumeContent = {
  name: string           // → {{name}}
  subtitle: string       // → {{subtitle}}
  contact: {
    phone?: string       // → {{contact.phone}}
    email?: string       // → {{contact.email}}
    linkedin?: string    // → {{contact.linkedin}}
  }
  summary?: string       // → {{summary}}
  experience: ExperienceEntry[]
  skills: string[]       // → {{#each skills}}
  education: Array<{ degree: string; institution: string; year: string }>
  achievements?: string[]
}

type ExperienceEntry = {
  title: string          // → {{title}}
  company: string        // → {{company}}
  location?: string      // → {{location}}
  startDate: string      // → {{startDate}}
  endDate: string        // → {{endDate}}
  description: string    // → {{description}}
  bullets: string[]      // → {{#each bullets}}
}
```

All optional fields (`phone?`, `summary?`, `location?`, `achievements?`) **must** be wrapped in `{{#if}}` guards. Missing optional sections must produce no HTML output — no empty headers, no `N/A` text. This is enforced in AC: missing sections are omitted entirely.

### CSS Architecture

**`:root` font-size: 10px** — This sets the rem baseline so all font sizes use clean integer rem values:
- 28px name = `2.8rem`
- 13px subtitle = `1.3rem`
- 11px section headers / company / title = `1.1rem`
- 10px body / dates / bullets = `1.0rem`
- 9.5px proficiency items = `0.95rem`

**CSS Grid for columns** — Not flexbox, not floats. CSS Grid is the required layout for the two-column resume. Float-based layouts break in print; flexbox column wrapping has known print issues.

```css
.resume {
  display: grid;
  grid-template-columns: var(--col-left) var(--col-right);
  gap: var(--space-lg);
}
```

**Theme injection point** — The template's default `:root` defines `--accent-color: #E8952A`. For non-amber themes, `renderer.ts` (Story 2.5) will prepend `<style>:root { --accent-color: #3B5F8A; --accent-dark: #2C4A6E; }</style>` to the HTML output. The template must not hardcode any accent color value outside of `:root`.

### Complete CSS Custom Properties Reference

```css
:root {
  /* Accent / brand */
  --accent-color: #E8952A;
  --accent-dark:  #C4771A;

  /* Text */
  --text-primary:   #1A1A1A;
  --text-secondary: #555555;
  --text-italic:    #444444;

  /* Background */
  --bg-primary: #FFFFFF;
  --divider:    #E0E0E0;

  /* Layout */
  --col-left:    27%;
  --col-right:   73%;
  --page-margin: 0.75in;

  /* Spacing scale */
  --space-xs: 4px;    /* bullet indent, icon-text gap */
  --space-sm: 8px;    /* within-entry spacing */
  --space-md: 14px;   /* between sections */
  --space-lg: 20px;   /* column gap, header margin */
  --space-xl: 28px;   /* header block bottom margin */

  /* Font */
  font-size: 10px;    /* rem baseline */
}
```

### Section Header `+` Pattern

The `+` prefix is implemented via CSS `::before` pseudo-element — **not** as a literal character in the HTML. This keeps the HTML clean and makes it easy to theme:

```css
.r-sh {
  font-size: 1.1rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-primary);
  margin-top: var(--space-md);
  margin-bottom: var(--space-sm);
  letter-spacing: 0.05em;
}

.r-sh::before {
  content: '+ ';
  color: var(--accent-color);
  font-weight: 700;
}
```

HTML: `<h2 class="r-sh">Experience</h2>` — no `+` in the HTML source.

### Geometric Accent Shape

The header accent shape (top-left decorative element) uses a positioned div with the accent color background. It should be a simple rectangle or trapezoid using CSS `clip-path` or `border` tricks — whatever matches the reference design aesthetic:

```css
.r-header-accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 120px;
  height: 8px;
  background-color: var(--accent-color);
}
```

Adjust dimensions to match visual reference. The `.r-header` parent needs `position: relative`.

### Experience Entry Structure

```html
{{#each experience}}
<div class="r-job">
  <div class="r-jtitle">{{title}} | {{company}}</div>
  <div class="r-jmeta">{{#if location}}{{location}} | {{/if}}{{startDate}} – {{endDate}}</div>
  {{#if description}}<p class="r-jdesc">{{description}}</p>{{/if}}
  {{#if bullets}}
  <ul class="r-jbullets">
    {{#each bullets}}<li>{{this}}</li>{{/each}}
  </ul>
  {{/if}}
</div>
{{/each}}
```

**`page-break-inside: avoid` on `.r-job`** — This is AC10 and critical for print fidelity. Without it, experience entries can split across pages mid-bullet-list.

### Contact Block with Icon Squares

The UX spec requires "14px icon square with accent background, white symbol." Since this is a static HTML template (no external icon library dependency allowed), use Unicode symbols for the icons:

```html
<div class="r-ci">
  <div class="r-icon">✆</div>
  <span>{{contact.phone}}</span>
</div>
```

Icon candidates: `✆` (phone), `✉` or `@` (email), `in` text (LinkedIn)

```css
.r-icon {
  width: 14px;
  height: 14px;
  background-color: var(--accent-color);
  color: #FFFFFF;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: var(--space-xs);
}
```

### Bullet Styling (`●`)

Large filled circle bullets for skills and achievement lists. **Do not use default list-style-type** — the UX spec specifies `●` explicitly, with the bullet at 6–7px. Use `::before` pseudo-element:

```css
.r-skills li,
.r-achiev li {
  list-style: none;
  padding-left: 1em;
  position: relative;
  font-size: 1.0rem;
  color: var(--text-primary);
}

.r-skills li::before,
.r-achiev li::before {
  content: '●';
  position: absolute;
  left: 0;
  font-size: 0.6rem;    /* 6px at rem baseline of 10px */
  color: var(--text-primary);
  top: 0.3em;
}
```

Experience bullets (`.r-jbullets`) use the same pattern.

### Compact Mode

`.compact` is added to the root `.resume` element when the `--compact` flag is passed. It overrides spacing tokens to fit more content per page:

```css
.compact {
  --space-xs: 2px;
  --space-sm: 4px;
  --space-md: 8px;
  --space-lg: 12px;
  --space-xl: 16px;
}
```

In `resume.html`, the root element: `<div class="resume {{#if compact}}compact{{/if}}">`. The `compact` boolean comes from the `ResumeContent` data passed by the renderer. Note: `renderer.ts` (Story 2.5) will handle injecting this flag; for now, the template just needs the class binding.

### Print Media Query (Critical for AC9)

The `@media print` block must be at the **bottom** of `styles.css` — never mixed with screen styles:

```css
@media print {
  @page {
    size: letter;
    margin: 0.75in;
  }

  .resume {
    width: 100%;
  }

  * {
    -webkit-print-color-adjust: exact;
    color-adjust: exact;
  }

  /* Remove screen-only elements if any */
  .no-print {
    display: none;
  }
}
```

**Both `color-adjust` and `-webkit-print-color-adjust` are required** — Chrome/Edge uses `-webkit-print-color-adjust` in older versions; the unprefixed `color-adjust` is the standard. Both ensure accent color and background fills render in PDF.

### HTML Document Template Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{name}} — Resume</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="resume {{#if compact}}compact{{/if}}">
    <!-- Header spans full width or is in right column -->
    <header class="r-header">
      <div class="r-header-accent"></div>
      <h1 class="r-name">{{name}}</h1>
      <p class="r-subtitle">{{subtitle}}</p>
    </header>

    <!-- Left column -->
    <aside class="r-left">
      <!-- Contact block -->
      <section>
        <h2 class="r-sh">Contact</h2>
        {{#if contact.phone}}
        <div class="r-ci"><div class="r-icon">✆</div><span>{{contact.phone}}</span></div>
        {{/if}}
        {{#if contact.email}}
        <div class="r-ci"><div class="r-icon">✉</div><span>{{contact.email}}</span></div>
        {{/if}}
        {{#if contact.linkedin}}
        <div class="r-ci"><div class="r-icon">in</div><span>{{contact.linkedin}}</span></div>
        {{/if}}
      </section>

      <!-- Skills -->
      {{#if skills}}
      <section>
        <h2 class="r-sh">Skills</h2>
        <ul class="r-skills">
          {{#each skills}}<li>{{this}}</li>{{/each}}
        </ul>
      </section>
      {{/if}}
    </aside>

    <!-- Right column -->
    <main class="r-right">
      {{#if summary}}
      <section>
        <h2 class="r-sh">Summary</h2>
        <p>{{summary}}</p>
      </section>
      {{/if}}

      <section>
        <h2 class="r-sh">Experience</h2>
        {{#each experience}}
        <div class="r-job">
          <div class="r-jtitle">{{title}} | {{company}}</div>
          <div class="r-jmeta">{{#if location}}{{location}} | {{/if}}{{startDate}} – {{endDate}}</div>
          {{#if description}}<p class="r-jdesc">{{description}}</p>{{/if}}
          {{#if bullets}}
          <ul class="r-jbullets">
            {{#each bullets}}<li>{{this}}</li>{{/each}}
          </ul>
          {{/if}}
        </div>
        {{/each}}
      </section>

      {{#if education}}
      <section>
        <h2 class="r-sh">Education</h2>
        {{#each education}}
        <div class="r-job">
          <div class="r-jtitle">{{degree}}</div>
          <div class="r-jmeta">{{institution}} | {{year}}</div>
        </div>
        {{/each}}
      </section>
      {{/if}}

      {{#if achievements}}
      <section>
        <h2 class="r-sh">Achievements</h2>
        <ul class="r-achiev">
          {{#each achievements}}<li>{{this}}</li>{{/each}}
        </ul>
      </section>
      {{/if}}
    </main>
  </div>
</body>
</html>
```

**Note on header positioning:** Depending on the reference design, the header may span the full width above both columns (requiring `grid-column: 1 / -1` on `.r-header`) or live in the right column only. Use full-width span for the header — this matches the two-column design where the header is a distinct top block.

Revised grid structure for full-width header:
```css
.resume {
  display: grid;
  grid-template-columns: var(--col-left) var(--col-right);
  grid-template-rows: auto 1fr;
  gap: var(--space-lg);
}

.r-header {
  grid-column: 1 / -1;  /* spans both columns */
}

.r-left  { grid-column: 1; }
.r-right { grid-column: 2; }
```

### Google Fonts Integration

Use `<link rel="preconnect">` for performance, then the actual font link. Load only weights 400 and 700 — these are the only weights used (normal body + bold for titles/section headers):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
```

CSS font-family declaration:
```css
body {
  font-family: 'Inter', 'Calibri', 'Segoe UI', system-ui, sans-serif;
  color: var(--text-primary);
  background-color: var(--bg-primary);
  margin: 0;
  padding: 0;
}
```

**Important:** Google Fonts requires internet access. The template works offline only with the fallback chain. The `renderer.ts` story (2.5) can optionally handle offline fallback by embedding fonts — defer that to Story 2.5.

### Architecture Compliance (Inherited from Story 1.1)

Story 1.2 is purely HTML/CSS/Handlebars — no TypeScript. However, these rules apply to how this template is used in future stories:

| Pattern | What to enforce |
|---------|-----------------|
| No hardcoded accent color | All color values via CSS custom properties only |
| No inline styles | All styling via CSS classes — never `style=""` attributes |
| No JavaScript in template | Pure HTML + CSS — zero JS in resume output |
| Handlebars only | No other templating syntax (`<%= %>`, `{{ }}` mustache without Handlebars helpers, etc.) |
| Optional field guards | Every `?` field in `ResumeContent` must have `{{#if}}` guard |

### Handlebars Syntax Reference

| Pattern | Usage |
|---------|-------|
| `{{name}}` | Simple variable substitution |
| `{{contact.phone}}` | Nested object access |
| `{{#if summary}}...{{/if}}` | Conditional block (omits content when falsy) |
| `{{#each experience}}...{{/each}}` | Array iteration (each item available as current context) |
| `{{#each bullets}}<li>{{this}}</li>{{/each}}` | Array of primitives — use `{{this}}` |
| `{{#if compact}}compact{{/if}}` | Conditional class name |

**Handlebars is already installed** (`"handlebars": "..."` in package.json from Story 1.1). No additional install needed.

### Verification Steps

Before marking done:

1. **Browser test:** Open `templates/default/resume.html` directly in Chrome with placeholder content substituted for all `{{tokens}}`. Verify layout, typography, colors, and section structure visually.
2. **Print preview:** Chrome → File → Print (or Ctrl+P) → verify the PDF preview matches the two-column layout. Check page margins, column widths, font sizes.
3. **Inspect tokens:** Use Chrome DevTools → Elements → Computed → verify CSS custom properties resolve to correct values.
4. **Compact check:** Add `class="resume compact"` to root div manually and verify spacing tightens.
5. **Token completeness:** Grep for `{{` in `resume.html` and confirm every token matches a field in `ResumeContent`.

### Previous Story Intelligence (from Story 1.1)

- **`handlebars` is installed** in `node_modules/` — referenced in `package.json` as a production dependency
- **No `display.ts` exists yet** — Story 1.3 creates it; Story 1.2 has no CLI output to worry about
- **`src/types.ts` defines `ResumeContent`** — the authoritative type that the template tokens must match
- **`src/pipeline/renderer.ts`** is a stub — will use `handlebars.compile()` on this template in Story 2.5
- **The `templates/` directory is NOT in `.gitignore`** — template files are checked into the repository
- **CJS output format** — TypeScript compiles to CommonJS; Handlebars in Node.js works identically in CJS mode
- No `src/display.ts` violations apply here — this story touches no TypeScript files

### References

- Story 1.2 acceptance criteria [Source: project Outline/epics-resume-forge.md#Story-1.2]
- CSS class names and component anatomy [Source: project Outline/ux-design-specification-resume-forge.md#Component-Strategy]
- CSS custom properties specification [Source: project Outline/ux-design-specification-resume-forge.md#Design-System-Foundation]
- Typography type scale [Source: project Outline/ux-design-specification-resume-forge.md#Typography-System]
- Spacing scale [Source: project Outline/ux-design-specification-resume-forge.md#Spacing-Layout-Foundation]
- Print media query requirement [Source: project Outline/ux-design-specification-resume-forge.md#Breakpoint-Strategy]
- Handlebars template pattern [Source: project Outline/architecture-resume-forge.md#HTML-Template-Injection]
- `ResumeContent` type definition [Source: resume-forge/src/types.ts]
- UX design directions and color themes [Source: project Outline/ux-design-specification-resume-forge.md#Design-Direction-Decision]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (BMad Dev — Amelia)

### Debug Log References

- Phone icon glyph set to `&#9742;` (☎) for an unambiguous telephone symbol; email uses `&#9993;` (✉), LinkedIn uses `in` text.

### Completion Notes List

- Created `templates/default/resume.html` and `templates/default/styles.css` — pure HTML/CSS/Handlebars, no TypeScript (per story scope).
- Two-column CSS grid (`--col-left` 27% / `--col-right` 73%) with a full-width header spanning `grid-column: 1 / -1`.
- Full CSS custom-property token set in `:root` (accent, text, background, layout, spacing scale) with `font-size: 10px` rem baseline; `.compact` overrides the spacing tokens.
- Header accent shape, 28px bold name (`2.8rem`), 13px italic subtitle (`1.3rem`).
- Section headers render `+ SECTION` via `.r-sh::before { content: '+ '; color: var(--accent-color); }` — no literal `+` in HTML.
- Experience entries: `.r-job` carries `page-break-inside: avoid` (AC10); title|company, location|date meta, description, `●` bullets via `::before`.
- Contact icon squares (14px accent background, white glyph); skills/achievements use `●` bullets.
- `@media print` at file bottom: `@page { size: letter; margin: 0.75in; }`, both `-webkit-print-color-adjust` and `color-adjust: exact`.
- Every `ResumeContent` optional field is wrapped in a `{{#if}}` guard; all dynamic insertion points use Handlebars tokens matching `src/types.ts`.
- Rendered in the Launch preview panel during development for visual confirmation.

### File List

- `templates/default/resume.html`
- `templates/default/styles.css`

### Change Log

- 2026-05-29: Story 1.2 created — HTML resume template with two-column layout, Handlebars tokens, print media query, compact mode
- 2026-05-29: Story 1.2 implemented — both template files created; all 12 ACs satisfied; status → review

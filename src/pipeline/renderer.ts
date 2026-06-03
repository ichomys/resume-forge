import Handlebars from 'handlebars'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { readConfig } from '../config.js'
import { readContact } from '../profile/index.js'
import { ResumeForgeError } from '../errors.js'
import type { GenerationSession, ResumeContent } from '../types.js'

/**
 * Replace every `<link rel="stylesheet" href="...">` in `html` with an inline
 * `<style>` block. Makes the output HTML self-contained regardless of where the
 * file is written (tmp dir for preview, output dir for final save).
 */
async function inlineCssLinks(html: string, templateDir: string): Promise<string> {
  const linkRe = /<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/gi
  const matches = [...html.matchAll(linkRe)]
  for (const match of matches) {
    const href = match[1]
    const cssPath = path.isAbsolute(href) ? href : path.join(templateDir, href)
    try {
      const css = await fs.readFile(cssPath, 'utf-8')
      html = html.replace(match[0], `<style>\n${css}\n</style>`)
    } catch {
      html = html.replace(match[0], `<!-- CSS not found: ${href} -->`)
    }
  }
  return html
}

type RenderOptions = { compact?: boolean }

/** Theme accent colors (UX-DR1). `amber` is the template default — no injection needed. */
const THEME_MAP: Record<string, { accent: string; dark: string }> = {
  amber: { accent: '#E8952A', dark: '#C47B1E' },
  'slate-blue': { accent: '#3B5F8A', dark: '#2C4A6E' },
  forest: { accent: '#2E6B47', dark: '#234F35' },
  charcoal: { accent: '#3D3D3D', dark: '#2A2A2A' },
}

/**
 * Compile the user's Handlebars template with the generated resume content, apply
 * the configured theme, and return the final HTML string. Pure with respect to the
 * session — returns a string and never mutates the session.
 */
export async function renderHTML(
  session: GenerationSession,
  options: RenderOptions = {},
): Promise<string> {
  const config = await readConfig()
  const templatePath = resolveTemplatePath(config.templatePath)
  const templateDir = path.dirname(templatePath)

  const templateSource = await fs.readFile(templatePath, 'utf-8')
  const template = loadTemplate(templateSource)

  // The template uses {{#if summary}} / {{#if achievements}} guards; normalize
  // empty optionals to undefined so no empty headers render. `compact` is passed
  // as template data — the template's `class="resume {{#if compact}}compact{{/if}}"`
  // handles the compact class (data-driven, deterministic).
  const content = session.generatedContent
  if (!content) {
    throw new Error('No generated content in session — generate before rendering.')
  }
  // Inject contact from the local contact.json — never from the LLM output.
  const storedContact = await readContact()
  const data = {
    ...content,
    contact: { ...(content.contact ?? {}), ...storedContact },
    summary: content.summary || undefined,
    achievements: content.achievements?.length ? content.achievements : undefined,
    compact: options.compact === true,
  }

  let html = template(data)
  html = await inlineCssLinks(html, templateDir)
  return injectTheme(html, config.theme ?? 'amber')
}

/** Compile a Handlebars template source string. */
export function loadTemplate(
  templateSource: string,
): HandlebarsTemplateDelegate<ResumeContent & { compact?: boolean }> {
  return Handlebars.compile(templateSource)
}

/**
 * Prepend a `:root` override `<style>` for non-amber themes. Amber is the template
 * default, so no injection occurs and the output is unchanged.
 */
export function injectTheme(html: string, theme: string): string {
  if (theme === 'amber' || !THEME_MAP[theme]) return html

  const { accent, dark } = THEME_MAP[theme]
  const styleBlock = `<style>:root { --accent-color: ${accent}; --accent-dark: ${dark}; }</style>\n`
  return styleBlock + html
}

/** Resolve a config template path (which may use `~/`) to an absolute path. Rejects `..` traversal sequences. */
function resolveTemplatePath(templatePath: string): string {
  if (templatePath.includes('..')) {
    throw new ResumeForgeError(
      'CONFIG_INVALID',
      `Template path must not contain '..': ${templatePath}`,
    )
  }
  return templatePath.startsWith('~/')
    ? path.join(os.homedir(), templatePath.slice(2))
    : path.resolve(templatePath)
}

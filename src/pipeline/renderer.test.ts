import * as os from 'os'
import * as path from 'path'
import * as realFs from 'fs/promises'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { ResumeContent } from '../types.js'

// Minimal template covering the root class, optional summary, and experience loop.
const TEST_TEMPLATE = `<html><body>
<div class="resume {{#if compact}}compact{{/if}}">
{{#if summary}}<section class="r-summary"><p>{{summary}}</p></section>{{/if}}
<main>{{#each experience}}<div class="r-job">{{title}}</div>{{/each}}</main>
{{#if achievements}}<section class="r-ach"><ul>{{#each achievements}}<li>{{this}}</li>{{/each}}</ul></section>{{/if}}
</div></body></html>`

const tmpHome = path.join(os.tmpdir(), `resume-forge-render-test-${Date.now()}`)
const templateFile = path.join(tmpHome, 'template.html')

let theme = 'amber'

vi.mock('../profile/index.js', () => ({
  readContact: vi.fn().mockResolvedValue({}),
}))

vi.mock('../config.js', () => ({
  readConfig: vi.fn(async () => ({
    model: 'claude-test',
    apiKeyEnvVar: 'X',
    outputDir: '~/out',
    templatePath: templateFile,
    theme,
  })),
}))

import { renderHTML, injectTheme, loadTemplate } from './renderer.js'
import { readConfig } from '../config.js'

const content: ResumeContent = {
  name: 'Jane Doe',
  subtitle: 'Senior Engineer',
  contact: { email: 'jane@example.com' },
  summary: 'A strong summary.',
  experience: [
    {
      title: 'Engineer',
      company: 'Acme',
      startDate: '2020',
      endDate: '2024',
      description: 'd',
      bullets: ['b1'],
    },
  ],
  skills: ['TS'],
  education: [],
}

function session(c: ResumeContent = content) {
  return { jdText: 'jd', jdConfirmed: true, resolvedGaps: {}, generatedContent: c }
}

describe('renderer', () => {
  beforeEach(async () => {
    theme = 'amber'
    await realFs.mkdir(tmpHome, { recursive: true })
    await realFs.writeFile(templateFile, TEST_TEMPLATE)
  })

  afterEach(async () => {
    await realFs.rm(tmpHome, { recursive: true, force: true })
  })

  it('amber theme produces no extra <style> prepend', async () => {
    theme = 'amber'
    const html = await renderHTML(session())
    expect(html.startsWith('<style>')).toBe(false)
    expect(html).toContain('r-job')
  })

  it('slate-blue theme prepends the correct <style> block', async () => {
    theme = 'slate-blue'
    const html = await renderHTML(session())
    expect(html.startsWith('<style>:root')).toBe(true)
    expect(html).toContain('--accent-color: #3B5F8A')
    expect(html).toContain('--accent-dark: #2C4A6E')
  })

  it('compact flag adds class="compact" to the root element', async () => {
    const html = await renderHTML(session(), { compact: true })
    expect(html).toContain('class="resume compact"')
    const plain = await renderHTML(session(), { compact: false })
    expect(plain).not.toContain('compact')
  })

  it('omits the summary section when summary is empty', async () => {
    const html = await renderHTML(session({ ...content, summary: '' }))
    expect(html).not.toContain('r-summary')
  })

  it('produces deterministic output for identical inputs', async () => {
    const a = await renderHTML(session())
    const b = await renderHTML(session())
    expect(a).toBe(b)
  })

  it('injectTheme is a no-op for amber and unknown themes', () => {
    expect(injectTheme('<html></html>', 'amber')).toBe('<html></html>')
    expect(injectTheme('<html></html>', 'unknown')).toBe('<html></html>')
  })

  it('loadTemplate compiles a usable delegate', () => {
    const t = loadTemplate('<p>{{name}}</p>')
    expect(t({ ...content, name: 'X' })).toBe('<p>X</p>')
  })

  it('inlines a linked stylesheet into a <style> block', async () => {
    const cssFile = path.join(tmpHome, 'styles.css')
    await realFs.writeFile(cssFile, 'body { color: red; }')
    const tplWithLink = path.join(tmpHome, 'template-with-css.html')
    await realFs.writeFile(
      tplWithLink,
      `<html><head><link rel="stylesheet" href="styles.css"></head><body>{{name}}</body></html>`,
    )
    vi.mocked(readConfig).mockResolvedValueOnce({
      version: 1,
      model: 'claude-test',
      apiKeyEnvVar: 'X',
      outputDir: '~/out',
      templatePath: tplWithLink,
      theme: 'amber',
    })

    const html = await renderHTML(session())
    expect(html).not.toContain('<link')
    expect(html).toContain('<style>')
    expect(html).toContain('body { color: red; }')
  })

  it('leaves a comment when linked CSS file is missing', async () => {
    const tplMissingCss = path.join(tmpHome, 'template-missing-css.html')
    await realFs.writeFile(
      tplMissingCss,
      `<html><head><link rel="stylesheet" href="nonexistent.css"></head><body>{{name}}</body></html>`,
    )
    vi.mocked(readConfig).mockResolvedValueOnce({
      version: 1,
      model: 'claude-test',
      apiKeyEnvVar: 'X',
      outputDir: '~/out',
      templatePath: tplMissingCss,
      theme: 'amber',
    })

    const html = await renderHTML(session())
    expect(html).not.toContain('<link')
    expect(html).toContain('<!-- CSS not found:')
  })
})

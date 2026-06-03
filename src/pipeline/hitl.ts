import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { execFile } from 'child_process'
import writeFileAtomic from 'write-file-atomic'
import { input } from '@inquirer/prompts'
import { readConfig } from '../config.js'
import { generateContent, extractRoleInfo } from './generator.js'
import { renderHTML } from './renderer.js'
import { append } from '../history/index.js'
import * as display from '../display.js'
import type { GenerationSession } from '../types.js'

type ReviewOptions = { compact?: boolean }

/**
 * Human-in-the-loop review loop: Open / Request changes / Approve & save.
 * Loops until the user approves, at which point the HTML is written atomically to
 * the configured output dir and the run is appended to history.
 */
export async function hitlReview(
  session: GenerationSession,
  htmlString: string,
  options: ReviewOptions = {},
): Promise<void> {
  const config = await readConfig()
  let html = htmlString
  let currentSession = session

  console.log()
  display.success('Draft ready.')

  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log('  [O] Open in browser  [R] Request changes  [A] Approve & save')
    const key = await readReviewKey()

    if (key === 'o') {
      const tmpPath = path.join(os.tmpdir(), `resume-forge-draft-${Date.now()}.html`)
      await fs.writeFile(tmpPath, html)
      openInBrowser(tmpPath)
    } else if (key === 'r') {
      const changeDesc = await readRevisionInput()
      const spin = display.spinner('Revising...')
      try {
        const revisionSession = {
          ...currentSession,
          resolvedGaps: { ...currentSession.resolvedGaps, __hitl_revision__: changeDesc },
        }
        currentSession = await generateContent(revisionSession)
        html = await renderHTML(currentSession, options)
        spin.succeed()
      } catch (e) {
        spin.fail()
        throw e
      }
    } else if (key === 'a') {
      const today = new Date()
      const dateStr = today.toISOString().split('T')[0]
      const outputPath = buildOutputPath(config.outputDir, currentSession, dateStr)
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await writeFileAtomic(outputPath, html)

      display.success(`Resume saved → ${outputPath}`)
      display.status('Run resume-forge review to reopen at any time.')

      const role = currentSession.generatedContent?.subtitle ?? 'unknown-role'
      await append({
        role,
        date: dateStr,
        alignmentScore: currentSession.alignment?.score ?? 0,
        outputPath,
        timestamp: today.toISOString(),
      })
      break
    }
  }
}

/** Construct `{outputDir}/{name}_{job-title}_{company}_{YYYY-MM-DD}.html`. Pass `dateStr` to share the date with the history append. */
export function buildOutputPath(
  outputDir: string,
  session: GenerationSession,
  dateStr?: string,
): string {
  const resolved = outputDir.startsWith('~/')
    ? path.join(os.homedir(), outputDir.slice(2))
    : path.resolve(outputDir)

  const toSlug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const name = toSlug(session.generatedContent?.name ?? '')
  const title = toSlug(session.generatedContent?.subtitle ?? '')
  const { company } = extractRoleInfo(session.jdText)
  const companySlug = toSlug(company)

  const parts = [name || 'resume', title, companySlug].filter(Boolean)
  const date = dateStr ?? new Date().toISOString().split('T')[0]

  return path.join(resolved, `${parts.join('_')}_${date}.html`)
}

/** Open a local file in the system default browser, cross-platform. */
export function openInBrowser(filePath: string): void {
  const url = `file://${filePath}`
  const platform = process.platform

  if (platform === 'win32') {
    execFile('cmd.exe', ['/c', 'start', '', url])
  } else if (platform === 'darwin') {
    execFile('open', [url])
  } else {
    execFile('xdg-open', [url])
  }
}

/** Prompt for a free-text change description (revision). */
async function readRevisionInput(): Promise<string> {
  return input({ message: '✦  Describe the changes you want:' })
}

/** Single-keypress reader (no Enter) for the O/R/A menu. */
async function readReviewKey(): Promise<'o' | 'r' | 'a'> {
  return new Promise((resolve) => {
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const handler = (key: string): void => {
      const k = key.toLowerCase()
      if (k === '\x03') {
        process.stdin.setRawMode?.(false)
        process.stdin.pause()
        process.stdin.removeListener('data', handler)
        process.exit(1)
      }
      if (k === 'o' || k === 'r' || k === 'a') {
        process.stdin.setRawMode?.(false)
        process.stdin.pause()
        process.stdin.removeListener('data', handler)
        resolve(k as 'o' | 'r' | 'a')
      }
    }

    process.stdin.on('data', handler)
  })
}

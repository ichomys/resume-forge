import * as fs from 'fs/promises'
import * as path from 'path'
import type { Command } from 'commander'
import Anthropic from '@anthropic-ai/sdk'
import { input } from '@inquirer/prompts'
import chalk from 'chalk'
import * as display from '../display.js'
import { readConfig, writeConfig, expandPath, CONFIG_DIR } from '../config.js'
import { load, loadBaseResume, updateContact } from '../profile/index.js'
import { ResumeForgeError } from '../errors.js'

const AMBER_PREFIX = chalk.hex('#E8952A')('✦')

// ── Helpers ──────────────────────────────────────────────────────────────────

async function detectExistingInstall(): Promise<boolean> {
  try {
    await fs.access(CONFIG_DIR)
    return true
  } catch {
    return false
  }
}

/**
 * Locate the repo's templates/default directory. Works in both built mode
 * (__dirname = bin/) and dev mode via tsx (__dirname = src/commands/).
 */
async function findTemplatesDir(): Promise<string> {
  const candidates = [
    path.join(__dirname, '..', 'templates', 'default'), // bin/ → ../templates
    path.join(__dirname, '..', '..', 'templates', 'default'), // src/commands → ../../templates
  ]
  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // try next candidate
    }
  }
  throw new ResumeForgeError(
    'FILE_NOT_FOUND',
    'Cannot locate templates directory. Ensure the package is installed correctly.',
  )
}

async function copyTemplates(): Promise<void> {
  const src = await findTemplatesDir()
  const dest = path.join(CONFIG_DIR, 'templates', 'default')
  await fs.mkdir(dest, { recursive: true })
  for (const file of ['resume.html', 'styles.css']) {
    await fs.copyFile(path.join(src, file), path.join(dest, file))
  }
}

// ── Wizard steps ─────────────────────────────────────────────────────────────

async function runStep1(isExisting: boolean): Promise<void> {
  display.status('Step 1/5 — LinkedIn profile')

  // On a re-run with an existing profile, allow Enter to keep it without re-parsing (Story 4.3 AC5).
  if (isExisting) {
    const profilePath = path.join(CONFIG_DIR, 'profile', 'linkedin-export.json')
    let profileExists = false
    try {
      await fs.access(profilePath)
      profileExists = true
    } catch {
      // not found — fall through to the required loop below
    }

    if (profileExists) {
      const linkedinPath = await input({
        message: 'Path to LinkedIn export ZIP or JSON (press Enter to keep existing):',
        theme: { prefix: AMBER_PREFIX },
      })
      if (!linkedinPath.trim()) {
        display.status('Keeping existing LinkedIn profile')
        return
      }
      try {
        await load(linkedinPath.trim().replace(/^["']|["']$/g, ''))
        return
      } catch {
        display.error(
          'Could not parse LinkedIn export.',
          'Provide the ZIP archive or JSON export from LinkedIn Settings → Data Privacy → Get a copy of your data.',
        )
        // Fall through to the standard retry loop below.
      }
    }
  }

  // Standard loop: required on first run, or if the profile file is missing on re-run.
  let done = false
  while (!done) {
    const linkedinPath = await input({
      message: 'Path to your LinkedIn export (ZIP archive or JSON file):',
      theme: { prefix: AMBER_PREFIX },
    })
    try {
      await load(linkedinPath.trim().replace(/^["']|["']$/g, ''))
      done = true
    } catch {
      display.error(
        'Could not parse LinkedIn export.',
        'Provide the ZIP archive or JSON export from LinkedIn Settings → Data Privacy → Get a copy of your data.',
      )
      // loop retries
    }
  }
}

async function runContactStep(): Promise<void> {
  display.status('Step 2/5 — Contact information')
  const phone = await input({
    message: 'Phone number (press Enter to skip):',
    theme: { prefix: AMBER_PREFIX },
  })
  const email = await input({
    message: 'Email address (press Enter to skip):',
    theme: { prefix: AMBER_PREFIX },
  })
  const linkedin = await input({
    message: 'LinkedIn profile URL (press Enter to skip):',
    theme: { prefix: AMBER_PREFIX },
  })

  const contact: { phone?: string; email?: string; linkedin?: string } = {}
  if (phone.trim()) contact.phone = phone.trim()
  if (email.trim()) contact.email = email.trim()
  if (linkedin.trim()) contact.linkedin = linkedin.trim()

  if (Object.keys(contact).length > 0) {
    await updateContact(contact)
  }
}

async function runStep2(): Promise<void> {
  display.status('Step 3/5 — Base resume (visual reference)')
  const resumePath = await input({
    message: 'Path to your base resume (PDF or DOCX), or press Enter to skip:',
    theme: { prefix: AMBER_PREFIX },
  })
  const cleanResumePath = resumePath.trim().replace(/^["']|["']$/g, '')
  if (cleanResumePath) {
    try {
      await loadBaseResume(cleanResumePath)
    } catch {
      display.error(
        'Could not read resume file.',
        'Check the path and try again. Continuing without base resume.',
      )
    }
  }
}

async function runStep3(model: string, apiKeyEnvVar: string): Promise<void> {
  display.status('Step 4/5 — Anthropic API key')
  let verified = false
  while (!verified) {
    display.status(`Set environment variable ${apiKeyEnvVar}, then press Enter`)
    await input({
      message: 'Press Enter when your API key env var is set:',
      theme: { prefix: AMBER_PREFIX },
    })
    const spin = display.spinner('Verifying API connection...')
    try {
      const apiKey = process.env[apiKeyEnvVar]
      if (!apiKey) {
        spin.fail()
        display.error(
          `${apiKeyEnvVar} is not set.`,
          'Set the env var and press Enter to retry.',
        )
        continue
      }
      const client = new Anthropic({ apiKey })
      await client.messages.create({
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      })
      spin.succeed()
      display.success('API connection verified')
      verified = true
    } catch {
      spin.fail()
      display.error(
        'API key not found or invalid.',
        `Check ${apiKeyEnvVar} is set to a valid key and press Enter to retry.`,
      )
    }
  }
}

async function runStep4(defaultOutputDir: string): Promise<string> {
  display.status('Step 5/5 — Output directory')
  const answer = await input({
    message: `Output directory [${defaultOutputDir}]:`,
    theme: { prefix: AMBER_PREFIX },
    default: defaultOutputDir,
  })
  const outputDir = answer.trim() || defaultOutputDir
  await fs.mkdir(expandPath(outputDir), { recursive: true })
  return outputDir
}

// ── Orchestration ────────────────────────────────────────────────────────────

export async function initAction(): Promise<void> {
  const existing = await detectExistingInstall()
  if (existing) {
    display.status('Updating config · Answer store preserved')
  }

  const config = await readConfig()

  await runStep1(existing)
  await runContactStep()
  await runStep2()
  await runStep3(config.model, config.apiKeyEnvVar)
  const outputDir = await runStep4(config.outputDir)

  await writeConfig({ ...config, outputDir })
  await copyTemplates()

  display.success('Ready — run resume-forge generate')
}

export function register(program: Command): void {
  program
    .command('init')
    .description('Run the setup wizard to configure Resume Forge')
    .action(initAction)
}

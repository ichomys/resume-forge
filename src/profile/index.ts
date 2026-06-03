import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import * as display from '../display.js'
import type { ExperiencePool } from '../types.js'
import { ResumeForgeError } from '../errors.js'
import { load, updateContact, readContact } from './linkedin.js'
import { loadBaseResume } from './resume.js'

const LINKEDIN_PATH = path.join(
  os.homedir(),
  '.resume-forge',
  'profile',
  'linkedin-export.json',
)

export { load, loadBaseResume, updateContact, readContact }

/**
 * Return the stored ExperiencePool. If no profile has been loaded, displays the
 * "no profile found" error and exits with code 2. Throws ResumeForgeError if the
 * stored profile exists but is corrupted.
 */
export async function getExperiencePool(): Promise<ExperiencePool> {
  let raw: string
  try {
    raw = await fs.readFile(LINKEDIN_PATH, 'utf-8')
  } catch {
    display.noProfile() // ✗ No profile found. → Run resume-forge init first.
    process.exit(2)
  }

  try {
    return JSON.parse(raw) as ExperiencePool
  } catch {
    throw new ResumeForgeError(
      'PROFILE_PARSE_FAILED',
      'Stored profile is corrupted. Re-run resume-forge init to reload your profile.',
    )
  }
}

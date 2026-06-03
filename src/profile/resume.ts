import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import * as display from '../display.js'
import { ResumeForgeError } from '../errors.js'

const PROFILE_DIR = path.join(os.homedir(), '.resume-forge', 'profile')

/**
 * Store the user's base resume (PDF or DOCX) as a visual reference under
 * ~/.resume-forge/profile/base-resume.{pdf|docx}. The file is copied as-is;
 * text extraction (pdf-parse / mammoth) is a future-story enhancement.
 */
export async function loadBaseResume(filePath: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase()

  if (ext !== '.pdf' && ext !== '.docx') {
    throw new ResumeForgeError(
      'PROFILE_PARSE_FAILED',
      `Unsupported file type: ${ext || '(none)'}. Use .pdf or .docx.`,
    )
  }

  try {
    await fs.access(filePath)
  } catch {
    throw new ResumeForgeError(
      'FILE_NOT_FOUND',
      `Resume file not found: ${filePath}`,
    )
  }

  await fs.mkdir(PROFILE_DIR, { recursive: true })
  const dest = path.join(PROFILE_DIR, `base-resume${ext}`)
  await fs.copyFile(filePath, dest)

  display.success('Resume stored as visual reference')
}

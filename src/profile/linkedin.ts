import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import AdmZip from 'adm-zip'
import writeFileAtomic from 'write-file-atomic'
import * as display from '../display.js'
import { ResumeForgeError } from '../errors.js'
import type { ExperiencePool, ExperienceEntry } from '../types.js'

const PROFILE_DIR = path.join(os.homedir(), '.resume-forge', 'profile')
const LINKEDIN_PATH = path.join(PROFILE_DIR, 'linkedin-export.json')

async function ensureProfileDir(): Promise<void> {
  await fs.mkdir(PROFILE_DIR, { recursive: true })
}

// ── CSV parser (RFC 4180, handles multi-line quoted fields) ──────────────────

export function parseCSVRaw(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i += 2
      } else if (ch === '"') {
        inQuotes = false
        i++
      } else {
        field += ch
        i++
      }
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
      } else if (ch === ',') {
        row.push(field)
        field = ''
        i++
      } else if (ch === '\r' && text[i + 1] === '\n') {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
        i += 2
      } else if (ch === '\n') {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
        i++
      } else {
        field += ch
        i++
      }
    }
  }

  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

export function parseCSV(text: string): Record<string, string>[] {
  const allRows = parseCSVRaw(text)
  if (allRows.length < 2) return []
  const headers = allRows[0].map((h) => h.trim())
  return allRows
    .slice(1)
    .map((values) => {
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => {
        row[h] = (values[idx] ?? '').trim()
      })
      return row
    })
    .filter((row) => Object.values(row).some((v) => v !== ''))
}

// ── ZIP loader ───────────────────────────────────────────────────────────────

function readZipEntry(zip: AdmZip, filename: string): string | null {
  const entry = zip
    .getEntries()
    .find(
      (e) =>
        e.entryName === filename ||
        e.entryName.toLowerCase().endsWith('/' + filename.toLowerCase()) ||
        e.entryName.toLowerCase() === filename.toLowerCase(),
    )
  return entry ? zip.readAsText(entry) : null
}

function loadFromZip(zipPath: string): ExperiencePool {
  let zip: AdmZip
  try {
    zip = new AdmZip(zipPath)
  } catch {
    throw new ResumeForgeError('PROFILE_PARSE_FAILED', 'Could not read ZIP file.')
  }

  const positionsCsv = readZipEntry(zip, 'Positions.csv')
  if (!positionsCsv) {
    throw new ResumeForgeError(
      'PROFILE_PARSE_FAILED',
      'Positions.csv not found in ZIP. Download the "Complete" archive from LinkedIn Settings → Data Privacy → Get a copy of your data.',
    )
  }

  const skillsCsv = readZipEntry(zip, 'Skills.csv')
  const educationCsv = readZipEntry(zip, 'Education.csv')
  const profileCsv = readZipEntry(zip, 'Profile.csv')

  const positions = parseCSV(positionsCsv)
  const skills = skillsCsv ? parseCSV(skillsCsv) : []
  const education = educationCsv ? parseCSV(educationCsv) : []

  const combined: Record<string, unknown> = {
    experience: positions,
    skills,
    education,
  }

  if (profileCsv) {
    const profileRows = parseCSV(profileCsv)
    if (profileRows.length > 0) {
      const p = profileRows[0]
      if (p['First Name']) combined['firstName'] = p['First Name']
      if (p['Last Name']) combined['lastName'] = p['Last Name']
    }
  }

  return parseLinkedin(combined)
}

// ── Multi-format parser ─────────────────────────────────────────────────────

/**
 * Parse a LinkedIn JSON export into an ExperiencePool. Intentionally lenient:
 * real exports vary in field casing and structure across versions. Throws
 * ResumeForgeError only when no recognizable format is found.
 */
export function parseLinkedin(raw: unknown): ExperiencePool {
  if (!raw || typeof raw !== 'object') {
    throw new ResumeForgeError(
      'PROFILE_PARSE_FAILED',
      'LinkedIn export is not a valid JSON object or array.',
    )
  }

  // Format 1: Array — treat as Experience.json directly
  if (Array.isArray(raw)) {
    const entries = raw
      .map(parseLinkedinEntry)
      .filter((e): e is ExperienceEntry => e !== null)
    if (entries.length === 0) {
      throw new ResumeForgeError(
        'PROFILE_PARSE_FAILED',
        'LinkedIn export array contained no recognizable experience entries.',
      )
    }
    return { entries, skills: [], education: [] }
  }

  const obj = raw as Record<string, unknown>

  // Format 2: Object with experience/skills/education keys (or positions)
  if (obj['experience'] || obj['Experience'] || obj['positions']) {
    return parseObjectFormat(obj)
  }

  // Format 3: A single experience entry wrapped in an object
  if (obj['Company Name'] || obj['title'] || obj['Title']) {
    const entry = parseLinkedinEntry(obj)
    if (entry) {
      return { entries: [entry], skills: [], education: [] }
    }
  }

  throw new ResumeForgeError(
    'PROFILE_PARSE_FAILED',
    'Unrecognized LinkedIn export format.',
  )
}

function parseLinkedinEntry(item: unknown): ExperienceEntry | null {
  if (!item || typeof item !== 'object') return null
  const e = item as Record<string, unknown>

  const title = String(e['Title'] ?? e['title'] ?? '')
  const company = String(
    e['Company Name'] ?? e['company'] ?? e['companyName'] ?? '',
  )

  if (!title && !company) return null

  return {
    title: title || 'Unknown Title',
    company: company || 'Unknown Company',
    location: e['Location'] ? String(e['Location']) : undefined,
    startDate: String(e['Started On'] ?? e['startDate'] ?? 'Unknown'),
    endDate: String(e['Finished On'] ?? e['endDate'] ?? 'Present'),
    description: String(e['Description'] ?? e['description'] ?? ''),
    bullets: [], // LinkedIn JSON has no bullet points; the LLM generates them
  }
}

function parseObjectFormat(obj: Record<string, unknown>): ExperiencePool {
  const rawExp = obj['experience'] ?? obj['Experience'] ?? obj['positions'] ?? []
  const rawSkills = obj['skills'] ?? obj['Skills'] ?? []
  const rawEdu = obj['education'] ?? obj['Education'] ?? []

  const entries = Array.isArray(rawExp)
    ? (rawExp
        .map(parseLinkedinEntry)
        .filter((e): e is ExperienceEntry => e !== null))
    : []

  const skills = Array.isArray(rawSkills)
    ? rawSkills
        .map((s: unknown) => {
          if (typeof s === 'string') return s
          const so = s as Record<string, unknown>
          return String(so['Name'] ?? so['name'] ?? so['skill'] ?? '')
        })
        .filter(Boolean)
    : []

  const education = Array.isArray(rawEdu)
    ? (rawEdu
        .map((e: unknown) => {
          if (!e || typeof e !== 'object') return null
          const ed = e as Record<string, unknown>
          return {
            degree: String(ed['Degree Name'] ?? ed['degree'] ?? ''),
            institution: String(
              ed['School Name'] ?? ed['school'] ?? ed['institution'] ?? '',
            ),
            year: String(ed['End Date'] ?? ed['endDate'] ?? ''),
          }
        })
        .filter(
          (e): e is { degree: string; institution: string; year: string } =>
            e !== null,
        ))
    : []

  const name =
    obj['firstName'] && obj['lastName']
      ? `${String(obj['firstName'])} ${String(obj['lastName'])}`
      : undefined

  return { name, entries, skills, education }
}

// ── Contact file (separate from the experience pool) ─────────────────────────

const CONTACT_PATH = path.join(PROFILE_DIR, 'contact.json')

export type ContactInfo = {
  phone?: string
  email?: string
  linkedin?: string
}

/**
 * Read the stored contact info. Returns an empty object when no contact file
 * exists yet — callers treat all fields as optional.
 */
export async function readContact(): Promise<ContactInfo> {
  try {
    const raw = await fs.readFile(CONTACT_PATH, 'utf-8')
    return JSON.parse(raw) as ContactInfo
  } catch {
    return {}
  }
}

/**
 * Merge `contact` into the stored contact.json, creating it if absent.
 * Only fields explicitly provided are updated; others are preserved.
 */
export async function updateContact(contact: ContactInfo): Promise<void> {
  await ensureProfileDir()
  const existing = await readContact()
  const updated: ContactInfo = { ...existing }
  if (contact.phone !== undefined) updated.phone = contact.phone
  if (contact.email !== undefined) updated.email = contact.email
  if (contact.linkedin !== undefined) updated.linkedin = contact.linkedin
  await writeFileAtomic(CONTACT_PATH, JSON.stringify(updated, null, 2))
}

// ── Public load() ────────────────────────────────────────────────────────────

export async function load(linkedinPath: string): Promise<ExperiencePool> {
  let pool: ExperiencePool

  if (linkedinPath.toLowerCase().endsWith('.zip')) {
    try {
      await fs.access(linkedinPath)
    } catch {
      throw new ResumeForgeError(
        'FILE_NOT_FOUND',
        `LinkedIn export not found at: ${linkedinPath}`,
      )
    }
    pool = loadFromZip(linkedinPath)
  } else {
    let raw: string
    try {
      raw = await fs.readFile(linkedinPath, 'utf-8')
    } catch {
      throw new ResumeForgeError(
        'FILE_NOT_FOUND',
        `LinkedIn export not found at: ${linkedinPath}`,
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new ResumeForgeError(
        'PROFILE_PARSE_FAILED',
        'LinkedIn export is not valid JSON.',
      )
    }

    pool = parseLinkedin(parsed)
  }

  await ensureProfileDir()
  await writeFileAtomic(LINKEDIN_PATH, JSON.stringify(pool, null, 2))

  display.success(`Profile loaded — ${pool.entries.length} entries indexed`)
  return pool
}

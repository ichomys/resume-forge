// History barrel — minimal append/getLastEntry API (Story 2.6); Story 4.4 extends it.
import * as fs from 'fs/promises'
import writeFileAtomic from 'write-file-atomic'
import * as display from '../display.js'
import { HISTORY_PATH, DATA_DIR, RunEntrySchema } from './schema.js'
import type { RunEntry } from './schema.js'

export type { RunEntry }
export { HISTORY_PATH, DATA_DIR, RunEntrySchema } from './schema.js'

/** Atomically append one run entry as a JSON line. Read-all + write-all via atomic rename. */
export async function append(entry: RunEntry): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })

  let existing = ''
  try {
    existing = await fs.readFile(HISTORY_PATH, 'utf-8')
  } catch {
    // File doesn't exist yet — start fresh.
  }

  const line = JSON.stringify(entry)
  const content = existing ? existing.trimEnd() + '\n' + line + '\n' : line + '\n'

  await writeFileAtomic(HISTORY_PATH, content)
}

/** Read the most recent run entry. Returns null when the file is missing/empty/corrupt. */
export async function getLastEntry(): Promise<RunEntry | null> {
  let content: string
  try {
    content = await fs.readFile(HISTORY_PATH, 'utf-8')
  } catch {
    return null
  }

  const lines = content.trim().split('\n').filter(Boolean)
  if (lines.length === 0) return null

  try {
    const parsed = JSON.parse(lines[lines.length - 1])
    return RunEntrySchema.parse(parsed)
  } catch {
    display.error(
      'Run history entry is corrupt.',
      'Check ~/.resume-forge/data/run-history.jsonl',
    )
    return null
  }
}

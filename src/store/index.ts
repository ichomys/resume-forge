import * as fs from 'fs/promises'
import writeFileAtomic from 'write-file-atomic'
import * as display from '../display.js'
import { DATA_DIR, STORE_PATH, migrate } from './schema.js'
import { normalizeKey, fuzzyMatch } from './matcher.js'
import type { AnswerEntry, AnswerStore } from './schema.js'

export type { AnswerEntry, AnswerStore }
export { normalizeKey, isValidKey, fuzzyMatch } from './matcher.js'

export async function read(): Promise<AnswerStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    return migrate(parsed)
  } catch (e: unknown) {
    if (isNotFound(e)) return { version: 1, entries: {} }
    throw e
  }
}

export async function get(topicKey: string): Promise<AnswerEntry | undefined> {
  const store = await read()
  const normalized = normalizeKey(topicKey)
  if (store.entries[normalized]) return store.entries[normalized]

  // LLM-generated keys drift across runs — fall back to fuzzy word-overlap match
  const fuzzyKey = fuzzyMatch(normalized, Object.keys(store.entries))
  return fuzzyKey ? store.entries[fuzzyKey] : undefined
}

export async function write(
  topicKey: string,
  data: { question: string; answer: string },
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const normalized = normalizeKey(topicKey)
  const store = await read()
  const existing = store.entries[normalized]
  const now = new Date().toISOString()

  store.entries[normalized] = existing
    ? { ...existing, answer: data.answer, lastUsed: now, usageCount: existing.usageCount + 1 }
    : { question: data.question, answer: data.answer, createdAt: now, usageCount: 1 }

  await writeFileAtomic(STORE_PATH, JSON.stringify(store, null, 2))
  display.status(`Answer saved to store (topic: ${normalized})`)
}

export async function update(topicKey: string, newAnswer: string): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const normalized = normalizeKey(topicKey)
  const store = await read()
  const existing = store.entries[normalized]
  if (!existing) return

  const now = new Date().toISOString()
  store.entries[normalized] = {
    ...existing,
    answer: newAnswer,
    lastUsed: now,
    usageCount: existing.usageCount + 1,
  }

  await writeFileAtomic(STORE_PATH, JSON.stringify(store, null, 2))
}

export async function remove(topicKey: string): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const normalized = normalizeKey(topicKey)
  const store = await read()
  delete store.entries[normalized]
  await writeFileAtomic(STORE_PATH, JSON.stringify(store, null, 2))
}

export async function clearAll(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await writeFileAtomic(STORE_PATH, JSON.stringify({ version: 1, entries: {} }, null, 2))
}

function isNotFound(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code: unknown }).code === 'ENOENT'
  )
}

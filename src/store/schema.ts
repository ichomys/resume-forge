import { z } from 'zod'
import * as path from 'path'
import * as os from 'os'

export const AnswerEntrySchema = z.object({
  question:   z.string(),
  answer:     z.string(),
  createdAt:  z.string(),
  usageCount: z.number().int().min(0),
  lastUsed:   z.string().optional(),
})

export const AnswerStoreSchema = z.object({
  version: z.literal(1),
  entries: z.record(z.string(), AnswerEntrySchema),
})

export type AnswerEntry = z.infer<typeof AnswerEntrySchema>
export type AnswerStore = z.infer<typeof AnswerStoreSchema>

export const DATA_DIR   = path.join(os.homedir(), '.resume-forge', 'data')
export const STORE_PATH = path.join(DATA_DIR, 'answer-store.json')

export function migrate(raw: unknown): AnswerStore {
  const result = AnswerStoreSchema.safeParse(raw)
  return result.success ? result.data : { version: 1, entries: {} }
}

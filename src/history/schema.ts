import { z } from 'zod'
import * as path from 'path'
import * as os from 'os'

export const RunEntrySchema = z.object({
  role: z.string(),
  company: z.string().optional(), // Story 4.4: schema-ready; not yet populated
  date: z.string(), // YYYY-MM-DD
  alignmentScore: z.number(),
  outputPath: z.string(),
  timestamp: z.string(), // ISO 8601
})

export type RunEntry = z.infer<typeof RunEntrySchema>

export const DATA_DIR = path.join(os.homedir(), '.resume-forge', 'data')
export const HISTORY_PATH = path.join(DATA_DIR, 'run-history.jsonl')

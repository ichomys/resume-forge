import type { Command } from 'commander'
import { input } from '@inquirer/prompts'
import * as display from '../display.js'
import { read, update, remove, clearAll, normalizeKey } from '../store/index.js'
import type { AnswerEntry } from '../store/index.js'

const TOPIC_HINT = 'Run resume-forge store list to see all stored topics'

// ── Subcommand actions ─────────────────────────────────────────────────────────

async function listAction(): Promise<void> {
  const store = await read()
  const entries = Object.entries(store.entries)

  if (entries.length === 0) {
    display.storeEmpty()
    return
  }

  const sorted = entries.sort(
    ([, a], [, b]) => sortKey(b).localeCompare(sortKey(a)),
  )

  for (const [topic, entry] of sorted) {
    const preview =
      entry.answer.length > 60 ? entry.answer.slice(0, 60) + '...' : entry.answer
    const last = (entry.lastUsed ?? entry.createdAt).slice(0, 10)
    console.log(`  [${topic}]  "${preview}" | used: ${entry.usageCount}x | last: ${last}`)
  }
}

async function editAction(options: { topic?: string }): Promise<void> {
  if (!options.topic) {
    display.error('--topic is required', TOPIC_HINT)
    process.exit(1)
  }

  const topic = normalizeKey(options.topic)
  const store = await read()
  const entry = store.entries[topic]

  if (!entry) {
    display.error('No entry found for topic: ' + topic, TOPIC_HINT)
    process.exit(1)
  }

  console.log('  Current: "' + entry.answer + '"')
  const newAnswer = await input({ message: '> ' })

  if (newAnswer.trim()) {
    await update(topic, newAnswer.trim())
    display.success('Entry updated: ' + topic)
  } else {
    display.status('No change made')
  }
}

async function clearAction(options: { topic?: string }): Promise<void> {
  if (options.topic) {
    const topic = normalizeKey(options.topic)
    await remove(topic)
    display.success('Cleared: ' + topic)
    return
  }

  display.prompt('Clear entire answer store? This cannot be undone. [y/N]')
  const confirmed = await readYesNoKey()
  if (confirmed) {
    await clearAll()
    display.success('Answer store cleared')
  } else {
    display.status('Cancelled')
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Sort key: prefer lastUsed, fall back to createdAt. ISO strings sort lexically. */
function sortKey(entry: AnswerEntry): string {
  return entry.lastUsed ?? entry.createdAt
}

/** Single-keypress y/N reader. Enter / n / any other key → false; Ctrl+C → exit. */
async function readYesNoKey(): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const handler = (key: string): void => {
      const k = key.toLowerCase()
      process.stdin.setRawMode?.(false)
      process.stdin.pause()
      process.stdin.removeListener('data', handler)
      if (k === '\x03') process.exit(1)
      resolve(k === 'y')
    }

    process.stdin.on('data', handler)
  })
}

// ── Registration ────────────────────────────────────────────────────────────

export function register(program: Command): void {
  const storeCmd = program.command('store').description('Manage stored gap answers')

  storeCmd
    .command('list')
    .description('List all stored answer entries')
    .action(listAction)

  storeCmd
    .command('edit')
    .description('Edit a stored answer by topic key')
    .option('--topic <key>', 'Topic key to edit')
    .action(editAction)

  storeCmd
    .command('clear')
    .description('Clear one or all stored answers')
    .option('--topic <key>', 'Topic key to clear (omit to clear all)')
    .action(clearAction)
}

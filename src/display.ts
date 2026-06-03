import chalk from 'chalk'
import ora from 'ora'
import type { Ora } from 'ora'

// Amber matches --accent-color in the HTML template (#E8952A)
const amber = chalk.hex('#E8952A')
const green = chalk.green
const gray = chalk.gray
const red = chalk.red

// prefix is "X  " = icon + 2 spaces = 3 visible characters
const PREFIX_WIDTH = 3

function wordWrap(text: string, indent: number = PREFIX_WIDTH): string {
  const cols = process.stdout.columns ?? 80
  const available = cols - indent
  if (available <= 0 || text.length <= available) return text

  const words = text.split(' ')
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length <= available) {
      line = candidate
    } else {
      if (line) lines.push(line)
      // A single word longer than available just goes on its own line
      line = word
    }
  }
  if (line) lines.push(line)

  // continuation lines are indented to align under the first character of text
  const pad = ' '.repeat(indent)
  return lines.join(`\n${pad}`)
}

export function prompt(msg: string): void {
  console.log(`${amber('✦')}  ${wordWrap(msg)}`)
}

export function success(msg: string): void {
  console.log(`${green('✓')}  ${wordWrap(msg)}`)
}

export function status(msg: string): void {
  console.log(`${gray('→')}  ${wordWrap(msg)}`)
}

export function error(msg: string, recovery?: string): void {
  console.error(`${red('✗')}  ${wordWrap(msg)}`)
  if (recovery) {
    console.error(`${gray('→')}  ${wordWrap(recovery)}`)
  }
}

export function spinner(msg: string): Ora {
  return ora({ text: msg, color: 'gray' }).start()
}

// ── Empty / first-run state convenience functions ─────────────────────────

export function noProfile(): void {
  error('No profile found.', 'Run resume-forge init first.')
}

export function linkedinNotLoaded(): void {
  error('LinkedIn profile not loaded.', 'Re-run resume-forge init to add your profile.')
}

export function storeEmpty(): void {
  status('Answer store is empty. Answers save automatically during resume-forge generate.')
}

export function noRecentRun(): void {
  error('No generated resume found.', 'Run resume-forge generate first.')
}

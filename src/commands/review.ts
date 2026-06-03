import type { Command } from 'commander'
import { execFile } from 'child_process'
import { getLastEntry } from '../history/index.js'
import * as display from '../display.js'

export function register(program: Command): void {
  program
    .command('review')
    .description('Reopen the most recently generated resume in your browser')
    .action(async () => {
      const entry = await getLastEntry()
      if (!entry) {
        display.noRecentRun()
        process.exit(1)
      }

      const url = `file://${entry.outputPath}`
      const platform = process.platform
      if (platform === 'win32') execFile('cmd.exe', ['/c', 'start', '', url])
      else if (platform === 'darwin') execFile('open', [url])
      else execFile('xdg-open', [url])

      display.status(`Opened: ${entry.outputPath}`)
    })
}

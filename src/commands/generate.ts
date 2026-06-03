import type { Command } from 'commander'
import {
  captureJD,
  captureRoleTitle,
  runAlignment,
  runGapLoop,
  generateContent,
  renderHTML,
  hitlReview,
} from '../pipeline/index.js'
import * as display from '../display.js'
import { ResumeForgeError } from '../errors.js'

export function register(program: Command): void {
  program
    .command('generate')
    .description('Generate a role-tailored resume')
    .option('--jd <file>', 'Path to job description file (.txt or .html)')
    .option('--role <title>', 'Use a role title as the generation target instead of a full JD')
    .option('--compact', 'Apply compact CSS class for content-dense layouts')
    .action(async (options: { jd?: string; role?: string; compact?: boolean }) => {
      try {
        let session = options.role
          ? await captureRoleTitle(options.role)
          : await captureJD(options.jd)

        const { session: s2, action } = await runAlignment(session)
        session = s2
        if (action === 'exit') process.exit(1)
        if (action === 'context') {
          session = await runGapLoop(session)
        }

        session = await generateContent(session)
        const html = await renderHTML(session, { compact: options.compact })
        await hitlReview(session, html, { compact: options.compact })
      } catch (e) {
        if (e instanceof ResumeForgeError) {
          display.error(e.message)
          process.exit(2)
        }
        throw e
      }
    })
}

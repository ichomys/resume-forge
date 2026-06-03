import 'dotenv/config'
import { Command } from 'commander'
import { register } from './commands/index.js'

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const { version } = require('../package.json') as { version: string }

const program = new Command()

program
  .name('resume-forge')
  .description('Role-tailored resume generator')
  .version(version)

register(program)

program.parse(process.argv)

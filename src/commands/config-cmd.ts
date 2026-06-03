import * as fs from 'fs/promises'
import type { Command } from 'commander'
import * as display from '../display.js'
import { readConfig, writeConfig, expandPath } from '../config.js'
import type { Config } from '../config.js'
import { ResumeForgeError } from '../errors.js'

const VALID_KEYS = [
  'model',
  'outputDir',
  'templatePath',
  'theme',
  'apiKeyEnvVar',
] as const
type ValidKey = (typeof VALID_KEYS)[number]

const VALID_THEMES = ['amber', 'slate-blue', 'forest', 'charcoal'] as const

export function register(program: Command): void {
  program
    .command('config [value]')
    .description('View or update Resume Forge configuration')
    .option('--show', 'Display all current settings')
    .option('--set <key>', 'Config key to update')
    .action(configAction)
}

async function configAction(
  value: string | undefined,
  options: { show?: boolean; set?: string },
): Promise<void> {
  try {
    const config = await readConfig()

    if (options.show) {
      showConfig(config)
      return
    }

    if (options.set) {
      if (!isValidKey(options.set)) {
        display.error(
          `Unknown config key: ${options.set}`,
          `Valid keys: ${VALID_KEYS.join(', ')}`,
        )
        process.exit(2)
      }
      if (value === undefined) {
        display.error(
          `No value provided for --set ${options.set}`,
          `Usage: resume-forge config --set ${options.set} <value>`,
        )
        process.exit(2)
      }
      const updated = await applySet(options.set, value, config)
      await writeConfig(updated)
      display.success(`${options.set} updated to ${value}`)
      return
    }

    // No flags — show usage hint
    display.status('Usage: resume-forge config --show | --set <key> <value>')
  } catch (err) {
    if (err instanceof ResumeForgeError) {
      display.error(err.message, 'Check your config with resume-forge config --show')
    } else {
      throw err
    }
    process.exit(2)
  }
}

function showConfig(config: Config): void {
  display.status('Current configuration:')
  // Indented key-value lines. The API key VALUE is never printed — only the
  // env var name (apiKeyEnvVar). This is the one acceptable console.log outside
  // display.ts: it is itself the display layer for the config command.
  console.log(`  version:      ${config.version}`)
  console.log(`  model:        ${config.model}`)
  console.log(`  outputDir:    ${config.outputDir}`)
  console.log(`  templatePath: ${config.templatePath}`)
  console.log(`  theme:        ${config.theme}`)
  console.log(`  apiKeyEnvVar: ${config.apiKeyEnvVar}`)
}

function isValidKey(key: string): key is ValidKey {
  return (VALID_KEYS as readonly string[]).includes(key)
}

async function applySet(
  key: ValidKey,
  value: string,
  config: Config,
): Promise<Config> {
  switch (key) {
    case 'theme':
      if (!(VALID_THEMES as readonly string[]).includes(value)) {
        throw new ResumeForgeError(
          'CONFIG_INVALID',
          `Invalid theme: ${value}. Valid themes: ${VALID_THEMES.join(', ')}`,
        )
      }
      return { ...config, theme: value as Config['theme'] }

    case 'outputDir': {
      const expanded = expandPath(value)
      await fs.mkdir(expanded, { recursive: true })
      return { ...config, outputDir: value } // store original (with ~)
    }

    case 'model':
    case 'templatePath':
    case 'apiKeyEnvVar':
      return { ...config, [key]: value }

    default: {
      const _never: never = key
      throw new ResumeForgeError('UNKNOWN_CONFIG_KEY', `Unknown key: ${String(_never)}`)
    }
  }
}

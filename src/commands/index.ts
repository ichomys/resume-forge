import type { Command } from 'commander'
import { register as registerInit } from './init.js'
import { register as registerConfig } from './config-cmd.js'
import { register as registerGenerate } from './generate.js'
import { register as registerReview } from './review.js'
import { register as registerStore } from './store.js'

export function register(program: Command): void {
  registerInit(program)
  registerConfig(program)
  registerGenerate(program)
  registerReview(program)
  registerStore(program)
}

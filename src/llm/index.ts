// LLM adapter barrel — populated in Story 2.2
import type { LLMAdapter } from './adapter.js'
import { AnthropicAdapter } from './anthropic.js'
import type { AdapterConfig } from './anthropic.js'

/** Construct the active LLM adapter from config. The only place a concrete provider is chosen. */
export function createAdapter(config: AdapterConfig): LLMAdapter {
  return new AnthropicAdapter(config)
}

export type { LLMAdapter }

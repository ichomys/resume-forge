import Anthropic from '@anthropic-ai/sdk'
import * as display from '../display.js'
import { ResumeForgeError, ERROR_CODES } from '../errors.js'
import type { LLMAdapter } from './adapter.js'
import type { AlignmentResult, ExperiencePool, ResumeContent } from '../types.js'
import { alignmentPrompt } from './prompts/alignment.js'
import { gapQuestionPrompt } from './prompts/gap-question.js'
import { resumePrompt } from './prompts/resume.js'

export type AdapterConfig = {
  model: string
  apiKeyEnvVar: string
}

export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic
  private model: string

  constructor(config: AdapterConfig) {
    const apiKey = process.env[config.apiKeyEnvVar]
    if (!apiKey) {
      display.error(
        `API key not found in environment: ${config.apiKeyEnvVar}`,
        `Set ${config.apiKeyEnvVar} in your environment and retry.`,
      )
      process.exit(2)
    }
    this.client = new Anthropic({ apiKey })
    this.model = config.model
  }

  async analyzeAlignment(
    jdText: string,
    pool: ExperiencePool,
    storedAnswers?: Record<string, string>,
  ): Promise<AlignmentResult> {
    const raw = await this.call(alignmentPrompt(jdText, pool, storedAnswers))
    return this.parseJSON<AlignmentResult>(raw, 'ALIGNMENT_FAILED')
  }

  async generateGapQuestion(
    gapKey: string,
    description: string,
    pool: ExperiencePool,
  ): Promise<string> {
    const raw = await this.call(gapQuestionPrompt(gapKey, description, pool))
    return raw.trim()
  }

  async generateResume(
    analysis: AlignmentResult,
    pool: ExperiencePool,
    answers: Record<string, string>,
  ): Promise<ResumeContent> {
    const raw = await this.call(resumePrompt(analysis, pool, answers))
    return this.parseJSON<ResumeContent>(raw, 'GENERATION_FAILED')
  }

  /**
   * Single Anthropic message round-trip. Handles rate limiting (429) and
   * network/timeout failures by displaying a friendly error and exiting with
   * code 2 — in-progress state is never partially mutated because callers only
   * assign the resolved value.
   */
  private async call(prompt: string): Promise<string> {
    try {
      const msg = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      const block = msg.content[0]
      if (!block || block.type !== 'text') {
        throw new ResumeForgeError(
          'API_UNAVAILABLE',
          'Unexpected response block type from Anthropic API',
        )
      }
      return block.text
    } catch (e: unknown) {
      if (isRateLimit(e)) {
        display.error('Rate limit reached.', 'Wait a moment and try again.')
        process.exit(2)
        throw new Error('unreachable')
      }
      display.error('API unavailable.', 'Check your connection and retry.')
      process.exit(2)
      throw new Error('unreachable')
    }
  }

  private parseJSON<T>(raw: string, errorCode: keyof typeof ERROR_CODES): T {
    // Strip markdown code fences — Claude sometimes wraps JSON in ```json blocks.
    const cleaned = raw
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim()
    try {
      return JSON.parse(cleaned) as T
    } catch {
      throw new ResumeForgeError(
        errorCode,
        `LLM returned invalid JSON: ${cleaned.slice(0, 100)}`,
      )
    }
  }
}

/** Duck-typed 429 detection — robust across SDK error-class shapes. */
function isRateLimit(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'status' in e &&
    (e as { status: unknown }).status === 429
  )
}

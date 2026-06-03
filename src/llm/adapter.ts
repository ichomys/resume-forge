import type { AlignmentResult, ExperiencePool, ResumeContent } from '../types.js'

/**
 * Thin LLM abstraction. All business logic depends on this interface, never on a
 * concrete provider — swapping models or providers requires no business-logic changes.
 */
export interface LLMAdapter {
  analyzeAlignment(
    jdText: string,
    pool: ExperiencePool,
    storedAnswers?: Record<string, string>,
  ): Promise<AlignmentResult>
  generateGapQuestion(
    gapKey: string,
    description: string,
    pool: ExperiencePool,
  ): Promise<string>
  generateResume(
    analysis: AlignmentResult,
    pool: ExperiencePool,
    answers: Record<string, string>,
  ): Promise<ResumeContent>
}

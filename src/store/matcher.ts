export function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isValidKey(key: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(key)
}

/**
 * Fuzzy-match a normalized key against a list of stored keys using Jaccard
 * word-overlap. Returns the best candidate above the threshold, or undefined.
 * Handles LLM-generated key drift (e.g. "kubernetes-experience" vs
 * "container-orchestration" for the same conceptual gap).
 */
export function fuzzyMatch(key: string, candidates: string[], threshold = 0.3): string | undefined {
  const keyWords = new Set(key.split('-').filter(Boolean))
  if (keyWords.size === 0) return undefined

  let bestKey: string | undefined
  let bestScore = 0

  for (const candidate of candidates) {
    const cWords = new Set(candidate.split('-').filter(Boolean))
    const intersection = [...keyWords].filter((w) => cWords.has(w)).length
    const union = new Set([...keyWords, ...cWords]).size
    const score = intersection / union
    if (score > threshold && score > bestScore) {
      bestScore = score
      bestKey = candidate
    }
  }

  return bestKey
}

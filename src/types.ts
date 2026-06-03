export type AlignmentResult = {
  score: number
  aligned: string[]
  gaps: string[]
  noMatch: string[]
  gapKeys: string[]
}

export type ExperienceEntry = {
  title: string
  company: string
  location?: string
  startDate: string
  endDate: string
  description: string
  bullets: string[]
}

export type ResumeContent = {
  name: string
  subtitle: string
  contact: {
    phone?: string
    email?: string
    linkedin?: string
  }
  summary?: string
  experience: ExperienceEntry[]
  skills: string[]
  education: Array<{ degree: string; institution: string; year: string }>
  achievements?: string[]
}

export type GapEntry = {
  key: string
  description: string
  question?: string
  answer?: string
}

export type GenerationSession = {
  jdText: string
  jdConfirmed: boolean
  alignment?: AlignmentResult
  resolvedGaps: Record<string, string>
  generatedContent?: ResumeContent
  approvedOutputPath?: string
}

export type ExperiencePool = {
  name?: string
  contact?: {
    phone?: string
    email?: string
    linkedin?: string
  }
  entries: ExperienceEntry[]
  skills: string[]
  education: Array<{ degree: string; institution: string; year: string }>
}

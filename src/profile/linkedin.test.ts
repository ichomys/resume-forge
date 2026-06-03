import { describe, it, expect } from 'vitest'
import { parseLinkedin, parseCSV, parseCSVRaw } from './linkedin.js'
import { ResumeForgeError } from '../errors.js'

describe('parseLinkedin', () => {
  it('parses an Experience.json array', () => {
    const raw = [
      {
        'Company Name': 'Acme Corp',
        Title: 'Software Engineer',
        'Started On': 'Jan 2020',
        'Finished On': 'Present',
        Description: 'Built things.',
        Location: 'Remote',
      },
      {
        'Company Name': 'Beta LLC',
        Title: 'Senior Engineer',
        'Started On': 'Feb 2018',
        'Finished On': 'Dec 2019',
        Description: 'Led a team.',
      },
    ]
    const pool = parseLinkedin(raw)
    expect(pool.entries).toHaveLength(2)
    expect(pool.entries[0].company).toBe('Acme Corp')
    expect(pool.entries[0].title).toBe('Software Engineer')
    expect(pool.entries[0].location).toBe('Remote')
    expect(pool.entries[1].endDate).toBe('Dec 2019')
  })

  it('parses an object with experience/skills/education keys', () => {
    const raw = {
      experience: [
        {
          company: 'Beta Inc',
          title: 'Dev',
          startDate: '2022',
          endDate: '2023',
          description: '',
        },
      ],
      skills: ['TypeScript', 'Node.js', { Name: 'Rust' }],
      education: [
        { 'School Name': 'MIT', 'Degree Name': 'BS CS', 'End Date': '2019' },
      ],
    }
    const pool = parseLinkedin(raw)
    expect(pool.entries).toHaveLength(1)
    expect(pool.skills).toContain('TypeScript')
    expect(pool.skills).toContain('Rust')
    expect(pool.education[0].institution).toBe('MIT')
    expect(pool.education[0].degree).toBe('BS CS')
  })

  it('extracts name from firstName/lastName object format', () => {
    const raw = {
      firstName: 'Jane',
      lastName: 'Doe',
      positions: [{ title: 'PM', company: 'Co' }],
    }
    const pool = parseLinkedin(raw)
    expect(pool.name).toBe('Jane Doe')
    expect(pool.entries).toHaveLength(1)
  })

  it('throws ResumeForgeError for non-object input', () => {
    expect(() => parseLinkedin('not json')).toThrow(ResumeForgeError)
    expect(() => parseLinkedin(null)).toThrow(ResumeForgeError)
    expect(() => parseLinkedin(42)).toThrow(ResumeForgeError)
  })

  it('throws ResumeForgeError for unrecognized object format', () => {
    expect(() => parseLinkedin({ someRandomKey: true })).toThrow(
      ResumeForgeError,
    )
  })
})

describe('parseCSV', () => {
  it('parses a simple CSV', () => {
    const csv = 'Company Name,Title,Started On\nAcme,Engineer,Jan 2020\nBeta,Lead,Mar 2018'
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]['Company Name']).toBe('Acme')
    expect(rows[0]['Title']).toBe('Engineer')
    expect(rows[1]['Started On']).toBe('Mar 2018')
  })

  it('handles quoted fields with commas', () => {
    const csv = 'Name,Description\nAcme,"Built things, deployed things"'
    const rows = parseCSV(csv)
    expect(rows[0]['Description']).toBe('Built things, deployed things')
  })

  it('handles escaped double-quotes inside quoted fields', () => {
    const csv = 'Name,Note\nAcme,"Said ""hello"" today"'
    const rows = parseCSV(csv)
    expect(rows[0]['Note']).toBe('Said "hello" today')
  })

  it('handles CRLF line endings', () => {
    const csv = 'A,B\r\n1,2\r\n3,4'
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(2)
    expect(rows[1]['A']).toBe('3')
  })

  it('skips empty rows', () => {
    const csv = 'Name,Title\nAcme,Dev\n\n'
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
  })

  it('returns empty array for header-only CSV', () => {
    expect(parseCSV('Name,Title')).toHaveLength(0)
  })
})

describe('parseLinkedin with CSV-shaped data (ZIP simulation)', () => {
  it('parses Positions.csv rows as experience entries', () => {
    const positions = [
      { 'Company Name': 'Acme', Title: 'Dev', 'Started On': 'Jan 2020', 'Finished On': 'Present', Description: 'Built stuff', Location: 'NYC' },
    ]
    const skills = [{ Name: 'TypeScript' }, { Name: 'Python' }]
    const education = [{ 'School Name': 'MIT', 'Degree Name': 'BS', 'End Date': '2018' }]
    const pool = parseLinkedin({ experience: positions, skills, education, firstName: 'Jane', lastName: 'Doe' })
    expect(pool.entries[0].company).toBe('Acme')
    expect(pool.entries[0].location).toBe('NYC')
    expect(pool.skills).toContain('TypeScript')
    expect(pool.education[0].institution).toBe('MIT')
    expect(pool.name).toBe('Jane Doe')
  })
})

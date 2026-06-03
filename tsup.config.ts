import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { 'resume-forge': 'src/index.ts' },
  format: ['cjs'],
  outDir: 'bin',
  clean: true,
  shims: true,
  banner: { js: '#!/usr/bin/env node' },
})

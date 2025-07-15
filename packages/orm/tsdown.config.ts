import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/*/index.ts'],
  format: ['esm', 'cjs'],
  target: 'es2020',
  dts: true,
  sourcemap: true,
  fixedExtension: true,
  outDir: 'dist',
  external: [
    'typeorm',
    'reflect-metadata',
    'commander',
    'pg',
    'graphql',
  ],
})

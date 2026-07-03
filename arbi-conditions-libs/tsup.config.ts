import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Keep output as one file per format so the exports map stays simple.
  splitting: false,
  target: 'es2022',
});

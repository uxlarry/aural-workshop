/// <reference types='vitest' />
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/packages/audio/engine',
  plugins: [tsconfigPaths({ root: '../../..' })],
  test: {
    name: 'audio-engine',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/packages/audio/engine',
      provider: 'v8' as const,
    },
  },
}));

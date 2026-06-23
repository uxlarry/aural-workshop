/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/packages/audio/model',
  test: {
    name: 'audio-model',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/packages/audio/model',
      provider: 'v8' as const,
    },
  },
}));

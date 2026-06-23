/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/packages/audio/orchestration',
  plugins: [nxViteTsPaths()],
  test: {
    name: 'audio-orchestration',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/packages/audio/orchestration',
      provider: 'v8' as const,
    },
  },
}));

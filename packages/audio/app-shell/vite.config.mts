/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/packages/audio/app-shell',
  plugins: [
    angular({
      tsconfig: resolve(__dirname, 'tsconfig.lib.json'),
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'audio-app-shell',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/packages/audio/app-shell',
      provider: 'v8' as const,
    },
  },
}));

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
    root: '.',
    environment: 'node',
    globals: true,
  },
  plugins: [swc.vite()],
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    env: { NODE_ENV: 'test', JWT_SECRET: 'test-only-auth-secret-with-at-least-32-bytes', JWT_EXPIRES_IN: '8h' },
    root: './',
    include: ['**/*.spec.ts'],
  },
});

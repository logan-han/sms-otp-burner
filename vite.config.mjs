import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // serverless offline and the Playwright webServer both expect 3000.
  server: { port: 3000 },
  preview: { port: 3000 },
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        // The Lambda serves the build directory and its httpApi routes are
        // /static/js, /static/css and /static/media, so keep CRA's layout.
        entryFileNames: 'static/js/[name].[hash].js',
        chunkFileNames: 'static/js/[name].[hash].js',
        assetFileNames: (asset) => {
          const name = asset.names?.[0] ?? asset.name ?? '';
          return name.endsWith('.css')
            ? 'static/css/[name].[hash][extname]'
            : 'static/media/[name].[hash][extname]';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // The backend suite stays on jest (see jest.backend.config.js).
    include: ['src/__tests__/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/index.js', 'src/__tests__/**', 'src/handler.js', 'src/lib/**'],
    },
  },
});

import { describeMe } from '@describe-me/vitest/plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serwuje aplikację pod ścieżką repozytorium. Wartość musi zaczynać się i kończyć na /.
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    tailwindcss(),
    describeMe({
      include: ['src/components/Scoreboard.test.tsx', 'src/components/Keypad.test.tsx', 'src/components/MatchEndView.test.tsx'],
    }),
  ],
  server: {
    // Tablet w sieci lokalnej otwiera stronę po adresie IP komputera.
    host: true,
    // Proxy zamiast CORS: front i API są pod jednym adresem, także dla WebSocketa.
    proxy: {
      '/api': {
        target: process.env.AUTOSCORE_API_URL ?? 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});

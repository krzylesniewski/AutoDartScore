import { describeMe } from '@describe-me/vitest/plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Testy .ts, które potrzebują jsdom: używają localStorage albo renderHook. Pozostałe .ts działają w node, bez kosztu jsdom.
const DOM_TESTS = [
  'src/api/session.test.ts',
  'src/api/use-match.test.ts',
  'src/components/shortcut-target.test.ts',
  'src/game/keypad-layout.test.ts',
  'src/game/stats-period.test.ts',
  'src/game/use-now.test.ts',
  'src/game/use-undo-window.test.ts',
];

export default defineConfig({
  // Build może działać pod podścieżką serwera. Wartość musi zaczynać się i kończyć na /.
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
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: DOM_TESTS,
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
          include: ['src/**/*.test.tsx', ...DOM_TESTS],
        },
      },
    ],
  },
});

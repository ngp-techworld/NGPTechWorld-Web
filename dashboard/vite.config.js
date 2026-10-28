import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_DEV_PROXY_TARGET (set in a local, gitignored .env.local) lets a single developer point their dev
// server at a different backend — e.g. the live production API — without touching this shared file.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    // Deployed behind the public site's domain (see ../vercel.json's rewrite + src/app/App.jsx's
    // `basename`) — every asset URL must carry that prefix, so the browser (whose address bar shows the main
    // site's origin) requests <prefix>/assets/... instead of /assets/....
    //
    // Not /admin. That is the first path every automated scanner tries, and robots.txt used to name it
    // outright, which advertised it rather than hid it. This is the single place the prefix is written:
    // App.jsx reads it back through import.meta.env.BASE_URL, and the two vercel.json files route it.
    // It buys quiet, not safety — the login and the token are what protect the dashboard.
    base: '/ngp-hq/',
    resolve: {
      // `@/ui`, `@/lib/api`, `@/i18n`… resolve from src/ (mirrored in jsconfig.json for editors)
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    // every feature is bundled eagerly (see docs/UI-KIT.md, known limits) — silence the 500 kB advisory until it matters
    build: { chunkSizeWarningLimit: 900 },
    server: {
      port: 5174,
      strictPort: true,
      proxy: { '/api': { target: env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: true } },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      css: false,
      // whole forms are filled in and saved in one test, and the suite runs its files in parallel: under that load a
      // 4-second form test (offers, team) used to cross the 5-second default now and then
      testTimeout: 15_000,
    },
  }
})

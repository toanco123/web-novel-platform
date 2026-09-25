import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Prefix '' để đọc cả biến không có VITE_ (PORT, HOST chỉ dùng cho dev server, không lộ ra client)
  const env = loadEnv(mode, process.cwd(), '')
  const server = {
    host: env.HOST || 'localhost',
    port: Number(env.PORT) || 3000,
    strictPort: true,
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server,
    preview: server,
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
    },
  }
})

import { defineConfig } from 'vite'
import build from '@hono/vite-build/node'
import devServer from '@hono/vite-dev-server'

export default defineConfig({
  server: {
    port: 3100,
  },
  plugins: [
    build({
      entry: './src/index.ts',
    }),
    devServer({
      entry: './src/index.ts',
    }),
  ],
})

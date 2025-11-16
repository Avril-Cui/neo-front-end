import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins = [vue(), vueJsx()]

  // Only load and enable devtools in development mode
  if (mode === 'development') {
    const vueDevTools = (await import('vite-plugin-vue-devtools')).default
    plugins.push(vueDevTools())
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/diary',   // ← change to '/' for custom domain (was '/diary/' for github.io/diary)
})
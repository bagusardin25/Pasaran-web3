import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Port 5177 keeps this dev server apart from the other projects'.
export default defineConfig({
  plugins: [react()],
  server: { port: 5177, strictPort: true },
  preview: { port: 4177, strictPort: true },
})

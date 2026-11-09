import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // three.js is loaded on demand in its own chunk when the aim dialog opens
  build: { chunkSizeWarningLimit: 800 },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Needed for file:// loading inside packaged Electron apps
  base: './',
  build: {
    outDir: 'dist'
  }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React app lives in app/, but during the move it reuses files from the
// old app one folder up (content files, style.css), so Vite may read from '..'.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, fs: { allow: ['..'] } },
  build: { outDir: 'dist', emptyOutDir: true },
});

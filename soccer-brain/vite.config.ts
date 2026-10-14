import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The studio UI. `public/` is shared with Remotion so staticFile() paths work in the Player.
export default defineConfig({
  root: path.resolve(__dirname, 'src/app'),
  publicDir: false,
  plugins: [react()],
  build: {outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true, chunkSizeWarningLimit: 2000},
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/output': 'http://127.0.0.1:8000',
      '/tts': 'http://127.0.0.1:8000',
      '/img': 'http://127.0.0.1:8000',
      '/flags': 'http://127.0.0.1:8000',
      '/fonts': 'http://127.0.0.1:8000',
      '/audio': 'http://127.0.0.1:8000',
    },
  },
});

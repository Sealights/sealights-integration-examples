import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import istanbulPlugin from 'vite-plugin-istanbul';

export default defineConfig({
  plugins: [
      react(),
      istanbulPlugin(),
  ],
  server: {
    port: 5173,
  },
  build: {
    sourcemap: true
  },
});


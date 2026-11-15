import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/components/ui/button" → src/components/ui/button (also set in tsconfig.json)
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  // Pre-bundling breaks onnxruntime-web's loading of its .wasm files
  optimizeDeps: { exclude: ['onnxruntime-web'] },
});

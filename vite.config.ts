import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Support base path for subdirectory deployments (e.g., /dev/)
    const basePath = process.env.VITE_BASE_PATH || '/';
    
    return {
      base: basePath,
      server: {
        port: 5173,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.VITE_BASE_PATH': JSON.stringify(basePath),
      },
      build: {
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
        },
        rollupOptions: {
          input: 'index.html',
          output: {
            manualChunks: {
              'vendor': [
                'react',
                'react-dom',
                'react-router-dom',
              ],
              'ui': [
                'lucide-react',
              ],
            },
            chunkFileNames: 'assets/[name]-[hash].js',
            entryFileNames: 'assets/[name]-[hash].js',
          },
        },
        chunkSizeWarningLimit: 600,
        reportCompressedSize: false,
        cssCodeSplit: true,
      },
      optimize: {
        exclude: [],
      },
    };
});


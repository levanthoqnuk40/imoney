import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // Base path for GitHub Pages (repo name)
    base: '/imoney/',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // Note: VITE_ prefixed vars are automatically exposed via import.meta.env
      // No need to define them here, but ensure .env.local has:
      // VITE_SUPABASE_URL=your_url
      // VITE_SUPABASE_ANON_KEY=your_key
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      outDir: 'dist',
      // Code splitting to reduce bundle size
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'charts': ['recharts'],
            'supabase': ['@supabase/supabase-js']
          }
        }
      },
      chunkSizeWarningLimit: 600
    }
  };
});

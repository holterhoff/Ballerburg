import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Online-Spiel: nur die ÖFFENTLICHEN Supabase-Werte übernehmen, egal mit welchem Präfix sie angelegt sind.
  // Secret- oder Service-Role-Keys werden bewusst nie gelesen.
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '';
  const supabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return {
    plugins: [react()],
    server: { port: 5173 },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0'),
      __SUPABASE_URL__: JSON.stringify(supabaseUrl),
      __SUPABASE_KEY__: JSON.stringify(supabaseKey),
    },
    // three.js is loaded on demand in its own chunk when the aim dialog opens
    build: { chunkSizeWarningLimit: 800 },
  };
});

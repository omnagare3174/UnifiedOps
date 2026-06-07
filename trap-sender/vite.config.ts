import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// ---------------------------------------------------------------------------
// Trap-Sender dev server.
//
// Standalone React 19 + Vite app — NOT bundled into the production
// UnifiedOps build. The trap sender is a developer / lab tool that
// pushes synthetic syslog traps into the per-vendor UDP listeners so
// the dashboard pipeline has data to render in dev.
//
// `/api/*` is reverse-proxied to the FastAPI trap-sender backend
// (`dev/trap_sender_ui.py`) which fronts the actual UDP socket. The
// browser cannot speak UDP directly, so all sends go through that
// backend.
// ---------------------------------------------------------------------------
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_TRAP_API_TARGET ?? 'http://127.0.0.1:7700';

  return {
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler', { target: '19' }]],
        },
      }),
    ],
    server: {
      host: '0.0.0.0',
      port: 7780,
      proxy: {
        '/api':  { target: apiTarget, changeOrigin: true, secure: false },
        '/healthz': { target: apiTarget, changeOrigin: true, secure: false },
      },
    },
  };
});

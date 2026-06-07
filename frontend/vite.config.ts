import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const cdvlTarget = env.VITE_DEV_INFLUX_CDVL_TARGET ?? 'http://127.0.0.1:8086';
  const bcpTarget  = env.VITE_DEV_INFLUX_BCP_TARGET  ?? 'http://127.0.0.1:8087';
  const sifyTarget = env.VITE_DEV_INFLUX_SIFY_TARGET ?? 'http://127.0.0.1:8088';
  const apiTarget  = env.VITE_DEV_API_TARGET         ?? 'http://127.0.0.1:8001';
  const trapTarget = env.VITE_DEV_TRAP_UI_TARGET     ?? 'http://127.0.0.1:7700';

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
      port: 3000,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        '/trap': {
          target: trapTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/trap/, ''),
        },
        '/influx-sify': {
          target: sifyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/influx-sify/, ''),
        },
        '/influx-bcp': {
          target: bcpTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/influx-bcp/, ''),
        },
        '/influx': {
          target: cdvlTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/influx/, ''),
        },
      },
    },
  };
});

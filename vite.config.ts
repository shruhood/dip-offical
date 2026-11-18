import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '');
  const disableHmr = env.DISABLE_HMR === 'true' || process.env.DISABLE_HMR === 'true';

  return {
    base: '/',
    publicDir: 'public',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
      dedupe: ['react', 'react-dom', 'react-is'],
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/react-is/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (
              id.includes('node_modules/@firebase/firestore') ||
              id.includes('node_modules/firebase/firestore') ||
              id.includes('node_modules/@firebase/webchannel-wrapper')
            ) {
              return 'vendor-firestore';
            }
            if (
              id.includes('node_modules/@firebase/auth') ||
              id.includes('node_modules/firebase/auth')
            ) {
              return 'vendor-firebase-auth';
            }
            if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
              return 'vendor-firebase';
            }
            if (
              id.includes('/node_modules/recharts/') ||
              id.includes('/node_modules/d3-') ||
              id.includes('/node_modules/victory-vendor/') ||
              id.includes('/node_modules/es-toolkit/') ||
              id.includes('/node_modules/@reduxjs/') ||
              id.includes('/node_modules/react-redux/') ||
              id.includes('/node_modules/immer/')
            ) {
              return 'vendor-charts';
            }
            if (id.includes('/node_modules/pdfjs-dist/')) {
              return 'vendor-pdfjs';
            }
            if (id.includes('/node_modules/pdf-lib/') || id.includes('/node_modules/@pdf-lib/')) {
              return 'vendor-pdf-lib';
            }
            if (id.includes('/node_modules/xlsx/') || id.includes('/node_modules/cfb/')) {
              return 'vendor-xlsx';
            }
            if (id.includes('/node_modules/tesseract.js')) {
              return 'vendor-ocr';
            }
            if (
              id.includes('/node_modules/jszip/') ||
              id.includes('/node_modules/qrcode/') ||
              id.includes('/node_modules/jsqr/') ||
              id.includes('/node_modules/jsbarcode/')
            ) {
              return 'vendor-doc-utils';
            }
            return undefined;
          },
        },
      },
    },
    worker: {
      format: 'es',
    },
    server: {
      host: '0.0.0.0',
      port: Number(env.PORT || process.env.PORT || 3000),
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: !disableHmr,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: disableHmr ? null : {},
    },
  };
});

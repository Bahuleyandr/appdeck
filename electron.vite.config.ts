import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          bridge: resolve(__dirname, 'src/preload/bridge.ts'),
          service: resolve(__dirname, 'src/preload/service-preload.ts'),
          quickview: resolve(__dirname, 'src/preload/quickview.ts')
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          // Main window plus the tray quick-view popover page.
          index: resolve(__dirname, 'src/renderer/index.html'),
          quickview: resolve(__dirname, 'src/renderer/quickview.html')
        }
      }
    }
  }
});

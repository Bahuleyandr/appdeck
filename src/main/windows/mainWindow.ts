import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { APP_NAME } from '../../shared/constants.js';

export function createMainWindow(preloadPath: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    title: APP_NAME,
    icon: join(__dirname, '../../build/icon.png'),
    backgroundColor: '#101216',
    show: false,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });

  window.once('ready-to-show', () => window.show());

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    void window.loadURL(rendererUrl);
  } else {
    // Strict CSP for the packaged shell. Service views run in separate partitions, so this only
    // constrains AppDeck's own UI. Skipped in dev because it would block Vite's HMR client.
    window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'"
          ]
        }
      });
    });
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}

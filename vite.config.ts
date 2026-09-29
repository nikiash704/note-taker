import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // CodeMirror + KaTeX make the editor chunk ~800 kB (~275 kB gzipped).
    // That's expected for this app, so don't warn about it.
    chunkSizeWarningLimit: 1000,
  },
});

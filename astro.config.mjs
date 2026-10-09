import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://sshkeygen.dev',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [svelte(), sitemap()],
  markdown: { syntaxHighlight: false },
  compressHTML: false,
  server: { allowedHosts: ['test.mbserver.org'] },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'none'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ],
    },
  },
  vite: {
    worker: { format: 'es' },
  },
});

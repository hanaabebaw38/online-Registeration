import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(projectRoot, 'index.html'),
        about: resolve(projectRoot, 'about.html'),
        campuses: resolve(projectRoot, 'campuses.html'),
        administration: resolve(projectRoot, 'administration.html'),
        academic: resolve(projectRoot, 'academic.html'),
        registration: resolve(projectRoot, 'registration.html'),
        admin: resolve(projectRoot, 'admin.html')
      }
    }
  }
});
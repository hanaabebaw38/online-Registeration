import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const githubPagesMode = process.env.GITHUB_PAGES === 'true';

const githubPagesPaths = {
  name: 'github-pages-project-paths',
  transformIndexHtml(html) {
    if (!githubPagesMode) return html;
    return html.replace(/(href|src|data-image)="\/(?!online-Registeration\/|\/)/g, '$1="./');
  }
};

export default defineConfig({
  base: githubPagesMode ? '/online-Registeration/' : '/',
  plugins: [githubPagesPaths],
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
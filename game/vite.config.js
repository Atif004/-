import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// يُبنى كملف HTML واحد يحتوي كل شيء — يعمل أوفلاين حتى بفتحه مباشرة من الجهاز.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2020', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 2000 },
});

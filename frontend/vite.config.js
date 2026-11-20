import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Custom plugin to treat .geojson files as JSON modules
const geojsonPlugin = () => ({
  name: 'geojson-loader',
  transform(code, id) {
    const cleanId = id.split('?')[0].replace(/\\/g, '/');
    if (cleanId.endsWith('.geojson')) {
      return {
        code: `export default ${code};`,
        map: null,
      }
    }
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), geojsonPlugin()],
  // Radio modules stay in the existing radio_lab folder. Resolve their React
  // imports against this frontend and expose only that specific source folder.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    fs: {
      allow: [
        fileURLToPath(new URL('.', import.meta.url)),
        fileURLToPath(new URL('../backend/app/radio_lab/frontend', import.meta.url)),
      ],
    },
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})

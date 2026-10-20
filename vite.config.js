import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
})


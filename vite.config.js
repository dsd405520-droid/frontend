import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// backend ຕົວດຽວສຳລັບ proxy ໃນ DEV — ປ່ຽນໄດ້ດ້ວຍ: API_PROXY_TARGET=http://localhost:4000 npm run dev
const API_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // DEV ເທົ່ານັ້ນ: ແນງ request ໄປ backend — ມືຖືເຊື່ມຜ່ານ IP ຂອງ PC ໄດ້ທັນທີ
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
      '/files': { target: API_TARGET, changeOrigin: true },
      '/socket.io': { target: API_TARGET, changeOrigin: true, ws: true },
    },
  },
})

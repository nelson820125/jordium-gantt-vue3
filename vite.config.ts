import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // 开发服务器配置
  root: 'demo',
  // 构建配置
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  // 路径别名
  resolve: {
    alias: {
      '@': '../src',
    },
  },
})

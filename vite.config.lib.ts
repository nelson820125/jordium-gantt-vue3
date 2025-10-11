import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 生成CSS导出文件的插件
const generateCssExportPlugin = () => {
  return {
    name: 'generate-css-export',
    generateBundle() {
      // 此插件将在构建后脚本中处理
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), generateCssExportPlugin()],
  build: {
    outDir: './npm-package/dist',
    emptyOutDir: true,
    lib: {
      entry: './src/index.ts',
      name: 'JordiumGanttVue3',
      fileName: format => `jordium-gantt-vue3.${format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // 确保外部化处理那些你不想打包进库的依赖
      external: ['vue'],
      output: {
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        globals: {
          vue: 'Vue',
        },
        // 禁用文件名哈希，生成固定文件名
        entryFileNames: 'jordium-gantt-vue3.[format].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        // 禁用代码分割，将所有代码打包到一个文件中
        manualChunks: undefined,
        inlineDynamicImports: true
      },
    },
  },
})

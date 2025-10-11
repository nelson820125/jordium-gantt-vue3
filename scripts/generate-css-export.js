#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ES模块中的__dirname等价物
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 构建后生成CSS导出文件
function generateCssExport() {
  const distDir = path.resolve(__dirname, '../npm-package/dist')
  const cssFile = path.join(distDir, 'assets/jordium-gantt-vue3.css')
  const outputFile = path.join(distDir, 'jordium-gantt-vue3-styles.js')

  try {
    if (fs.existsSync(cssFile)) {
      const cssContent = fs.readFileSync(cssFile, 'utf8')

      // 生成JS导出文件
      const jsContent = `// CSS styles for jordium-gantt-vue3
// Auto-generated file - do not edit manually
export const ganttStyles = ${JSON.stringify(cssContent)}
export default ganttStyles
`

      fs.writeFileSync(outputFile, jsContent, 'utf8')
      console.log('✅ Generated CSS export file:', outputFile)
    } else {
      console.warn('⚠️ CSS file not found:', cssFile)
    }
  } catch (error) {
    console.error('❌ Failed to generate CSS export:', error)
    process.exit(1)
  }
}

// 运行
generateCssExport()

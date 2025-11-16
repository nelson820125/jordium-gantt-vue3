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
  const assetsDir = path.join(distDir, 'assets')
  const expectedCssFile = path.join(assetsDir, 'jordium-gantt-vue3.css')
  const outputFile = path.join(distDir, 'jordium-gantt-vue3-styles.js')

  try {
    // 首先尝试查找固定名称的CSS文件
    if (fs.existsSync(expectedCssFile)) {
      const cssContent = fs.readFileSync(expectedCssFile, 'utf8')

      // 生成JS导出文件
      const jsContent = `// CSS styles for jordium-gantt-vue3
// Auto-generated file - do not edit manually
export const ganttStyles = ${JSON.stringify(cssContent)}
export default ganttStyles
`

      fs.writeFileSync(outputFile, jsContent, 'utf8')
      console.log('✅ Generated CSS export file:', outputFile)
      console.log('📄 Source CSS file:', expectedCssFile)
      return
    }

    // 如果固定名称文件不存在，检查assets目录
    if (!fs.existsSync(assetsDir)) {
      console.warn('⚠️ Assets directory not found:', assetsDir)
      console.warn('ℹ️ This is normal for library builds - CSS is typically inlined in JS files')
      return
    }

    // 查找任何CSS文件
    const files = fs.readdirSync(assetsDir)
    const cssFiles = files.filter(file => file.endsWith('.css'))

    if (cssFiles.length === 0) {
      console.warn('⚠️ No CSS files found in:', assetsDir)
      console.warn('ℹ️ This is normal for library builds - CSS is typically inlined in JS files')
      return
    }

    // 使用第一个找到的CSS文件
    const cssFile = path.join(assetsDir, cssFiles[0])
    const cssContent = fs.readFileSync(cssFile, 'utf8')

    // 生成JS导出文件
    const jsContent = `// CSS styles for jordium-gantt-vue3
// Auto-generated file - do not edit manually
export const ganttStyles = ${JSON.stringify(cssContent)}
export default ganttStyles
`

    fs.writeFileSync(outputFile, jsContent, 'utf8')
    console.log('✅ Generated CSS export file:', outputFile)
    console.log('📄 Source CSS file:', cssFile)
  } catch (error) {
    console.error('❌ Failed to generate CSS export:', error)
    process.exit(1)
  }
}

// 运行
generateCssExport()

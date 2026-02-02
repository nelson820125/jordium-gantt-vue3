// 替换数据集中的远程头像URL为本地路径
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const files = [
  'demo/data.json',
  'demo/data-resources.json',
  'demo/data-resources-large.json',
]

files.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath)
  console.log(`Processing ${filePath}...`)

  try {
    let content = fs.readFileSync(fullPath, 'utf-8')

    // 替换 https://i.pravatar.cc/150?img=X 为 /50-(X+10).jpg
    content = content.replace(/https:\/\/i\.pravatar\.cc\/150\?img=(\d+)/g, (match, num) => {
      const newNum = parseInt(num) + 10
      return `/50-${newNum}.jpg`
    })

    fs.writeFileSync(fullPath, content, 'utf-8')
    console.log(`✓ ${filePath} updated successfully`)
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message)
  }
})

console.log('\nAll files processed!')

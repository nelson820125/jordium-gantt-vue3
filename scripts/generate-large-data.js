import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 生成大数据集：100个资源，每个资源20-30个任务，总计约2500个任务
// 用于测试资源视图的垂直滚动性能和区间树算法优化效果
function generateLargeResourceData() {
  const resources = []
  const departments = ['研发部', '临床部', '质量部', '注册部', '生产部', '市场部', '工程部', '测试部']
  const types = ['研究员', '试验主任', '数据分析师', '质量专员', '注册专员', '项目经理', '工程师', '测试工程师']
  const colors = ['#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#8bc34a', '#ffc107', '#e91e63', '#3f51b5']

  for (let i = 1; i <= 100; i++) {
    const resourceId = `resource-${i.toString().padStart(3, '0')}`
    const taskCount = 20 + Math.floor(Math.random() * 11) // 20-30个任务
    const tasks = []
    const taskIdStart = i * 1000

    // 为每个资源生成任务
    for (let j = 0; j < taskCount; j++) {
      const taskId = taskIdStart + j
      const startDay = Math.floor(Math.random() * 365) // 365天内随机开始
      const duration = 3 + Math.floor(Math.random() * 28) // 3-30天

      const startDate = new Date(2025, 0, 1)
      startDate.setDate(startDate.getDate() + startDay)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + duration)

      const percent = [25, 50, 75, 100][Math.floor(Math.random() * 4)]

      tasks.push({
        id: taskId,
        name: `任务${taskId} - ${['需求分析', '方案设计', '实施开发', '测试验证', '文档编写', '评审会议'][j % 6]}`,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        progress: Math.floor(Math.random() * 100),
        type: ['task', 'story', 'bug', 'milestone'][Math.floor(Math.random() * 4)],
        resources: [
          {
            id: resourceId,
            name: `资源${i}`,
            percent,
          },
        ],
      })
    }

    resources.push({
      id: resourceId,
      name: `资源${i} - ${types[i % types.length]}`,
      type: types[i % types.length],
      avatar: `https://i.pravatar.cc/150?img=${i}`,
      department: departments[i % departments.length],
      skills: ['技能A', '技能B', '技能C'],
      capacity: 60 + Math.floor(Math.random() * 40),
      color: colors[i % colors.length],
      tasks,
    })
  }

  return {
    resources,
    meta: {
      generated: new Date().toISOString(),
      resourceCount: resources.length,
      taskCount: resources.reduce((sum, r) => sum + r.tasks.length, 0),
      description: '性能测试用大数据集 - 100个资源，约2500个任务，用于测试垂直滚动性能和区间树算法优化效果',
    },
  }
}

const data = generateLargeResourceData()
const outputPath = path.join(__dirname, '..', 'demo', 'data-resources-large.json')

fs.writeFileSync(
  outputPath,
  JSON.stringify(data, null, 2),
  'utf-8',
)

console.log('✅ 已生成大数据集:')
console.log(`  - 资源数: ${data.meta.resourceCount}`)
console.log(`  - 任务数: ${data.meta.taskCount}`)
console.log('  - 文件: demo/data-resources-large.json')

# jordium-gantt-vue3

<!-- For English documentation, see README-EN.md -->
**🌐 Languages**: [📖 English Documentation](./README-EN.md) | [📖 中文文档](./README.md)

[![npm version](https://badge.fury.io/js/jordium-gantt-vue3.svg)](https://badge.fury.io/js/jordium-gantt-vue3)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Vue 3](https://img.shields.io/badge/vue-3.x-green.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)](https://www.typescriptlang.org/)

> 现代化的 Vue 3 甘特图组件库，为项目管理和任务调度提供完整解决方案

## 🌐 在线体验

🎯 **[立即体验 Demo →](https://nelson820125.github.io/jordium-gantt-vue3/)**

*在线 Demo 包含完整功能展示：任务管理、里程碑、主题切换、国际化等*

## 🖼️ Demo展示

![甘特图概览](design/screenshots/demo.gif)

## 🎨 主题支持

### 亮色主题

![亮色主题](design/screenshots/light-theme.png)

### 暗色主题

![暗色主题](design/screenshots/dark-theme.png)

## 🚀 插件特点

- 📊 **完整功能**: 任务管理、里程碑追踪、依赖关系、进度可视化
- 🎨 **主题切换**: 内置亮色/暗色主题，支持自定义主题变量
- 🖱️ **交互丰富**: 拖拽调整、大小缩放、双击编辑、右键菜单
- 🌍 **国际化**: 内置中英文，支持自定义语言包
- 📱 **响应式**: 适配桌面和移动端，流畅的触控体验
- ⚡ **高性能**: 虚拟滚动、懒加载、优化渲染
- 🔧 **可扩展**: 丰富的 API 接口，支持自定义组件和事件
- 💎 **类型安全**: 完整 TypeScript 支持，开发体验更佳

## 📦 安装

```bash
# npm
npm install jordium-gantt-vue3

# yarn  
yarn add jordium-gantt-vue3

# pnpm
pnpm add jordium-gantt-vue3
```

## 📄 许可证

[MIT License](./LICENSE) © 2025 JORDIUM.COM

---

> 💡 **徽章下载**：
> - npm 版本徽章：https://badge.fury.io/
> - MIT 许可证徽章：https://img.shields.io/badge/license-MIT-blue.svg
> - Vue 版本徽章：https://img.shields.io/badge/vue-3.x-green.svg
> - TypeScript 徽章：https://img.shields.io/badge/typescript-5.x-blue.svg

## 📁 项目结构

```
jordium-gantt-vue3/
├── src/                      # 源码目录
│   ├── components/           # 核心组件
│   │   ├── GanttChart.vue   # 主入口组件
│   │   ├── TaskList.vue     # 任务列表
│   │   ├── Timeline.vue     # 时间轴
│   │   ├── TaskBar.vue      # 任务条
│   │   ├── MilestonePoint.vue # 里程碑
│   │   └── ...              # 其他组件
│   ├── models/              # 数据模型
│   │   ├── classes/         # 类定义
│   │   └── configs/         # 配置接口
│   ├── composables/         # 组合式函数
│   ├── styles/              # 样式文件
│   └── index.ts             # 导出入口
├── demo/                    # 开发演示
├── dist/                    # 构建产物
├── docs/                    # 文档
└── package.json
```

## 🔧 API 参考

### GanttChart 属性

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `tasks` | `Task[]` | `[]` | 任务数据数组 |
| `milestones` | `Task[]` | `[]` | 里程碑数据数组 |
| `editComponent` | `any` | - | 自定义编辑组件 |
| `useDefaultDrawer` | `boolean` | `true` | 是否使用默认编辑抽屉 |
| `showToolbar` | `boolean` | `true` | 是否显示工具栏 |
| `toolbarConfig` | `ToolbarConfig` | `{}` | 工具栏配置 |
| `localeMessages` | `Partial<Messages['zh-CN']>` | - | 自定义多语言配置 |
| `onTaskDoubleClick` | `(task: Task) => void` | - | 任务双击事件回调 |
| `onTaskDelete` | `(task: Task) => void` | - | 任务删除事件回调 |
| `onTaskUpdate` | `(task: Task) => void` | - | 任务更新事件回调 |
| `onTaskAdd` | `(task: Task) => void` | - | 任务添加事件回调 |
| `onMilestoneSave` | `(milestone: Task) => void` | - | 里程碑保存事件回调 |
| `onMilestoneDelete` | `(milestoneId: number) => void` | - | 里程碑删除事件回调 |
| `onMilestoneIconChange` | `(milestoneId: number, icon: string) => void` | - | 里程碑图标变更事件回调 |
| `onAddTask` | `() => void` | - | 新增任务工具栏事件回调 |
| `onAddMilestone` | `() => void` | - | 新增里程碑工具栏事件回调 |
| `onTodayLocate` | `() => void` | - | 定位今天工具栏事件回调 |
| `onExportCsv` | `() => boolean \| void` | - | 导出CSV工具栏事件回调 |
| `onExportPdf` | `() => void` | - | 导出PDF工具栏事件回调 |
| `onLanguageChange` | `(lang: 'zh-CN' \| 'en-US') => void` | - | 语言切换工具栏事件回调 |
| `onThemeChange` | `(isDark: boolean) => void` | - | 主题切换工具栏事件回调 |
| `onFullscreenChange` | `(isFullscreen: boolean) => void` | - | 全屏切换工具栏事件回调 |

### GanttChart 事件

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `taskbar-drag-end` | `task: Task` | 任务条拖拽结束 |
| `taskbar-resize-end` | `task: Task` | 任务条大小调整结束 |
| `milestone-drag-end` | `milestone: Task` | 里程碑拖拽结束 |

### 数据类型

#### 核心类型 (src/models/classes)

**Task 任务类型**
```typescript
interface Task {
  id: number                    // 任务唯一标识
  name: string                  // 任务名称
  predecessor?: string          // 前置任务ID
  assignee?: string            // 负责人
  startDate?: string           // 开始日期 (YYYY-MM-DD格式)
  endDate?: string             // 结束日期 (YYYY-MM-DD格式)
  progress?: number            // 完成进度 (0-100)
  estimatedHours?: number      // 预估工时
  actualHours?: number         // 实际工时
  parentId?: number            // 上级任务ID
  children?: Task[]            // 子任务数组（支持嵌套结构）
  collapsed?: boolean          // 是否折叠子任务
  isParent?: boolean           // 是否为父级任务
  type?: string               // 任务类型 (task/story/bug/milestone)
  description?: string         // 任务描述
  icon?: string               // 任务图标
  level?: number              // 任务层级
}
```

**Milestone 里程碑类型**
```typescript
// 里程碑实际上是 Task 类型的特殊用法
// 具有 type: 'milestone' 属性的 Task 对象
interface Milestone extends Task {
  type: 'milestone'            // 必须为 'milestone'
  startDate: string           // 里程碑日期 (必填)
  endDate?: string            // 结束日期 (可选，通常与startDate相同)
}
```

**Language 语言类型**
```typescript
type Language = 'zh' | 'en'   // 支持的语言类型
type Locale = 'zh-CN' | 'en-US' // 完整的语言区域标识
```

#### 配置类型 (src/models/configs)

**TimelineConfig 时间轴配置**
```typescript
interface TimelineConfig {
  startDate: Date              // 时间轴开始日期
  endDate: Date                // 时间轴结束日期
  zoomLevel: number            // 缩放级别
}
```

**ToolbarConfig 工具栏配置**
```typescript
interface ToolbarConfig {
  showAddTask?: boolean        // 是否显示新增任务按钮
  showAddMilestone?: boolean   // 是否显示新增里程碑按钮
  showTodayLocate?: boolean    // 是否显示定位今天按钮
  showExportCsv?: boolean      // 是否显示导出CSV按钮
  showExportPdf?: boolean      // 是否显示导出PDF按钮
  showLanguage?: boolean       // 是否显示语言切换按钮
  showTheme?: boolean          // 是否显示主题切换按钮
  showFullscreen?: boolean     // 是否显示全屏切换按钮
}
```

#### 组合式函数 (src/composables)

**useI18n 国际化工具**
```typescript
// 提供多语言支持
const { 
  locale,           // 当前语言
  setLocale,        // 切换语言
  t,               // 翻译函数
  formatYearMonth  // 年月格式化
} = useI18n()

// 支持的语言
type Locale = 'zh-CN' | 'en-US'
```

**useMessage 消息提示工具**
```typescript
// 提供全局消息提示
const { showMessage } = useMessage()

// 消息类型
type MessageType = 'success' | 'error' | 'warning' | 'info'

// 使用示例
showMessage('操作成功', 'success')
```

## 💻 基本使用

### 简单示例

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/style.css'

const tasks = ref([
  {
    id: 1,
    name: '项目启动',
    startDate: '2025-01-01',
    endDate: '2025-01-15',
    progress: 80,
    assignee: '张三'
  },
  {
    id: 2,
    name: '需求分析',
    startDate: '2025-01-16',
    endDate: '2025-01-30',
    progress: 60,
    assignee: '李四',
    predecessor: '1'
  }
])

const milestones = ref([
  {
    id: 1,
    name: '项目里程碑',
    startDate: '2025-01-31',
    type: 'milestone'
  }
])
</script>

<template>
  <div style="height: 600px;">
    <GanttChart 
      :tasks="tasks" 
      :milestones="milestones"
    />
  </div>
</template>
```

### 自定义事件处理

```vue
<script setup lang="ts">
import { GanttChart } from 'jordium-gantt-vue3'

// 自定义双击处理
const handleTaskDoubleClick = (task) => {
  console.log('双击任务:', task)
  // 打开自定义编辑界面
  router.push(`/task/${task.id}/edit`)
}

// 自定义删除处理
const handleTaskDelete = async (task) => {
  const confirmed = await showConfirm(`确定删除任务 "${task.name}" 吗？`)
  if (confirmed) {
    await api.deleteTask(task.id)
    // 刷新任务列表
    refreshTasks()
  }
}

// 监听拖拽事件
const handleTaskDragEnd = (task) => {
  console.log('任务拖拽结束:', task)
  // 保存任务时间变更
  api.updateTask(task)
}
</script>

<template>
  <GanttChart
    :tasks="tasks"
    :on-task-double-click="handleTaskDoubleClick"
    :on-task-delete="handleTaskDelete"
    :use-default-drawer="false"
    @taskbar-drag-end="handleTaskDragEnd"
  />
</template>
```

### 主题和国际化

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'

// 工具栏配置
const toolbarConfig = {
  showLanguage: true,
  showTheme: true,
  showAddTask: true,
  showAddMilestone: true,
  showTodayLocate: true,
  showExportCsv: true,
  showExportPdf: true,
  showFullscreen: true
}

// 自定义多语言配置
const customLocaleMessages = {
  taskName: '自定义任务名称',
  addTask: '自定义新增任务'
}

// 处理工具栏事件
const handleLanguageChange = (lang) => {
  console.log('语言切换到:', lang)
}

const handleThemeChange = (isDark) => {
  console.log('主题切换到:', isDark ? '暗色' : '亮色')
}
</script>

<template>
  <GanttChart
    :tasks="tasks"
    :milestones="milestones"
    :toolbar-config="toolbarConfig"
    :locale-messages="customLocaleMessages"
    :on-language-change="handleLanguageChange"
    :on-theme-change="handleThemeChange"
  />
</template>
```

## 🤝 贡献与合作

### 参与贡献

我们欢迎社区贡献！如果你想参与项目开发：

1. **Fork** 本仓库
2. **创建** 你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. **提交** 你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. **推送** 到分支 (`git push origin feature/AmazingFeature`)
5. **打开** Pull Request

### 报告问题

如果你发现了 bug 或有功能建议：

- 📬 [提交 Github Issue](https://github.com/nelson820125/jordium-gantt-vue3/issues)
- 📬 [提交 Gitee Issue](https://gitee.com/jordium/jordium-gantt-vue3/issues)
- 📧 发送邮件至：ning.li@jordium.com / nelson820125@gmail.com / lining820125@163.com

### 商业合作

我们提供专业的技术支持和定制开发服务：

- 🏢 **企业定制**: 根据业务需求定制系统开发
- 💼 **技术咨询**: 业务及架构设计解决方案咨询

**联系方式**：
- 📧 商务邮箱：ning.li@jordium.com / nelson820125@gmail.com

### 开发环境

```bash
# 克隆项目
git clone https://github.com/nelson820125/jordium-gantt-vue3.git

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建库文件
npm run build:lib

# 运行测试
npm run test
```

---

**🔗 相关链接**
- [GitHub 仓库](https://github.com/nelson820125/jordium-gantt-vue3)
- [更新日志](./CHANGELOG.md)

> 💡 **提示**: 如果这个项目对你有帮助，请给我们一个 ⭐ Star！

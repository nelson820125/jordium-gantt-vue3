# <img src="public/assets/jordium-gantt-vue3-logo.svg" alt="jordium-gantt-vue3 logo" width="32" style="vertical-align:middle;margin-right:8px;" /> jordium-gantt-vue3

<!-- For English documentation, see README-EN.md -->
**🌐 Languages**: [📖 English Documentation](./README-EN.md) | [📖 中文文档](./README.md)

[![npm version](https://img.shields.io/npm/v/jordium-gantt-vue3.svg?cacheBust=1)](https://www.npmjs.com/package/jordium-gantt-vue3)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Vue 3](https://img.shields.io/badge/vue-3.x-green.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)](https://www.typescriptlang.org/)

> 现代化的 Vue 3 甘特图组件库，为项目管理和任务调度提供完整解决方案

## 🌐 在线体验

🎯 **[立即体验 Github在线Demo →](https://nelson820125.github.io/jordium-gantt-vue3/)**

*在线 Demo 包含完整功能展示：任务管理、里程碑、主题切换、国际化等*

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

## 📁 项目结构

```
jordium-gantt-vue3/
├── src/             # 组件源码与核心逻辑
│   ├── components/  # 主要 Vue 组件
│   ├── models/      # 数据类型与配置
│   ├── composables/ # 组合式函数
│   ├── styles/      # 样式文件
│   └── index.ts     # 入口导出
├── demo/            # 组件开发与交互演示（本地开发/预览用）
├── packageDemo/     # npm 包集成演示（模拟外部项目集成效果）
├── dist/            # 构建产物（发布/静态站点/打包输出）
├── docs/            # 相关文档（如部署、API 说明等）
├── design/          # 设计资源与截图
├── public/          # 公共静态资源
├── README.md        # 中文说明文档
├── README-EN.md     # 英文说明文档
└── ...              # 其他配置、脚本与元数据
```

- `demo/`：用于本地开发和功能演示，包含完整的交互页面。
- `packageDemo/`：用于模拟 npm 包在外部项目中的集成与使用场景。
- `dist/`：构建输出目录，包含发布到 npm 或静态站点的产物。
- `docs/`：项目相关文档，如部署说明、API 参考等。
- 其余目录请参考注释。

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

| 事件名                | 参数                        | 说明                         |
|----------------------|----------------------------|------------------------------|
| `taskbar-drag-end` | `task: Task` | 任务条拖拽结束 |
| `taskbar-resize-end` | `task: Task` | 任务条大小调整结束 |
| `milestone-drag-end` | `milestone: Task` | 里程碑拖拽结束 |
| `predecessor-added`  | `{ targetTask, newTask }`   | 添加前置任务后触发。<br>参数说明：<br>• `targetTask`：被添加前置任务的目标任务（Task对象）<br>• `newTask`：新添加的前置任务（Task对象） |
| `successor-added`    | `{ targetTask, newTask }`   | 添加后置任务后触发。<br>参数说明：<br>• `targetTask`：被添加后置任务的目标任务（Task对象）<br>• `newTask`：新添加的后置任务（Task对象） |
| `task-deleted`       | `{ task }`                  | 删除任务后触发               |
| `task-added`         | `{ task }`                  | 新建任务后触发               |
| `task-updated`       | `{ task }`                  | 更新任务后触发               |

#### 计时事件用法示例

```vue
<GanttChart
  ...
  @timer-started="onTimerStarted"
  @timer-stopped="onTimerStopped"
/>

<script setup>
function onTimerStarted(task) {
  // 这里可以自定义提示、日志或业务逻辑
  alert(`任务【${task.name}】开始计时：${new Date(task.timerStartTime).toLocaleString()}`)
}
function onTimerStopped(task) {
  alert(`任务【${task.name}】停止计时`)
}
</script>
```

#### 任务事件用法示例

```vue
<GanttChart
  ...
  @predecessor-added="onPredecessorAdded"
  @successor-added="onSuccessorAdded"
  @task-deleted="onTaskDeleted"
  @task-added="onTaskAdded"
  @task-updated="onTaskUpdated"
/>

<script setup>
function onPredecessorAdded(e) {
  // e: { targetTask: Task, newTask: Task }
  alert(`任务【${e.targetTask.name}】添加前置任务【${e.newTask.name}】`)
}
function onSuccessorAdded(e) {
  // e: { targetTask: Task, newTask: Task }
  alert(`任务【${e.targetTask.name}】添加后置任务【${e.newTask.name}】`)
}
function onTaskDeleted(e) {
  // e: { task: Task }
  alert(`任务【${e.task.name}】已删除`)
}
function onTaskAdded(e) {
  // e: { task: Task }
  alert(`任务【${e.task.name}】已创建`)
}
function onTaskUpdated(e) {
  // e: { task: Task }
  alert(`任务【${e.task.name}】已更新`)
}
</script>
```

### 数据类型

#### 核心类型 (src/models/classes)

**Task 任务类型**
```typescript
export interface Task {
  id: number // 任务唯一ID
  name: string // 任务名称
  predecessor?: number[] // 前置任务ID数组
  assignee?: string // 负责人
  startDate?: string // 开始日期（ISO字符串）
  endDate?: string // 结束日期（ISO字符串）
  progress?: number // 进度百分比 0-100
  estimatedHours?: number // 预估工时
  actualHours?: number // 实际工时
  parentId?: number // 上级任务ID
  children?: Task[] // 子任务数组
  collapsed?: boolean // 是否折叠
  isParent?: boolean // 是否为父任务
  type?: string // 任务类型（如 task、story、milestone 等）
  description?: string // 任务描述
  icon?: string // 图标
  level?: number // 层级
  // 计时相关字段
  isTimerRunning?: boolean // 计时是否进行中
  timerStartTime?: number // 计时开始时间（时间戳）
  timerEndTime?: number // 计时结束时间（时间戳）
  timerStartDesc?: string // 计时开始时的描述
  timerElapsedTime?: number // 已累计计时时长（秒）
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
  showTimeScale?: boolean      // 是否显示时间刻度切换按钮组(日|周|月)
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
  showFullscreen: true,
  showTimeScale: true  // 控制日|周|月时间刻度按钮组的可见性
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

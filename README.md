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
<span><strong>推荐使用 <a href="https://dovee.cc/a.php?anaxjgyz1ozZq2B">DOVE</a> VPN，快速、稳定。</strong></span> <span style="color:red;">（注意：请合法使用 VPN 资源）</span>

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
├── src/                      # 组件源码与核心逻辑
│   ├── components/           # 主要 Vue 组件
│   │   ├── GanttChart.vue    # 主入口组件
│   │   ├── TaskList.vue      # 任务列表
│   │   ├── Timeline.vue      # 时间轴组件
│   │   ├── TaskBar.vue       # 任务条
│   │   ├── TaskDrawer.vue    # 任务编辑抽屉
│   │   ├── TaskContextMenu.vue # 任务右键菜单
│   │   ├── GanttToolbar.vue  # 工具栏
│   │   ├── MilestonePoint.vue # 里程碑点
│   │   ├── MilestoneDialog.vue # 里程碑对话框
│   │   ├── DatePicker.vue    # 日期选择器
│   │   └── ...               # 其他组件
│   ├── models/               # 数据模型与配置
│   │   ├── classes/          # 类定义
│   │   │   ├── Task.ts       # 任务模型
│   │   │   ├── Milestone.ts  # 里程碑模型
│   │   │   └── Language.ts   # 语言配置
│   │   ├── configs/          # 配置接口
│   │   │   ├── TimelineConfig.ts # 时间轴配置
│   │   │   └── ToolbarConfig.ts  # 工具栏配置
│   │   └── types/            # 类型定义
│   │       └── TimelineScale.ts  # 时间刻度类型
│   ├── composables/          # 组合式函数
│   │   ├── useI18n.ts        # 国际化工具
│   │   └── useMessage.ts     # 消息提示工具
│   ├── styles/               # 样式文件
│   │   ├── app.css           # 主样式
│   │   └── theme-variables.css # 主题变量
│   ├── utils/                # 工具函数
│   │   └── predecessorUtils.ts # 前置依赖工具
│   └── index.ts              # 入口导出
├── demo/                     # 组件开发与交互演示（本地开发/预览用）
│   ├── App.vue               # 演示应用主组件
│   ├── data.json             # 演示数据（包含药物临床试验案例）
│   ├── main.ts               # 演示应用入口
│   └── ...                   # 其他演示文件
├── packageDemo/              # npm 包集成演示（模拟外部项目集成效果）
├── dist/                     # 构建产物（发布/静态站点/打包输出）
├── docs/                     # 相关文档（如部署、API 说明等）
├── design/                   # 设计资源与截图
│   └── screenshots/          # 主题截图
├── public/                   # 公共静态资源
│   └── assets/               # 静态资源文件
├── README.md                 # 中文说明文档
├── README-EN.md              # 英文说明文档
├── package.json              # 项目配置
├── vite.config.ts            # Vite开发配置
├── vite.config.lib.ts        # Vite库构建配置
├── tsconfig.json             # TypeScript配置
└── ...                       # 其他配置、脚本与元数据
```

### 目录说明

- **`src/components/`**：核心Vue组件，包含甘特图的所有功能组件
- **`src/models/`**：数据模型、类型定义和配置接口
- **`src/composables/`**：Vue 3组合式函数，提供可复用的逻辑
- **`src/styles/`**：样式文件，包含主题系统和CSS变量
- **`src/utils/`**：工具函数，处理业务逻辑和数据转换
- **`demo/`**：本地开发和功能演示，包含完整的交互页面和药物临床试验样例数据
- **`packageDemo/`**：模拟npm包在外部项目中的集成与使用场景
- **`dist/`**：构建输出目录，包含发布到npm或静态站点的产物
- **`docs/`**：项目文档，包括部署说明、API参考等

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
| `taskListConfig` | `TaskListConfig` | `{}` | 任务列表配置（包括默认宽度、最小最大宽度限制等） |
| `localeMessages` | `Partial<Messages['zh-CN']>` | - | 自定义多语言配置 |
| `workingHours` | `WorkingHours` | - | 工作时间配置 |
| `onTaskDoubleClick` | `(task: Task) => void` | - | 任务双击事件回调 |
| `onTaskDelete` | `(task: Task, deleteChildren?: boolean) => void` | - | 任务删除事件回调 |
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
  id: number                  // 任务唯一ID
  name: string               // 任务名称
  predecessor?: number[]     // 前置任务ID数组
  assignee?: string          // 负责人
  startDate?: string         // 开始日期（ISO字符串）
  endDate?: string           // 结束日期（ISO字符串）
  progress?: number          // 进度百分比 0-100
  estimatedHours?: number    // 预估工时（支持小数，最多2位）
  actualHours?: number       // 实际工时（支持小数，最多2位）
  parentId?: number          // 上级任务ID
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

**TaskListConfig 任务列表配置**
```typescript
interface TaskListConfig {
  columns?: TaskListColumnConfig[]  // 列配置数组
  showAllColumns?: boolean         // 是否显示所有列，默认true
  defaultWidth?: number           // 默认展开宽度，单位像素，默认320px
  minWidth?: number              // 最小宽度，单位像素，默认280px，不能小于280px
  maxWidth?: number              // 最大宽度，单位像素，默认1160px
}

interface TaskListColumnConfig {
  type?: TaskListColumnType       // 列类型
  key: string                    // 用于国际化的key，也可以作为识别符
  label?: string                 // 显示标签
  cssClass?: string              // CSS类名
  width?: number                 // 可选的列宽度
  visible?: boolean              // 是否显示，默认true
}

type TaskListColumnType = 
  | 'name' | 'predecessor' | 'assignee' 
  | 'startDate' | 'endDate' | 'estimatedHours' 
  | 'actualHours' | 'progress'
```

**WorkingHours 工作时间配置**
```typescript
interface WorkingHours {
  morning?: { start: number; end: number }    // 上午工作时间，如 { start: 8, end: 11 }
  afternoon?: { start: number; end: number }  // 下午工作时间，如 { start: 13, end: 17 }
}
```

**TimelineScale 时间刻度类型**
```typescript
// 时间轴显示刻度类型
type TimelineScale = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'

// 时间刻度常量
export const TimelineScale = {
  HOUR: 'hour',        // 小时视图 - 每列显示一小时
  DAY: 'day',          // 日视图 - 每列显示一天
  WEEK: 'week',        // 周视图 - 每列显示一周  
  MONTH: 'month',      // 月视图 - 每列显示一个月
  QUARTER: 'quarter',  // 季度视图 - 每列显示一个季度
  YEAR: 'year',        // 年视图 - 每列显示一年
}

// 时间刻度配置
interface TimelineScaleConfig {
  scale: TimelineScale    // 刻度类型
  cellWidth: number       // 每个时间单元的宽度(px)
  headerLevels: number    // 表头层级数
  formatters: {
    primary: string       // 主要时间标签格式
    secondary?: string    // 次要时间标签格式
  }
}
```

### 🕐 时间刻度功能说明

组件支持多种时间刻度显示，用户可以通过工具栏的日/周/月按钮组或者编程方式切换时间轴的显示粒度：

#### 内置刻度配置

| 刻度类型 | 单元宽度 | 主标签格式 | 副标签格式 | 适用场景 |
|----------|----------|------------|------------|----------|
| `hour` | 40px | yyyy/MM/dd | HH | 精确到小时的项目, 例如药物临床试验 |
| `day` | 30px | yyyy年MM月 | dd | 日常项目管理的标准视图 |
| `week` | 120px | yyyy年MM月 | W | 中期项目的周计划视图 |
| `month` | 180px | yyyy | MM | 长期项目的月度视图 |
| `quarter` | 360px | yyyy | Q | 战略规划的季度视图 |
| `year` | 360px | yyyy | 上半年\|下半年 | 超长期项目年度视图 |

#### 使用示例

```vue
<script setup>
import { ref } from 'vue'
import { GanttChart, TimelineScale } from 'jordium-gantt-vue3'

const tasks = ref([/* 任务数据 */])

// 工具栏配置 - 启用时间刻度切换按钮
const toolbarConfig = {
  showTimeScale: true  // 显示日|周|月按钮组
}

// 监听刻度切换（可选）
const handleTimeScaleChange = (scale) => {
  console.log('时间刻度切换至:', scale)
  // 可以在这里做一些业务逻辑，如保存用户偏好设置
}
</script>

<template>
  <GanttChart
    :tasks="tasks"
    :toolbar-config="toolbarConfig"
    @timescale-changed="handleTimeScaleChange"
  />
</template>
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
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'

const tasks = ref([
  {
    id: 1,
    name: '项目启动',
    startDate: '2025-01-01',
    endDate: '2025-01-15',
    progress: 80,
    assignee: '张三',
    type: 'task'
  },
  {
    id: 2,
    name: '需求分析',
    startDate: '2025-01-16',
    endDate: '2025-01-30',
    progress: 60,
    assignee: '李四',
    predecessor: '1',
    type: 'task'
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

// TaskList宽度配置示例
const taskListConfig = {
  defaultWidth: 400,  // 默认展开宽度400px（默认320px）
  minWidth: 300,      // 最小宽度300px（默认280px） 
  maxWidth: 1200      // 最大宽度1200px（默认1160px）
}
</script>

<template>
  <div style="height: 600px;">
    <GanttChart 
      :tasks="tasks" 
      :milestones="milestones"
      :task-list-config="taskListConfig"
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
  showLanguage: true,      // 语言切换
  showTheme: true,         // 主题切换
  showAddTask: true,       // 新增任务
  showAddMilestone: true,  // 新增里程碑
  showTodayLocate: true,   // 定位今天
  showExportCsv: true,     // 导出CSV
  showExportPdf: true,     // 导出PDF
  showFullscreen: true,    // 全屏模式
  showTimeScale: true      // 时间刻度切换（日|周|月按钮组）
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

// 监听时间刻度变化
const handleTimeScaleChange = (scale) => {
  console.log('时间刻度切换至:', scale)
  // 根据刻度调整显示逻辑
  if (scale === 'day') {
    // 日视图下的特殊处理
  } else if (scale === 'week') {
    // 周视图下的特殊处理  
  }
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
    @timescale-changed="handleTimeScaleChange"
  />
</template>
```

### 🔧 工作时间配置

组件支持设置工作时间，影响任务时长计算和进度显示：

```vue
<script setup lang="ts">
// 配置工作时间（24小时制）
const workingHours = {
  morning: { start: 9, end: 12 },    // 上午9点-12点
  afternoon: { start: 14, end: 18 }  // 下午2点-6点
}
</script>

<template>
  <GanttChart
    :tasks="tasks"
    :working-hours="workingHours"
  />
</template>
```

### 📊 高精度工时管理

组件支持精确到小数点后2位的工时记录，适合需要精确计费的项目：

```vue
<script setup lang="ts">
const tasks = ref([
  {
    id: 1,
    name: '高精度任务',
    estimatedHours: 8.75,    // 8小时45分钟
    actualHours: 7.25,       // 7小时15分钟
    startDate: '2025-01-01',
    endDate: '2025-01-02'
  }
])
</script>
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

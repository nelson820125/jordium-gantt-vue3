# <img src="public/assets/jordium-gantt-vue3-logo.svg" alt="jordium-gantt-vue3 logo" width="32" style="vertical-align:middle;margin-right:8px;" /> jordium-gantt-vue3

<p align="center">
  <a href="https://www.npmjs.com/package/jordium-gantt-vue3">
    <img src="https://img.shields.io/npm/v/jordium-gantt-vue3?style=flat-square" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/jordium-gantt-vue3">
    <img src="https://img.shields.io/npm/dt/jordium-gantt-vue3?style=flat-square" alt="npm total">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License">
  </a>
  <a href="https://vuejs.org/">
    <img src="https://img.shields.io/badge/Vue.js->=3.5.13-4FC08D?style=flat-square&logo=vue.js&logoColor=white" alt="Vue.js">
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript->=5.8.3-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  </a>
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/Node.js->=16.0.0-339933?style=flat-square&logo=node.js&logoColor=white" alt="Nodejs">
  </a>
</p>

<p align="center">
  <a href="./README.md">中文</a> | 
  <a href="./README-EN.md">English</a> | 
  <a href="./CHANGELOG.md">更新日志</a>
</p>

<p align="center">现代化的 Vue 3 甘特图组件库，为项目管理和任务调度提供完整解决方案</p>

<p align="center">
  <a href="https://nelson820125.github.io/jordium-gantt-vue3/">
    <strong>📱 在线演示</strong>
  </a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="https://github.com/nelson820125/jordium-gantt-vue3">
    <strong>📦 GitHub</strong>
  </a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="https://www.npmjs.com/package/jordium-gantt-vue3">
    <strong>📚 npm</strong>
  </a>
</p>

---

## ✨ 简介

jordium-gantt-vue3 是一个基于 Vue 3 和 TypeScript 开发的现代化甘特图组件，专为项目管理和任务调度场景设计。它提供了丰富的交互功能、灵活的配置选项和优雅的视觉效果。

### 核心特性

- 📊 **功能完整** - 任务管理、里程碑、依赖关系、进度追踪
- 🎨 **主题系统** - 内置亮色/暗色主题，支持自定义样式
- 🖱️ **交互流畅** - 拖拽调整、缩放、双击编辑、右键菜单
- 🌍 **国际化** - 内置中英文，可扩展其他语言
- ⚡ **高性能** - 虚拟滚动、懒加载，轻松处理大量数据
- 💎 **类型安全** - 完整 TypeScript 支持

### 效果预览

#### 亮色主题

<img src="design/screenshots/light-theme.png" alt="亮色主题" width="100%">

#### 暗色主题

<img src="design/screenshots/dark-theme.png" alt="暗色主题" width="100%">

---

## 📦 安装

使用你喜欢的包管理器安装：

```bash
# npm
npm install jordium-gantt-vue3

# yarn
yarn add jordium-gantt-vue3

# pnpm
pnpm add jordium-gantt-vue3
```

---

## 🚀 快速开始

### 组件引入

在组件中引入 `GanttChart` 组件和样式：

```vue
<script setup lang="ts">
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
</script>
```

> **提示**: 样式文件只需在项目中引入一次即可，建议在 `main.ts` 或根组件中引入。

### 第一个示例

创建你的第一个甘特图：

```vue
<template>
  <div style="height: 600px;">
    <GanttChart :tasks="tasks" :milestones="milestones" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'

const tasks = ref([
  {
    id: 1,
    name: '项目启动',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progress: 100,
  },
  {
    id: 2,
    name: '需求分析',
    startDate: '2025-01-11',
    endDate: '2025-01-20',
    progress: 80,
    predecessor: [1],
  },
  {
    id: 3,
    name: '系统设计',
    startDate: '2025-01-21',
    endDate: '2025-02-05',
    progress: 50,
    predecessor: [2],
  },
])

const milestones = ref([
  {
    id: 101,
    name: '项目立项',
    date: '2025-01-01',
    type: 'milestone',
  },
])
</script>
```

🎯 **[立即体验 Github在线Demo →](https://nelson820125.github.io/jordium-gantt-vue3/)**
<span><strong>推荐使用 <a href="https://dovee.cc/a.php?anaxjgyz1ozZq2B">DOVE</a> VPN，快速、稳定。</strong></span> <span style="color:red;">（注意：请合法使用 VPN 资源）</span>

## 🌞 NPM包使用示例

请参考项目下的npm-demo，这是一个独立的项目，可以使用IDE单独浏览和启动，运行前请安装element plus以及jordium-gantt-vue3插件包

```bash
# npm
npm install element-plus
npm install jordium-gantt-vue3
npm run dev
```

---

## 组件指南

### GanttChart 组件

`GanttChart` 是组件库的核心入口，提供了完整的甘特图功能。

#### 基础属性

| 属性名                      | 类型                                                                                      | 默认值  | 说明                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------- |
| `tasks`                     | `Task[]`                                                                                  | `[]`    | 任务数据数组                                                   |
| `milestones`                | `Task[]`                                                                                  | `[]`    | 里程碑数据数组（注意：类型为 Task[]，需设置 type='milestone'） |
| `showToolbar`               | `boolean`                                                                                 | `true`  | 是否显示工具栏                                                 |
| `useDefaultDrawer`          | `boolean`                                                                                 | `true`  | 是否使用内置任务编辑抽屉（TaskDrawer）                         |
| `useDefaultMilestoneDialog` | `boolean`                                                                                 | `true`  | 是否使用内置里程碑编辑对话框（MilestoneDialog）                |
| `autoSortByStartDate`       | `boolean`                                                                                 | `false` | 是否根据开始时间自动排序任务                                   |
| `allowDragAndResize`        | `boolean`                                                                                 | `true`  | 是否允许拖拽和调整任务/里程碑大小                              |
| `enableTaskRowMove`         | `boolean`                                                                                 | `false` | 是否允许拖拽和摆放TaskRow                                      |
| `assigneeOptions`           | `Array<{ key?: string \| number; value: string \| number; label: string }>`               | `[]`    | 任务编辑抽屉中负责人下拉菜单的选项列表          | 

#### 配置对象属性

完整的配置对象说明请参考 [⚙️ 配置与扩展](#⚙️-配置与扩展) 章节。

| 属性名           | 类型                         | 默认值                                                                  | 说明             |
| ---------------- | ---------------------------- | ----------------------------------------------------------------------- | ---------------- |
| `toolbarConfig`  | `ToolbarConfig`              | `{}`                                                                    | 工具栏配置       |
| `taskListConfig` | `TaskListConfig`             | `undefined`                                                             | 任务列表配置     |
| `taskBarConfig`  | `TaskBarConfig`              | `undefined`                                                             | 任务条样式配置   |
| `localeMessages` | `Partial<Messages['zh-CN']>` | `undefined`                                                             | 自定义多语言配置 |
| `workingHours`   | `WorkingHours`               | `{ morning: { start: 8, end: 11 }, afternoon: { start: 13, end: 17 } }` | 工作时间配置     |

#### 回调函数属性

| 属性名               | 类型                                 | 说明                                                     |
| -------------------- | ------------------------------------ | -------------------------------------------------------- |
| `onTodayLocate`      | `() => void`                         | 工具栏"今天"按钮点击回调                                 |
| `onExportCsv`        | `() => boolean \| void`              | 工具栏"导出CSV"按钮点击回调，返回 `false` 可阻止默认导出 |
| `onExportPdf`        | `() => void`                         | 工具栏"导出PDF"按钮点击回调                              |
| `onLanguageChange`   | `(lang: 'zh-CN' \| 'en-US') => void` | 语言切换回调                                             |
| `onThemeChange`      | `(isDark: boolean) => void`          | 主题切换回调                                             |
| `onFullscreenChange` | `(isFullscreen: boolean) => void`    | 全屏切换回调                                             |
| `onExpandAll`        | `() => void`                         | 工具栏"全部展开"按钮点击回调                             |
| `onCollapseAll`      | `() => void`                         | 工具栏"全部折叠"按钮点击回调                             |

#### 组件事件（Events）

完整的事件说明请分别参考：

- **任务相关事件**：参见下方 [任务管理](#任务管理) 章节
- **里程碑相关事件**：参见下方 [里程碑管理](#里程碑管理) 章节

**事件列表总览：**

| 事件名                   | 参数                              | 说明                       |
| ------------------------ | --------------------------------- | -------------------------- |
| `add-task`               | -                                 | 点击工具栏"添加任务"按钮   |
| `task-click`             | `(task: Task, event: MouseEvent)` | 点击任务                   |
| `task-double-click`      | `(task: Task)`                    | 双击任务                   |
| `task-added`             | `{ task: Task }`                  | 任务添加后触发             |
| `task-updated`           | `{ task: Task }`                  | 任务更新后触发             |
| `task-deleted`           | `{ task: Task }`                  | 任务删除后触发             |
| `taskbar-drag-end`       | `(task: Task)`                    | 拖拽任务结束               |
| `taskbar-resize-end`     | `(task: Task)`                    | 调整任务大小结束           |
| `predecessor-added`      | `{ targetTask, newTask }`         | 添加前置任务               |
| `successor-added`        | `{ targetTask, newTask }`         | 添加后置任务               |
| `timer-started`          | `(task: Task)`                    | 任务计时器启动             |
| `timer-stopped`          | `(task: Task)`                    | 任务计时器停止             |
| `add-milestone`          | -                                 | 点击工具栏"添加里程碑"按钮 |
| `milestone-saved`        | `(milestone: Task)`               | 里程碑保存                 |
| `milestone-deleted`      | `{ milestoneId: number }`         | 里程碑删除                 |
| `milestone-icon-changed` | `{ milestoneId, icon }`           | 里程碑图标变更             |
| `milestone-drag-end`     | `(milestone: Task)`               | 拖拽里程碑结束             |
| `task-row-moved`     | `payload: { draggedTask: Task, targetTask: Task, position: 'after' \| 'child', oldParent: Task \| null, newParent: Task \| null }` | 拖拽TaskRow结束（可选） |

#### 示例1：最简单的甘特图

```vue
<template>
  <div style="height: 600px;">
    <GanttChart :tasks="tasks" :assignee-options="assigneeOptions" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'

const tasks = ref([
  {
    id: 1,
    name: '任务1',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progress: 100,
  },
])

const assigneeOptions = ref([
  { value: 'zhangsan', label: '张三' },
  { value: 'lisi', label: '李四' },
  { value: 'wangwu', label: '王五' },
])
</script>
```

#### 示例2：带里程碑的甘特图

```vue
<template>
  <div style="height: 600px;">
    <GanttChart :tasks="tasks" :milestones="milestones" :assignee-options="assigneeOptions" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'

const tasks = ref([
  {
    id: 1,
    name: '项目启动',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progress: 100,
  },
])

const milestones = ref([
  {
    id: 101,
    name: '项目立项',
    startDate: '2025-01-01',
    type: 'milestone',
    icon: 'diamond',
  },
])

const assigneeOptions = ref([
  { value: 'zhangsan', label: '张三' },
  { value: 'lisi', label: '李四' },
  { value: 'wangwu', label: '王五' },
])
</script>
```

#### 示例3：隐藏工具栏，自定义控制按钮绑定事件

```vue
<template>
  <div>
    <!-- 自定义控制栏 -->
    <div class="custom-toolbar">
      <button @click="addTask">新增任务</button>
      <button @click="addMilestone">新增里程碑</button>
    </div>

    <!-- 甘特图组件，隐藏内置工具栏 -->
    <div style="height: 600px;">
      <GanttChart
        :tasks="tasks"
        :milestones="milestones"
        :show-toolbar="false"
        :assignee-options="assigneeOptions"
        @task-added="handleTaskAdded"
        @milestone-saved="handleMilestoneSaved"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'

const tasks = ref([])
const milestones = ref([])

const assigneeOptions = ref([
  { value: 'zhangsan', label: '张三' },
  { value: 'lisi', label: '李四' },
  { value: 'wangwu', label: '王五' },
])

const addTask = () => {
  const newTask = {
    id: Date.now(),
    name: '新任务',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    progress: 0,
  }
  tasks.value.push(newTask)
}

const addMilestone = () => {
  const newMilestone = {
    id: Date.now(),
    name: '新里程碑',
    startDate: new Date().toISOString().split('T')[0],
    type: 'milestone',
  }
  milestones.value.push(newMilestone)
}

const handleTaskAdded = e => {
  console.log('任务已添加:', e.task)
}

const handleMilestoneSaved = milestone => {
  console.log('里程碑已保存:', milestone)
}
</script>
```

---

### 任务管理

任务是甘特图的核心元素，组件提供了完整的任务 CRUD 操作支持，包括添加、编辑、删除任务，以及丰富的交互事件。

#### Task 数据结构

| 字段名             | 类型       | 必填 | 默认值      | 说明                                                                                                                            |
| ------------------ | ---------- | ---- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | `number`   | ✅   | -           | 任务唯一标识符                                                                                                                  |
| `name`             | `string`   | ✅   | -           | 任务名称                                                                                                                        |
| `startDate`        | `string`   | -    | -           | 开始日期，格式：'YYYY-MM-DD' 或 'YYYY-MM-DD HH:mm'                                                                              |
| `endDate`          | `string`   | -    | -           | 结束日期，格式：'YYYY-MM-DD' 或 'YYYY-MM-DD HH:mm'                                                                              |
| `progress`         | `number`   | -    | `0`         | 任务进度，范围 0-100                                                                                                            |
| `predecessor`      | `number[]` | -    | -           | 前置任务 ID 数组，标准格式：`[1, 2, 3]`<br/>**兼容格式**：也支持字符串 `'1,2,3'` 或字符串数组 `['1', '2', '3']`，组件会自动解析 |
| `assignee`         | `string`   | -    | -           | 任务负责人，用作负责人下拉菜单的值绑定                                                                                                                      |
| `assigneeName`         | `string`   | -    | -           | 任务负责人姓名，自动从绑定的数据集`assigneeOptions`中获取Label作为显示，如果需要自定义，可以在GanttChart回调事件`task-added`中自定义信息                                                                                                                      |
| `avatar`           | `string`   | -    | -           | 任务负责人头像 URL                                                                                                              |
| `estimatedHours`   | `number`   | -    | -           | 预估工时（小时）                                                                                                                |
| `actualHours`      | `number`   | -    | -           | 实际工时（小时）                                                                                                                |
| `parentId`         | `number`   | -    | -           | 父任务 ID，用于任务分组                                                                                                         |
| `children`         | `Task[]`   | -    | -           | 子任务数组                                                                                                                      |
| `collapsed`        | `boolean`  | -    | `false`     | 子任务是否折叠                                                                                                                  |
| `isParent`         | `boolean`  | -    | -           | 是否为父任务                                                                                                                    |
| `type`             | `string`   | -    | -           | 任务类型，'milestone' 表示里程碑，'milestone-group' 表示里程碑分组                                                              |
| `description`      | `string`   | -    | -           | 任务描述                                                                                                                        |
| `icon`             | `string`   | -    | `'diamond'` | 任务图标（用于里程碑），可选值：'diamond', 'flag', 'star', 'rocket' 等                                                          |
| `level`            | `number`   | -    | `0`         | 任务层级（自动计算）                                                                                                            |
| `isTimerRunning`   | `boolean`  | -    | `false`     | 计时器是否运行中                                                                                                                |
| `timerStartTime`   | `number`   | -    | -           | 计时开始时间（时间戳）                                                                                                          |
| `timerEndTime`     | `number`   | -    | -           | 计时结束时间（时间戳）                                                                                                          |
| `timerStartDesc`   | `string`   | -    | -           | 计时开始时填写的描述                                                                                                            |
| `timerElapsedTime` | `number`   | -    | `0`         | 已计时的时长（毫秒）                                                                                                            |
| `isEditable`       | `boolean`  | -    | `true`      | 单个任务是否可编辑（可拖拽、拉伸），优先级高于全局 `allowDragAndResize`                                                         |
| `[key: string]`    | `unknown`  | -    | -           | 支持自定义属性扩展，可添加任意额外字段                                                                                          |

> **自定义属性扩展**：Task 接口支持添加任意自定义字段，例如：`priority`、`tags`、`status`、`department` 等业务相关字段。
>
> **前置任务字段说明**：
>
> - **标准格式**（推荐）：`predecessor: [1, 2, 3]` - number 数组
> - **兼容格式1**：`predecessor: '1,2,3'` - 逗号分隔的字符串
> - **兼容格式2**：`predecessor: ['1', '2', '3']` - 字符串数组
> - 组件内部会自动将所有格式统一解析为 number 数组
> - 无前置任务：使用空数组 `[]`、空字符串 `''` 或不设置该字段

#### 任务相关属性

| 属性名                | 类型             | 默认值      | 说明                                                           |
| --------------------- | ---------------- | ----------- | -------------------------------------------------------------- |
| `tasks`               | `Task[]`         | `[]`        | 任务数据数组                                                   |
| `useDefaultDrawer`    | `boolean`        | `true`      | 是否使用内置的任务编辑抽屉（TaskDrawer）                       |
| `taskBarConfig`       | `TaskBarConfig`  | `{}`        | 任务条样式配置，详见 [TaskBarConfig 配置](#taskbarconfig-配置) |
| `taskListConfig`      | `TaskListConfig` | `undefined` | 任务列表配置，详见 [TaskListConfig 配置](#tasklistconfig-配置) |
| `autoSortByStartDate` | `boolean`        | `false`     | 是否根据开始时间自动排序任务                                   |
| `enableTaskRowMove`        | `boolean` | `false`  | 是否允许拖拽和摆放TaskRow   |
| `assigneeOptions`           | `Array<{ key?: string \| number; value: string \| number; label: string }>`               | `[]`    | 任务编辑抽屉中负责人下拉菜单的选项列表          | 

**配置说明**：

- **默认模式**：`useDefaultDrawer=true`（默认），双击任务自动打开内置 TaskDrawer
- **自定义编辑器**：`useDefaultDrawer=false` 禁用内置抽屉，监听 `@task-double-click` 事件打开自定义编辑器
- **只读模式**：`useDefaultDrawer=false` 且不监听 `@task-double-click` 事件，用户双击任务无反应

#### 任务事件

> **💡 事件驱动架构**：组件采用纯事件驱动设计，所有用户操作（添加、编辑、删除、拖拽等）都会触发对应事件，方便外部监听和处理。

| 事件名               | 参数                                      | 触发时机                   | 说明                                                                                                                       |
| -------------------- | ----------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `add-task`           | -                                         | 点击工具栏"添加任务"按钮时 | 可用于自定义新增任务逻辑。如 `useDefaultDrawer=true`，组件会自动打开内置 TaskDrawer                                        |
| `task-click`         | `(task: Task, event: MouseEvent) => void` | 点击任务条时               | 单击任务触发                                                                                                               |
| `task-double-click`  | `(task: Task) => void`                    | 双击任务条时               | 双击任务时**始终触发**。`useDefaultDrawer=true` 时组件会额外打开内置编辑器，`false` 时不打开。事件触发与属性值无关         |
| `task-added`         | `{ task: Task }`                          | 任务添加后                 | 通过内置 TaskDrawer 添加任务后触发。**注意**：组件已自动更新 `tasks` 数据，外部只需监听此事件做额外处理（如调用 API 保存） |
| `task-updated`       | `{ task: Task }`                          | 任务更新后                 | 通过内置 TaskDrawer 或拖拽更新任务后触发。**注意**：组件已自动更新 `tasks` 数据，外部只需监听此事件做额外处理              |
| `task-deleted`       | `{ task: Task }`                          | 任务删除后                 | 通过内置 TaskDrawer 删除任务后触发。**注意**：组件已自动更新 `tasks` 数据，外部只需监听此事件做额外处理                    |
| `taskbar-drag-end`   | `(task: Task) => void`                    | 拖拽任务条结束时           | 任务位置变化，startDate 和 endDate 已更新。**注意**：组件已自动更新 `tasks` 数据                                           |
| `taskbar-resize-end` | `(task: Task) => void`                    | 调整任务条大小结束时       | 任务时长变化，endDate 已更新。**注意**：组件已自动更新 `tasks` 数据                                                        |
| `predecessor-added`  | `{ targetTask: Task, newTask: Task }`     | 通过右键菜单添加前置任务后 | `targetTask` 是被添加前置任务的任务，`newTask` 是新创建的前置任务                                                          |
| `successor-added`    | `{ targetTask: Task, newTask: Task }`     | 通过右键菜单添加后置任务后 | `targetTask` 是原任务，`newTask` 是新创建的后置任务（其 predecessor 已包含 targetTask.id）                                 |
| `timer-started`      | `(task: Task) => void`                    | 任务计时器启动时           | 开始记录任务工时                                                                                                           |
| `timer-stopped`      | `(task: Task) => void`                    | 任务计时器停止时           | 停止记录任务工时                                                                                                           |
| `task-row-moved`     | `payload: { draggedTask: Task, targetTask: Task, position: 'after' \| 'child', oldParent: Task \| null, newParent: Task \| null }` | 拖拽TaskRow结束（可选） | 组件已自动完成数据移动和TaskList/Timeline同步。监听此事件为完全可选，仅用于显示提示、调用API保存等。`position`: 'after'=同级放置，'child'=作为子任务 |

**数据同步说明**：

- ✅ **组件内部自动更新**：所有任务的增删改操作，组件都会自动更新 `props.tasks` 数据
- ✅ **事件仅做通知**：外部监听事件主要用于：显示提示消息、调用后端 API、更新其他相关数据等
- ❌ **避免重复操作**：不要在事件处理器中再次修改 `tasks` 数据，否则会导致重复更新

#### 示例1：基础任务操作

```vue
<template>
  <div style="height: 600px;">
    <GanttChart
      :tasks="tasks"
      :assignee-options="assigneeOptions"
      @add-task="handleAddTask"
      @task-added="handleTaskAdded"
      @task-updated="handleTaskUpdated"
      @task-deleted="handleTaskDeleted"
      @task-click="handleTaskClick"
      @taskbar-drag-end="handleTaskDragEnd"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import type { Task } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'

const tasks = ref<Task[]>([
  {
    id: 1,
    name: '项目规划',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progress: 100,
    assignee: '张三',
    estimatedHours: 40,
  },
  {
    id: 2,
    name: '需求分析',
    startDate: '2025-01-11',
    endDate: '2025-01-20',
    progress: 60,
    assignee: '李四',
    predecessor: [1], // 依赖任务1
  },
])

const assigneeOptions = ref([
  { value: 'zhangsan', label: '张三' },
  { value: 'lisi', label: '李四' },
  { value: 'wangwu', label: '王五' },
])

// 工具栏"添加任务"按钮点击事件
const handleAddTask = () => {
  console.log('准备新增任务...')
  // 组件会自动打开 TaskDrawer（如果 useDefaultDrawer=true）
  // 也可以在这里执行自定义逻辑，如显示提示消息
}

// 任务添加事件（通过内置抽屉添加）
const handleTaskAdded = (e: { task: Task }) => {
  console.log('新增任务:', e.task)
  // 注意：组件已自动将任务添加到 tasks 数组
  // 这里只需调用后端 API 保存即可
  // await api.createTask(e.task)
}

// 任务更新事件（通过内置抽屉或拖拽更新）
const handleTaskUpdated = (e: { task: Task }) => {
  console.log('更新任务:', e.task)
  // 注意：组件已自动更新 tasks 数组中的任务数据
  // 这里只需调用后端 API 更新即可
  // await api.updateTask(e.task.id, e.task)
}

// 任务删除事件
const handleTaskDeleted = (e: { task: Task }) => {
  console.log('删除任务:', e.task)
  // 注意：组件已自动从 tasks 数组中移除任务
  // 这里只需调用后端 API 删除即可
  // await api.deleteTask(e.task.id)
}

// 点击任务事件
const handleTaskClick = (task: Task) => {
  console.log('点击任务:', task.name)
}

// 拖拽任务结束事件
const handleTaskDragEnd = (task: Task) => {
  console.log('任务拖拽完成，新日期:', task.startDate, '至', task.endDate)
  // 可以在这里调用后端 API 保存新的日期
}
</script>
```

#### 示例2：任务依赖关系（前置任务/后置任务）

任务可以通过 `predecessor` 字段配置前置任务，组件会自动绘制依赖关系连线：

```vue
<template>
  <GanttChart
    :tasks="tasks"
    :assignee-options="assigneeOptions"
    @predecessor-added="handlePredecessorAdded"
    @successor-added="handleSuccessorAdded"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import type { Task } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'

const tasks = ref<Task[]>([
  {
    id: 1,
    name: '需求分析',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progress: 100,
    predecessor: [], // 无前置任务
  },
  {
    id: 2,
    name: '系统设计',
    startDate: '2025-01-11',
    endDate: '2025-01-20',
    progress: 80,
    predecessor: [1], // 依赖任务1（需求分析）
  },
  {
    id: 3,
    name: '数据库设计',
    startDate: '2025-01-11',
    endDate: '2025-01-18',
    progress: 90,
    predecessor: [1], // 依赖任务1
  },
  {
    id: 4,
    name: '前端开发',
    startDate: '2025-01-21',
    endDate: '2025-02-10',
    progress: 60,
    predecessor: [2], // 依赖任务2（系统设计）
  },
  {
    id: 5,
    name: '后端开发',
    startDate: '2025-01-19',
    endDate: '2025-02-08',
    progress: 70,
    predecessor: [2, 3], // 同时依赖任务2和3
  },
  {
    id: 6,
    name: '集成测试',
    startDate: '2025-02-11',
    endDate: '2025-02-20',
    progress: 30,
    predecessor: [4, 5], // 依赖前端和后端开发完成
  },
])

const assigneeOptions = ref([
  { value: 'zhangsan', label: '张三' },
  { value: 'lisi', label: '李四' },
  { value: 'wangwu', label: '王五' },
])

// 通过右键菜单添加前置任务时触发
const handlePredecessorAdded = (event: { targetTask: Task; newTask: Task }) => {
  console.log(`任务 [${event.targetTask.name}] 添加了前置任务 [${event.newTask.name}]`)
  // 组件会自动更新 targetTask 的 predecessor 数组（追加新任务 ID）
  // 这里可以调用后端 API 保存依赖关系
  // await api.addTaskDependency(event.targetTask.id, event.newTask.id)
}

// 通过右键菜单添加后置任务时触发
const handleSuccessorAdded = (event: { targetTask: Task; newTask: Task }) => {
  console.log(`任务 [${event.targetTask.name}] 添加了后置任务 [${event.newTask.name}]`)
  // 组件会自动更新 newTask 的 predecessor 数组（将 targetTask.id 添加进去）
  // 这里可以调用后端 API 保存依赖关系
  // await api.addTaskDependency(event.newTask.id, event.targetTask.id)
}
</script>
```

**依赖关系说明**：

- **`predecessor` 字段支持多种格式**：
  - 标准格式（推荐）：`[1, 2, 3]` - number 数组
  - 兼容格式1：`'1,2,3'` - 逗号分隔的字符串
  - 兼容格式2：`['1', '2', '3']` - 字符串数组
  - 组件会自动解析所有格式
- 前置任务：必须先完成的任务（例如：设计完成后才能开发）
- 后置任务：依赖当前任务的任务（当前任务是其他任务的前置任务）
- 组件会自动绘制依赖关系连线，从前置任务指向依赖它的任务
- 可以通过内置右键菜单添加/删除前置任务和后置任务
- 内置菜单删除任务时，组件会自动清理相关的依赖关系引用
- 无前置任务：使用空数组 `[]`、空字符串 `''` 或不设置 `predecessor` 字段

#### 示例3：隐藏工具栏，使用自定义按钮触发事件

适用于需要完全自定义控制栏的场景：

```vue
<template>
  <div>
    <!-- 自定义控制栏 -->
    <div class="custom-toolbar">
      <button @click="triggerAddTask">新增任务</button>
      <button @click="triggerAddMilestone">新增里程碑</button>
      <!-- 其他自定义按钮... -->
    </div>

    <!-- 甘特图组件，隐藏内置工具栏 -->
    <GanttChart
      :tasks="tasks"
      :milestones="milestones"
      :show-toolbar="false"
      :use-default-drawer="true"
      :use-default-milestone-dialog="true"
      :assignee-options="assigneeOptions"
      @add-task="handleAddTask"
      @add-milestone="handleAddMilestone"
      @task-added="handleTaskAdded"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'

const tasks = ref([])
const milestones = ref([])

const assigneeOptions = ref([
  { value: 'zhangsan', label: '张三' },
  { value: 'lisi', label: '李四' },
  { value: 'wangwu', label: '王五' },
])

// 自定义按钮触发事件（组件会响应并打开内置编辑器）
const triggerAddTask = () => {
  // 直接触发组件的 add-task 事件
  // 由于 useDefaultDrawer=true，组件会自动打开 TaskDrawer
}

const triggerAddMilestone = () => {
  // 直接触发组件的 add-milestone 事件
  // 由于 useDefaultMilestoneDialog=true，组件会自动打开 MilestoneDialog
}

// 监听事件处理逻辑
const handleAddTask = () => {
  console.log('准备新增任务（由自定义按钮触发）')
}

const handleAddMilestone = () => {
  console.log('准备新增里程碑（由自定义按钮触发）')
}

const handleTaskAdded = e => {
  console.log('任务已添加:', e.task)
  // 调用 API 保存...
}
</script>
```

> **💡 灵活性设计**：
>
> - 显示工具栏 + 默认编辑器：最简单的开箱即用方式
> - 隐藏工具栏 + 自定义按钮 + 默认编辑器：自定义控制栏样式，保留默认编辑功能
> - 隐藏工具栏 + 自定义按钮 + 自定义编辑器：完全自定义所有交互逻辑

#### 示例4：任务行拖拽排序

允许用户通过拖拽 TaskRow 来调整任务的层级关系和前后顺序：

```vue
<template>
  <div style="height: 600px;">
    <GanttChart
      :tasks="tasks"
      :enable-task-row-move="true"
      :assignee-options="assigneeOptions"
      @task-row-moved="handleTaskRowMoved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import type { Task } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'

const tasks = ref<Task[]>([
  {
    id: 1,
    name: '项目规划',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progress: 100,
  },
  {
    id: 2,
    name: '需求分析',
    startDate: '2025-01-11',
    endDate: '2025-01-20',
    progress: 60,
    parentId: 1,
  },
  {
    id: 3,
    name: '系统设计',
    startDate: '2025-01-21',
    endDate: '2025-01-30',
    progress: 40,
  },
])

const assigneeOptions = ref([
  { value: 'zhangsan', label: '张三' },
  { value: 'lisi', label: '李四' },
  { value: 'wangwu', label: '王五' },
])

// 任务行拖拽完成事件（可选）
const handleTaskRowMoved = async (payload: {
  draggedTask: Task
  targetTask: Task
  position: 'after' | 'child'
  oldParent: Task | null
  newParent: Task | null
}) => {
  const { draggedTask, targetTask, position, oldParent, newParent } = payload
  
  // 组件已自动完成任务移动、parentId更新和TaskList/Timeline同步
  // 监听此事件为完全可选，仅用于：
  
  // 1. 显示自定义提示消息
  const oldParentName = oldParent?.name || '根目录'
  const newParentName = newParent?.name || '根目录'
  const positionText = position === 'after' ? '在目标任务之后' : '作为目标任务的子任务'
  showMessage(`任务 [${draggedTask.name}] 已从 [${oldParentName}] 移动到 [${newParentName}] (${positionText})`, 'success')
  
  // 2. 调用后端 API 保存新的任务层级关系
  try {
    await api.updateTaskHierarchy({
      taskId: draggedTask.id,
      targetTaskId: targetTask.id,
      position: position,
      oldParentId: oldParent?.id,
      newParentId: newParent?.id,
    })
  } catch (error) {
    console.error('保存任务层级失败:', error)
    showMessage('保存失败，请刷新页面', 'error')
  }
  
  // 3. 触发其他业务逻辑（如更新关联数据、记录操作日志等）
  // ...
}
</script>
```

**拖拽排序说明**：

- **启用拖拽**：设置 `enable-task-row-move="true"` 启用任务行拖拽功能（默认为 `false`）
- **拖拽算法**（组件内部自动执行）：
  - **算法1（放置在后面）**：当目标任务没有子任务时，被拖拽的任务会放置在目标任务之后（同级），`position='after'`
  - **算法2（作为子任务）**：当目标任务有子任务时，被拖拽的任务会成为目标任务的第一个子任务，`position='child'`
- **视觉反馈**：
  - 拖拽时会显示半透明的跟随元素
  - 悬停在有效目标任务上时显示蓝色边框提示
  - 无子任务的任务显示蓝色底部边框
  - 有子任务的任务显示蓝色四周边框
- **自动同步**：组件内部通过对象引用直接修改 `props.tasks`，自动完成任务移动、`parentId` 更新、`children` 数组调整以及 TaskList/Timeline 同步
- **事件监听（可选）**：
  - `task-row-moved` 事件为完全可选，仅用于显示提示、调用API保存、记录日志等额外处理
  - 无需手动更新 `tasks.value`，组件已自动完成数据同步
- **事件参数**：
  - `draggedTask`: 被拖拽的任务
  - `targetTask`: 目标任务
  - `position`: 放置位置（'after' 或 'child'）
  - `oldParent`: 原父任务（null 表示根目录）
  - `newParent`: 新父任务（null 表示根目录）
- **限制条件**：
  - 不能拖拽到自己身上
  - 不能拖拽到自己的子任务上（避免循环引用）
  - 里程碑和里程碑分组不能被拖拽

### 里程碑管理

里程碑用于标记项目中的重要时间节点，如项目启动、阶段完成、产品发布等。组件提供了灵活的里程碑编辑配置，默认使用内置的 MilestoneDialog，也支持完全自定义编辑行为。

> **注意**: 里程碑与任务是独立的数据集合，不存在直接关联关系。里程碑通过 `milestones` 属性独立管理。

#### Milestone 数据结构

| 字段名        | 类型     | 必填 | 默认值        | 说明                                                       |
| ------------- | -------- | ---- | ------------- | ---------------------------------------------------------- |
| `id`          | `number` | ✅   | -             | 里程碑唯一标识符                                           |
| `name`        | `string` | ✅   | -             | 里程碑名称                                                 |
| `startDate`   | `string` | ✅   | -             | 里程碑日期，格式：'YYYY-MM-DD' 或 'YYYY-MM-DD HH:mm'       |
| `endDate`     | `string` | -    | -             | 结束日期（通常里程碑不需要，自动设置为与 startDate 相同）  |
| `assignee`    | `string` | -    | -             | 负责人                                                     |
| `type`        | `string` | ✅   | `'milestone'` | 类型标识，必须设为 'milestone'                             |
| `icon`        | `string` | -    | `'diamond'`   | 里程碑图标，可选值：'diamond', 'flag', 'star', 'rocket' 等 |
| `description` | `string` | -    | -             | 里程碑描述                                                 |

> **注意**：`milestones` 属性的类型为 `Task[]`，需要确保每个里程碑对象的 `type` 字段设置为 `'milestone'`。

#### 里程碑相关属性

| 属性名                      | 类型      | 默认值 | 说明                                                     |
| --------------------------- | --------- | ------ | -------------------------------------------------------- |
| `milestones`                | `Task[]`  | `[]`   | 里程碑数据数组（类型为 Task[]，需确保 type='milestone'） |
| `useDefaultMilestoneDialog` | `boolean` | `true` | 是否使用内置的里程碑编辑对话框（MilestoneDialog）        |

**配置说明**：

- **默认模式**：`useDefaultMilestoneDialog=true`（默认），双击里程碑自动打开内置 MilestoneDialog
- **禁用编辑器**：`useDefaultMilestoneDialog=false`，双击里程碑无反应（组件不打开任何编辑器）
- **自定义编辑器**：可以监听 `onMilestoneDoubleClick` 回调或相关事件，实现自定义编辑逻辑

> **💡 里程碑与任务的区别**：
>
> - 里程碑数据通过 `milestones` 属性独立管理，与 `tasks` 分开
> - 里程碑对象的 `type` 字段必须设置为 `'milestone'`
> - 里程碑不支持子任务、依赖关系等复杂结构
> - 里程碑主要用于标记关键时间节点

#### 里程碑回调函数（向后兼容）

> **⚠️ 已废弃**：请使用新的事件驱动 API（见下方"里程碑事件"章节）

#### 里程碑事件

> **💡 事件驱动架构**：里程碑管理采用事件驱动设计，推荐使用事件 API 替代回调函数。

| 事件名                   | 参数                                    | 触发时机                     | 说明                                                                                                                                   |
| ------------------------ | --------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `add-milestone`          | -                                       | 点击工具栏"添加里程碑"按钮时 | 可用于自定义新增里程碑逻辑。如 `useDefaultMilestoneDialog=true`，组件会自动打开内置 MilestoneDialog                                    |
| `milestone-saved`        | `(milestone: Task) => void`             | 里程碑保存后（新增或编辑）   | 通过内置 MilestoneDialog 保存里程碑后触发。**注意**：组件已自动更新 `milestones` 数据，外部只需监听此事件做额外处理（如调用 API 保存） |
| `milestone-deleted`      | `{ milestoneId: number }`               | 里程碑删除后                 | 通过内置 MilestoneDialog 删除里程碑后触发。**注意**：组件已自动更新 `milestones` 数据，外部只需监听此事件做额外处理                    |
| `milestone-icon-changed` | `{ milestoneId: number, icon: string }` | 里程碑图标变更后             | 通过内置 MilestoneDialog 修改图标后触发                                                                                                |
| `milestone-drag-end`     | `(milestone: Task) => void`             | 拖拽里程碑结束时             | 里程碑日期已更新。**注意**：组件已自动更新 `milestones` 数据                                                                           |

**数据同步说明**：

- ✅ **组件内部自动更新**：所有里程碑的增删改操作，组件都会自动更新 `props.milestones` 数据
- ✅ **事件仅做通知**：外部监听事件主要用于：显示提示消息、调用后端 API、更新其他相关数据等
- ❌ **避免重复操作**：不要在事件处理器中再次修改 `milestones` 数据，否则会导致重复更新

#### 示例1：使用事件驱动 API（推荐）

使用新的事件 API，组件会自动管理数据，更加简洁：

```vue
<template>
  <div style="height: 600px;">
    <GanttChart
      :milestones="milestones"
      @add-milestone="handleAddMilestone"
      @milestone-saved="handleMilestoneSaved"
      @milestone-deleted="handleMilestoneDeleted"
      @milestone-icon-changed="handleMilestoneIconChanged"
      @milestone-drag-end="handleMilestoneDrag"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import type { Task } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'

const milestones = ref<Task[]>([
  {
    id: 101,
    name: '项目启动',
    startDate: '2025-01-01',
    type: 'milestone',
    icon: 'diamond',
    assignee: '项目经理',
    description: '项目正式启动',
  },
  {
    id: 102,
    name: '需求评审',
    startDate: '2025-01-15',
    type: 'milestone',
    icon: 'flag',
  },
])

// 工具栏"添加里程碑"按钮点击事件
const handleAddMilestone = () => {
  console.log('准备新增里程碑...')
  // 组件会自动打开 MilestoneDialog（如果 useDefaultMilestoneDialog=true）
}

// 里程碑保存事件（添加或编辑）
const handleMilestoneSaved = (milestone: Task) => {
  console.log('里程碑已保存:', milestone)
  // 注意：组件已自动更新 milestones 数组
  // 这里只需调用后端 API 保存即可
  // await api.saveMilestone(milestone)
}

// 里程碑删除事件
const handleMilestoneDeleted = (e: { milestoneId: number }) => {
  console.log('里程碑已删除, ID:', e.milestoneId)
  // 注意：组件已自动从 milestones 数组中移除
  // 这里只需调用后端 API 删除即可
  // await api.deleteMilestone(e.milestoneId)
}

// 里程碑图标变更事件
const handleMilestoneIconChanged = (e: { milestoneId: number; icon: string }) => {
  console.log('里程碑图标已变更:', e.milestoneId, '->', e.icon)
  // 组件已自动更新图标，这里可以调用 API 保存
  // await api.updateMilestoneIcon(e.milestoneId, e.icon)
}

// 拖拽里程碑结束事件
const handleMilestoneDrag = (milestone: Task) => {
  console.log('里程碑拖拽完成，新日期:', milestone.startDate)
  // 组件已自动更新日期，这里可以调用 API 保存
  // await api.updateMilestoneDate(milestone.id, milestone.startDate)
}
</script>
```

#### 示例2：使用自定义里程碑编辑对话框

如果需要完全自定义里程碑编辑界面，可以禁用内置对话框并使用自己的组件：

```vue
<template>
  <div style="height: 600px;">
    <GanttChart
      :milestones="milestones"
      :use-default-milestone-dialog="false"
      @add-milestone="handleAddMilestone"
      @milestone-saved="handleMilestoneSaved"
      @milestone-deleted="handleMilestoneDeleted"
      @milestone-drag-end="handleMilestoneDrag"
    />

    <!-- 自定义里程碑编辑对话框 -->
    <CustomMilestoneDialog
      v-model:visible="customDialogVisible"
      :milestone="editingMilestone"
      :is-new="isNewMilestone"
      @save="handleCustomDialogSave"
      @delete="handleCustomDialogDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
import CustomMilestoneDialog from './CustomMilestoneDialog.vue'
import type { Task } from 'jordium-gantt-vue3'

const milestones = ref<Task[]>([
  {
    id: 101,
    name: '项目启动',
    startDate: '2025-01-01',
    type: 'milestone',
    icon: 'diamond',
    assignee: '项目经理',
    description: '项目正式启动',
  },
])

const customDialogVisible = ref(false)
const editingMilestone = ref<Task | null>(null)
const isNewMilestone = ref(false)

// 点击工具栏"添加里程碑"按钮
const handleAddMilestone = () => {
  editingMilestone.value = null
  isNewMilestone.value = true
  customDialogVisible.value = true
}

// 双击里程碑时打开自定义对话框
// 注意：需要监听 Timeline 组件的里程碑双击事件
// 或者通过外部按钮/列表项触发编辑
const openEditDialog = (milestone: Task) => {
  editingMilestone.value = { ...milestone }
  isNewMilestone.value = false
  customDialogVisible.value = true
}

// 自定义对话框保存事件
const handleCustomDialogSave = (milestone: Task) => {
  if (isNewMilestone.value) {
    // 新增里程碑
    const newMilestone = {
      ...milestone,
      id: Date.now(), // 生成新 ID
      type: 'milestone',
    }
    milestones.value.push(newMilestone)

    // 调用后端 API 保存
    // await api.createMilestone(newMilestone)
  } else {
    // 更新现有里程碑
    const index = milestones.value.findIndex(m => m.id === milestone.id)
    if (index !== -1) {
      milestones.value[index] = { ...milestone }
    }

    // 调用后端 API 更新
    // await api.updateMilestone(milestone)
  }

  customDialogVisible.value = false
}

// 自定义对话框删除事件
const handleCustomDialogDelete = (milestoneId: number) => {
  const index = milestones.value.findIndex(m => m.id === milestoneId)
  if (index !== -1) {
    milestones.value.splice(index, 1)
  }

  // 调用后端 API 删除
  // await api.deleteMilestone(milestoneId)

  customDialogVisible.value = false
}

// 以下事件处理器仍然有效（用于拖拽等操作）
const handleMilestoneSaved = (milestone: Task) => {
  console.log('里程碑已保存（通过其他方式）:', milestone)
}

const handleMilestoneDeleted = (e: { milestoneId: number }) => {
  console.log('里程碑已删除（通过其他方式）:', e.milestoneId)
}

const handleMilestoneDrag = (milestone: Task) => {
  console.log('里程碑拖拽完成:', milestone.startDate)
  // 调用 API 更新日期
  // await api.updateMilestoneDate(milestone.id, milestone.startDate)
}
</script>
```

**自定义对话框组件示例** (`CustomMilestoneDialog.vue` - 使用 Element Plus)：

> **注意**：以下示例使用 Element Plus UI 框架。你也可以使用其他 UI 框架（如 Ant Design Vue、Naive UI 等）或原生 HTML 实现。

```vue
<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isNew ? '新增里程碑' : '编辑里程碑'"
    width="500px"
    @close="handleClose"
  >
    <el-form :model="form" label-width="100px">
      <el-form-item label="里程碑名称">
        <el-input v-model="form.name" placeholder="请输入里程碑名称" />
      </el-form-item>

      <el-form-item label="日期">
        <el-date-picker
          v-model="form.startDate"
          type="date"
          placeholder="选择日期"
          value-format="YYYY-MM-DD"
        />
      </el-form-item>

      <el-form-item label="负责人">
        <el-input v-model="form.assignee" placeholder="请输入负责人" />
      </el-form-item>

      <el-form-item label="图标">
        <el-select v-model="form.icon" placeholder="选择图标">
          <el-option label="钻石" value="diamond" />
          <el-option label="旗帜" value="flag" />
          <el-option label="星星" value="star" />
          <el-option label="火箭" value="rocket" />
        </el-select>
      </el-form-item>

      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入描述" />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button v-if="!isNew" type="danger" @click="handleDelete"> 删除 </el-button>
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Task } from 'jordium-gantt-vue3'

interface Props {
  visible: boolean
  milestone: Task | null
  isNew: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [milestone: Task]
  delete: [milestoneId: number]
}>()

const dialogVisible = ref(false)
const form = ref({
  id: 0,
  name: '',
  startDate: '',
  assignee: '',
  icon: 'diamond',
  description: '',
  type: 'milestone',
})

watch(
  () => props.visible,
  val => {
    dialogVisible.value = val
    if (val) {
      if (props.milestone) {
        // 编辑模式，填充数据
        form.value = { ...props.milestone }
      } else {
        // 新增模式，重置表单
        form.value = {
          id: 0,
          name: '',
          startDate: new Date().toISOString().split('T')[0],
          assignee: '',
          icon: 'diamond',
          description: '',
          type: 'milestone',
        }
      }
    }
  }
)

watch(dialogVisible, val => {
  emit('update:visible', val)
})

const handleClose = () => {
  dialogVisible.value = false
}

const handleSave = () => {
  if (!form.value.name || !form.value.startDate) {
    alert('请填写必填项')
    return
  }
  emit('save', { ...form.value })
}

const handleDelete = () => {
  if (confirm('确定要删除这个里程碑吗？')) {
    emit('delete', form.value.id)
  }
}
</script>
```

> **💡 自定义对话框说明**：
>
> - 设置 `use-default-milestone-dialog="false"` 禁用内置对话框
> - 监听 `@add-milestone` 事件打开自定义对话框
> - 需要手动管理 `milestones` 数组的增删改
> - 仍然可以监听其他事件（如 `@milestone-drag-end`）处理拖拽等操作
> - 适合需要复杂表单验证、特殊 UI 设计或额外字段的场景

---

## ⚙️ 配置与扩展

本章节详细介绍 GanttChart 组件的配置选项和扩展能力，包括组件配置、主题与国际化、自定义扩展三个部分。

### 任务类型定义

任务类型（`type` 字段）用于区分不同类型的任务，组件内部会根据类型执行不同的逻辑判断。

#### 内置任务类型

| 类型值  | 说明       | 默认值 |
| ------- | ---------- | ------ |
| `story` | 用户故事   | -      |
| `task`  | 普通任务   | ✅     |
| `bug`   | 缺陷/问题  | -      |

#### 功能区分

不同任务类型在组件中具有不同的功能特性：

| 功能             | story | task | bug |
| ---------------- | ----- | ---- | --- |
| 可作为上级任务   | ✅    | ✅   | ❌  |
| 可作为前置任务   | ❌    | ✅   | ❌  |
| 支持计时器       | ❌    | ✅   | ✅  |
| 自动视为父任务   | ✅    | ❌   | ❌  |
| 删除时特殊提示   | ✅    | ❌   | ❌  |

#### 注意事项

> ⚠️ **重要提示**
>
> 1. 任务类型值为组件内置判断使用，**请勿随意修改**这些枚举值
> 2. 客制化 TaskDrawer 时，必须保持 `story`、`task`、`bug` 这三个枚举值
> 3. 如需添加其他业务标签，建议使用自定义属性字段，例如：`customType`、`category`、`label` 等

**示例：使用自定义标签**

```typescript
const tasks = ref([
  {
    id: 1,
    name: '需求分析',
    type: 'task', // 保持组件内置类型
    customType: 'requirement', // 自定义业务类型
    category: 'analysis', // 自定义分类
    startDate: '2025-01-01',
    endDate: '2025-01-10',
  },
])
```

### 组件配置

#### ToolbarConfig（工具栏配置）

自定义工具栏显示的功能按钮和时间刻度选项。

**类型定义：**

| 字段名                | 类型              | 默认值                                                | 说明                                                                                                  |
| --------------------- | ----------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `showAddTask`         | `boolean`         | `true`                                                | 显示"添加任务"按钮                                                                                    |
| `showAddMilestone`    | `boolean`         | `true`                                                | 显示"添加里程碑"按钮                                                                                  |
| `showTodayLocate`     | `boolean`         | `true`                                                | 显示"定位到今天"按钮                                                                                  |
| `showExportCsv`       | `boolean`         | `true`                                                | 显示"导出 CSV"按钮                                                                                    |
| `showExportPdf`       | `boolean`         | `true`                                                | 显示"导出 PDF"按钮                                                                                    |
| `showLanguage`        | `boolean`         | `true`                                                | 显示"语言切换"按钮（中/英文）                                                                         |
| `showTheme`           | `boolean`         | `true`                                                | 显示"主题切换"按钮（亮色/暗色）                                                                       |
| `showFullscreen`      | `boolean`         | `true`                                                | 显示"全屏"按钮                                                                                        |
| `showTimeScale`       | `boolean`         | `true`                                                | 显示时间刻度按钮组（控制整组按钮的显隐）                                                              |
| `timeScaleDimensions` | `TimelineScale[]` | `['hour', 'day', 'week', 'month', 'quarter', 'year']` | 设置时间刻度按钮组要显示的维度，可选值：`'hour'`、`'day'`、`'week'`、`'month'`、`'quarter'`、`'year'` |
| `defaultTimeScale`    | `TimelineScale`   | `'week'`                                              | 默认选中的时间刻度                                                                                    |
| `showExpandCollapse`  | `boolean`         | `true`                                                | 显示"全部展开/折叠"按钮（用于父子任务树形结构）                                                       |

**TimelineScale 类型说明：**

```typescript
type TimelineScale = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'

// 也可以使用常量形式
import { TimelineScale } from 'jordium-gantt-vue3'

TimelineScale.HOUR // 'hour' - 小时视图
TimelineScale.DAY // 'day' - 日视图
TimelineScale.WEEK // 'week' - 周视图
TimelineScale.MONTH // 'month' - 月视图
TimelineScale.QUARTER // 'quarter' - 季度视图
TimelineScale.YEAR // 'year' - 年视图
```

**示例1：完整配置（显示所有功能）**

```vue
<template>
  <GanttChart :tasks="tasks" :toolbar-config="toolbarConfig" />
</template>

<script setup lang="ts">
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
import type { ToolbarConfig } from 'jordium-gantt-vue3'

const toolbarConfig: ToolbarConfig = {
  showAddTask: true, // 显示添加任务按钮
  showAddMilestone: true, // 显示添加里程碑按钮
  showTodayLocate: true, // 显示定位到今天按钮
  showExportCsv: true, // 显示导出CSV按钮
  showExportPdf: true, // 显示导出PDF按钮
  showLanguage: true, // 显示语言切换按钮
  showTheme: true, // 显示主题切换按钮
  showFullscreen: true, // 显示全屏按钮
  showTimeScale: true, // 显示时间刻度按钮组
  timeScaleDimensions: [
    // 显示所有时间刻度维度
    'hour',
    'day',
    'week',
    'month',
    'quarter',
    'year',
  ],
  defaultTimeScale: 'week', // 默认选中周视图
  showExpandCollapse: true, // 显示展开/折叠按钮
}
</script>
```

**示例2：精简配置（只显示常用功能）**

```vue
<script setup lang="ts">
import type { ToolbarConfig } from 'jordium-gantt-vue3'

const toolbarConfig: ToolbarConfig = {
  showAddTask: true, // 保留添加任务
  showAddMilestone: true, // 保留添加里程碑
  showTodayLocate: true, // 保留定位今天
  showExportCsv: false, // 隐藏导出CSV
  showExportPdf: false, // 隐藏导出PDF
  showLanguage: false, // 隐藏语言切换（固定使用一种语言）
  showTheme: true, // 保留主题切换
  showFullscreen: true, // 保留全屏
  showTimeScale: true, // 显示时间刻度
  timeScaleDimensions: [
    // 只显示日/周/月三种刻度
    'day',
    'week',
    'month',
  ],
  defaultTimeScale: 'week', // 默认周视图
  showExpandCollapse: true, // 保留展开/折叠
}
</script>
```

**示例3：使用 TimelineScale 常量**

```vue
<script setup lang="ts">
import { TimelineScale } from 'jordium-gantt-vue3'
import type { ToolbarConfig } from 'jordium-gantt-vue3'

const toolbarConfig: ToolbarConfig = {
  showTimeScale: true,
  timeScaleDimensions: [
    TimelineScale.DAY,
    TimelineScale.WEEK,
    TimelineScale.MONTH,
    TimelineScale.QUARTER,
  ],
  defaultTimeScale: TimelineScale.MONTH, // 默认月视图
}
</script>
```

**示例4：极简配置（适合嵌入式使用）**

```vue
<script setup lang="ts">
import type { ToolbarConfig } from 'jordium-gantt-vue3'

const toolbarConfig: ToolbarConfig = {
  showAddTask: false, // 隐藏所有编辑按钮
  showAddMilestone: false,
  showTodayLocate: true, // 只保留导航功能
  showExportCsv: false,
  showExportPdf: false,
  showLanguage: false,
  showTheme: false,
  showFullscreen: false,
  showTimeScale: true, // 保留时间刻度切换
  timeScaleDimensions: ['week', 'month'],
  defaultTimeScale: 'month',
  showExpandCollapse: false, // 隐藏展开/折叠
}
</script>
```

> **💡 配置建议**：
>
> - **默认配置**：不传 `toolbar-config` 时，所有按钮默认显示
> - **按需显示**：根据业务需求隐藏不需要的功能按钮
> - **时间刻度**：`timeScaleDimensions` 控制显示哪些时间维度，建议选择 2-4 个常用维度
> - **响应式布局**：工具栏会自动适配容器宽度，按钮过多时会折叠到更多菜单中

#### TaskListConfig（任务列表配置）

自定义任务列表的显示列、宽度限制等。任务列表位于甘特图左侧，显示任务的详细信息。

**类型定义：**

| 字段名           | 类型                     | 默认值  | 说明                                                                           |
| ---------------- | ------------------------ | ------- | ------------------------------------------------------------------------------ |
| `columns`        | `TaskListColumnConfig[]` | 默认8列 | 任务列表的列配置数组，定义显示哪些列及其属性                                   |
| `showAllColumns` | `boolean`                | `true`  | 是否显示所有列。`true` 时忽略 `columns` 中的 `visible` 设置                    |
| `defaultWidth`   | `number \| string`       | `320`   | 默认展开宽度。支持像素数字（如 `320`）或百分比字符串（如 `'30%'`）             |
| `minWidth`       | `number \| string`       | `280`   | 最小宽度。支持像素数字（如 `280`）或百分比字符串（如 `'20%'`）。不能小于 280px |
| `maxWidth`       | `number \| string`       | `1160`  | 最大宽度。支持像素数字（如 `1160`）或百分比字符串（如 `'80%'`）                |
| `showTaskIcon`       | `boolean`       | `true`  | 是否展示任务图标                |

**TaskListColumnConfig 类型定义：**

| 字段名     | 类型      | 必填 | 说明                                                             |
| ---------- | --------- | ---- | ---------------------------------------------------------------- |
| `key`      | `string`  | ✅   | 列的唯一标识符，用于访问 Task 对象中的字段，也用于国际化         |
| `label`    | `string`  | -    | 列的显示标签（表头文字）                                         |
| `cssClass` | `string`  | -    | 自定义 CSS 类名                                                  |
| `width`    | `number`  | -    | 列宽度（单位：像素）                                             |
| `visible`  | `boolean` | -    | 是否显示该列，默认 `true`。当 `showAllColumns=true` 时此设置无效 |

**示例1：基础配置（调整宽度）**

```vue
<template>
  <GanttChart :tasks="tasks" :task-list-config="taskListConfig" />
</template>

<script setup lang="ts">
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
import type { TaskListConfig } from 'jordium-gantt-vue3'

const taskListConfig: TaskListConfig = {
  defaultWidth: 450, // 默认宽度450px（比默认值320px更宽）
  minWidth: 300, // 最小宽度300px
  maxWidth: 1200, // 最大宽度1200px
}
</script>
```

**示例2：使用百分比宽度**

```vue
<template>
  <GanttChart :tasks="tasks" :task-list-config="taskListConfig" />
</template>

<script setup lang="ts">
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
import type { TaskListConfig } from 'jordium-gantt-vue3'

const taskListConfig: TaskListConfig = {
  defaultWidth: '25%', // 默认占容器宽度的25%
  minWidth: '15%', // 最小占15%
  maxWidth: '60%', // 最大占60%
}
</script>
```

**示例3：自定义显示列（标准配置）**

根据业务需求，可以自定义要显示的列、列宽度和显示顺序。建议先定义列配置数组，再赋值给 `columns` 属性。

```vue
<template>
  <GanttChart :tasks="tasks" :task-list-config="taskListConfig" />
</template>

<script setup lang="ts">
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
import type { TaskListConfig, TaskListColumnConfig } from 'jordium-gantt-vue3'

// 定义要显示的列配置
const columns: TaskListColumnConfig[] = [
  { key: 'predecessor', label: '前置任务', visible: true },
  { key: 'assignee', label: '负责人', visible: true },
  { key: 'startDate', label: '开始日期', visible: true },
  { key: 'endDate', label: '结束日期', visible: true },
  { key: 'estimatedHours', label: '预估工时', visible: true },
  { key: 'actualHours', label: '实际工时', visible: true },
  { key: 'progress', label: '进度', visible: true },
]

const taskListConfig: TaskListConfig = {
  columns,
  defaultWidth: 450,
  minWidth: 300,
  maxWidth: 1200,
}
</script>
```

**示例4：精简列配置**

只显示核心信息列，适合空间有限或需要简洁展示的场景。

```vue
<script setup lang="ts">
import type { TaskListConfig, TaskListColumnConfig } from 'jordium-gantt-vue3'

// 定义精简列配置
const columns: TaskListColumnConfig[] = [
  { key: 'name', label: '任务', visible: true },
  { key: 'assignee', label: '负责人', width: 80, visible: true },
  { key: 'progress', label: '进度', width: 60, visible: true },
]

const taskListConfig: TaskListConfig = {
  columns,
  defaultWidth: 350,
  minWidth: 280,
  maxWidth: 500,
  showAllColumns: false, // 只显示 visible=true 的列
}
</script>
```

**示例5：自定义业务列**

添加业务相关的自定义列，需要确保 Task 对象中包含对应字段。

```vue
<script setup lang="ts">
import type { TaskListConfig, TaskListColumnConfig } from 'jordium-gantt-vue3'

// 定义包含自定义列的配置
const columns: TaskListColumnConfig[] = [
  { key: 'name', label: '任务名称', visible: true },
  { key: 'priority', label: '优先级', width: 80, visible: true }, // 自定义列
  { key: 'department', label: '部门', width: 100, visible: true }, // 自定义列
  { key: 'status', label: '状态', width: 80, visible: true }, // 自定义列
  { key: 'assignee', label: '负责人', visible: true },
  { key: 'startDate', label: '开始日期', visible: true },
  { key: 'endDate', label: '结束日期', visible: true },
  { key: 'progress', label: '进度', visible: true },
]

const taskListConfig: TaskListConfig = {
  columns,
}
</script>
```

**示例6：动态列配置**

配合 `ref` 和 `computed` 实现列的动态显示/隐藏和宽度调整。

```vue
<template>
  <GanttChart :tasks="tasks" :task-list-config="taskListConfig" />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
import type { TaskListConfig, TaskListColumnConfig } from 'jordium-gantt-vue3'

// 定义可动态配置的列
const availableColumns = ref<TaskListColumnConfig[]>([
  { key: 'predecessor', label: '前置任务', visible: true },
  { key: 'assignee', label: '负责人', visible: true },
  { key: 'startDate', label: '开始日期', visible: true },
  { key: 'endDate', label: '结束日期', visible: true },
  { key: 'estimatedHours', label: '预估工时', visible: true },
  { key: 'actualHours', label: '实际工时', visible: true },
  { key: 'progress', label: '进度', visible: true },
  { key: 'custom', label: '自定义列', visible: true, width: 120 },
])

// 定义宽度配置
const taskListWidth = ref({
  defaultWidth: 450,
  minWidth: 300,
  maxWidth: 1200,
})

// 使用计算属性动态生成配置
const taskListConfig = computed<TaskListConfig>(() => ({
  columns: availableColumns.value,
  defaultWidth: taskListWidth.value.defaultWidth,
  minWidth: taskListWidth.value.minWidth,
  maxWidth: taskListWidth.value.maxWidth,
}))
</script>
```

> **💡 配置说明**：
>
> - **默认行为**：不传 `task-list-config` 时，显示所有 8 个默认列，宽度为 320px
> - **宽度单位**：支持像素（`number`）和百分比（`string`，如 `'30%'`）两种方式
> - **百分比计算**：基于甘特图容器的总宽度，响应式调整
> - **列顺序**：`columns` 数组的顺序决定列的显示顺序
> - **列配置规范**：建议先定义 `TaskListColumnConfig[]` 类型的列数组，再赋值给 `columns` 属性
> - **自定义列支持**：Task 接口通过 `[key: string]: unknown` 索引签名支持任意自定义字段，组件会通过 `task[column.key]` 动态读取列值，无需修改 Task 接口即可添加自定义列
> - **动态配置**：配合 `ref` 和 `computed` 可实现列的动态显示/隐藏和宽度调整
> - **最小宽度限制**：`minWidth` 不能小于 280px，这是保证基本可用性的最小值

#### TaskBarConfig（任务条配置）

控制任务条的显示内容和交互行为。

**配置字段：**

| 字段名              | 类型      | 默认值  | 说明                            |
| ------------------- | --------- | ------- | ------------------------------- |
| `showAvatar`        | `boolean` | `true`  | 是否展示头像                    |
| `showTitle`         | `boolean` | `true`  | 是否展示标题文字                |
| `showProgress`      | `boolean` | `true`  | 是否展示进度文字                |
| `dragThreshold`     | `number`  | `5`     | 拖拽触发阈值（像素）            |
| `resizeHandleWidth` | `number`  | `5`     | 拉伸手柄宽度（像素），最大 15px |
| `enableDragDelay`   | `boolean` | `false` | 是否启用拖拽延迟（防止误触）    |
| `dragDelayTime`     | `number`  | `150`   | 拖拽延迟时间（毫秒）            |

> **💡 编辑权限控制**：
>
> - **全局控制**：使用 `<GanttChart :allow-drag-and-resize="false" />` 禁用所有任务的拖拽/拉伸
> - **单个任务控制**：设置任务对象的 `isEditable: false` 属性单独控制某个任务

**示例1：完整配置**

```vue
<template>
  <GanttChart :tasks="tasks" :task-bar-config="taskBarConfig" />
</template>

<script setup lang="ts">
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
import type { TaskBarConfig } from 'jordium-gantt-vue3'

const taskBarConfig: TaskBarConfig = {
  showAvatar: true,
  showTitle: true,
  showProgress: true,
  dragThreshold: 8,
  resizeHandleWidth: 8,
  enableDragDelay: true,
  dragDelayTime: 200,
}
</script>
```

**示例2：全局只读模式**

禁用所有任务的编辑操作。

```vue
<template>
  <GanttChart :tasks="tasks" :allow-drag-and-resize="false" />
</template>
```

**示例3：单个任务只读**

仅某些任务不可编辑，其他任务正常。

```vue
<script setup lang="ts">
import type { Task } from 'jordium-gantt-vue3'

const tasks: Task[] = [
  {
    id: 1,
    name: '可编辑任务',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    // isEditable 默认为 true
  },
  {
    id: 2,
    name: '只读任务（已锁定）',
    startDate: '2025-01-05',
    endDate: '2025-01-15',
    isEditable: false, // 此任务不可拖拽/拉伸
  },
]
</script>
```

**示例4：精简显示**

仅显示任务条，隐藏头像、标题和进度文字。

```vue
<script setup lang="ts">
import type { TaskBarConfig } from 'jordium-gantt-vue3'

const taskBarConfig: TaskBarConfig = {
  showAvatar: false,
  showTitle: false,
  showProgress: false,
}
</script>
```

**示例5：防误触配置**

移动端或触摸屏场景下，增加拖拽阈值和延迟时间。

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TaskBarConfig } from 'jordium-gantt-vue3'

const isTouchDevice = ref('ontouchstart' in window)

const taskBarConfig = computed<TaskBarConfig>(() => ({
  dragThreshold: isTouchDevice.value ? 10 : 5,
  resizeHandleWidth: isTouchDevice.value ? 12 : 5,
  enableDragDelay: isTouchDevice.value,
  dragDelayTime: isTouchDevice.value ? 300 : 150,
}))
</script>
```

#### Timeline 容器自动填充配置

组件内置了智能的时间线范围计算逻辑，确保无论任务数据量多少、任务持续时间长短，时间线始终能够填充满容器宽度，提供最佳的视觉体验。

**核心设计思路：**

1. **基础缓冲机制**：在任务的实际时间范围基础上，根据不同视图添加固定的缓冲区

   - 小时视图：任务范围前后各 ±1 天
   - 日视图：任务范围前后各 ±30 天
   - 周视图：任务范围前后各 ±8 周（约2个月）
   - 月视图：任务范围前后各 ±1 年
   - 季度视图：任务范围前后各 ±1 年
   - 年视图：任务范围前后各 ±1 年

2. **容器宽度适配**：基础缓冲后，如果计算出的时间线宽度小于容器宽度，会自动扩展范围

   - 计算容器需要的时间单位数（天/周/月/季度/年）
   - 在基础范围两侧**对称扩展**，确保时间线填充满容器

3. **空数据处理**：当没有任务数据时，根据容器宽度和时间刻度计算合理的时间范围

   - 以当前日期为中心
   - 根据容器宽度动态计算需要显示的时间跨度
   - 确保最小显示范围（如日视图至少60天，周视图至少20周等）

4. **视图切换独立计算**：每次切换时间刻度时，都会独立重新计算该视图的最佳时间范围
   - 避免不同视图共享缓存导致的范围不合理
   - 每个视图都能获得最优的显示效果

**各视图计算模式对照表：**

| 视图     | 单位宽度             | 基础缓冲 | 空数据最小范围 | 容器自动填充？ |
| -------- | -------------------- | -------- | -------------- | -------------- |
| 小时视图 | 30px/时              | ±1天     | 3天            | ✅             |
| 日视图   | 30px/天              | ±30天    | 60天           | ✅             |
| 周视图   | 60px/周              | ±2月     | 20周           | ✅             |
| 月视图   | 60px/月              | ±1年     | 3年            | ✅             |
| 季度视图 | 60px/季度 (240px/年) | ±1年     | 5年            | ✅             |
| 年视图   | 360px/年             | ±1年     | 5年            | ✅             |

**实际应用场景：**

- **短期任务**（如1周项目， 分辨率1080）：

  - 不会导致时间线过窄，自动扩展到填充满容器
  - 日视图：1周(7天×30px=210px) → 扩展至 ≥1200px（约40天）
  - 周视图：1周(60px) → 扩展至 ≥1200px（约20周）

- **长期项目**（如2年项目）：

  - 添加固定缓冲后，自动适配容器
  - 月视图：24个月 + 缓冲 → 如需要则扩展至容器宽度
  - 季度视图：8个季度 + 缓冲 → 如需要则扩展至容器宽度

- **空白看板**（无任务数据）：
  - 日视图：以今天为中心，显示至少60天
  - 周视图：以今天为中心，显示至少20周
  - 月视图：显示至少3年
  - 季度/年视图：显示至少5年

> **💡 自动化优势**：
>
> - 无需手动设置 `startDate` 和 `endDate`，组件会自动计算最优范围
> - 响应式容器宽度变化，时间线自动重新计算
> - 不同视图独立优化，切换视图时自动调整到最佳显示效果
> - 避免出现时间线过窄或留白过多的问题
> - 适用不同分辨率展示

### 主题与国际化

#### 主题切换

组件内置亮色和暗色两种主题，可通过工具栏按钮切换，也可监听切换事件：

```vue
<template>
  <GanttChart :tasks="tasks" :on-theme-change="handleThemeChange" />
</template>

<script setup lang="ts">
const handleThemeChange = (isDark: boolean) => {
  console.log('主题切换为:', isDark ? '暗色' : '亮色')
  // 可在此保存用户偏好设置到 localStorage
  localStorage.setItem('gantt-theme', isDark ? 'dark' : 'light')
}
</script>
```

#### 自定义主题变量

通过覆盖 CSS 变量实现主题自定义：

```css
/* 自定义亮色主题 */
:root {
  /* 主色调 */
  --gantt-primary-color: #409eff;
  --gantt-success-color: #67c23a;
  --gantt-warning-color: #e6a23c;
  --gantt-danger-color: #f56c6c;

  /* 背景色 */
  --gantt-bg-primary: #ffffff;
  --gantt-bg-secondary: #f5f7fa;
  --gantt-bg-hover: #ecf5ff;

  /* 文字颜色 */
  --gantt-text-primary: #303133;
  --gantt-text-secondary: #606266;
  --gantt-text-placeholder: #c0c4cc;

  /* 边框颜色 */
  --gantt-border-color: #dcdfe6;
  --gantt-border-color-light: #e4e7ed;

  /* 任务条颜色 */
  --gantt-task-bg: #409eff;
  --gantt-task-border: #66b1ff;
  --gantt-task-text: #ffffff;
}

/* 自定义暗色主题 */
.dark {
  --gantt-bg-primary: #1a1a1a;
  --gantt-bg-secondary: #2c2c2c;
  --gantt-bg-hover: #3a3a3a;

  --gantt-text-primary: #e5e5e5;
  --gantt-text-secondary: #b0b0b0;

  --gantt-border-color: #3a3a3a;
  --gantt-border-color-light: #4a4a4a;

  --gantt-task-bg: #409eff;
  --gantt-task-border: #66b1ff;
  --gantt-task-text: #ffffff;
}
```

#### 语言切换

组件内置中文（zh-CN）和英文（en-US）两种语言，可通过工具栏按钮切换：

```vue
<template>
  <GanttChart :tasks="tasks" :on-language-change="handleLanguageChange" />
</template>

<script setup lang="ts">
const handleLanguageChange = (lang: 'zh-CN' | 'en-US') => {
  console.log('语言切换为:', lang)
  // 可在此保存用户偏好设置到 localStorage
  localStorage.setItem('gantt-language', lang)
}
</script>
```

#### 自定义翻译

通过 `localeMessages` 属性覆盖或扩展默认翻译：

```vue
<template>
  <GanttChart :tasks="tasks" :locale-messages="customMessages" />
</template>

<script setup lang="ts">
const customMessages = {
  "zh-CN": {
    // 任务列表相关
    name: '任务名称（自定义）',
    startDate: '开始日期',
    endDate: '结束日期',
    duration: '工期',
    progress: '完成度',
    predecessor: '前置任务',
    assignee: '负责人',
    estimatedHours: '预估工时',
    actualHours: '实际工时'

    // 工具栏相关
    addTask: '新建任务',
    addMilestone: '新建里程碑',
    today: '今天',
    exportCsv: '导出 CSV',
    exportPdf: '导出 PDF',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    language: '语言',
    theme: '主题',
    expandAll: '全部展开',
    collapseAll: '全部折叠'

    // 内置任务编辑器相关
    title: '任务详情',
    titleEdit: '编辑任务',
    titleNew: '新建任务',
    name: '任务名称',
    startDate: '开始日期',
    endDate: '结束日期',
    assignee: '负责人',
    predecessor: '前置任务',
    description: '描述',
    estimatedHours: '预估工时',
    actualHours: '实际工时',
    progress: '进度',
    save: '保存',
    cancel: '取消',
    delete: '删除'

    // 其他文本
    days: '天',
    hours: '小时',
    overtime: '超时',
    overdue: '逾期',
    // ... 更多自定义翻译
  },
  "en-US": {......}
}
</script>
```

> **💡 提示**：
>
> - `localeMessages` 采用**深度合并**策略，只需传递需要覆盖的字段即可
> - 支持嵌套对象，如 `taskList.name`、`toolbar.addTask` 等
> - 完整的翻译键请参考组件内置的 `messages['zh-CN']` 对象

### 自定义扩展

#### 插槽 (Slots)

组件提供了插槽支持，允许自定义任务内容的渲染。

##### `custom-task-content` 插槽

用于自定义任务在任务列表（TaskRow）和时间轴（TaskBar）中的显示内容。

**插槽参数：**

| 参数名 | 类型                         | 来源 | 说明             |
| ------ | ---------------------------- | ---- | ---------------- |
| `type` | `'task-row'` \| `'task-bar'` | 通用 | 插槽调用位置标识 |
| `task` | `Task`                       | 通用 | 当前任务对象     |

**TaskRow 特有参数（当 `type === 'task-row'` 时）：**

| 参数名           | 类型                             | 说明             |
| ---------------- | -------------------------------- | ---------------- |
| `isRowContent`   | `boolean`                        | 标识为行内容     |
| `level`          | `number`                         | 任务层级         |
| `indent`         | `string`                         | 缩进样式         |
| `isHovered`      | `boolean`                        | 是否悬停         |
| `hoveredTaskId`  | `number \| null`                 | 当前悬停任务ID   |
| `isParent`       | `boolean`                        | 是否为父任务     |
| `hasChildren`    | `boolean`                        | 是否有子任务     |
| `collapsed`      | `boolean`                        | 是否折叠         |
| `formattedTimer` | `string`                         | 格式化的计时文本 |
| `timerRunning`   | `boolean`                        | 计时器是否运行   |
| `timerElapsed`   | `number`                         | 已计时时长       |
| `isOvertime`     | `number \| boolean \| undefined` | 是否超时         |
| `overdueDays`    | `number`                         | 逾期天数         |
| `overtimeText`   | `string`                         | 超时文本         |
| `overdueText`    | `string`                         | 逾期文本         |
| `daysText`       | `string`                         | 天数文本         |
| `progressClass`  | `string`                         | 进度CSS类名      |

**TaskBar 特有参数（当 `type === 'task-bar'` 时）：**

| 参数名             | 类型            | 说明                                                                               |
| ------------------ | --------------- | ---------------------------------------------------------------------------------- |
| `status`           | `object`        | 任务状态对象，包含 `type`, `color`, `bgColor`, `borderColor`                       |
| `statusType`       | `string`        | 状态类型：`'completed'`, `'delayed'`, `'in-progress'`, `'not-started'`, `'parent'` |
| `isParent`         | `boolean`       | 是否为父任务                                                                       |
| `progress`         | `number`        | 任务进度（0-100）                                                                  |
| `currentTimeScale` | `TimelineScale` | 当前时间刻度                                                                       |
| `rowHeight`        | `number`        | 行高（像素）                                                                       |
| `dayWidth`         | `number`        | 每天宽度（像素）                                                                   |

**使用示例：**

```vue
<template>
  <GanttChart :tasks="tasks">
    <template #custom-task-content="slotProps">
      <!-- 根据类型渲染不同内容 -->
      <CustomTaskContent :task="slotProps.task" :type="slotProps.type" :status="slotProps.status" />
    </template>
  </GanttChart>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
import type { Task } from 'jordium-gantt-vue3'
import CustomTaskContent from './CustomTaskContent.vue'

const tasks = ref<Task[]>([
  {
    id: 1,
    name: '<strong>重要任务</strong>',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progress: 50,
  },
])
</script>
```

**自定义内容组件示例：**

```vue
<!-- CustomTaskContent.vue -->
<script setup lang="ts">
import type { Task } from 'jordium-gantt-vue3'

interface Props {
  task: Task
  type: 'task-row' | 'task-bar'
  status?: {
    type: string
    color: string
    bgColor: string
    borderColor: string
  }
}

const props = defineProps<Props>()
</script>

<template>
  <div class="custom-task-content">
    <!-- TaskRow 中的渲染 -->
    <div v-if="type === 'task-row'" class="task-row-content">
      <span v-html="task.name" />
    </div>

    <!-- TaskBar 中的渲染 -->
    <div v-else-if="type === 'task-bar'" class="task-bar-content">
      <div class="task-icon" :style="{ color: status?.color }">📌</div>
      <span class="task-title" v-html="task.name" />
    </div>
  </div>
</template>

<style scoped>
.custom-task-content {
  width: 100%;
  height: 100%;
}

.task-row-content {
  padding: 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-bar-content {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  overflow: hidden;
}

.task-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.task-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
```

> **💡 使用场景**：
>
> - 支持 HTML 格式的任务名称
> - 添加自定义图标、标签或徽章
> - 根据任务状态显示不同样式
> - 集成第三方富文本渲染
> - 显示额外的业务信息

> **⚠️ 注意事项**：
>
> - 插槽内容会同时在 TaskRow 和 TaskBar 中渲染
> - 需要根据 `type` 参数区分渲染位置
> - TaskRow 和 TaskBar 的可用空间不同，需要适配布局
> - 避免在插槽内容中使用过于复杂的组件，可能影响性能

---

## ❓ 常见问题

### 如何集成到现有项目？

1. 安装依赖
2. 引入组件和样式
3. 传入数据
4. 监听事件处理业务逻辑

详见 [快速开始](#-快速开始) 章节。

### 支持哪些浏览器？

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

---

## 📁 项目结构

```
jordium-gantt-vue3/
├── src/                      # 源代码
│   ├── components/           # Vue 组件
│   │   ├── GanttChart.vue    # 甘特图主组件
│   │   ├── TaskList.vue      # 任务列表
│   │   ├── Timeline.vue      # 时间轴
│   │   └── ...
│   ├── models/               # 数据模型
│   │   ├── classes/          # 类定义
│   │   ├── configs/          # 配置接口
│   │   └── types/            # 类型定义
│   ├── composables/          # 组合式函数
│   ├── styles/               # 样式文件
│   └── utils/                # 工具函数
├── demo/                     # 示例代码
├── docs/                     # 文档
├── public/                   # 公共资源
└── package.json              # 项目配置
```

---

## 🔗 相关链接

- **在线演示**: [https://nelson820125.github.io/jordium-gantt-vue3/](https://nelson820125.github.io/jordium-gantt-vue3/)
- **GitHub**: [https://github.com/nelson820125/jordium-gantt-vue3](https://github.com/nelson820125/jordium-gantt-vue3)
- **npm**: [https://www.npmjs.com/package/jordium-gantt-vue3](https://www.npmjs.com/package/jordium-gantt-vue3)
- **更新日志**: [CHANGELOG.md](./CHANGELOG.md)
- **贡献指南**: [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

详细的贡献指南请查看 [CONTRIBUTING.md](./CONTRIBUTING.md)。

### 贡献者

感谢所有为本项目做出贡献的开发者！

查看完整的 [贡献者名单](./CONTRIBUTORS.md)。

---

## 📄 开源协议

[MIT License](./LICENSE) © 2025 JORDIUM.COM

---

<p align="center">
  如果这个项目对你有帮助，请给一个 ⭐️ 支持一下！
</p>

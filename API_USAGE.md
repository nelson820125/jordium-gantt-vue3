# Gantt Chart API 使用指南

## 📖 概述

Jordium Gantt Vue3 组件提供了灵活的API接口，允许开发者自定义TaskBar双击事件的处理逻辑，可以完全替换默认的编辑行为。组件采用Vue3 + TypeScript构建，样式延续Element Plus设计风格但不依赖Element Plus组件库。

## 🚀 API 接口

### GanttChart Props

| 属性名 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| `tasks` | `Task[]` | `[]` | 任务数据数组，支持嵌套结构（树形数据） |
| `onTaskDoubleClick` | `(task: Task) => void` | `undefined` | 自定义双击事件处理器，当TaskBar被双击时触发 |
| `editComponent` | `any` | `undefined` | 自定义编辑组件（预留接口，暂未实现） |
| `useDefaultDrawer` | `boolean` | `true` | 是否使用默认的TaskDrawer抽屉组件进行编辑 |
| `onTaskDelete` | `(task: Task) => void` | `undefined` | 自定义删除事件处理器，当删除按钮被点击时触发 |
| `showToolbar` | `boolean` | `true` | 是否显示工具栏 |
| `toolbarConfig` | `ToolbarConfig` | `{}` | 工具栏配置选项 |
| `onAddTask` | `() => void` | `undefined` | 新增任务按钮点击事件处理器 |
| `onExportCsv` | `() => void \| boolean` | `undefined` | 导出CSV按钮点击事件处理器，返回false使用默认实现 |
| `onExportPdf` | `() => void` | `undefined` | 导出PDF按钮点击事件处理器 |
| `onLanguageChange` | `(lang: 'zh' \| 'en') => void` | `undefined` | 语言切换事件处理器 |
| `onThemeChange` | `(isDark: boolean) => void` | `undefined` | 主题切换事件处理器 |
| `onFullscreenChange` | `(isFullscreen: boolean) => void` | `undefined` | 全屏切换事件处理器 |

### ToolbarConfig 接口定义

```typescript
interface ToolbarConfig {
  showAddTask?: boolean        // 是否显示新增任务按钮，默认true
  showExportCsv?: boolean      // 是否显示导出CSV按钮，默认true
  showExportPdf?: boolean      // 是否显示导出PDF按钮，默认true
  showLanguage?: boolean       // 是否显示语言切换按钮，默认true
  showTheme?: boolean          // 是否显示主题切换按钮，默认true
  showFullscreen?: boolean     // 是否显示全屏切换按钮，默认true
}
```

### API 工作机制

1. **双击优先级**: 当提供 `onTaskDoubleClick` 时，将优先调用自定义处理器，默认的TaskDrawer不会打开
2. **双击一致性**: TaskList中任务行的双击与Timeline中TaskBar的双击具有完全相同的效果和优先级
3. **删除优先级**: 当提供 `onTaskDelete` 时，将优先调用自定义删除处理器，否则使用默认删除行为
4. **默认行为**: 当未提供 `onTaskDoubleClick` 且 `useDefaultDrawer` 为 `true` 时，双击TaskBar或TaskRow会打开内置的TaskDrawer
5. **完全自定义**: 设置 `useDefaultDrawer: false` 可以完全禁用默认抽屉，只使用自定义处理器
6. **数据更新机制**:
   - TaskDrawer更新任务 → Timeline本地更新 → 发送task-updated事件 → TaskList更新数据源
   - TaskList数据更新 → 发送tasks-changed事件 → Timeline重新渲染TaskBar
   - TaskBar位置变化 → 自动重新报告位置 → 依赖关系线自动重新计算
7. **CSV导出机制**:
   - 当提供 `onExportCsv` 时，优先调用自定义处理器
   - 如果自定义处理器返回 `false`，则使用内置的默认导出功能
   - 默认导出支持UTF-8编码、多语言头部、安全字符转义等特性
   - 导出内容包含所有任务字段，递归处理子任务
8. **工具栏功能**:
   - 新增任务按钮：独立的主要操作按钮，具有醒目的主色调样式
   - 导出按钮组：CSV和PDF导出按钮采用button group样式，左右相连，统一的视觉效果
   - 设置按钮：语言、主题、全屏等图标按钮，位于右侧，支持响应式布局
   - 国际化支持：内置中英文切换，所有按钮文本和提示自动适配

### Task 接口定义

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
  children?: Task[]            // 子任务数组（支持嵌套结构）
  collapsed?: boolean          // 是否折叠子任务
  isParent?: boolean           // 是否为父级任务
  type?: string               // 任务类型 (task/story/bug/milestone)
  description?: string         // 任务描述
}
```

## 💡 使用示例

### 1. 默认模式（使用内置TaskDrawer）

```vue
<template>
  <!-- 最简单的使用方式，双击TaskBar会打开默认的编辑抽屉 -->
  <GanttChart :tasks="tasks" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import GanttChart from './components/GanttChart.vue'

// 定义任务数据
const tasks = ref([
  {
    id: 1,
    name: '项目启动',
    assignee: '张三',
    startDate: '2025-06-15',
    endDate: '2025-06-25',
    progress: 100,
    type: 'story',
    children: [
      {
        id: 2,
        name: '需求分析',
        assignee: '李四',
        startDate: '2025-06-16',
        endDate: '2025-06-20',
        progress: 100,
        type: 'task'
      }
    ]
  }
])
</script>
```

### 2. 自定义双击处理器

```vue
<script setup lang="ts">
import { ref } from 'vue'
import GanttChart from './components/GanttChart.vue'

// 定义Task接口（与组件内部保持一致）
interface Task {
  id: number
  name: string
  startDate: string
  endDate: string
  progress?: number
  isParent?: boolean
  predecessor?: number
  type?: string
}

// 自定义双击事件处理器
const handleTaskDoubleClick = (task: Task) => {
  console.log('双击了任务:', task)
  // 注意：此处理器会同时响应TaskBar和TaskList中任务行的双击事件

  // 自定义逻辑示例:
  // 1. 打开自定义模态框
  openCustomModal(task)

  // 2. 跳转到详情页面
  // router.push(`/task/${task.id}`)

  // 3. 调用外部API
  // await updateTaskAPI(task)

  // 4. 显示自定义消息
  // showCustomMessage(task)
}

const openCustomModal = (task: Task) => {
  // 实现自定义模态框逻辑
  alert(`自定义处理: ${task.name}`)
}
</script>

<template>
  <!-- 使用自定义处理器，禁用默认抽屉 -->
  <GanttChart
    :on-task-double-click="handleTaskDoubleClick"
    :use-default-drawer="false"
  />
</template>
```

### 3. TaskList与TaskBar双击一致性

```vue
<script setup lang="ts">
import { ref } from 'vue'
import GanttChart from './components/GanttChart.vue'

const handleTaskDoubleClick = (task: Task) => {
  console.log('任务双击事件:', task)
  // 此处理器会同时响应：
  // 1. Timeline中TaskBar的双击
  // 2. TaskList中任务行的双击

  // 无论用户双击任务条还是任务行，都会执行相同的逻辑
  openTaskEditor(task)
}

const openTaskEditor = (task: Task) => {
  // 打开自定义任务编辑器
  console.log(`正在编辑任务: ${task.name}`)
}
</script>

<template>  <!-- TaskList和Timeline的双击行为保持一致 -->
  <GanttChart
    :tasks="tasks"
    :on-task-double-click="handleTaskDoubleClick"
    :use-default-drawer="false"
  />
</template>
```

### 4. CSV导出功能使用

CSV导出功能支持自定义处理器和默认实现，具有完整的多语言和UTF-8编码支持。详细文档请参考 [CSV_EXPORT.md](./CSV_EXPORT.md)

#### 基本使用

```vue
<script setup lang="ts">
import { ref } from 'vue'

const tasks = ref([/* 你的任务数据 */])

// 启用CSV导出
const toolbarConfig = {
  showExportCsv: true,
  showLanguage: true, // 启用语言切换，影响CSV头部语言
}

// 可选：自定义CSV导出处理器
const handleCsvExport = () => {
  console.log('CSV导出')
  // 返回false使用默认实现
  return false
}
</script>

<template>
  <GanttChart
    :tasks="tasks"
    :toolbar-config="toolbarConfig"
    :on-export-csv="handleCsvExport"
  />
</template>
```

### 5. 工具栏配置与使用

工具栏采用了全新的设计，新增任务按钮独立显示，导出CSV和PDF按钮采用button group样式相连，右侧为设置类按钮。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import GanttChart from './components/GanttChart.vue'

// 工具栏配置
const toolbarConfig = ref({
  showAddTask: true,      // 显示新增任务按钮（主色调独立按钮）
  showExportCsv: true,    // 显示导出CSV按钮（button group左侧）
  showExportPdf: true,    // 显示导出PDF按钮（button group右侧）
  showLanguage: true,     // 显示语言切换按钮
  showTheme: true,        // 显示主题切换按钮
  showFullscreen: true    // 显示全屏切换按钮
})

// 工具栏事件处理器
const handleAddTask = () => {
  console.log('新增任务按钮被点击')
  // 实现新增任务逻辑
  // 例如：打开新增任务对话框
  openAddTaskDialog()
}

const handleExportCsv = () => {
  console.log('导出CSV按钮被点击')
  // 实现CSV导出逻辑
  exportToCsv()
}

const handleExportPdf = () => {
  console.log('导出PDF按钮被点击')
  // 实现PDF导出逻辑
  exportToPdf()
}

const handleLanguageChange = (lang: 'zh' | 'en') => {
  console.log('语言切换为:', lang)
  // 实现语言切换逻辑
}

const handleThemeChange = (isDark: boolean) => {
  console.log('主题切换为:', isDark ? '暗色' : '明亮')
  // 实现主题切换逻辑
}

const handleFullscreenChange = (isFullscreen: boolean) => {
  console.log('全屏状态:', isFullscreen ? '已进入' : '已退出')
  // 实现全屏状态处理逻辑
}

// 业务逻辑函数示例
const openAddTaskDialog = () => {
  // 打开新增任务对话框的具体实现
}

const exportToCsv = () => {
  // 导出CSV的具体实现
  // 可以调用后端API或者前端处理
}

const exportToPdf = () => {
  // 导出PDF的具体实现
  // 可以调用后端API或者前端处理
}
</script>

<template>
  <GanttChart
    :tasks="tasks"
    :show-toolbar="true"
    :toolbar-config="toolbarConfig"
    :on-add-task="handleAddTask"
    :on-export-csv="handleExportCsv"
    :on-export-pdf="handleExportPdf"
    :on-language-change="handleLanguageChange"
    :on-theme-change="handleThemeChange"
    :on-fullscreen-change="handleFullscreenChange"
  />
</template>
```

#### 工具栏样式特点

- **Button Group设计**: 导出CSV和PDF按钮采用连接式设计，视觉上更加统一
- **主操作突出**: 新增任务按钮使用主色调，突出重要操作
- **图标化右侧**: 设置类按钮采用纯图标设计，节省空间
- **响应式布局**: 在小屏幕设备上自动调整按钮尺寸和间距
- **国际化支持**: 所有按钮文本和提示自动适配当前语言

#### 选择性显示工具栏项

```vue
<script setup lang="ts">
// 仅显示新增任务和导出功能，隐藏其他按钮
const minimalToolbarConfig = ref({
  showAddTask: true,
  showExportCsv: true,
  showExportPdf: true,
  showLanguage: false,    // 隐藏语言切换
  showTheme: false,       // 隐藏主题切换
  showFullscreen: false   // 隐藏全屏切换
})
</script>

<template>
  <!-- 最小化工具栏配置 -->
  <GanttChart
    :toolbar-config="minimalToolbarConfig"
    :on-add-task="handleAddTask"
    :on-export-csv="handleExportCsv"
    :on-export-pdf="handleExportPdf"
  />
</template>
```

#### 完全隐藏工具栏

```vue
<template>
  <!-- 隐藏工具栏，使用纯甘特图 -->
  <GanttChart
    :show-toolbar="false"
    :tasks="tasks"
  />
</template>
```

> **说明**: TaskList中任务行的双击与Timeline中TaskBar的双击具有完全相同的API行为和优先级机制，确保用户体验的一致性。

### 4. 条件性使用不同处理器

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import GanttChart from './components/GanttChart.vue'

const useCustomHandler = ref(false)

const handleCustomTaskDoubleClick = (task: Task) => {
  // 自定义处理逻辑
  console.log('使用自定义处理器:', task)
}

// 根据条件决定使用哪种处理器
const doubleClickHandler = computed(() => {
  return useCustomHandler.value ? handleCustomTaskDoubleClick : undefined
})
</script>

<template>
  <div>
    <label>
      <input type="checkbox" v-model="useCustomHandler" />
      使用自定义处理器
    </label>

    <GanttChart
      :on-task-double-click="doubleClickHandler"
      :use-default-drawer="!useCustomHandler"
    />
  </div>
</template>
```

### 4. 自定义删除处理器

```vue
<script setup lang="ts">
import { ref } from 'vue'
import GanttChart from './components/GanttChart.vue'

// 自定义删除事件处理器
const handleCustomTaskDelete = async (task: Task) => {
  console.log('自定义删除处理器被调用:', task)

  // 自定义删除逻辑示例:
  try {
    // 1. 调用后端API删除
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })

    // 2. 更新本地状态
    // store.dispatch('deleteTask', task.id)

    // 3. 显示自定义成功消息
    showNotification(`任务 "${task.name}" 已成功删除`, 'success')

    // 4. 可以触发其他业务逻辑
    // trackDeleteEvent(task)

  } catch (error) {
    console.error('删除失败:', error)
    showNotification('删除失败，请重试', 'error')
  }
}

const showNotification = (message: string, type: string) => {
  // 实现自定义通知逻辑
  console.log(`${type}: ${message}`)
}
</script>

<template>
  <GanttChart
    :on-task-delete="handleCustomTaskDelete"
  />
</template>
```

### 5. 完整的自定义处理器组合

```vue
<script setup lang="ts">
import { ref } from 'vue'
import GanttChart from './components/GanttChart.vue'

// 自定义双击处理器
const handleTaskDoubleClick = (task: Task) => {
  // 打开自定义编辑界面
  router.push(`/tasks/${task.id}/edit`)
}

// 自定义删除处理器
const handleTaskDelete = async (task: Task) => {
  // 使用自定义确认对话框
  const confirmed = await showCustomConfirm(
    '删除确认',
    `确定要删除任务 "${task.name}" 吗？`,
    'warning'
  )

  if (confirmed) {
    await api.deleteTask(task.id)
    showMessage('删除成功', 'success')
  }
}
</script>

<template>
  <GanttChart
    :on-task-double-click="handleTaskDoubleClick"
    :on-task-delete="handleTaskDelete"
    :use-default-drawer="false"
  />
</template>
```

## 🏗️ 组件架构

### 组件层次结构
```
GanttChart (入口组件，API配置)
├── TaskList (左侧任务列表)
├── Timeline (右侧时间轴区域)
    ├── TaskBar (任务条，支持双击事件)
    ├── Milestone (里程碑)
    └── TaskDrawer (默认编辑抽屉)
```

### API 数据流
1. `GanttChart` 接收API配置props
2. 透传给 `Timeline` 组件
3. `Timeline` 将API配置传递给 `TaskBar`
4. `TaskBar` 双击时调用API处理器或触发默认行为

### 内置功能
- ✅ 拖拽调整任务时间
- ✅ 调整任务条长度
- ✅ 任务进度显示
- ✅ 前置任务依赖关系
- ✅ 父子任务层级结构
- ✅ 时间轴缩放和导航
- ✅ 自定义双击事件API

## 🔧 技术特性

- **Framework**: Vue 3 + TypeScript + Vite
- **样式**: 延续Element Plus设计风格，无外部依赖
- **响应式**: 完全使用Vue 3 Composition API
- **类型安全**: 完整的TypeScript接口定义
- **可扩展**: 灵活的API设计，支持自定义扩展

## 🛠️ 高级用法

### 完整示例：集成自定义编辑功能

```vue
<template>
  <div class="gantt-container">
    <!-- Gantt图表 -->
    <GanttChart
      :on-task-double-click="handleTaskDoubleClick"
      :use-default-drawer="!useCustomEditor"
    />

    <!-- 自定义编辑模态框 -->
    <div v-if="showCustomModal" class="custom-modal-overlay" @click="closeModal">
      <div class="custom-modal" @click.stop>
        <div class="modal-header">
          <h3>编辑任务: {{ currentTask?.name }}</h3>
          <button @click="closeModal" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveTask">
            <div class="form-group">
              <label>任务名称:</label>
              <input v-model="editingTask.name" type="text" required />
            </div>
            <div class="form-group">
              <label>开始日期:</label>
              <input v-model="editingTask.startDate" type="date" required />
            </div>
            <div class="form-group">
              <label>结束日期:</label>
              <input v-model="editingTask.endDate" type="date" required />
            </div>
            <div class="form-group">
              <label>完成进度:</label>
              <input v-model.number="editingTask.progress" type="number" min="0" max="100" />
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button @click="closeModal" class="btn-cancel">取消</button>
          <button @click="saveTask" class="btn-save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import GanttChart from './components/GanttChart.vue'

interface Task {
  id: number
  name: string
  startDate: string
  endDate: string
  progress?: number
  isParent?: boolean
  predecessor?: number
  type?: string
}

// 状态管理
const useCustomEditor = ref(true)
const showCustomModal = ref(false)
const currentTask = ref<Task | null>(null)
const editingTask = reactive<Partial<Task>>({})

// 自定义双击处理器
const handleTaskDoubleClick = (task: Task) => {
  currentTask.value = task

  // 复制任务数据到编辑状态
  Object.assign(editingTask, {
    id: task.id,
    name: task.name,
    startDate: task.startDate,
    endDate: task.endDate,
    progress: task.progress || 0
  })

  showCustomModal.value = true
}

// 关闭模态框
const closeModal = () => {
  showCustomModal.value = false
  currentTask.value = null
  Object.keys(editingTask).forEach(key => {
    delete editingTask[key as keyof typeof editingTask]
  })
}

// 保存任务
const saveTask = () => {
  if (!currentTask.value) return

  // 这里可以调用API保存数据
  console.log('保存任务:', editingTask)

  // 触发任务更新事件
  window.dispatchEvent(new CustomEvent('task-updated', {
    detail: { ...currentTask.value, ...editingTask }
  }))

  closeModal()
}
</script>

<style scoped>
.gantt-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.custom-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.custom-modal {
  background: white;
  border-radius: 8px;
  width: 500px;
  max-width: 90vw;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  color: #333;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #eee;
}

.btn-cancel, .btn-save {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-cancel {
  background: #f5f5f5;
  color: #666;
}

.btn-save {
  background: #409eff;
  color: white;
}
</style>
```

## ⚡ 性能优化建议

1. **事件处理器缓存**: 使用 `computed` 或 `useMemo` 缓存事件处理器，避免不必要的重新渲染

2. **异步处理**: 对于复杂的双击处理逻辑，建议使用异步函数

```vue
<script setup lang="ts">
const handleTaskDoubleClick = async (task: Task) => {
  try {
    // 显示加载状态
    loading.value = true

    // 异步处理
    await processTask(task)
  } catch (error) {
    console.error('处理任务失败:', error)
  } finally {
    loading.value = false
  }
}
</script>
```

3. **防抖处理**: 对于可能触发频繁操作的场景，考虑添加防抖

```vue
<script setup lang="ts">
import { debounce } from 'lodash-es'

const debouncedHandler = debounce((task: Task) => {
  // 实际处理逻辑
  console.log('处理任务:', task)
}, 300)
</script>
```

## 🔧 故障排除

### 常见问题

1. **Q: 双击事件不触发？**
   - A: 检查是否正确传递了 `onTaskDoubleClick` 属性，并确保 `useDefaultDrawer` 设置正确

2. **Q: 同时使用自定义处理器和默认Drawer？**
   - A: 当 `onTaskDoubleClick` 存在时，会优先调用自定义处理器，默认Drawer不会打开

3. **Q: 如何在自定义处理器中获取更多任务信息？**
   - A: 可以通过全局状态管理或者父组件传递更多上下文信息

4. **Q: 自定义处理器中的异步操作报错？**
   - A: 确保在异步操作中添加try-catch错误处理，避免未捕获的异常

### 调试技巧

```vue
<script setup lang="ts">
// 启用调试模式
const debugMode = ref(true)

const handleTaskDoubleClick = (task: Task) => {
  if (debugMode.value) {
    console.log('双击事件触发:', {
      task,
      timestamp: new Date().toISOString(),
      component: 'TaskBar'
    })
  }

  // 你的处理逻辑...
}
</script>
```

## ⚡ 性能优化

### 1. 事件处理器缓存
```vue
<script setup lang="ts">
import { computed } from 'vue'

// 使用computed缓存处理器，避免不必要的重新渲染
const taskDoubleClickHandler = computed(() => {
  return (task: Task) => {
    // 处理逻辑
  }
})
</script>

<template>
  <GanttChart :on-task-double-click="taskDoubleClickHandler" />
</template>
```

### 2. 异步处理优化
```vue
<script setup lang="ts">
const loading = ref(false)

const handleTaskDoubleClick = async (task: Task) => {
  try {
    // 显示加载状态
    loading.value = true

    // 异步处理
    await processTaskAsync(task)
  } catch (error) {
    console.error('处理任务失败:', error)
    // 显示错误提示
  } finally {
    loading.value = false
  }
}
</script>
```

### 3. 防抖处理
```vue
<script setup lang="ts">
import { debounce } from 'lodash-es'

const debouncedHandler = debounce((task: Task) => {
  // 实际处理逻辑
  console.log('处理任务:', task)
}, 300)
</script>
```

## 🎯 最佳实践

### 1. 代码组织
- **保持处理器简洁**: 双击处理器应该保持轻量，复杂逻辑建议抽取到单独的函数中
- **类型安全**: 充分利用TypeScript的类型检查，确保Task接口一致性
- **职责分离**: 将业务逻辑与UI逻辑分离

### 2. 用户体验
- **即时反馈**: 为用户操作提供即时的视觉反馈
- **错误处理**: 始终为异步操作添加错误处理和用户友好的错误提示
- **加载状态**: 为长时间运行的操作提供适当的加载提示
- **可访问性**: 确保自定义交互也支持键盘导航和屏幕阅读器

### 3. 性能考虑
- **避免内存泄漏**: 及时清理事件监听器和定时器
- **合理使用响应式**: 不要过度使用reactive，对于简单数据使用ref
- **组件懒加载**: 对于复杂的自定义组件考虑懒加载

### 4. 兼容性设计
```vue
<script setup lang="ts">
// 提供降级方案
const handleTaskDoubleClick = (task: Task) => {
  try {
    // 主要逻辑
    processTask(task)
  } catch (error) {
    // 降级处理
    console.warn('使用降级方案')
    fallbackHandler(task)
  }
}
</script>
```

## 🚀 扩展开发

### 自定义事件系统
```vue
<script setup lang="ts">
// 定义自定义事件
const emit = defineEmits<{
  'task-clicked': [task: Task]
  'task-updated': [task: Task]
  'task-deleted': [taskId: number]
}>()

const handleTaskDoubleClick = (task: Task) => {
  // 处理双击逻辑

  // 发出自定义事件
  emit('task-clicked', task)
}
</script>
```

### 插件化架构
```typescript
// 定义插件接口
interface GanttPlugin {
  name: string
  onTaskDoubleClick?: (task: Task) => void
  onTaskCreate?: (task: Task) => void
  onTaskUpdate?: (task: Task) => void
}

// 使用插件
const ganttPlugins: GanttPlugin[] = [
  {
    name: 'analytics',
    onTaskDoubleClick: (task) => {
      // 分析统计逻辑
    }
  }
]
```

## 📝 更新日志

- **v0.2.0-beta**: 工具栏集成与Button Group优化
  - ✅ 新增GanttToolbar工具栏组件，支持完整的功能配置
  - ✅ 导出CSV和PDF按钮采用Button Group样式，视觉统一
  - ✅ 新增任务按钮独立显示，采用主色调突出重要操作
  - ✅ 右侧设置按钮采用图标化设计，支持语言、主题、全屏切换
  - ✅ 工具栏支持国际化，内置中英文切换
  - ✅ 响应式设计，在小屏幕设备上自动调整布局
  - ✅ 支持选择性显示工具栏项，完全可配置

- **v1.0.0**: 初始API发布
  - ✅ 支持自定义双击处理器 (`onTaskDoubleClick`)
  - ✅ 支持禁用默认编辑抽屉 (`useDefaultDrawer`)
  - ✅ 完整的TypeScript类型支持
  - ✅ Element Plus风格设计，无外部依赖

- **规划中**:
  - 🔄 自定义编辑组件支持 (`editComponent`)
  - 🔄 更多事件API（创建、删除、拖拽等）
  - 🔄 主题定制API
  - 🔄 插件系统

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个组件！

### 开发环境设置
```bash
# 克隆项目
git clone <repository-url>

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建项目
npm run build
```

### 代码规范
- 使用TypeScript进行类型安全开发
- 遵循Vue 3 Composition API最佳实践
- 保持代码简洁和可读性
- 添加适当的注释和文档

---

🎉 **通过这些API，您可以完全自定义TaskBar的交互行为，打造符合您项目需求的甘特图体验！**

> 如有问题或建议，欢迎提交Issue或联系开发团队。

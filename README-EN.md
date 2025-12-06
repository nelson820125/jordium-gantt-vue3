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
  <a href="./README-EN.md">English</a>
</p>

<p align="center">A modern Vue 3 Gantt chart component library providing complete solutions for project management and task scheduling</p>

<p align="center">
  <a href="https://nelson820125.github.io/jordium-gantt-vue3/">
    <strong>📱 Live Demo</strong>
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

## ✨ Introduction

jordium-gantt-vue3 is a modern Gantt chart component built with Vue 3 and TypeScript, designed specifically for project management and task scheduling scenarios. It provides rich interactive features, flexible configuration options, and elegant visual effects.

### Core Features

- 📊 **Feature Complete** - Task management, milestones, dependencies, progress tracking
- 🎨 **Theme System** - Built-in light/dark themes with customizable styles
- 🖱️ **Smooth Interaction** - Drag & resize, zoom, double-click edit, context menu
- 🌍 **Internationalization** - Built-in Chinese/English with extensible language support
- ⚡ **High Performance** - Virtual scrolling, lazy loading for handling massive data
- 💎 **Type Safe** - Full TypeScript support

### Preview

#### Light Theme

<img src="design/screenshots/light-theme.png" alt="Light Theme" width="100%">

#### Dark Theme

<img src="design/screenshots/dark-theme.png" alt="Dark Theme" width="100%">

---

## 📦 Installation

Install using your preferred package manager:

```bash
# npm
npm install jordium-gantt-vue3

# yarn
yarn add jordium-gantt-vue3

# pnpm
pnpm add jordium-gantt-vue3
```

---

## 🚀 Quick Start

### Import Component

Import the `GanttChart` component and styles:

```vue
<script setup lang="ts">
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
</script>
```

> **Tip**: The style file only needs to be imported once in your project. It's recommended to import it in `main.ts` or the root component.

### First Example

Create your first Gantt chart:

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
    name: 'Project Kickoff',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progress: 100,
  },
  {
    id: 2,
    name: 'Requirements Analysis',
    startDate: '2025-01-11',
    endDate: '2025-01-20',
    progress: 80,
    predecessor: [1],
  },
  {
    id: 3,
    name: 'System Design',
    startDate: '2025-01-21',
    endDate: '2025-02-05',
    progress: 50,
    predecessor: [2],
  },
])

const milestones = ref([
  {
    id: 101,
    name: 'Project Approval',
    date: '2025-01-01',
    type: 'milestone',
  },
])
</script>
```

🎯 **[Try Live Demo on Github →](https://nelson820125.github.io/jordium-gantt-vue3/)**
<span><strong>Recommended: <a href="https://dovee.cc/a.php?anaxjgyz1ozZq2B">DOVE</a> VPN for fast and stable access.</strong></span> <span style="color:red;">(Note: Please use VPN services legally)</span>

## 🌞 NPM Package Usage Example

Please refer to the npm-demo folder in the project.
It is a standalone project that can be opened and run independently using your IDE.
Before running, make sure to install the Element Plus library and the jordium-gantt-vue3 plugin package.

```bash
# npm
npm install element-plus
npm install jordium-gantt-vue3
npm run dev
```

---

## 📖 Component Guide

### GanttChart Component

`GanttChart` is the core entry point of the library, providing complete Gantt chart functionality.

#### Basic Props

| Prop                        | Type      | Default | Description                                                               |
| --------------------------- | --------- | ------- | ------------------------------------------------------------------------- |
| `tasks`                     | `Task[]`  | `[]`    | Array of task data                                                        |
| `milestones`                | `Task[]`  | `[]`    | Array of milestone data (Note: Type is Task[], must set type='milestone') |
| `showToolbar`               | `boolean` | `true`  | Whether to show the toolbar                                               |
| `useDefaultDrawer`          | `boolean` | `true`  | Whether to use the built-in task edit drawer (TaskDrawer)                 |
| `useDefaultMilestoneDialog` | `boolean` | `true`  | Whether to use the built-in milestone edit dialog (MilestoneDialog)       |
| `autoSortByStartDate`       | `boolean` | `false` | Whether to automatically sort tasks by start date                         |
| `allowDragAndResize`        | `boolean` | `true`  | Whether to allow dragging and resizing tasks/milestones                   |
| `enableTaskRowMove`        | `boolean` | `false`  | Whether to alloww dragging and dropping TaskRow  

#### Configuration Object Props

For complete configuration object documentation, see [⚙️ Configuration & Customization](#⚙️-configuration--customization) section.

| Prop             | Type                         | Default                                                                 | Description                  |
| ---------------- | ---------------------------- | ----------------------------------------------------------------------- | ---------------------------- |
| `toolbarConfig`  | `ToolbarConfig`              | `{}`                                                                    | Toolbar configuration        |
| `taskListConfig` | `TaskListConfig`             | `undefined`                                                             | Task list configuration      |
| `taskBarConfig`  | `TaskBarConfig`              | `undefined`                                                             | Task bar style configuration |
| `localeMessages` | `Partial<Messages['zh-CN']>` | `undefined`                                                             | Custom localization messages |
| `workingHours`   | `WorkingHours`               | `{ morning: { start: 8, end: 11 }, afternoon: { start: 13, end: 17 } }` | Working hours configuration  |

#### Callback Props

| Prop                 | Type                                 | Description                                                                          |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| `onTodayLocate`      | `() => void`                         | Toolbar "Today" button click callback                                                |
| `onExportCsv`        | `() => boolean \| void`              | Toolbar "Export CSV" button click callback, return `false` to prevent default export |
| `onExportPdf`        | `() => void`                         | Toolbar "Export PDF" button click callback                                           |
| `onLanguageChange`   | `(lang: 'zh-CN' \| 'en-US') => void` | Language switch callback                                                             |
| `onThemeChange`      | `(isDark: boolean) => void`          | Theme switch callback                                                                |
| `onFullscreenChange` | `(isFullscreen: boolean) => void`    | Fullscreen toggle callback                                                           |
| `onExpandAll`        | `() => void`                         | Toolbar "Expand All" button click callback                                           |
| `onCollapseAll`      | `() => void`                         | Toolbar "Collapse All" button click callback                                         |

#### Component Events

For complete event documentation, see:

- **Task-related events**: See [Task Management](#task-management) section below
- **Milestone-related events**: See [Milestone Management](#milestone-management) section below

**Event List Overview:**

| Event Name               | Parameters                        | Description                            |
| ------------------------ | --------------------------------- | -------------------------------------- |
| `add-task`               | -                                 | Clicked toolbar "Add Task" button      |
| `task-click`             | `(task: Task, event: MouseEvent)` | Clicked task                           |
| `task-double-click`      | `(task: Task)`                    | Double-clicked task                    |
| `task-added`             | `{ task: Task }`                  | Triggered after task added             |
| `task-updated`           | `{ task: Task }`                  | Triggered after task updated           |
| `task-deleted`           | `{ task: Task }`                  | Triggered after task deleted           |
| `taskbar-drag-end`       | `(task: Task)`                    | Task drag ended                        |
| `taskbar-resize-end`     | `(task: Task)`                    | Task resize ended                      |
| `predecessor-added`      | `{ targetTask, newTask }`         | Added predecessor task                 |
| `successor-added`        | `{ targetTask, newTask }`         | Added successor task                   |
| `timer-started`          | `(task: Task)`                    | Task timer started                     |
| `timer-stopped`          | `(task: Task)`                    | Task timer stopped                     |
| `add-milestone`          | -                                 | Clicked toolbar "Add Milestone" button |
| `milestone-saved`        | `(milestone: Task)`               | Milestone saved                        |
| `milestone-deleted`      | `{ milestoneId: number }`         | Milestone deleted                      |
| `milestone-icon-changed` | `{ milestoneId, icon }`           | Milestone icon changed                 |
| `milestone-drag-end`     | `(milestone: Task)`               | Milestone drag ended                   |
| `task-row-moved`     | `payload: { draggedTask: Task, targetTask: Task, position: 'after' \| 'child', oldParent: Task \| null, newParent: Task \| null }` | TaskRow drag ended (optional) |

#### Example 1: Simplest Gantt Chart

```vue
<template>
  <div style="height: 600px;">
    <GanttChart :tasks="tasks" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'

const tasks = ref([
  {
    id: 1,
    name: 'Task 1',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progress: 100,
  },
])
</script>
```

#### Example 2: Gantt Chart with Milestones

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
    name: 'Project Kickoff',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progress: 100,
  },
])

const milestones = ref([
  {
    id: 101,
    name: 'Project Approval',
    startDate: '2025-01-01',
    type: 'milestone',
    icon: 'diamond',
  },
])
</script>
```

#### Example 3: Hide Toolbar, Custom Control Buttons with Event Binding

```vue
<template>
  <div>
    <!-- Custom toolbar -->
    <div class="custom-toolbar">
      <button @click="addTask">Add Task</button>
      <button @click="addMilestone">Add Milestone</button>
    </div>

    <!-- Gantt chart component with hidden built-in toolbar -->
    <div style="height: 600px;">
      <GanttChart
        :tasks="tasks"
        :milestones="milestones"
        :show-toolbar="false"
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

const addTask = () => {
  const newTask = {
    id: Date.now(),
    name: 'New Task',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    progress: 0,
  }
  tasks.value.push(newTask)
}

const addMilestone = () => {
  const newMilestone = {
    id: Date.now(),
    name: 'New Milestone',
    startDate: new Date().toISOString().split('T')[0],
    type: 'milestone',
  }
  milestones.value.push(newMilestone)
}

const handleTaskAdded = e => {
  console.log('Task added:', e.task)
}

const handleMilestoneSaved = milestone => {
  console.log('Milestone saved:', milestone)
}
</script>
```

---

### Task Management

Tasks are the core elements of the Gantt chart. The component provides complete CRUD operation support for tasks, including adding, editing, deleting tasks, and rich interactive events.

#### Task Data Structure

| Field              | Type       | Required | Default     | Description                                                                                                                                                                         |
| ------------------ | ---------- | -------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | `number`   | ✅       | -           | Unique task identifier                                                                                                                                                              |
| `name`             | `string`   | ✅       | -           | Task name                                                                                                                                                                           |
| `startDate`        | `string`   | -        | -           | Start date, format: 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm'                                                                                                                              |
| `endDate`          | `string`   | -        | -           | End date, format: 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm'                                                                                                                                |
| `progress`         | `number`   | -        | `0`         | Task progress, range 0-100                                                                                                                                                          |
| `predecessor`      | `number[]` | -        | -           | Array of predecessor task IDs, standard format: `[1, 2, 3]`<br/>**Compatible formats**: Also supports string `'1,2,3'` or string array `['1', '2', '3']`, component will auto-parse |
| `assignee`         | `string`   | -        | -           | Task assignee                                                                                                                                                                       |
| `avatar`           | `string`   | -        | -           | Avatar URL of task assignee                                                                                                                                                         |
| `estimatedHours`   | `number`   | -        | -           | Estimated hours                                                                                                                                                                     |
| `actualHours`      | `number`   | -        | -           | Actual hours                                                                                                                                                                        |
| `parentId`         | `number`   | -        | -           | Parent task ID, used for task grouping                                                                                                                                              |
| `children`         | `Task[]`   | -        | -           | Array of child tasks                                                                                                                                                                |
| `collapsed`        | `boolean`  | -        | `false`     | Whether child tasks are collapsed                                                                                                                                                   |
| `isParent`         | `boolean`  | -        | -           | Whether this is a parent task                                                                                                                                                       |
| `type`             | `string`   | -        | -           | Task type, 'milestone' for milestone, 'milestone-group' for milestone group                                                                                                         |
| `description`      | `string`   | -        | -           | Task description                                                                                                                                                                    |
| `icon`             | `string`   | -        | `'diamond'` | Task icon (for milestones), options: 'diamond', 'flag', 'star', 'rocket', etc.                                                                                                      |
| `level`            | `number`   | -        | `0`         | Task level (auto-calculated)                                                                                                                                                        |
| `isTimerRunning`   | `boolean`  | -        | `false`     | Whether timer is running                                                                                                                                                            |
| `timerStartTime`   | `number`   | -        | -           | Timer start time (timestamp)                                                                                                                                                        |
| `timerEndTime`     | `number`   | -        | -           | Timer end time (timestamp)                                                                                                                                                          |
| `timerStartDesc`   | `string`   | -        | -           | Description filled when timer starts                                                                                                                                                |
| `timerElapsedTime` | `number`   | -        | `0`         | Elapsed time (milliseconds)                                                                                                                                                         |
| `isEditable`       | `boolean`  | -        | `true`      | Whether individual task is editable (draggable, resizable), overrides global `allowDragAndResize`                                                                                   |
| `[key: string]`    | `unknown`  | -        | -           | Supports custom property extensions, can add any additional fields                                                                                                                  |

> **Custom Property Extensions**: The Task interface supports adding arbitrary custom fields, such as: `priority`, `tags`, `status`, `department`, and other business-related fields.
>
> **Predecessor Field Notes**:
>
> - **Standard format** (recommended): `predecessor: [1, 2, 3]` - number array
>   **Compatible format 1**: `predecessor: '1,2,3'` - comma-separated string
> - **Compatible format 2**: `predecessor: ['1', '2', '3']` - string array
> - Component will automatically parse all formats into number array
> - No predecessors: use empty array `[]`, empty string `''`, or don't set this field

#### Task-Related Props

| Prop                  | Type             | Default     | Description                                                                                   |
| --------------------- | ---------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `tasks`               | `Task[]`         | `[]`        | Array of task data                                                                            |
| `useDefaultDrawer`    | `boolean`        | `true`      | Whether to use built-in task edit drawer (TaskDrawer)                                         |
| `taskBarConfig`       | `TaskBarConfig`  | `{}`        | Task bar style configuration, see [TaskBarConfig Configuration](#taskbarconfig-configuration) |
| `taskListConfig`      | `TaskListConfig` | `undefined` | Task list configuration, see [TaskListConfig Configuration](#tasklistconfig-configuration)    |
| `autoSortByStartDate` | `boolean`        | `false`     | Whether to automatically sort tasks by start date                                             |
| `enableTaskRowMove`        | `boolean` | `false`  | Whether to alloww dragging and dropping TaskRow  

**Configuration Notes**:

- **Default mode**: `useDefaultDrawer=true` (default), double-click task to auto-open built-in TaskDrawer
- **Custom editor**: `useDefaultDrawer=false` disables built-in drawer, listen to `@task-double-click` event to open custom editor
- **Read-only mode**: `useDefaultDrawer=false` and don't listen to `@task-double-click` event, user double-click task has no response

#### Task Events

> **💡 Event-Driven Architecture**: Component adopts pure event-driven design. All user operations (add, edit, delete, drag, etc.) will trigger corresponding events for easy external listening and handling.

| Event Name           | Parameters                                | When Triggered                            | Description                                                                                                                                                                                              |
| -------------------- | ----------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add-task`           | -                                         | When clicking toolbar "Add Task" button   | Can be used for custom add task logic. If `useDefaultDrawer=true`, component will auto-open built-in TaskDrawer                                                                                          |
| `task-click`         | `(task: Task, event: MouseEvent) => void` | When clicking task bar                    | Triggered on single-click task                                                                                                                                                                           |
| `task-double-click`  | `(task: Task) => void`                    | When double-clicking task bar             | Double-click task **always triggers**. When `useDefaultDrawer=true`, component will additionally open built-in editor; when `false`, won't open. Event triggering is independent of property value       |
| `task-added`         | `{ task: Task }`                          | After task added                          | Triggered after adding task via built-in TaskDrawer. **Note**: Component has auto-updated `tasks` data, external only needs to listen to this event for additional processing (like calling API to save) |
| `task-updated`       | `{ task: Task }`                          | After task updated                        | Triggered after updating task via built-in TaskDrawer or drag. **Note**: Component has auto-updated `tasks` data, external only needs to listen to this event for additional processing                  |
| `task-deleted`       | `{ task: Task }`                          | After task deleted                        | Triggered after deleting task via built-in TaskDrawer. **Note**: Component has auto-updated `tasks` data, external only needs to listen to this event for additional processing                          |
| `taskbar-drag-end`   | `(task: Task) => void`                    | When task bar drag ends                   | Task position changed, startDate and endDate updated. **Note**: Component has auto-updated `tasks` data                                                                                                  |
| `taskbar-resize-end` | `(task: Task) => void`                    | When task bar resize ends                 | Task duration changed, endDate updated. **Note**: Component has auto-updated `tasks` data                                                                                                                |
| `predecessor-added`  | `{ targetTask: Task, newTask: Task }`     | After adding predecessor via context menu | `targetTask` is the task to which predecessor is added, `newTask` is the newly created predecessor task                                                                                                  |
| `successor-added`    | `{ targetTask: Task, newTask: Task }`     | After adding successor via context menu   | `targetTask` is the original task, `newTask` is the newly created successor task (its predecessor already contains targetTask.id)                                                                        |
| `timer-started`      | `(task: Task) => void`                    | When task timer starts                    | Start recording task hours                                                                                                                                                                               |
| `timer-stopped`      | `(task: Task) => void`                    | When task timer stops                     | Stop recording task hours                                                                                                                                                                                |
| `task-row-moved`     | `payload: { draggedTask: Task, targetTask: Task, position: 'after' \| 'child', oldParent: Task \| null, newParent: Task \| null }` | TaskRow drag ended (optional) | Component has automatically completed data movement and TaskList/Timeline sync via object reference mutation. Listening to this event is completely optional, only for showing messages, calling API, etc. `position`: 'after'=same level, 'child'=as child |

**Data Synchronization Notes**:

- ✅ **Component auto-updates internally**: For all task CRUD operations, component will auto-update `props.tasks` data
- ✅ **Events are for notification only**: External event listeners are mainly for: showing messages, calling backend APIs, updating other related data, etc.
- ❌ **Avoid duplicate operations**: Don't modify `tasks` data again in event handlers, otherwise it will cause duplicate updates

#### Example 1: Basic Task Operations

```vue
<template>
  <div style="height: 600px;">
    <GanttChart
      :tasks="tasks"
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
    name: 'Project Planning',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progress: 100,
    assignee: 'Alice',
    estimatedHours: 40,
  },
  {
    id: 2,
    name: 'Requirements Analysis',
    startDate: '2025-01-11',
    endDate: '2025-01-20',
    progress: 60,
    assignee: 'Bob',
    predecessor: [1], // Depends on task 1
  },
])

// Toolbar "Add Task" button click event
const handleAddTask = () => {
  console.log('Preparing to add task...')
  // Component will auto-open TaskDrawer (if useDefaultDrawer=true)
  // Can also execute custom logic here, like showing messages
}

// Task add event (added via built-in drawer)
const handleTaskAdded = (e: { task: Task }) => {
  console.log('Task added:', e.task)
  // Note: Component has auto-added task to tasks array
  // Only need to call backend API to save here
  // await api.createTask(e.task)
}

// Task update event (updated via built-in drawer or drag)
const handleTaskUpdated = (e: { task: Task }) => {
  console.log('Task updated:', e.task)
  // Note: Component has auto-updated task data in tasks array
  // Only need to call backend API to update here
  // await api.updateTask(e.task.id, e.task)
}

// Task delete event
const handleTaskDeleted = (e: { task: Task }) => {
  console.log('Task deleted:', e.task)
  // Note: Component has auto-removed task from tasks array
  // Only need to call backend API to delete here
  // await api.deleteTask(e.task.id)
}

// Task click event
const handleTaskClick = (task: Task) => {
  console.log('Clicked task:', task.name)
}

// Task drag end event
const handleTaskDragEnd = (task: Task) => {
  console.log('Task drag completed, new dates:', task.startDate, 'to', task.endDate)
  // Can call backend API here to save new dates
}
</script>
```

#### Example 2: Task Dependencies (Predecessors/Successors)

Tasks can configure predecessors via the `predecessor` field, and the component will automatically draw dependency lines:

```vue
<template>
  <GanttChart
    :tasks="tasks"
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
    name: 'Requirements Analysis',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progress: 100,
    predecessor: [], // No predecessors
  },
  {
    id: 2,
    name: 'System Design',
    startDate: '2025-01-11',
    endDate: '2025-01-20',
    progress: 80,
    predecessor: [1], // Depends on task 1 (Requirements Analysis)
  },
  {
    id: 3,
    name: 'Database Design',
    startDate: '2025-01-11',
    endDate: '2025-01-18',
    progress: 90,
    predecessor: [1], // Depends on task 1
  },
  {
    id: 4,
    name: 'Frontend Development',
    startDate: '2025-01-21',
    endDate: '2025-02-10',
    progress: 60,
    predecessor: [2], // Depends on task 2 (System Design)
  },
  {
    id: 5,
    name: 'Backend Development',
    startDate: '2025-01-19',
    endDate: '2025-02-08',
    progress: 70,
    predecessor: [2, 3], // Depends on both task 2 and 3
  },
  {
    id: 6,
    name: 'Integration Testing',
    startDate: '2025-02-11',
    endDate: '2025-02-20',
    progress: 30,
    predecessor: [4, 5], // Depends on frontend and backend development completion
  },
])

// Triggered when adding predecessor via context menu
const handlePredecessorAdded = (event: { targetTask: Task; newTask: Task }) => {
  console.log(`Task [${event.targetTask.name}] added predecessor [${event.newTask.name}]`)
  // Component will auto-update targetTask's predecessor array (append new task ID)
  // Can call backend API here to save dependency relationship
  // await api.addTaskDependency(event.targetTask.id, event.newTask.id)
}

// Triggered when adding successor via context menu
const handleSuccessorAdded = (event: { targetTask: Task; newTask: Task }) => {
  console.log(`Task [${event.targetTask.name}] added successor [${event.newTask.name}]`)
  // Component will auto-update newTask's predecessor array (add targetTask.id)
  // Can call backend API here to save dependency relationship
  // await api.addTaskDependency(event.newTask.id, event.targetTask.id)
}
</script>
```

**Dependency Relationship Notes**:

- **`predecessor` field supports multiple formats**:
  - Standard format (recommended): `[1, 2, 3]` - number array
  - Compatible format 1: `'1,2,3'` - comma-separated string
  - Compatible format 2: `['1', '2', '3']` - string array
  - Component will automatically parse all formats
- Predecessor task: Task that must be completed first (e.g., design must be done before development)
- Successor task: Task that depends on current task (current task is a predecessor for other tasks)
- Component will automatically draw dependency lines from predecessor tasks to dependent tasks
- Can add/delete predecessor and successor tasks via built-in context menu
- When deleting tasks via built-in menu, component will automatically clean up related dependency references
- No predecessors: use empty array `[]`, empty string `''`, or don't set `predecessor` field

#### Example 3: Hide Toolbar, Use Custom Buttons to Trigger Events

Suitable for scenarios requiring complete custom control bar:

```vue
<template>
  <div>
    <!-- Custom control bar -->
    <div class="custom-toolbar">
      <button @click="triggerAddTask">Add Task</button>
      <button @click="triggerAddMilestone">Add Milestone</button>
      <!-- Other custom buttons... -->
    </div>

    <!-- Gantt chart component with hidden built-in toolbar -->
    <GanttChart
      :tasks="tasks"
      :milestones="milestones"
      :show-toolbar="false"
      :use-default-drawer="true"
      :use-default-milestone-dialog="true"
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

// Custom button triggers event (component will respond and open built-in editor)
const triggerAddTask = () => {
  // Directly trigger component's add-task event
  // Since useDefaultDrawer=true, component will auto-open TaskDrawer
}

const triggerAddMilestone = () => {
  // Directly trigger component's add-milestone event
  // Since useDefaultMilestoneDialog=true, component will auto-open MilestoneDialog
}

// Listen to event handling logic
const handleAddTask = () => {
  console.log('Preparing to add task (triggered by custom button)')
}

const handleAddMilestone = () => {
  console.log('Preparing to add milestone (triggered by custom button)')
}

const handleTaskAdded = e => {
  console.log('Task added:', e.task)
  // Call API to save...
}
</script>
```

> **💡 Flexibility Design**:
>
> - Show toolbar + default editor: Simplest out-of-the-box approach
> - Hide toolbar + custom buttons + default editor: Custom control bar style while keeping default edit functionality
> - Hide toolbar + custom buttons + custom editor: Fully customize all interaction logic

#### Example 4: Task Row Drag and Drop Sorting

Allow users to adjust task hierarchy and order by dragging TaskRow:

```vue
<template>
  <div style="height: 600px;">
    <GanttChart
      :tasks="tasks"
      :enable-task-row-move="true"
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
    name: 'Project Planning',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progress: 100,
  },
  {
    id: 2,
    name: 'Requirements Analysis',
    startDate: '2025-01-11',
    endDate: '2025-01-20',
    progress: 60,
    parentId: 1,
  },
  {
    id: 3,
    name: 'System Design',
    startDate: '2025-01-21',
    endDate: '2025-01-30',
    progress: 40,
  },
])

// Task row drag completed event (optional)
const handleTaskRowMoved = async (payload: {
  draggedTask: Task
  targetTask: Task
  position: 'after' | 'child'
  oldParent: Task | null
  newParent: Task | null
}) => {
  const { draggedTask, targetTask, position, oldParent, newParent } = payload
  
  // Component has automatically completed task move, parentId update and TaskList/Timeline sync
  // Listening to this event is completely optional, only for:
  
  // 1. Show custom notification message
  const oldParentName = oldParent?.name || 'Root'
  const newParentName = newParent?.name || 'Root'
  const positionText = position === 'after' ? 'after target task' : 'as child of target task'
  showMessage(`Task [${draggedTask.name}] moved from [${oldParentName}] to [${newParentName}] (${positionText})`, 'success')
  
  // 2. Call backend API to save new task hierarchy
  try {
    await api.updateTaskHierarchy({
      taskId: draggedTask.id,
      targetTaskId: targetTask.id,
      position: position,
      oldParentId: oldParent?.id,
      newParentId: newParent?.id,
    })
  } catch (error) {
    console.error('Save task hierarchy failed:', error)
    showMessage('Save failed, please refresh page', 'error')
  }
  
  // 3. Trigger other business logic (like updating related data, recording operation logs, etc.)
  // ...
}
</script>
```

**Drag and Drop Sorting Notes**:

- **Enable Dragging**: Set `enable-task-row-move="true"` to enable task row dragging (default is `false`)
- **Dragging Algorithms** (automatically executed by component):
  - **Algorithm 1 (Place After)**: When target task has no children, dragged task will be placed after target task (same level), `position='after'`
  - **Algorithm 2 (As Child)**: When target task has children, dragged task will become first child of target task, `position='child'`
- **Visual Feedback**:
  - Semi-transparent following element displayed while dragging
  - Blue border hint shown when hovering over valid target tasks
  - Tasks without children show blue bottom border
  - Tasks with children show blue border on all sides
- **Auto Sync**: Component internally mutates `props.tasks` via object reference, automatically completing task move, `parentId` update, `children` array adjustment, and TaskList/Timeline synchronization
- **Event Listening (Optional)**:
  - `task-row-moved` event is completely optional, only used for showing messages, calling API to save, recording logs, etc.
  - No need to manually update `tasks.value`, component has automatically completed data synchronization
- **Event Parameters**:
  - `draggedTask`: The dragged task
  - `targetTask`: The target task
  - `position`: Drop position ('after' or 'child')
  - `oldParent`: Original parent task (null means root)
  - `newParent`: New parent task (null means root)
- **Constraints**:
  - Cannot drag onto itself
  - Cannot drag onto its own child tasks (avoid circular reference)
  - Milestones and milestone groups cannot be dragged

### Milestone Management

### Milestone Management

Milestones are used to mark important time points in a project, such as project kickoff, phase completion, product release, etc. The component provides flexible milestone editing configuration, using the built-in MilestoneDialog by default, and also supports fully custom editing behavior.

> **Note**: Milestones and tasks are independent data collections with no direct association. Milestones are managed independently through the `milestones` prop.

#### Milestone Data Structure

| Field         | Type     | Required | Default       | Description                                                                 |
| ------------- | -------- | -------- | ------------- | --------------------------------------------------------------------------- |
| `id`          | `number` | ✅       | -             | Unique milestone identifier                                                 |
| `name`        | `string` | ✅       | -             | Milestone name                                                              |
| `startDate`   | `string` | ✅       | -             | Milestone date, format: 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm'                  |
| `endDate`     | `string` | -        | -             | End date (usually not needed for milestones, auto-set to same as startDate) |
| `assignee`    | `string` | -        | -             | Assignee                                                                    |
| `type`        | `string` | ✅       | `'milestone'` | Type identifier, must be set to 'milestone'                                 |
| `icon`        | `string` | -        | `'diamond'`   | Milestone icon, options: 'diamond', 'flag', 'star', 'rocket', etc.          |
| `description` | `string` | -        | -             | Milestone description                                                       |

> **Note**: The `milestones` prop type is `Task[]`, ensure each milestone object's `type` field is set to `'milestone'`.

#### Milestone-Related Props

| Prop                        | Type      | Default | Description                                                       |
| --------------------------- | --------- | ------- | ----------------------------------------------------------------- |
| `milestones`                | `Task[]`  | `[]`    | Array of milestone data (type is Task[], ensure type='milestone') |
| `useDefaultMilestoneDialog` | `boolean` | `true`  | Whether to use built-in milestone edit dialog (MilestoneDialog)   |

**Configuration Notes**:

- **Default mode**: `useDefaultMilestoneDialog=true` (default), double-click milestone to auto-open built-in MilestoneDialog
- **Disable editor**: `useDefaultMilestoneDialog=false`, double-click milestone has no response (component doesn't open any editor)
- **Custom editor**: Can listen to `onMilestoneDoubleClick` callback or related events to implement custom editing logic

> **💡 Differences Between Milestones and Tasks**:
>
> - Milestone data is managed independently via `milestones` prop, separate from `tasks`
> - Milestone object's `type` field must be set to `'milestone'`
> - Milestones don't support child tasks, dependency relationships, and other complex structures
> - Milestones are mainly used to mark key time points

#### Milestone Callbacks (Backward Compatible)

> **⚠️ Deprecated**: Please use the new event-driven API (see "Milestone Events" section below)

#### Milestone Events

> **💡 Event-Driven Architecture**: Milestone management adopts event-driven design. Using event API is recommended over callback functions.

| Event Name               | Parameters                              | When Triggered                               | Description                                                                                                                                                                                                             |
| ------------------------ | --------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add-milestone`          | -                                       | When clicking toolbar "Add Milestone" button | Can be used for custom add milestone logic. If `useDefaultMilestoneDialog=true`, component will auto-open built-in MilestoneDialog                                                                                      |
| `milestone-saved`        | `(milestone: Task) => void`             | After milestone saved (add or edit)          | Triggered after saving milestone via built-in MilestoneDialog. **Note**: Component has auto-updated `milestones` data, external only needs to listen to this event for additional processing (like calling API to save) |
| `milestone-deleted`      | `{ milestoneId: number }`               | After milestone deleted                      | Triggered after deleting milestone via built-in MilestoneDialog. **Note**: Component has auto-updated `milestones` data, external only needs to listen to this event for additional processing                          |
| `milestone-icon-changed` | `{ milestoneId: number, icon: string }` | After milestone icon changed                 | Triggered after modifying icon via built-in MilestoneDialog                                                                                                                                                             |
| `milestone-drag-end`     | `(milestone: Task) => void`             | When milestone drag ends                     | Milestone date updated. **Note**: Component has auto-updated `milestones` data                                                                                                                                          |

**Data Synchronization Notes**:

- ✅ **Component auto-updates internally**: For all milestone CRUD operations, component will auto-update `props.milestones` data
- ✅ **Events are for notification only**: External event listeners are mainly for: showing messages, calling backend APIs, updating other related data, etc.
- ❌ **Avoid duplicate operations**: Don't modify `milestones` data again in event handlers, otherwise it will cause duplicate updates

#### Example 1: Using Event-Driven API (Recommended)

Using the new event API, component auto-manages data, more concise:

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
    name: 'Project Kickoff',
    startDate: '2025-01-01',
    type: 'milestone',
    icon: 'diamond',
    assignee: 'Project Manager',
    description: 'Official project kickoff',
  },
  {
    id: 102,
    name: 'Requirements Review',
    startDate: '2025-01-15',
    type: 'milestone',
    icon: 'flag',
  },
])

// Toolbar "Add Milestone" button click event
const handleAddMilestone = () => {
  console.log('Preparing to add milestone...')
  // Component will auto-open MilestoneDialog (if useDefaultMilestoneDialog=true)
}

// Milestone save event (add or edit)
const handleMilestoneSaved = (milestone: Task) => {
  console.log('Milestone saved:', milestone)
  // Note: Component has auto-updated milestones array
  // Only need to call backend API to save here
  // await api.saveMilestone(milestone)
}

// Milestone delete event
const handleMilestoneDeleted = (e: { milestoneId: number }) => {
  console.log('Milestone deleted, ID:', e.milestoneId)
  // Note: Component has auto-removed from milestones array
  // Only need to call backend API to delete here
  // await api.deleteMilestone(e.milestoneId)
}

// Milestone icon change event
const handleMilestoneIconChanged = (e: { milestoneId: number; icon: string }) => {
  console.log('Milestone icon changed:', e.milestoneId, '->', e.icon)
  // Component has auto-updated icon, can call API to save here
  // await api.updateMilestoneIcon(e.milestoneId, e.icon)
}

// Milestone drag end event
const handleMilestoneDrag = (milestone: Task) => {
  console.log('Milestone drag completed, new date:', milestone.startDate)
  // Component has auto-updated date, can call API to save here
  // await api.updateMilestoneDate(milestone.id, milestone.startDate)
}
</script>
```

#### Example 2: Using Custom Milestone Edit Dialog

If you need to fully customize the milestone editing interface, you can disable the built-in dialog and use your own component:

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

    <!-- Custom Milestone Edit Dialog -->
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
    name: 'Project Kickoff',
    startDate: '2025-01-01',
    type: 'milestone',
    icon: 'diamond',
    assignee: 'Project Manager',
    description: 'Official project kickoff',
  },
])

const customDialogVisible = ref(false)
const editingMilestone = ref<Task | null>(null)
const isNewMilestone = ref(false)

// Click toolbar "Add Milestone" button
const handleAddMilestone = () => {
  editingMilestone.value = null
  isNewMilestone.value = true
  customDialogVisible.value = true
}

// Open custom dialog when double-clicking milestone
// Note: Need to listen to Timeline component milestone double-click event
// or trigger edit via external button/list item
const openEditDialog = (milestone: Task) => {
  editingMilestone.value = { ...milestone }
  isNewMilestone.value = false
  customDialogVisible.value = true
}

// Custom dialog save event
const handleCustomDialogSave = (milestone: Task) => {
  if (isNewMilestone.value) {
    // Add milestone
    const newMilestone = {
      ...milestone,
      id: Date.now(), // Generate new ID
      type: 'milestone',
    }
    milestones.value.push(newMilestone)

    // Call backend API to save
    // await api.createMilestone(newMilestone)
  } else {
    // Update existing milestone
    const index = milestones.value.findIndex(m => m.id === milestone.id)
    if (index !== -1) {
      milestones.value[index] = { ...milestone }
    }

    // Call backend API to update
    // await api.updateMilestone(milestone)
  }

  customDialogVisible.value = false
}

// Custom dialog delete event
const handleCustomDialogDelete = (milestoneId: number) => {
  const index = milestones.value.findIndex(m => m.id === milestoneId)
  if (index !== -1) {
    milestones.value.splice(index, 1)
  }

  // Call backend API to delete
  // await api.deleteMilestone(milestoneId)

  customDialogVisible.value = false
}

// Following event handlers are still valid (for drag operations, etc.)
const handleMilestoneSaved = (milestone: Task) => {
  console.log('Milestone saved (via other method):', milestone)
}

const handleMilestoneDeleted = (e: { milestoneId: number }) => {
  console.log('Milestone deleted (via other method):', e.milestoneId)
}

const handleMilestoneDrag = (milestone: Task) => {
  console.log('Milestone drag completed:', milestone.startDate)
  // Call API to update date
  // await api.updateMilestoneDate(milestone.id, milestone.startDate)
}
</script>
```

**Custom Dialog Component Example** (`CustomMilestoneDialog.vue` - Using Element Plus)：

> **Note**: The following examplesUsing Element Plus UI framework. You can also use other UI frameworks (such as Ant Design Vue, Naive UI, etc.) or native HTML implementation.

```vue
<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isNew ? 'Add milestone' : 'Edit Milestone'"
    width="500px"
    @close="handleClose"
  >
    <el-form :model="form" label-width="100px">
      <el-form-item label="Milestone Name">
        <el-input v-model="form.name" placeholder="Please enter milestone name" />
      </el-form-item>

      <el-form-item label="Date">
        <el-date-picker
          v-model="form.startDate"
          type="date"
          placeholder="Select date"
          value-format="YYYY-MM-DD"
        />
      </el-form-item>

      <el-form-item label="Assignee">
        <el-input v-model="form.assignee" placeholder="Please enter assignee" />
      </el-form-item>

      <el-form-item label="Icon">
        <el-select v-model="form.icon" placeholder="Select icon">
          <el-option label="Diamond" value="diamond" />
          <el-option label="Flag" value="flag" />
          <el-option label="Star" value="star" />
          <el-option label="Rocket" value="rocket" />
        </el-select>
      </el-form-item>

      <el-form-item label="Description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="Please enter description"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button v-if="!isNew" type="danger" @click="handleDelete"> Delete </el-button>
        <el-button @click="handleClose">Cancel</el-button>
        <el-button type="primary" @click="handleSave">Save</el-button>
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
        // Edit mode, fill data
        form.value = { ...props.milestone }
      } else {
        // Add mode, reset form
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
    alert('Please fill required fields')
    return
  }
  emit('save', { ...form.value })
}

const handleDelete = () => {
  if (confirm('Are you sure to delete this milestone?')) {
    emit('delete', form.value.id)
  }
}
</script>
```

> **💡 Custom Dialog Notes**:
>
> - Set `use-default-milestone-dialog="false"` to disable built-in dialog
> - Listen to `@add-milestone` event to open custom dialog
> - Need to manually manage `milestones` array CRUD operations
> - Can still listen to other events (like `@milestone-drag-end`) to handle drag operations
> - Suitable for scenarios requiring complex form validation, special UI design, or additional fields

---

## ⚙️ Configuration & Customization

This section details the configuration options and extension capabilities of the GanttChart component, including Component Configuration, Theme & Internationalization, and Custom Extensions.

### Component Configuration

#### ToolbarConfig (Toolbar Configuration)

Customize the toolbar functional buttons and time scale options.

**Type Definition:**

| Field                 | Type              | Default                                               | Description                                                                                                  |
| --------------------- | ----------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `showAddTask`         | `boolean`         | `true`                                                | Show "Add Task" button                                                                                       |
| `showAddMilestone`    | `boolean`         | `true`                                                | Show "Add Milestone" button                                                                                  |
| `showTodayLocate`     | `boolean`         | `true`                                                | Show "Locate to Today" button                                                                                |
| `showExportCsv`       | `boolean`         | `true`                                                | Show "Export CSV" button                                                                                     |
| `showExportPdf`       | `boolean`         | `true`                                                | Show "Export PDF" button                                                                                     |
| `showLanguage`        | `boolean`         | `true`                                                | Show "Language Switch" button (Chinese/English)                                                              |
| `showTheme`           | `boolean`         | `true`                                                | Show "Theme Switch" button (Light/Dark)                                                                      |
| `showFullscreen`      | `boolean`         | `true`                                                | Show "Fullscreen" button                                                                                     |
| `showTimeScale`       | `boolean`         | `true`                                                | Show time scale button group (controls entire group visibility)                                              |
| `timeScaleDimensions` | `TimelineScale[]` | `['hour', 'day', 'week', 'month', 'quarter', 'year']` | Set time scale dimensions to display, options: `'hour'`, `'day'`, `'week'`, `'month'`, `'quarter'`, `'year'` |
| `defaultTimeScale`    | `TimelineScale`   | `'week'`                                              | Default selected time scale                                                                                  |
| `showExpandCollapse`  | `boolean`         | `true`                                                | Show "Expand All/Collapse All" button (for parent-child task tree structure)                                 |

**TimelineScale Type Description:**

```typescript
type TimelineScale = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'

// Can also use constant form
import { TimelineScale } from 'jordium-gantt-vue3'

TimelineScale.HOUR // 'hour' - Hour view
TimelineScale.DAY // 'day' - Day view
TimelineScale.WEEK // 'week' - Week view
TimelineScale.MONTH // 'month' - Month view
TimelineScale.QUARTER // 'quarter' - Quarter view
TimelineScale.YEAR // 'year' - Year view
```

**Example 1: Complete Configuration (Show All Features)**

```vue
<template>
  <GanttChart :tasks="tasks" :toolbar-config="toolbarConfig" />
</template>

<script setup lang="ts">
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
import type { ToolbarConfig } from 'jordium-gantt-vue3'

const toolbarConfig: ToolbarConfig = {
  showAddTask: true, // Show add task button
  showAddMilestone: true, // Show add milestone button
  showTodayLocate: true, // Show locate to today button
  showExportCsv: true, // Show export CSV button
  showExportPdf: true, // Show export PDF button
  showLanguage: true, // Show language switch button
  showTheme: true, // Show theme switch button
  showFullscreen: true, // Show fullscreen button
  showTimeScale: true, // Show time scale button group
  timeScaleDimensions: [
    // Show all time scale dimensions
    'hour',
    'day',
    'week',
    'month',
    'quarter',
    'year',
  ],
  defaultTimeScale: 'week', // Default week view
  showExpandCollapse: true, // Show expand/collapse button
}
</script>
```

**Example 2: Simplified Configuration (Show Common Features Only)**

```vue
<script setup lang="ts">
import type { ToolbarConfig } from 'jordium-gantt-vue3'

const toolbarConfig: ToolbarConfig = {
  showAddTask: true, // Keep add task
  showAddMilestone: true, // Keep add milestone
  showTodayLocate: true, // Keep locate today
  showExportCsv: false, // Hide export CSV
  showExportPdf: false, // Hide export PDF
  showLanguage: false, // Hide language switch (fixed to one language)
  showTheme: true, // Keep theme switch
  showFullscreen: true, // Keep fullscreen
  showTimeScale: true, // Show time scale
  timeScaleDimensions: [
    // Only show day/week/month scales
    'day',
    'week',
    'month',
  ],
  defaultTimeScale: 'week', // Default week view
  showExpandCollapse: true, // Keep expand/collapse
}
</script>
```

**Example 3: Using TimelineScale Constants**

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
  defaultTimeScale: TimelineScale.MONTH, // Default month view
}
</script>
```

**Example 4: Minimal Configuration (Suitable for Embedded Use)**

```vue
<script setup lang="ts">
import type { ToolbarConfig } from 'jordium-gantt-vue3'

const toolbarConfig: ToolbarConfig = {
  showAddTask: false, // Hide all edit buttons
  showAddMilestone: false,
  showTodayLocate: true, // Only keep navigation features
  showExportCsv: false,
  showExportPdf: false,
  showLanguage: false,
  showTheme: false,
  showFullscreen: false,
  showTimeScale: true, // Keep time scale switch
  timeScaleDimensions: ['week', 'month'],
  defaultTimeScale: 'month',
  showExpandCollapse: false, // Hide expand/collapse
}
</script>
```

> **💡 Configuration Recommendations**：
>
> - **Default configuration**：When not passed, all buttons are shown by default
> - **Show as needed**: Hide unnecessary feature buttons based on business requirements
> - **Time scale**：`timeScaleDimensions` controls which time dimensions to display, recommend selecting 2-4 common dimensions
> - **Responsive layout**：toolbar will automatically adapt to container width, excessive buttons will collapse into more menu

#### TaskListConfig（Task List Configuration）

Customize task list display columns, width limits, etc. Task list is located on the left side of the Gantt chart, showing detailed task information.

**Type Definition：**

| Field            | Type                     | Default           | Description                                                                                                      |
| ---------------- | ------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `columns`        | `TaskListColumnConfig[]` | Default 8 columns | Task list column configuration array, defines which columns to display and their properties                      |
| `showAllColumns` | `boolean`                | `true`            | Whether to show all columns. When `true`, ignores `visible` setting in `columns`                                 |
| `defaultWidth`   | `number \| string`       | `320`             | Default expanded width. Supports pixel number (like `320`) or percentage string (like `'30%'`)                   |
| `minWidth`       | `number \| string`       | `280`             | Minimum width. Supports pixel number (like `280`) or percentage string (like `'20%'`). Cannot be less than 280px |
| `maxWidth`       | `number \| string`       | `1160`            | Maximum width. Supports pixel number (like `1160`) or percentage string (like `'80%'`)                           |

**TaskListColumnConfig Type Definition：**

| Field      | Type      | Required | Description                                                                                     |
| ---------- | --------- | -------- | ----------------------------------------------------------------------------------------------- |
| `key`      | `string`  | ✅       | Unique column identifier, used to access fields in Task object and for internationalization     |
| `label`    | `string`  | -        | Column display label (header text)                                                              |
| `cssClass` | `string`  | -        | Custom CSS class name                                                                           |
| `width`    | `number`  | -        | Column width (unit: pixels)                                                                     |
| `visible`  | `boolean` | -        | Whether to show this column, default `true`. This setting is invalid when `showAllColumns=true` |

**Example1：Basic Configuration (Adjust Width)**

```vue
<template>
  <GanttChart :tasks="tasks" :task-list-config="taskListConfig" />
</template>

<script setup lang="ts">
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
import type { TaskListConfig } from 'jordium-gantt-vue3'

const taskListConfig: TaskListConfig = {
  defaultWidth: 450, // Default width 450px (wider than default 320px)
  minWidth: 300, // Minimum width 300px
  maxWidth: 1200, // Maximum width 1200px
}
</script>
```

**Example2：Using Percentage Width**

```vue
<template>
  <GanttChart :tasks="tasks" :task-list-config="taskListConfig" />
</template>

<script setup lang="ts">
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
import type { TaskListConfig } from 'jordium-gantt-vue3'

const taskListConfig: TaskListConfig = {
  defaultWidth: '25%', // Default 25% of container width
  minWidth: '15%', // Minimum 15%
  maxWidth: '60%', // Maximum 60%
}
</script>
```

**Example3：Custom Display Columns (Standard Configuration)**

Based on business requirements, you can customize columns to display, column widths, and display order. Recommend defining column configuration array first, then assign to `columns` prop.

```vue
<template>
  <GanttChart :tasks="tasks" :task-list-config="taskListConfig" />
</template>

<script setup lang="ts">
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
import type { TaskListConfig, TaskListColumnConfig } from 'jordium-gantt-vue3'

// Define column configuration to display
const columns: TaskListColumnConfig[] = [
  { key: 'predecessor', label: 'Predecessors', visible: true },
  { key: 'assignee', label: 'Assignee', visible: true },
  { key: 'startDate', label: 'Start Date', visible: true },
  { key: 'endDate', label: 'End Date', visible: true },
  { key: 'estimatedHours', label: 'Estimated Hours', visible: true },
  { key: 'actualHours', label: 'Actual Hours', visible: true },
  { key: 'progress', label: 'Progress', visible: true },
]

const taskListConfig: TaskListConfig = {
  columns,
  defaultWidth: 450,
  minWidth: 300,
  maxWidth: 1200,
}
</script>
```

**Example4：Simplified Column Configuration**

Only show core information columns, suitable for scenarios with limited space or requiring concise display.

```vue
<script setup lang="ts">
import type { TaskListConfig, TaskListColumnConfig } from 'jordium-gantt-vue3'

// Define simplified Column Configuration
const columns: TaskListColumnConfig[] = [
  { key: 'name', label: 'Task', visible: true },
  { key: 'assignee', label: 'Assignee', width: 80, visible: true },
  { key: 'progress', label: 'Progress', width: 60, visible: true },
]

const taskListConfig: TaskListConfig = {
  columns,
  defaultWidth: 350,
  minWidth: 280,
  maxWidth: 500,
  showAllColumns: false, // Only show columns with visible=true
}
</script>
```

**Example5：Custom Business Columns**

Add business-related custom columns, ensure Task object contains corresponding fields.

```vue
<script setup lang="ts">
import type { TaskListConfig, TaskListColumnConfig } from 'jordium-gantt-vue3'

// Define configuration with custom columns
const columns: TaskListColumnConfig[] = [
  { key: 'name', label: 'Task Name', visible: true },
  { key: 'priority', label: 'Priority', width: 80, visible: true }, // Custom column
  { key: 'department', label: 'Department', width: 100, visible: true }, // Custom column
  { key: 'status', label: 'Status', width: 80, visible: true }, // Custom column
  { key: 'assignee', label: 'Assignee', visible: true },
  { key: 'startDate', label: 'Start Date', visible: true },
  { key: 'endDate', label: 'End Date', visible: true },
  { key: 'progress', label: 'Progress', visible: true },
]

const taskListConfig: TaskListConfig = {
  columns,
}
</script>
```

**Example6：Dynamic Column Configuration**

Combine `ref` and `computed` to achieve dynamic show/hide and width adjustment of columns.

```vue
<template>
  <GanttChart :tasks="tasks" :task-list-config="taskListConfig" />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
import type { TaskListConfig, TaskListColumnConfig } from 'jordium-gantt-vue3'

// Define dynamically configurable columns
const availableColumns = ref<TaskListColumnConfig[]>([
  { key: 'predecessor', label: 'Predecessors', visible: true },
  { key: 'assignee', label: 'Assignee', visible: true },
  { key: 'startDate', label: 'Start Date', visible: true },
  { key: 'endDate', label: 'End Date', visible: true },
  { key: 'estimatedHours', label: 'Estimated Hours', visible: true },
  { key: 'actualHours', label: 'Actual Hours', visible: true },
  { key: 'progress', label: 'Progress', visible: true },
  { key: 'custom', label: 'Custom column', visible: true, width: 120 },
])

// Define width configuration
const taskListWidth = ref({
  defaultWidth: 450,
  minWidth: 300,
  maxWidth: 1200,
})

// Use computed property to dynamically generate configuration
const taskListConfig = computed<TaskListConfig>(() => ({
  columns: availableColumns.value,
  defaultWidth: taskListWidth.value.defaultWidth,
  minWidth: taskListWidth.value.minWidth,
  maxWidth: taskListWidth.value.maxWidth,
}))
</script>
```

> **💡 Configuration Notes**：
>
> - **Default behavior**：When not passed, show all 8 default columns with width of 320px
> - **Width units**：Supports pixel (`number`) and percentage (`string`, like `'30%'`) methods
> - **Percentage calculation**：Based on total width of Gantt chart container, responsive adjustment
> - **Column order**: `columns` array order determines column display order
> - **Column configuration standards**：Recommend defining `TaskListColumnConfig[]` type column array first, then assign to `columns` prop
> - **Custom column support**：Task interface supports arbitrary custom fields through `[key: string]: unknown` index signature, component will dynamically read column values through `task[column.key]`, no need to modify Task interface to add custom columns
> - **Dynamic configuration**：Combine `ref` and `computed` to achieve dynamic show/hide and width adjustment of columns
> - **Minimum width limit**: `minWidth` cannot be less than 280px, this is the minimum value to ensure basic usability

#### TaskBarConfig (Task Bar Configuration)

Controls task bar display content and interaction behavior。

**Configuration Fields：**

| Field               | Type      | Default | Description                                               |
| ------------------- | --------- | ------- | --------------------------------------------------------- |
| `showAvatar`        | `boolean` | `true`  | Whether to show avatar                                    |
| `showTitle`         | `boolean` | `true`  | Whether to show title text                                |
| `showProgress`      | `boolean` | `true`  | Whether to show progress text                             |
| `dragThreshold`     | `number`  | `5`     | Drag trigger threshold (pixels)                           |
| `resizeHandleWidth` | `number`  | `5`     | Resize handle width (pixels), max 15px                    |
| `enableDragDelay`   | `boolean` | `false` | Whether to enable drag delay (prevent accidental trigger) |
| `dragDelayTime`     | `number`  | `150`   | Drag delay time (milliseconds)                            |

> **💡 Edit Permission Control**：
>
> - **Global control**: Use `<GanttChart :allow-drag-and-resize="false" />` to disable drag/resize for all tasks
> - **Individual task control**: Set task object `isEditable: false` property to control individual task

**Example1：Complete Configuration**

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

**Example2：Global Read-Only Mode**

Disable edit operations for all tasks.

```vue
<template>
  <GanttChart :tasks="tasks" :allow-drag-and-resize="false" />
</template>
```

**Example3：Individual Task Read-Only**

Only certain tasks are non-editable, other tasks are normal.

```vue
<script setup lang="ts">
import type { Task } from 'jordium-gantt-vue3'

const tasks: Task[] = [
  {
    id: 1,
    name: 'Editable Task',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    // isEditable default is true
  },
  {
    id: 2,
    name: 'Read-Only Task (Locked)',
    startDate: '2025-01-05',
    endDate: '2025-01-15',
    isEditable: false, // This task cannot be dragged/resized
  },
]
</script>
```

**Example4：Simplified Display**

Only show task bar, hide avatar, title and progress text.

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

**Example5：Anti-Accidental Touch Configuration**

In mobile or touch screen scenarios, increase drag threshold and delay time.

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

#### Timeline Container Auto-Fill Configuration

The component has built-in intelligent timeline range calculation logic, ensuring that regardless of task data volume or task duration, the timeline always fills the container width, providing the best visual experience.

**Core Design Principles:**

1. **Base Buffer Mechanism**: Add fixed buffers based on the actual time range of tasks, varying by view type

   - Hour view：±1 day task range
   - Day view: ±30 days before/after task range
   - Week view: ±8 weeks (approx. 2 months) before/after task range
   - Month view: ±1 year before/after task range
   - Quarter view: ±1 year before/after task range
   - Year view: ±1 year before/after task range

2. **Container Width Adaptation**: After base buffering, if calculated timeline width is less than container width, automatically extend the range

   - Calculate time units (days/weeks/months/quarters/years) needed for container
   - **Symmetrically extend** on both sides of base range to ensure timeline fills container

3. **Empty Data Handling**: When no task data exists, calculate reasonable time range based on container width and time scale

   - Center on current date
   - Dynamically calculate time span to display based on container width
   - Ensure minimum display range (e.g., at least 60 days for day view, at least 20 weeks for week view)

4. **Independent Calculation on View Switch**: Each time scale switch triggers independent recalculation of optimal time range for that view
   - Avoid unreasonable ranges caused by different views sharing cache
   - Each view gets optimal display effect

**Calculation Pattern Reference Table:**

| View         | Unit Width                | Base Buffer | Empty Data Min Range | Container Auto-Fill? |
| ------------ | ------------------------- | ----------- | -------------------- | -------------------- |
| Hour View    | 30px/hour                 | ±1 day      | 3 days               | ✅                   |
| Day View     | 30px/day                  | ±30 days    | 60 days              | ✅                   |
| Week View    | 60px/week                 | ±2 months   | 20 weeks             | ✅                   |
| Month View   | 60px/month                | ±1 year     | 3 years              | ✅                   |
| Quarter View | 60px/quarter (240px/year) | ±1 year     | 5 years              | ✅                   |
| Year View    | 360px/year                | ±1 year     | 5 years              | ✅                   |

**Practical Application Scenarios:**

- **Short-term Tasks** (e.g., 1-week project):

  - Won't result in narrow timeline, automatically extends to fill container
  - Day view: 1 week (7 days × 30px = 210px) → Extends to ≥1200px (approx. 40 days)
  - Week view: 1 week (60px) → Extends to ≥1200px (approx. 20 weeks)

- **Long-term Projects** (e.g., 2-year project):

  - After adding fixed buffer, automatically adapts to container
  - Month view: 24 months + buffer → Extends to container width if needed
  - Quarter view: 8 quarters + buffer → Extends to container width if needed

- **Empty Board** (no task data):
  - Day view: Centered on today, displays at least 60 days
  - Week view: Centered on today, displays at least 20 weeks
  - Month view: Displays at least 3 years
  - Quarter/Year view: Displays at least 5 years

> **💡 Automation Advantages**:
>
> - No need to manually set `startDate` and `endDate`, component automatically calculates optimal range
> - Responsive to container width changes, timeline automatically recalculates
> - Different views independently optimized, auto-adjusts to best display effect when switching views
> - Avoids issues with timeline being too narrow or having excessive whitespace
> - Suitable for displaying at different resolutions

### Theme & Internationalization

#### Theme Switching

Component has built-in light and dark themes, can switch via toolbar button, also can listen to switch events:

```vue
<template>
  <GanttChart :tasks="tasks" :on-theme-change="handleThemeChange" />
</template>

<script setup lang="ts">
const handleThemeChange = (isDark: boolean) => {
  console.log('Theme switched to:', isDark ? 'dark' : 'light')
  // Can save user preference settings to localStorage here
  localStorage.setItem('gantt-theme', isDark ? 'dark' : 'light')
}
</script>
```

#### Custom Theme Variables

Customize theme by overriding CSS variables:

```css
/* Customize light theme */
:root {
  /* Primary colors */
  --gantt-primary-color: #409eff;
  --gantt-success-color: #67c23a;
  --gantt-warning-color: #e6a23c;
  --gantt-danger-color: #f56c6c;

  /* Background colors */
  --gantt-bg-primary: #ffffff;
  --gantt-bg-secondary: #f5f7fa;
  --gantt-bg-hover: #ecf5ff;

  /* Text colors */
  --gantt-text-primary: #303133;
  --gantt-text-secondary: #606266;
  --gantt-text-placeholder: #c0c4cc;

  /* Border colors */
  --gantt-border-color: #dcdfe6;
  --gantt-border-color-light: #e4e7ed;

  /* Task bar colors */
  --gantt-task-bg: #409eff;
  --gantt-task-border: #66b1ff;
  --gantt-task-text: #ffffff;
}

/* Customize dark theme */
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

#### Language Switching

Component has built-in Chinese (zh-CN) and English (en-US), can switch via toolbar button:

```vue
<template>
  <GanttChart :tasks="tasks" :on-language-change="handleLanguageChange" />
</template>

<script setup lang="ts">
const handleLanguageChange = (lang: 'zh-CN' | 'en-US') => {
  console.log('Language switched to:', lang)
  // Can save user preference settings to localStorage here
  localStorage.setItem('gantt-language', lang)
}
</script>
```

#### Custom Translations

Override or extend default translations via `localeMessages` prop:

```vue
<template>
  <GanttChart :tasks="tasks" :locale-messages="customMessages" />
</template>

<script setup lang="ts">
const customMessages = {
  "zh-CN": {
    // Task list related
    name: 'Task Name (Custom)',
    startDate: 'Start Date',
    endDate: 'End Date',
    duration: 'Duration',
    progress: 'Completion',
    predecessor: 'Predecessors',
    assignee: 'Assignee',
    estimatedHours: 'Estimated Hours',
    actualHours: 'Actual Hours'

    // Toolbar related
    addTask: 'New Task',
    addMilestone: 'New Milestone',
    today: 'Today',
    exportCsv: 'Export CSV',
    exportPdf: 'Export PDF',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    language: 'Language',
    theme: 'Theme',
    expandAll: 'Expand All',
    collapseAll: 'Collapse All'

    // Internal Task editor related
    title: 'Task Details',
    titleEdit: 'Edit Task',
    titleNew: 'New Task',
    name: 'Task Name',
    startDate: 'Start Date',
    endDate: 'End Date',
    assignee: 'Assignee',
    predecessor: 'Predecessors',
    description: 'Description',
    estimatedHours: 'Estimated Hours',
    actualHours: 'Actual Hours',
    progress: 'Progress',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete'

    // Other texts
    days: 'days',
    hours: 'hours',
    overtime: 'overtime',
    overdue: 'overdue',
    // ... More custom translations
  },
  "en-US": {......}
}
</script>
```

> **💡 Tip**：
>
> - `localeMessages` adopts **deep merge** strategy, only need to pass fields that need to be overridden
> - supports nested objects, like `taskList.name`, `toolbar.addTask`, etc.
> - For complete translation keys, please refer to built-in `messages['zh-CN']` object in component

### Custom Extensions

#### Slots (Slots)

Component provides slots support, allowing custom task content rendering。

##### `custom-task-content` Slots

Used to customize task display content in task list (TaskRow) and timeline (TaskBar).

**Slot Parameters：**

| Parameter | Type                         | Source | Description                   |
| --------- | ---------------------------- | ------ | ----------------------------- |
| `type`    | `'task-row'` \| `'task-bar'` | Common | Slot call position identifier |
| `task`    | `Task`                       | Common | Current task object           |

**TaskRow specific parameters (when `type === 'task-row'`):**

| Parameter        | Type                             | Description               |
| ---------------- | -------------------------------- | ------------------------- |
| `isRowContent`   | `boolean`                        | Identified as row content |
| `level`          | `number`                         | Task level                |
| `indent`         | `string`                         | Indent style              |
| `isHovered`      | `boolean`                        | Whether hovering          |
| `hoveredTaskId`  | `number \| null`                 | Current hovering task ID  |
| `isParent`       | `boolean`                        | Whether parent task       |
| `hasChildren`    | `boolean`                        | Whether has child tasks   |
| `collapsed`      | `boolean`                        | Whether collapsed         |
| `formattedTimer` | `string`                         | Formatted timer text      |
| `timerRunning`   | `boolean`                        | Whether timer is running  |
| `timerElapsed`   | `number`                         | Elapsed time              |
| `isOvertime`     | `number \| boolean \| undefined` | Whether overtime          |
| `overdueDays`    | `number`                         | Overdue days              |
| `overtimeText`   | `string`                         | Overtime text             |
| `overdueText`    | `string`                         | Overdue text              |
| `daysText`       | `string`                         | Days text                 |
| `progressClass`  | `string`                         | Progress CSS class name   |

**TaskBar specific parameters (when `type === 'task-bar'`):**

| Parameter          | Type            | Description                                                                          |
| ------------------ | --------------- | ------------------------------------------------------------------------------------ |
| `status`           | `object`        | TaskStatus object, contains `type`, `color`, `bgColor`, `borderColor`                |
| `statusType`       | `string`        | StatusType：`'completed'`, `'delayed'`, `'in-progress'`, `'not-started'`, `'parent'` |
| `isParent`         | `boolean`       | Whether parent task                                                                  |
| `progress`         | `number`        | TaskProgress（0-100）                                                                |
| `currentTimeScale` | `TimelineScale` | Current time scale                                                                   |
| `rowHeight`        | `number`        | Row height (pixels)                                                                  |
| `dayWidth`         | `number`        | Width per day (pixels)                                                               |

**Usage Example：**

```vue
<template>
  <GanttChart :tasks="tasks">
    <template #custom-task-content="slotProps">
      <!-- Render different content based on type -->
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
    name: '<strong>Important Task</strong>',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progress: 50,
  },
])
</script>
```

**Custom Content Component Example：**

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
    <!-- Rendering in TaskRow -->
    <div v-if="type === 'task-row'" class="task-row-content">
      <span v-html="task.name" />
    </div>

    <!-- Rendering in TaskBar -->
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

> **💡 Usage Scenarios**：
>
> - Support HTML formatted task names
> - Add custom icons, tags or badges
> - Display different styles based on task status
> - Integrate third-party rich text rendering
> - Display additional business information

> **⚠️ Notes**：
>
> - Slot content will be rendered in both TaskRow and TaskBar
> - Need to distinguish rendering position based on `type` parameter
> - TaskRow and TaskBar have different available space, need to adapt layout
> - Avoid using overly complex components in slot content, may affect performance

---

## ❓ FAQ

### How to integrate into existing project?

1. Install dependencies
2. Import component and styles
3. Pass in data
4. Listen to events and handle business logic

See [Contributing Guide](CONTRIBUTING.md) for details.

### Which browsers are supported?

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

---

## 📁 Project Structure

```
jordium-gantt-vue3/
├── src/                      # Source code
│   ├── components/           # Vue Components
│   │   ├── GanttChart.vue    # Main Gantt chart component
│   │   ├── TaskList.vue      # Task list
│   │   ├── Timeline.vue      # Timeline
│   │   └── ...
│   ├── models/               # Data models
│   │   ├── classes/          # Class definitions
│   │   ├── configs/          # Configuration interfaces
│   │   └── types/            # Type Definition
│   ├── composables/          # Composables
│   ├── styles/               # Style files
│   └── utils/                # Utilities
├── demo/                     # Demo code
├── docs/                     # Documentation
├── public/                   # Public assets
└── package.json              # Project configuration
```

---

## 🔗 Related Links

- **Live Demo**: [https://nelson820125.github.io/jordium-gantt-vue3/](https://nelson820125.github.io/jordium-gantt-vue3/)
- **GitHub**: [https://github.com/nelson820125/jordium-gantt-vue3](https://github.com/nelson820125/jordium-gantt-vue3)
- **npm**: [https://www.npmjs.com/package/jordium-gantt-vue3](https://www.npmjs.com/package/jordium-gantt-vue3)
- **Changelog**: [CHANGELOG.md](./CHANGELOG.md)
- **Contributing Guide**: [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 🤝 Contributing

Welcome to submit Issues and Pull Requests!

For detailed contributing guide, please see [CONTRIBUTING.md](./CONTRIBUTING.md)。

### Contributors

Thanks to all developers who contributed to this project！

View the complete [Contributors list](./CONTRIBUTORS.md)。

---

## 📄 Open Source License

[MIT License](./LICENSE) © 2025 JORDIUM.COM

---

<p align="center">
  <sub>If this project helps you, please give it a ⭐️ to support it!</sub>
</p>

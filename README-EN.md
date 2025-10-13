# <img src="public/assets/jordium-gantt-vue3-logo.svg" alt="jordium-gantt-vue3 logo" width="32" style="vertical-align:middle;margin-right:8px;" /> jordium-gantt-vue3

**🌐 Languages**: [📖 English Documentation](./README-EN.md) | [📖 中文文档](./README.md)

[![npm version](https://img.shields.io/npm/v/jordium-gantt-vue3.svg?cacheBust=1)](https://www.npmjs.com/package/jordium-gantt-vue3)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Vue.Js](https://img.shields.io/badge/Vue.js->=3.5.13-4FC08D?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript->=5.8.3-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js->=16.0.0-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)

> Modern Vue 3 Gantt chart component library providing complete solutions for project management and task scheduling

## 🌐 Online Demo

🎯 **[Try Github Live Demo →](https://nelson820125.github.io/jordium-gantt-vue3/)**
<span><strong>Recommend to use <a href="https://dovee.cc/a.php?anaxjgyz1ozZq2B">DOVE</a> VPN for fast and stable access if needed.</strong></span> <span style="color:red;">(Note: Please use VPN resources legally.)</span>

*The online demo includes full feature showcase: task management, milestones, theme switching, internationalization, etc.*

## 🎨 Theme Support

### Light Theme

![Light Theme](design/screenshots/light-theme-en.png)

### Dark Theme

![Dark Theme](design/screenshots/dark-theme-en.png)

## 🚀 Features

- 📊 **Complete Functionality**: Task management, milestone tracking, dependency relationships, progress visualization
- 🎨 **Theme Switching**: Built-in light/dark themes with customizable theme variables
- 🖱️ **Rich Interactions**: Drag adjustment, resizing, double-click editing, context menus
- 🌍 **Internationalization**: Built-in Chinese/English support with custom language pack capability
- 📱 **Responsive**: Desktop and mobile compatible with smooth touch experience
- ⚡ **High Performance**: Virtual scrolling, lazy loading, optimized rendering
- 🔧 **Extensible**: Rich API interfaces supporting custom components and events
- 💎 **Type Safe**: Complete TypeScript support for better development experience

## 📦 Installation

```bash
# npm
npm install jordium-gantt-vue3

# yarn  
yarn add jordium-gantt-vue3

# pnpm
pnpm add jordium-gantt-vue3
```

## 📄 License

[MIT License](./LICENSE) © 2025 JordiUM

---

## 📁 Project Structure

```
jordium-gantt-vue3/
├── src/                      # Source code directory  
│   ├── components/           # Core Vue components
│   │   ├── GanttChart.vue    # Main entry component
│   │   ├── TaskList.vue      # Task list component
│   │   ├── Timeline.vue      # Timeline component
│   │   ├── TaskBar.vue       # Task bar component
│   │   ├── TaskDrawer.vue    # Task edit drawer
│   │   ├── TaskContextMenu.vue # Task context menu
│   │   ├── GanttToolbar.vue  # Toolbar component
│   │   ├── MilestonePoint.vue # Milestone point
│   │   ├── MilestoneDialog.vue # Milestone dialog
│   │   ├── DatePicker.vue    # Date picker
│   │   └── ...               # Other components
│   ├── models/               # Data models and configurations
│   │   ├── classes/          # Class definitions
│   │   │   ├── Task.ts       # Task model
│   │   │   ├── Milestone.ts  # Milestone model
│   │   │   └── Language.ts   # Language configuration
│   │   ├── configs/          # Configuration interfaces
│   │   │   ├── TimelineConfig.ts # Timeline configuration
│   │   │   └── ToolbarConfig.ts  # Toolbar configuration
│   │   └── types/            # Type definitions
│   │       └── TimelineScale.ts  # Timeline scale types
│   ├── composables/          # Vue composable functions
│   │   ├── useI18n.ts        # Internationalization utilities
│   │   └── useMessage.ts     # Message utilities
│   ├── styles/               # Style files
│   │   ├── app.css           # Main styles
│   │   └── theme-variables.css # Theme variables
│   ├── utils/                # Utility functions
│   │   └── predecessorUtils.ts # Predecessor utilities
│   └── index.ts              # Export entry
├── demo/                     # Development demo & interactive showcase
│   ├── App.vue               # Demo application main component
│   ├── data.json             # Demo data (includes clinical trial examples)
│   ├── main.ts               # Demo application entry
│   └── ...                   # Other demo files
├── packageDemo/              # npm package integration demo
├── dist/                     # Build output directory
├── docs/                     # Documentation
├── design/                   # Design resources and screenshots
│   └── screenshots/          # Theme screenshots
├── public/                   # Public static resources
│   └── assets/               # Static asset files
├── README.md                 # Chinese documentation
├── README-EN.md              # English documentation
├── package.json              # Project configuration
├── vite.config.ts            # Vite development configuration
├── vite.config.lib.ts        # Vite library build configuration
├── tsconfig.json             # TypeScript configuration
└── ...                       # Other configuration files and metadata
```

### Directory Description

- **`src/components/`**: Core Vue components containing all Gantt chart functionality
- **`src/models/`**: Data models, type definitions and configuration interfaces  
- **`src/composables/`**: Vue 3 composable functions providing reusable logic
- **`src/styles/`**: Style files including theme system and CSS variables
- **`src/utils/`**: Utility functions for business logic and data transformation
- **`demo/`**: Local development and feature demonstration with complete interactive pages and clinical trial sample data
- **`packageDemo/`**: Simulates npm package integration in external projects
- **`dist/`**: Build output directory for npm publishing or static sites
- **`docs/`**: Project documentation including deployment guides and API references

## 🔧 API Reference

### GanttChart Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `tasks` | `Task[]` | `[]` | Task data array |
| `milestones` | `Task[]` | `[]` | Milestone data array |
| `editComponent` | `any` | - | Custom edit component |
| `useDefaultDrawer` | `boolean` | `true` | Use default edit drawer |
| `showToolbar` | `boolean` | `true` | Show toolbar |
| `toolbarConfig` | `ToolbarConfig` | `{}` | Toolbar configuration |
| `taskListConfig` | `TaskListConfig` | `{}` | Task list configuration (including default width, min/max width limits, etc.) |
| `localeMessages` | `Partial<Messages['zh-CN']>` | - | Custom locale messages |
| `workingHours` | `WorkingHours` | - | Working hours configuration |
| `onTaskDoubleClick` | `(task: Task) => void` | - | Task double-click event callback |
| `onTaskDelete` | `(task: Task, deleteChildren?: boolean) => void` | - | Task delete event callback |
| `onTaskUpdate` | `(task: Task) => void` | - | Task update event callback |
| `onTaskAdd` | `(task: Task) => void` | - | Task add event callback |
| `onMilestoneSave` | `(milestone: Task) => void` | - | Milestone save event callback |
| `onMilestoneDelete` | `(milestoneId: number) => void` | - | Milestone delete event callback |
| `onMilestoneIconChange` | `(milestoneId: number, icon: string) => void` | - | Milestone icon change event callback |
| `onAddTask` | `() => void` | - | Add task toolbar event callback |
| `onAddMilestone` | `() => void` | - | Add milestone toolbar event callback |
| `onTodayLocate` | `() => void` | - | Locate today toolbar event callback |
| `onExportCsv` | `() => boolean \| void` | - | Export CSV toolbar event callback |
| `onExportPdf` | `() => void` | - | Export PDF toolbar event callback |
| `onLanguageChange` | `(lang: 'zh-CN' \| 'en-US') => void` | - | Language change toolbar event callback |
| `onThemeChange` | `(isDark: boolean) => void` | - | Theme change toolbar event callback |
| `onFullscreenChange` | `(isFullscreen: boolean) => void` | - | Fullscreen change toolbar event callback |

### GanttChart Events

| Event              | Parameters                  | Description                        |
|--------------------|----------------------------|------------------------------------|
| `taskbar-drag-end` | `task: Task` | Task bar drag end |
| `taskbar-resize-end` | `task: Task` | Task bar resize end |
| `milestone-drag-end` | `milestone: Task` | Milestone drag end |
| `predecessor-added`| `{ targetTask, newTask }`   | Triggered after adding predecessor.<br>Parameters:<br>• `targetTask`: The task to which a predecessor was added (Task object)<br>• `newTask`: The newly added predecessor task (Task object) |
| `successor-added`  | `{ targetTask, newTask }`   | Triggered after adding successor.<br>Parameters:<br>• `targetTask`: The task to which a successor was added (Task object)<br>• `newTask`: The newly added successor task (Task object) |
| `task-deleted`     | `{ task }`                  | Triggered after deleting a task    |
| `task-added`       | `{ task }`                  | Triggered after creating a task    |
| `task-updated`     | `{ task }`                  | Triggered after updating a task    |

#### Timer Event Usage Example

```vue
<GanttChart
  ...
  @timer-started="onTimerStarted"
  @timer-stopped="onTimerStopped"
/>

<script setup>
function onTimerStarted(task) {
  // Custom notification, logging, or business logic
  alert(`Task [${task.name}] started at: ${new Date(task.timerStartTime).toLocaleString()}`)
}
function onTimerStopped(task) {
  alert(`Task [${task.name}] stopped`)
}
</script>
```

#### Task Event Usage Example

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
  alert(`Task [${e.targetTask.name}] predecessor added [${e.newTask.name}]`)
}
function onSuccessorAdded(e) {
  // e: { targetTask: Task, newTask: Task }
  alert(`Task [${e.targetTask.name}] successor added [${e.newTask.name}]`)
}
function onTaskDeleted(e) {
  // e: { task: Task }
  alert(`Task [${e.task.name}] deleted`)
}
function onTaskAdded(e) {
  // e: { task: Task }
  alert(`Task [${e.task.name}] created`)
}
function onTaskUpdated(e) {
  // e: { task: Task }
  alert(`Task [${e.task.name}] updated`)
}
</script>
```

### Data Types

#### Core Types (src/models/classes)

**Task Type**
```typescript
export interface Task {
  id: number                  // Unique task ID
  name: string               // Task name
  predecessor?: number[]     // Predecessor task ID array
  assignee?: string          // Assignee
  startDate?: string         // Start date (ISO string)
  endDate?: string           // End date (ISO string)
  progress?: number          // Progress percentage 0-100
  estimatedHours?: number    // Estimated hours (supports decimal, up to 2 decimal places)
  actualHours?: number       // Actual hours (supports decimal, up to 2 decimal places)
  parentId?: number          // Parent task ID
  children?: Task[] // Subtask array
  collapsed?: boolean // Collapsed state
  isParent?: boolean // Is parent task
  type?: string // Task type (e.g. task, story, milestone)
  description?: string // Task description
  icon?: string // Icon
  level?: number // Level
  // Timer related fields
  isTimerRunning?: boolean // Is timer running
  timerStartTime?: number // Timer start timestamp
  timerEndTime?: number // Timer end timestamp
  timerStartDesc?: string // Timer start description
  timerElapsedTime?: number // Accumulated timer duration (seconds)
}
```

**Milestone Type**
```typescript
// Milestone is actually a special usage of Task type
// Task object with type: 'milestone' property
interface Milestone extends Task {
  type: 'milestone'            // Must be 'milestone'
  startDate: string           // Milestone date (required)
  endDate?: string            // End date (optional, usually same as startDate)
}
```

**Language Type**
```typescript
type Language = 'zh' | 'en'   // Supported language types
type Locale = 'zh-CN' | 'en-US' // Complete language locale identifiers
```

#### Configuration Types (src/models/configs)

**TimelineConfig**
```typescript
interface TimelineConfig {
  startDate: Date              // Timeline start date
  endDate: Date                // Timeline end date
  zoomLevel: number            // Zoom level
}
```

**ToolbarConfig**
```typescript
interface ToolbarConfig {
  showAddTask?: boolean        // Show add task button
  showAddMilestone?: boolean   // Show add milestone button
  showTodayLocate?: boolean    // Show locate today button
  showExportCsv?: boolean      // Show export CSV button
  showExportPdf?: boolean      // Show export PDF button
  showLanguage?: boolean       // Show language switch button
  showTheme?: boolean          // Show theme switch button
  showFullscreen?: boolean     // Show fullscreen toggle button
  showTimeScale?: boolean      // Show time scale toggle buttons (Day|Week|Month)
}
```

**TaskListConfig**
```typescript
interface TaskListConfig {
  columns?: TaskListColumnConfig[]  // Column configuration array
  showAllColumns?: boolean         // Show all columns, default true
  defaultWidth?: number           // Default expanded width in pixels, default 320px
  minWidth?: number              // Minimum width in pixels, default 280px, cannot be less than 280px
  maxWidth?: number              // Maximum width in pixels, default 1160px
}

interface TaskListColumnConfig {
  type?: TaskListColumnType       // Column type
  key: string                    // Key for internationalization, also used as identifier
  label?: string                 // Display label
  cssClass?: string              // CSS class name
  width?: number                 // Optional column width
  visible?: boolean              // Whether to display, default true
}

type TaskListColumnType = 
  | 'name' | 'predecessor' | 'assignee' 
  | 'startDate' | 'endDate' | 'estimatedHours' 
  | 'actualHours' | 'progress'
```

**WorkingHours Configuration**
```typescript
interface WorkingHours {
  morning?: { start: number; end: number }    // Morning work hours, e.g. { start: 8, end: 11 }
  afternoon?: { start: number; end: number }  // Afternoon work hours, e.g. { start: 13, end: 17 }
}
```

**TimelineScale Types**
```typescript
// Timeline display scale types
type TimelineScale = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'

// Timeline scale constants
export const TimelineScale = {
  HOUR: 'hour',        // Hour view - each column displays one hour
  DAY: 'day',          // Day view - each column displays one day
  WEEK: 'week',        // Week view - each column displays one week  
  MONTH: 'month',      // Month view - each column displays one month
  QUARTER: 'quarter',  // Quarter view - each column displays one quarter
  YEAR: 'year',        // Year view - each column displays one year
}

// Timeline scale configuration
interface TimelineScaleConfig {
  scale: TimelineScale    // Scale type
  cellWidth: number       // Width of each time unit (px)
  headerLevels: number    // Number of header levels
  formatters: {
    primary: string       // Primary time label format
    secondary?: string    // Secondary time label format
  }
}
```

### 🕐 Timeline Scale Features

The component supports multiple timeline scale displays. Users can switch timeline granularity through the Day/Week/Month button group in the toolbar or programmatically:

#### Built-in Scale Configurations

| Scale Type | Cell Width | Primary Format | Secondary Format | Use Case |
|------------|------------|----------------|------------------|----------|
| `hour` | 40px | yyyy/MM/dd | HH | Short-term projects with hourly precision, such as drug clinical trials |
| `day` | 30px | yyyy/MM | dd | Standard view for daily project management |
| `week` | 120px | yyyy/MM | W | Weekly planning view for medium-term projects |
| `month` | 180px | yyyy | MM | Monthly view for long-term projects |
| `quarter` | 360px | yyyy | Q | Quarterly view for strategic planning |
| `year` | 360px | yyyy | First Half\|Second Half | Annual view for very long-term projects |

#### Usage Example

```vue
<script setup>
import { ref } from 'vue'
import { GanttChart, TimelineScale } from 'jordium-gantt-vue3'

const tasks = ref([/* task data */])

// Toolbar configuration - enable timeline scale toggle buttons
const toolbarConfig = {
  showTimeScale: true  // Display Day|Week|Month button group
}

// Listen to scale changes (optional)
const handleTimeScaleChange = (scale) => {
  console.log('Timeline scale changed to:', scale)
  // Business logic can be added here, such as saving user preferences
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

#### Composable Functions (src/composables)

**useI18n Internationalization Tool**
```typescript
// Provides multi-language support
const { 
  locale,           // Current language
  setLocale,        // Switch language
  t,               // Translation function
  formatYearMonth  // Year-month formatting
} = useI18n()

// Supported languages
type Locale = 'zh-CN' | 'en-US'
```

**useMessage Message Tool**
```typescript
// Provides global message notifications
const { showMessage } = useMessage()

// Message types
type MessageType = 'success' | 'error' | 'warning' | 'info'

// Usage example
showMessage('Operation successful', 'success')
```

## 💻 Basic Usage

### Simple Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'

const tasks = ref([
  {
    id: 1,
    name: 'Project Kickoff',
    startDate: '2025-01-01',
    endDate: '2025-01-15',
    progress: 80,
    assignee: 'John Doe',
    type: 'task'
  },
  {
    id: 2,
    name: 'Requirements Analysis',
    startDate: '2025-01-16',
    endDate: '2025-01-30',
    progress: 60,
    assignee: 'Jane Smith',
    predecessor: '1',
    type: 'task'
  }
])

const milestones = ref([
  {
    id: 1,
    name: 'Project Milestone',
    startDate: '2025-01-31',
    type: 'milestone'
  }
])

// TaskList width configuration example
const taskListConfig = {
  defaultWidth: 400,  // Default expanded width 400px (default 320px)
  minWidth: 300,      // Minimum width 300px (default 280px)
  maxWidth: 1200      // Maximum width 1200px (default 1160px)
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

### Custom Event Handling

```vue
<script setup lang="ts">
import { GanttChart } from 'jordium-gantt-vue3'

// Custom double-click handler
const handleTaskDoubleClick = (task) => {
  console.log('Task double-clicked:', task)
  // Open custom edit interface
  router.push(`/task/${task.id}/edit`)
}

// Custom delete handler
const handleTaskDelete = async (task) => {
  const confirmed = await showConfirm(`Are you sure to delete task "${task.name}"?`)
  if (confirmed) {
    await api.deleteTask(task.id)
    // Refresh task list
    refreshTasks()
  }
}

// Listen to drag events
const handleTaskDragEnd = (task) => {
  console.log('Task drag ended:', task)
  // Save task time changes
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

### Theme and Internationalization

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'

// Toolbar configuration
const toolbarConfig = {
  showLanguage: true,
  showTheme: true,
  showAddTask: true,
  showAddMilestone: true,
  showTodayLocate: true,
  showExportCsv: true,
  showExportPdf: true,
  showFullscreen: true,
  showTimeScale: true  // Control visibility of Day|Week|Month time scale toggle buttons
}

// Custom locale messages
const customLocaleMessages = {
  taskName: 'Custom Task Name',
  addTask: 'Custom Add Task'
}

// Handle toolbar events
const handleLanguageChange = (lang) => {
  console.log('Language switched to:', lang)
}

const handleThemeChange = (isDark) => {
  console.log('Theme switched to:', isDark ? 'dark' : 'light')
}

// Listen to timeline scale changes
const handleTimeScaleChange = (scale) => {
  console.log('Timeline scale changed to:', scale)
  // Adjust display logic based on scale
  if (scale === 'day') {
    // Special handling for day view
  } else if (scale === 'week') {
    // Special handling for week view  
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

### 🔧 Working Hours Configuration

The component supports setting working hours, affecting task duration calculations and progress display:

```vue
<script setup lang="ts">
// Configure working hours (24-hour format)
const workingHours = {
  morning: { start: 9, end: 12 },    // 9 AM - 12 PM
  afternoon: { start: 14, end: 18 }  // 2 PM - 6 PM
}
</script>

<template>
  <GanttChart
    :tasks="tasks"
    :working-hours="workingHours"
  />
</template>
```

### 📊 High-Precision Work Hours Management

The component supports work hour recording precise to 2 decimal places, suitable for projects requiring precise billing:

```vue
<script setup lang="ts">
const tasks = ref([
  {
    id: 1,
    name: 'High-precision Task',
    estimatedHours: 8.75,    // 8 hours 45 minutes
    actualHours: 7.25,       // 7 hours 15 minutes
    startDate: '2025-01-01',
    endDate: '2025-01-02'
  }
])
</script>
```

// Handle toolbar events
const handleLanguageChange = (lang) => {
  console.log('Language changed to:', lang)
}

const handleThemeChange = (isDark) => {
  console.log('Theme changed to:', isDark ? 'dark' : 'light')
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

## 🤝 Contributing & Collaboration

### Contributing

We welcome community contributions! If you want to participate in project development:

1. **Fork** this repository
2. **Create** your feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Report Issues

If you find bugs or have feature suggestions:

- 📬 [Submit Github Issue](https://github.com/nelson820125/jordium-gantt-vue3/issues)
- 📬 [Submit Gitee Issue](https://gitee.com/jordium/jordium-gantt-vue3/issues)
- 📧 Send email to：ning.li@jordium.com / nelson820125@gmail.com / lining820125@163.com

### Business Collaboration

We provide professional technical support and custom development services:

- 🏢 **Enterprise Customization**: Custom Gantt chart features based on business needs
- 💼 **Technical Consulting**: Project management system architecture design consultation

**Contact Information**：
- 📧 Business Email：ning.li@jordium.com / nelson820125@gmail.com

### Development Environment

```bash
# Clone project
git clone https://github.com/nelson820125/jordium-gantt-vue3.git

# Install dependencies
npm install

# Start development server
npm run dev

# Build library
npm run build:lib

# Run tests
npm run test
```

---

**🔗 Related Links**
- [GitHub Repository](https://github.com/nelson820125/jordium-gantt-vue3)
- [Changelog](./CHANGELOG.md)

> 💡 **Tip**: If this project helps you, please give us a ⭐ Star!

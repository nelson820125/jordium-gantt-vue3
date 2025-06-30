# jordium-gantt-vue3

A modern, flexible, and feature-rich Gantt chart component library for Vue 3, designed for project management, task scheduling, milestone tracking, and timeline visualization. This plugin provides a highly interactive and customizable Gantt chart experience, supporting drag-and-drop, theme switching, and internationalization.

## Installation

Install via npm or yarn:

```bash
npm install jordium-gantt-vue3
# or
yarn add jordium-gantt-vue3
```

## API Reference

### Props

| Prop              | Type                | Description                                 |
| ----------------- | ------------------- | ------------------------------------------- |
| tasks             | Task[]              | Task data array                             |
| milestones        | Task[]              | Milestone data array                        |
| startDate         | Date \| string      | Timeline start date                         |
| endDate           | Date \| string      | Timeline end date                           |
| useDefaultDrawer  | boolean             | Use built-in task drawer                    |
| onTaskDoubleClick | function            | Task double-click handler                   |
| onTaskDelete      | function            | Task delete handler                         |
| onMilestoneSave   | function            | Milestone save handler                      |
| editComponent     | Component           | Custom task edit component                  |

### Events

| Event                   | Payload         | Description                                |
| ----------------------- | --------------- | ------------------------------------------ |
| @taskbar-drag-end       | Task            | Task bar drag end                          |
| @taskbar-resize-end     | Task            | Task bar resize end                        |
| @milestone-drag-end     | Milestone       | Milestone drag end                         |
| @task-updated           | Task            | Task updated                               |
| @task-added             | Task            | Task added                                 |
| @task-deleted           | Task            | Task deleted                               |
| @milestone-data-updated | Milestone       | Milestone updated                          |
| @milestone-deleted      | number          | Milestone deleted (id)                     |

### Theming

- Supports light/dark mode via `isDark` prop or global theme variables.
- Customize colors via CSS variables in `theme-variables.css`.

## Usage Example

```vue
<script setup>
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/style.css'

const tasks = [
  // ...your task data
]
</script>

<template>
  <GanttChart :tasks="tasks" />
</template>
```

## Source Code & Demo

- Full source code and demo examples are available on GitHub:
  - [jordium-gantt-vue3 GitHub Repository](https://github.com/nelson820125/jordium-gantt-vue3)

## Author & Contribution

- Author: Jordium.com (Email: nelson820125@gmail.com / ning.li@jordium.com)
- Feel free to submit issues or pull requests on GitHub.
- Contributions, suggestions, and feedback are welcome!

---

For more details, see the [README](./README.md).

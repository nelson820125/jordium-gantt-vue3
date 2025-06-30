// 导出所有组件
export { default as GanttChart } from './components/GanttChart.vue'
export { default as TaskList } from './components/TaskList.vue'
export { default as Timeline } from './components/Timeline.vue'
export { default as TaskBar } from './components/TaskBar.vue'
export { default as TaskDrawer } from './components/TaskDrawer.vue'
export { default as MilestonePoint } from './components/MilestonePoint.vue'
export { default as MilestoneDialog } from './components/MilestoneDialog.vue'
export { default as TaskRow } from './components/TaskRow.vue'
export type { Task } from './models/classes/Task.ts' // 导出Task类型
export { useMessage } from './composables/useMessage.ts' // 导出useMessage组合式函数

// 导出样式文件
import './styles/theme-variables.css'

// 导出安装函数（可选，用于Vue.use()）
import type { App } from 'vue'
import GanttChart from './components/GanttChart.vue'

export const install = (app: App) => {
  app.component('GanttChart', GanttChart)
}

export default {
  install,
}

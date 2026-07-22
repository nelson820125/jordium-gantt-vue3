// 导出所有组件
export { default as GanttChart } from './components/GanttChart.vue'
export { default as TaskList } from './components/TaskList/TaskList.vue'
export { default as TaskListColumn } from './components/TaskList/TaskListColumn.vue'
export { default as TaskListContextMenu } from './components/TaskList/TaskListContextMenu.vue'
export { default as Timeline } from './components/Timeline.vue'
export { default as TaskBar } from './components/TaskBar.vue'
export { default as TaskBarContextMenu } from './components/Timeline/TaskBarContextMenu.vue'
export { default as TaskDrawer } from './components/TaskDrawer.vue'
export { default as MilestonePoint } from './components/MilestonePoint.vue'
export { default as MilestoneDialog } from './components/MilestoneDialog.vue'
export { default as TaskRow } from './components/TaskList/taskRow/TaskRow.vue'
export { default as CalendarView } from './components/Calendar/CalendarView.vue' // v1.12.5 导出日历视图（独立可用组件）
export { default as ResourceFilterSelect } from './components/Calendar/ResourceFilterSelect.vue' // v1.13.0 导出资源筛选下拉组件（P1 待办 T7.1）
export { default as ResourceUsageView } from './components/ResourceUsage/ResourceUsageView.vue' // v1.12.5 导出资源工时视图（独立可用组件）
export type { Task } from './models/classes/Task.ts' // 导出Task类型
export type { Resource } from './models/classes/Resource.ts' // v1.9.0 导出Resource类型
export { createResource } from './utils/resourceUtils.ts' // v2.0.0 导出资源创建工厂函数
export { useMessage } from './composables/useMessage.ts' // 导出useMessage组合式函数

// 导出 composables 供外部使用
export { useI18n } from './composables/useI18n'

// 导出配置类型
export type {
  TaskListConfig,
  TaskListColumnConfig,
  TaskListColumnType,
  ColumnFormatter,
} from './models/configs/TaskListConfig'
export type {
  ResourceListConfig,
  ResourceListColumnConfig,
  ResourceListColumnType,
  ResourceColumnFormatter,
} from './models/configs/ResourceListConfig' // v1.9.0 导出资源配置类型
export type { TaskBarConfig, LinkConfig, LinkType } from './models/configs/TaskBarConfig'
export type { ToolbarConfig } from './models/configs/ToolbarConfig'
export type {
  CalendarScale,
  CalendarSelectionDraft,
  CalendarSelectionRange,
  WorkingHoursConfig,
} from './models/types/CalendarTypes' // v1.12.5 导出日历视图相关类型
export type {
  ResourceUsageScale,
  ResourceUsageCellData,
  ResourceUsageCellPayload,
  ResourceUsageTaskBreakdown,
  ResourceUsageTaskDetailClickPayload,
} from './models/types/ResourceUsageTypes' // v1.12.5 导出资源工时视图相关类型
export type { GanttViewMode } from './components/GanttToolbar.vue' // v1.12.5 导出视图模式类型（task/resource/calendar/resource-usage）

// 导出样式文件
import './styles/theme-variables.css'

// 导出安装函数（可选，用于Vue.use()）
import type { App } from 'vue'
import GanttChart from './components/GanttChart.vue'
import TaskListColumn from './components/TaskList/TaskListColumn.vue'
import TaskListContextMenu from './components/TaskList/TaskListContextMenu.vue'
import TaskBarContextMenu from './components/Timeline/TaskBarContextMenu.vue'

export const install = (app: App) => {
  app.component('GanttChart', GanttChart)
  app.component('TaskListColumn', TaskListColumn)
  app.component('TaskListContextMenu', TaskListContextMenu)
  app.component('TaskBarContextMenu', TaskBarContextMenu)
}

export default {
  install,
}

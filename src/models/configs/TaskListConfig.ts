// TaskList 列配置类型定义

export type TaskListColumnType =
  | 'name'
  | 'predecessor'
  | 'assignee'
  | 'startDate'
  | 'endDate'
  | 'estimatedHours'
  | 'actualHours'
  | 'progress'

export interface TaskListColumnConfig {
  type?: TaskListColumnType
  key: string // 用于国际化的key，也可以作为识别符
  label?: string // 显示标签
  cssClass?: string // CSS类名
  width?: number // 可选的列宽度
  visible?: boolean // 是否显示，默认true
}

export interface TaskListConfig {
  columns?: TaskListColumnConfig[]
  showAllColumns?: boolean // 是否显示所有列，默认true
  defaultWidth?: number // 默认展开宽度，单位像素，默认320px
  minWidth?: number // 最小宽度，单位像素，默认280px，不能小于280px
  maxWidth?: number // 最大宽度，单位像素，默认1160px
}

// 默认宽度配置
export const DEFAULT_TASK_LIST_WIDTH = 320 // 默认展开宽度
export const DEFAULT_TASK_LIST_MIN_WIDTH = 280 // 最小宽度
export const DEFAULT_TASK_LIST_MAX_WIDTH = 1160 // 最大宽度

// 默认列配置
export const DEFAULT_TASK_LIST_COLUMNS: TaskListColumnConfig[] = [
  {
    type: 'name',
    key: 'taskName',
    label: '任务名称',
    cssClass: 'col-name',
    visible: true,
  },
  {
    type: 'predecessor',
    key: 'predecessor',
    label: '前置任务',
    cssClass: 'col-pre',
    visible: true,
  },
  {
    type: 'assignee',
    key: 'assignee',
    label: '负责人',
    cssClass: 'col-assignee',
    visible: true,
  },
  {
    type: 'startDate',
    key: 'startDate',
    label: '开始日期',
    cssClass: 'col-date',
    visible: true,
  },
  {
    type: 'endDate',
    key: 'endDate',
    label: '结束日期',
    cssClass: 'col-date',
    visible: true,
  },
  {
    type: 'estimatedHours',
    key: 'estimatedHours',
    label: '预估工时',
    cssClass: 'col-hours',
    visible: true,
  },
  {
    type: 'actualHours',
    key: 'actualHours',
    label: '实际工时',
    cssClass: 'col-hours',
    visible: true,
  },
  {
    type: 'progress',
    key: 'progress',
    label: '进度',
    cssClass: 'col-progress',
    visible: true,
  },
]

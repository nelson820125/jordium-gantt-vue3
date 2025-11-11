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
  width?: number | string // 列宽度，支持像素（120）或百分比（'15%'）
  visible?: boolean // 是否显示，默认true
}

export interface TaskListConfig {
  columns?: TaskListColumnConfig[]
  showAllColumns?: boolean // 是否显示所有列，默认true
  defaultWidth?: number | string // 默认展开宽度，支持像素数字（如 320）或百分比字符串（如 '30%'），默认320px
  minWidth?: number | string // 最小宽度，支持像素数字（如 280）或百分比字符串（如 '20%'），默认280px，不能小于280px
  maxWidth?: number | string // 最大宽度，支持像素数字（如 1160）或百分比字符串（如 '80%'），默认1160px
}

// 默认宽度配置
export const DEFAULT_TASK_LIST_WIDTH = 320 // 默认展开宽度
export const DEFAULT_TASK_LIST_MIN_WIDTH = 280 // 最小宽度
export const DEFAULT_TASK_LIST_MAX_WIDTH = 1160 // 最大宽度

/**
 * 解析宽度值（支持像素数字或百分比字符串）
 * @param value 宽度值，可以是数字（像素）或字符串（百分比，如 '30%'）
 * @param containerWidth 容器宽度（用于计算百分比）
 * @param defaultValue 默认值
 * @returns 解析后的像素值
 */
export function parseWidthValue(
  value: number | string | undefined,
  containerWidth: number,
  defaultValue: number,
): number {
  if (value === undefined || value === null) {
    return defaultValue
  }

  // 如果是数字，直接返回
  if (typeof value === 'number') {
    return value
  }

  // 如果是字符串，检查是否是百分比
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.endsWith('%')) {
      const percentage = parseFloat(trimmed)
      if (!isNaN(percentage)) {
        return Math.round((containerWidth * percentage) / 100)
      }
    }
    // 尝试解析为数字
    const parsed = parseFloat(trimmed)
    if (!isNaN(parsed)) {
      return parsed
    }
  }

  return defaultValue
}

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

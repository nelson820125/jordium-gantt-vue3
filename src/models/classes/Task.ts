import { Resource } from './Resource'// Task 类型定义
export interface Task {
  id: number
  name: string
  predecessor?: number[] // 前置任务ID数组
  assignee?: string | string[] // 记录唯一键值，如用户ID或用户名，支持单个或多个
  assigneeName?: string // 任务负责人名称
  avatar?: string | string[] // 任务负责人头像URL，支持单个或多个头像数组
  startDate?: string
  endDate?: string
  actualStartDate?: string // 实际开始日期
  actualEndDate?: string // 实际结束日期
  progress?: number
  estimatedHours?: number
  actualHours?: number
  parentId?: number // 上级任务ID
  children?: Task[]
  collapsed?: boolean
  isParent?: boolean
  type?: string
  description?: string
  icon?: string
  level?: number
  // 计时相关字段
  isTimerRunning?: boolean
  timerStartTime?: number
  timerEndTime?: number // 结束计时时间
  timerStartDesc?: string // 计时开始时填写的描述
  timerElapsedTime?: number
  // 权限控制
  isEditable?: boolean // 是否可编辑（可拖拽、拉伸），默认为true
  // 自定义样式
  barColor?: string // 自定义TaskBar颜色，如 '#ff5733'，若不设置则使用默认颜色方案
  // v1.9.0 资源占用比例
  resources?: Resource[] // 资源分配列表，包含占比信息
  // 支持自定义属性 - 使用 unknown 允许任意类型
  [key: string]: unknown
}

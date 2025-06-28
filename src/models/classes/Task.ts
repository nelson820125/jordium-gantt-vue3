// Task 类型定义
export interface Task {
  id: number
  name: string
  predecessor?: string
  assignee?: string
  startDate?: string
  endDate?: string
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
}

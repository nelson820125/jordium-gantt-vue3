// Milestone 类型定义
export interface Milestone {
  id?: number
  name: string
  startDate: string
  endDate?: string
  assignee?: string
  type: string
  icon?: string
  description?: string
}

// Milestone 类型定义
export interface Milestone {
  id?: number
  name: string
  startDate: string
  endDate?: string
  assignee?: string | string[] // 支持单个或多个负责人
  assigneeName?: string | string[] // 支持单个或多个负责人姓名
  avatar?: string | string[] // 支持单个或多个头像
  type: string
  icon?: string
  description?: string
}

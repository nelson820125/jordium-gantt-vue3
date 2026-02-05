import type { Task } from '../classes/Task'

/**
 * 资源接口 (Resource Interface)
 * 用于资源计划视图，代表可分配的人力或设备资源
 *
 * @version 1.9.0
 * @version 2.0.0 - 从 class 重构为 interface，方法迁移至 resourceUtils.ts
 * @description 支持资源视图的核心数据模型，每个资源可以关联多个任务
 */
export interface Resource {
  id: string | number
  name: string
  type?: string
  avatar?: string
  description?: string
  department?: string
  skills?: string[]
  capacity?: number
  color?: string // 自定义资源行左边框颜色，如 '#ff5733'，若不设置则使用默认颜色方案
  tasks: Task[]
  [key: string]: unknown
}

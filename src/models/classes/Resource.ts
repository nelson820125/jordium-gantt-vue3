import type { Task } from './Task'

/**
 * 资源类 (Resource Class)
 * 用于资源计划视图，代表可分配的人力或设备资源
 *
 * @version 1.9.0
 * @description 支持资源视图的核心数据模型，每个资源可以关联多个任务
 */
export class Resource {
  id: string | number
  name: string
  type?: string
  avatar?: string
  description?: string
  department?: string
  skills?: string[]
  utilization?: number
  tasks: Task[]
  [key: string]: unknown

  constructor(data: {
    id: string | number
    name: string
    type?: string
    avatar?: string
    description?: string
    department?: string
    skills?: string[]
    utilization?: number
    tasks?: Task[]
    [key: string]: unknown
  }) {
    this.id = data.id
    this.name = data.name
    this.type = data.type
    this.avatar = data.avatar
    this.description = data.description
    this.department = data.department
    this.skills = data.skills
    this.utilization = data.utilization
    this.tasks = data.tasks || []

    // 复制其他自定义属性
    Object.keys(data).forEach(key => {
      if (!(key in this)) {
        this[key] = data[key]
      }
    })
  }

  /**
   * 添加任务到资源
   */
  addTask(task: Task): void {
    if (!this.tasks.find(t => t.id === task.id)) {
      this.tasks.push(task)
    }
  }

  /**
   * 从资源中移除任务
   */
  removeTask(taskId: number | string): void {
    this.tasks = this.tasks.filter(t => t.id !== taskId)
  }

  /**
   * 获取任务数量
   */
  getTaskCount(): number {
    return this.tasks.length
  }

  /**
   * 计算资源利用率（基于任务时间重叠）
   * @returns 利用率百分比 (0-100)
   */
  calculateUtilization(): number {
    if (this.tasks.length === 0) return 0
    const baseUtilization = Math.min(this.tasks.length * 20, 100)
    return Math.round(baseUtilization)
  }

  /**
   * 更新利用率
   */
  updateUtilization(): void {
    this.utilization = this.calculateUtilization()
  }
}

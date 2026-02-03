import type { Task } from './Task'
import { detectConflicts } from '../../utils/conflictUtils'

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
  capacity?: number
  color?: string // 自定义资源行左边框颜色，如 '#ff5733'，若不设置则使用默认颜色方案
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
    capacity?: number
    color?: string
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
    this.capacity = data.capacity
    this.color = data.color
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
    this.capacity = this.calculateUtilization()
  }

  /**
   * 检测任务是否存在时间重叠
   * @returns 是否存在任务重叠
   */
  hasTaskOverlap(): boolean {
    if (this.tasks.length < 2) return false

    // 过滤掉没有开始日期和结束日期的任务
    const validTasks = this.tasks.filter(task => task.startDate && task.endDate)
    if (validTasks.length < 2) return false

    // 按开始日期排序
    const sortedTasks = [...validTasks].sort((a, b) => {
      const dateA = new Date(a.startDate!).getTime()
      const dateB = new Date(b.startDate!).getTime()
      return dateA - dateB
    })

    // 检测相邻任务是否重叠
    for (let i = 0; i < sortedTasks.length - 1; i++) {
      const currentTask = sortedTasks[i]
      const nextTask = sortedTasks[i + 1]

      const currentEnd = new Date(currentTask.endDate!).getTime()
      const nextStart = new Date(nextTask.startDate!).getTime()

      // 如果当前任务的结束时间晚于下一个任务的开始时间，则存在重叠
      if (currentEnd > nextStart) {
        return true
      }
    }

    return false
  }

  /**
   * v1.9.0 检测资源是否超载（基于占用比例）
   * 超载定义：同一时间段内，资源总占用比例 > 100%
   * v1.9.9 修复：使用 detectConflicts 函数来正确检测多任务叠加的超载
   * @returns 是否资源超载
   */
  isOverloaded(): boolean {
    if (this.tasks.length < 2) return false

    // 使用 conflictUtils 的 detectConflicts 函数来检测冲突
    // 这个函数能正确处理多任务叠加的超载情况（如 A:40% + B:40% + C:30% = 110%）
    const conflictZones = detectConflicts(this.tasks, this.id)

    return conflictZones.length > 0
  }

  /**
   * v1.9.0 获取任务中当前资源的利用率
   * @param task 任务对象
   * @returns 占比百分比 (20-100)，默认100
   */
  getTaskAllocationPercent(task: any): number {
    if (!task.resources || !Array.isArray(task.resources)) {
      return 100 // 未配置resources时，默认100%
    }

    const allocation = task.resources.find((r: any) => r.id === this.id)
    if (!allocation) {
      return 100 // 未找到当前资源的分配信息，默认100%
    }

    const capacity = allocation.capacity ?? 100
    return Math.max(20, Math.min(100, capacity)) // 限制范围 20-100
  }
}

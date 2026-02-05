import type { Task } from '../models/classes/Task'
import type { Resource } from '../models/types/Resource'
import { detectConflicts } from './conflictUtils'

/**
 * 检测两个任务的时间段是否重叠
 * @param task1 任务1
 * @param task2 任务2
 * @returns 是否重叠
 */
export function isTaskTimeOverlap(task1: Task, task2: Task): boolean {
  if (!task1.startDate || !task1.endDate || !task2.startDate || !task2.endDate) {
    return false
  }

  const start1 = new Date(task1.startDate).getTime()
  const end1 = new Date(task1.endDate).getTime()
  const start2 = new Date(task2.startDate).getTime()
  const end2 = new Date(task2.endDate).getTime()

  // 时间段重叠判定：start1 < end2 && start2 < end1
  return start1 < end2 && start2 < end1
}

/**
 * 获取任务在资源中的占比
 */
function getTaskResourcePercent(task: Task, resourceId: string | number): number {
  if (!task.resources || !Array.isArray(task.resources)) {
    return 100 // 默认100%
  }
  const allocation = task.resources.find((r: any) => String(r.id) === String(resourceId))
  return allocation?.capacity ?? 100
}

/**
 * 检测资源的任务列表中是否存在资源超载冲突
 * 逻辑：只要时间有交集的任务，资源占比总和超过100%，就认为是冲突
 * @param resource 资源对象
 * @returns 冲突的任务ID集合
 */
export function detectResourceConflicts(resource: Resource): Set<number> {
  const conflictTaskIds = new Set<number>()
  const tasks = resource.tasks || []

  // 过滤出有时间信息的任务
  const validTasks = tasks.filter(task => task.startDate && task.endDate)

  // 两两比较检测资源超载
  for (let i = 0; i < validTasks.length; i++) {
    for (let j = i + 1; j < validTasks.length; j++) {
      const task1 = validTasks[i]
      const task2 = validTasks[j]

      // 首先检查是否有时间交集
      if (isTaskTimeOverlap(task1, task2)) {
        // 计算两个任务在该资源的占比总和
        const percent1 = getTaskResourcePercent(task1, resource.id)
        const percent2 = getTaskResourcePercent(task2, resource.id)
        const totalPercent = percent1 + percent2

        // 如果占比总和超过100%，标记为冲突
        if (totalPercent > 100) {
          conflictTaskIds.add(task1.id)
          conflictTaskIds.add(task2.id)
        }
      }
    }
  }

  return conflictTaskIds
}

/**
 * 检测所有资源的冲突情况
 * @param resources 资源列表
 * @returns Map<resourceId, Set<conflictTaskIds>>
 */
export function detectAllResourceConflicts(
  resources: Resource[],
): Map<string | number, Set<number>> {
  const conflictsMap = new Map<string | number, Set<number>>()

  resources.forEach(resource => {
    const conflicts = detectResourceConflicts(resource)
    if (conflicts.size > 0) {
      conflictsMap.set(resource.id, conflicts)
    }
  })

  return conflictsMap
}

/**
 * 计算资源利用率（基于任务数量的简化计算）
 * @param resource 资源对象
 * @returns 利用率百分比 (0-100)
 */
function calculateSimpleResourceUtilization(resource: Resource): number {
  if (resource.tasks.length === 0) return 0
  const baseUtilization = Math.min(resource.tasks.length * 20, 100)
  return Math.round(baseUtilization)
}

/**
 * 计算资源利用率（时间窗口版：任务时长累加 / 时间窗口）
 * @param resource 资源对象
 * @param timeWindowDays 时间窗口（天数），默认30天
 * @returns 利用率百分比（0-100+）
 */
export function calculateResourceUtilization(
  resource: Resource,
  timeWindowDays?: number,
): number {
  // 如果没有指定时间窗口，使用简化计算
  if (timeWindowDays === undefined) {
    return calculateSimpleResourceUtilization(resource)
  }

  const tasks = resource.tasks || []
  if (tasks.length === 0) return 0

  let totalTaskHours = 0

  tasks.forEach(task => {
    if (task.startDate && task.endDate) {
      const start = new Date(task.startDate).getTime()
      const end = new Date(task.endDate).getTime()
      const durationMs = end - start
      const durationHours = durationMs / (1000 * 60 * 60)
      totalTaskHours += durationHours
    }
  })

  // 假设每天工作8小时
  const availableHours = timeWindowDays * 8

  return availableHours > 0 ? Math.round((totalTaskHours / availableHours) * 100) : 0
}

/**
 * 创建资源对象（工厂函数）
 * @param data 资源数据
 * @returns Resource 对象
 */
export function createResource(data: {
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
}): Resource {
  const resource: Resource = {
    id: data.id,
    name: data.name,
    type: data.type,
    avatar: data.avatar,
    description: data.description,
    department: data.department,
    skills: data.skills,
    capacity: data.capacity,
    color: data.color,
    tasks: data.tasks || [],
  }

  // 复制其他自定义属性
  Object.keys(data).forEach(key => {
    if (!(key in resource)) {
      resource[key] = data[key]
    }
  })

  return resource
}

/**
 * 添加任务到资源
 * @param resource 资源对象
 * @param task 任务对象
 */
export function addTaskToResource(resource: Resource, task: Task): void {
  if (!resource.tasks.find(t => t.id === task.id)) {
    resource.tasks.push(task)
  }
}

/**
 * 从资源中移除任务
 * @param resource 资源对象
 * @param taskId 任务ID
 */
export function removeTaskFromResource(resource: Resource, taskId: number | string): void {
  resource.tasks = resource.tasks.filter(t => t.id !== taskId)
}

/**
 * 获取资源的任务数量
 * @param resource 资源对象
 * @returns 任务数量
 */
export function getResourceTaskCount(resource: Resource): number {
  return resource.tasks.length
}

/**
 * 更新资源的利用率
 * @param resource 资源对象
 */
export function updateResourceUtilization(resource: Resource): void {
  resource.capacity = calculateResourceUtilization(resource)
}

/**
 * 检测资源的任务是否存在时间重叠
 * @param resource 资源对象
 * @returns 是否存在任务重叠
 */
export function hasResourceTaskOverlap(resource: Resource): boolean {
  if (resource.tasks.length < 2) return false

  // 过滤掉没有开始日期和结束日期的任务
  const validTasks = resource.tasks.filter(task => task.startDate && task.endDate)
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
 * 检测资源是否超载（基于占用比例）
 * 超载定义：同一时间段内，资源总占用比例 > 100%
 * @param resource 资源对象
 * @returns 是否资源超载
 */
export function isResourceOverloaded(resource: Resource): boolean {
  if (resource.tasks.length < 2) return false

  // 使用 conflictUtils 的 detectConflicts 函数来检测冲突
  // 这个函数能正确处理多任务叠加的超载情况（如 A:40% + B:40% + C:30% = 110%）
  const conflictZones = detectConflicts(resource.tasks, resource.id)

  return conflictZones.length > 0
}

/**
 * 获取任务中当前资源的利用率
 * @param resource 资源对象
 * @param task 任务对象
 * @returns 占比百分比 (20-100)，默认100
 */
export function getTaskAllocationPercent(resource: Resource, task: any): number {
  if (!task.resources || !Array.isArray(task.resources)) {
    return 100 // 未配置resources时，默认100%
  }

  const allocation = task.resources.find((r: any) => r.id === resource.id)
  if (!allocation) {
    return 100 // 未找到当前资源的分配信息，默认100%
  }

  const capacity = allocation.capacity ?? 100
  return Math.max(20, Math.min(100, capacity)) // 限制范围 20-100
}

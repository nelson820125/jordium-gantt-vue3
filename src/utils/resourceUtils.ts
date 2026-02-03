import type { Task } from '../models/classes/Task'
import type { Resource } from '../models/classes/Resource'

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
 * 计算资源利用率（简化版：任务时长累加 / 时间窗口）
 * @param resource 资源对象
 * @param timeWindowDays 时间窗口（天数），默认30天
 * @returns 利用率百分比（0-100+）
 */
export function calculateResourceUtilization(
  resource: Resource,
  timeWindowDays = 30,
): number {
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

import type { Task } from '../models/classes/Task'

/**
 * v1.9.0 任务布局工具函数
 * 用于处理资源视图下的任务换行布局
 */

/**
 * 检测两个任务是否存在时间交集
 */
export function hasTimeOverlap(task1: Task, task2: Task): boolean {
  // 获取任务的开始和结束日期
  const start1 = task1.startDate ? new Date(task1.startDate).getTime() : null
  const end1 = task1.endDate ? new Date(task1.endDate).getTime() : null
  const start2 = task2.startDate ? new Date(task2.startDate).getTime() : null
  const end2 = task2.endDate ? new Date(task2.endDate).getTime() : null

  // 如果任一任务缺少日期信息，视为无交集
  if (!start1 || !end1 || !start2 || !end2) {
    return false
  }

  // 检测时间交集：task1的结束时间 > task2的开始时间 && task1的开始时间 < task2的结束时间
  return end1 > start2 && start1 < end2
}

/**
 * 获取任务的资源占比（用于高度计算）
 */
function getTaskResourcePercent(task: Task, resourceId?: string | number): number {
  if (!resourceId || !task.resources || task.resources.length === 0) {
    return 100
  }
  const allocation = task.resources.find((r: any) => r.id === resourceId)
  if (allocation && allocation.percent !== undefined) {
    return Math.max(20, Math.min(100, allocation.percent))
  }
  return 100
}

/**
 * 为任务列表分配行索引，并计算每行高度
 * 使用贪心算法：尽可能将任务放在第一个不冲突的行
 * @param tasks 任务列表
 * @param resourceId 资源ID（用于获取占比）
 * @param baseRowHeight 基础行高（默认51）
 * @returns { taskRowMap, rowHeights, totalHeight }
 */
export function assignTaskRows(
  tasks: Task[],
  resourceId?: string | number,
  baseRowHeight: number = 51
): {
  taskRowMap: Map<string | number, number>
  rowHeights: number[]
  totalHeight: number
} {
  const taskRowMap = new Map<string | number, number>()
  const rowHeights: number[] = []

  if (!tasks || tasks.length === 0) {
    return { taskRowMap, rowHeights, totalHeight: baseRowHeight }
  }

  // 按开始时间排序任务
  const sortedTasks = [...tasks].sort((a, b) => {
    const timeA = a.startDate ? new Date(a.startDate).getTime() : 0
    const timeB = b.startDate ? new Date(b.startDate).getTime() : 0
    return timeA - timeB
  })

  // 记录每一行的所有任务
  const rowTasks: Task[][] = []

  for (const task of sortedTasks) {
    // 查找第一个不冲突的行
    let assignedRow = -1

    for (let rowIndex = 0; rowIndex < rowTasks.length; rowIndex++) {
      const tasksInRow = rowTasks[rowIndex]

      // 检查当前任务是否与该行的所有任务都不冲突
      let hasConflict = false
      for (const taskInRow of tasksInRow) {
        if (hasTimeOverlap(task, taskInRow)) {
          hasConflict = true
          break
        }
      }

      // 如果与该行所有任务都不冲突，可以放在这一行
      if (!hasConflict) {
        assignedRow = rowIndex
        rowTasks[rowIndex].push(task)
        break
      }
    }

    // 如果没有找到合适的行，创建新行
    if (assignedRow === -1) {
      assignedRow = rowTasks.length
      rowTasks.push([task])
    }

    taskRowMap.set(task.id, assignedRow)
  }

  // 计算每行的高度
  // v1.9.1: TaskBar固定41px全高度，用伪元素实现镂空，所以行高不再按占比缩放
  // v1.9.1: 每行底部都有5px padding-bottom，第一行顶部也有5px padding-top
  const baseTaskBarHeight = baseRowHeight - 10 // 基础TaskBar高度 (51 - 10 = 41px)

  for (let i = 0; i < rowTasks.length; i++) {
    // v1.9.1: 所有TaskBar都是固定41px高度，每行都有底部padding
    // 第一行：padding-top(5px) + TaskBar高度(41px) + padding-bottom(5px) = 51px
    // 后续行：TaskBar高度(41px) + padding-bottom(5px) = 46px
    const rowHeight = i === 0
      ? 5 + baseTaskBarHeight + 5  // 第一行：5 + 41 + 5 = 51px
      : baseTaskBarHeight + 5       // 后续行：41 + 5 = 46px

    rowHeights.push(rowHeight)
  }

  // 计算总高度
  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0)

  return { taskRowMap, rowHeights, totalHeight }
}

/**
 * 计算任务列表需要的最大行数
 */
export function calculateMaxRows(tasks: Task[], resourceId?: string | number): number {
  const result = assignTaskRows(tasks, resourceId)
  if (result.taskRowMap.size === 0) {
    return 1
  }
  return Math.max(...Array.from(result.taskRowMap.values())) + 1
}

/**
 * 为资源视图的每个资源计算任务行布局
 * @returns 资源ID到其任务行映射的映射 { resourceId: { taskRowMap, rowHeights, totalHeight } }
 */
export function calculateResourceTaskLayout(
  tasks: Task[],
  currentResourceId?: string | number,
  baseRowHeight: number = 51
): Map<string | number, { taskRowMap: Map<string | number, number>, rowHeights: number[], totalHeight: number }> {
  const resourceLayoutMap = new Map<string | number, { taskRowMap: Map<string | number, number>, rowHeights: number[], totalHeight: number }>()

  if (!currentResourceId) {
    return resourceLayoutMap
  }

  // 筛选属于当前资源的任务
  const resourceTasks = tasks.filter(task => {
    if (!task.resources || task.resources.length === 0) {
      return false
    }
    return task.resources.some(r => r.id === currentResourceId)
  })

  // 为当前资源的任务分配行
  const result = assignTaskRows(resourceTasks, currentResourceId, baseRowHeight)
  resourceLayoutMap.set(currentResourceId, result)

  return resourceLayoutMap
}

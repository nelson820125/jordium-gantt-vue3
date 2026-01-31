/**
 * conflictUtils.ts - 资源冲突检测工具函数
 *
 * 用于检测同一资源在同一时间段的任务冲突（总投入比例超载）
 * v1.9.2
 */

import type { Task } from '../models/classes/Task'

/**
 * 冲突区域数据结构
 */
export interface ConflictZone {
  /** 冲突开始时间 */
  startDate: Date
  /** 冲突结束时间 */
  endDate: Date
  /** 总投入比例（百分比） */
  totalPercent: number
  /** 冲突等级 */
  level: 'light' | 'medium' | 'severe'
  /** 涉及的任务列表 */
  tasks: Array<{
    id: number | string
    name: string
    percent: number
  }>
  /** Canvas渲染坐标（由GanttConflicts组件计算填充） */
  left?: number
  width?: number
  top?: number
  height?: number
}

/**
 * 时间交集结果
 */
export interface TimeIntersection {
  start: Date
  end: Date
}

/**
 * 检测资源时间冲突
 *
 * @param tasks 任务列表
 * @param resourceId 资源ID
 * @returns 冲突区域列表
 *
 * @example
 * const conflicts = detectConflicts(tasks, 'resource-1')
 */
export function detectConflicts(
  tasks: Task[],
  resourceId: string | number
): ConflictZone[] {
  // 过滤出包含指定资源的任务
  const resourceTasks = tasks.filter((task) => {
    if (!task.resources || task.resources.length === 0) return false
    return task.resources.some((r) => String(r.id) === String(resourceId))
  })

  if (resourceTasks.length < 2) {
    // 少于2个任务不会冲突
    return []
  }

  // 根据任务数量选择算法
  if (resourceTasks.length > 100) {
    // TODO: 使用区间树算法（O(n log n)）
    // 当前暂用暴力遍历，后续优化
    return detectConflictsBruteForce(resourceTasks, resourceId)
  } else {
    // 使用暴力遍历（O(n²)）
    return detectConflictsBruteForce(resourceTasks, resourceId)
  }
}

/**
 * 暴力遍历检测冲突（O(n²)算法）
 */
function detectConflictsBruteForce(
  tasks: Task[],
  resourceId: string | number
): ConflictZone[] {
  const conflictZones: ConflictZone[] = []
  const processedIntervals = new Set<string>() // 用于去重

  // 遍历所有任务对
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const task1 = tasks[i]
      const task2 = tasks[j]

      // 检查时间是否重叠
      const intersection = getTimeIntersection(task1, task2)
      if (!intersection) continue

      // 收集该时间段内的所有任务
      const overlappingTasks = tasks.filter((task) => {
        const taskIntersection = getTimeIntersection(
          {
            startDate: intersection.start.toISOString().split('T')[0],
            endDate: intersection.end.toISOString().split('T')[0],
          } as Task,
          task
        )
        return taskIntersection !== null
      })

      // 计算总投入比例
      let totalPercent = 0
      const taskDetails = overlappingTasks.map((task) => {
        const resource = task.resources?.find((r) => String(r.id) === String(resourceId))
        const percent = resource?.percent || 0
        totalPercent += percent
        return {
          id: task.id!,
          name: task.name || '未命名任务',
          percent,
        }
      })

      // 只有超载（>100%）才算冲突
      if (totalPercent <= 100) continue

      // 计算冲突范围：所有参与冲突的任务在intersection范围内的并集
      // 过滤出有资源分配的任务
      const tasksWithResource = overlappingTasks.filter((task) => {
        const resource = task.resources?.find((r) => String(r.id) === String(resourceId))
        return resource && resource.percent > 0
      })

      // 计算每个任务与intersection的交集，然后取并集
      let realStart = intersection.end  // 初始化为最大值
      let realEnd = intersection.start  // 初始化为最小值

      for (const task of tasksWithResource) {
        const taskStart = parseDate(task.startDate)
        const taskEnd = parseDate(task.endDate)
        if (taskStart && taskEnd) {
          // 计算task与intersection的交集
          const overlapStart = new Date(Math.max(taskStart.getTime(), intersection.start.getTime()))
          const overlapEnd = new Date(Math.min(taskEnd.getTime(), intersection.end.getTime()))

          // 取所有交集的并集（最小开始 ~ 最大结束）
          realStart = new Date(Math.min(realStart.getTime(), overlapStart.getTime()))
          realEnd = new Date(Math.max(realEnd.getTime(), overlapEnd.getTime()))
        }
      }

      // 创建区间标识符用于去重（避免多个任务对产生相同的冲突区间）
      const intervalKey = `${realStart.getTime()}-${realEnd.getTime()}`

      // 避免重复添加相同的冲突区间
      if (processedIntervals.has(intervalKey)) continue
      processedIntervals.add(intervalKey)

      // 创建冲突区域（使用真实交集范围）
      conflictZones.push({
        startDate: realStart,
        endDate: realEnd,
        totalPercent,
        level: getConflictLevel(totalPercent),
        tasks: taskDetails,
      })
    }
  }

  // 合并重叠的冲突区域
  return mergeConflictZones(conflictZones)
}

/**
 * 合并重叠的冲突区域
 */
function mergeConflictZones(zones: ConflictZone[]): ConflictZone[] {
  if (zones.length === 0) return []

  // 按开始时间排序
  const sorted = [...zones].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  const merged: ConflictZone[] = []
  let current = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]

    // 检查是否重叠
    if (current.endDate >= next.startDate) {
      // 合并区域
      current = {
        startDate: current.startDate,
        endDate: new Date(Math.max(current.endDate.getTime(), next.endDate.getTime())),
        totalPercent: Math.max(current.totalPercent, next.totalPercent), // 取最大负载
        level: getConflictLevel(Math.max(current.totalPercent, next.totalPercent)),
        tasks: mergeTasks(current.tasks, next.tasks),
      }
    } else {
      // 不重叠，保存当前区域并开始新区域
      merged.push(current)
      current = next
    }
  }

  // 添加最后一个区域
  merged.push(current)

  return merged
}

/**
 * 合并任务列表（去重）
 */
function mergeTasks(
  tasks1: ConflictZone['tasks'],
  tasks2: ConflictZone['tasks']
): ConflictZone['tasks'] {
  const taskMap = new Map<string | number, ConflictZone['tasks'][0]>()

  for (const task of tasks1) {
    taskMap.set(task.id, task)
  }

  for (const task of tasks2) {
    if (!taskMap.has(task.id)) {
      taskMap.set(task.id, task)
    } else {
      // 已存在，更新为更高的投入比例
      const existing = taskMap.get(task.id)!
      if (task.percent > existing.percent) {
        taskMap.set(task.id, task)
      }
    }
  }

  return Array.from(taskMap.values())
}

/**
 * 计算两个任务的时间交集
 *
 * @param task1 任务1
 * @param task2 任务2
 * @returns 时间交集，如果没有交集返回null
 *
 * @example
 * const intersection = getTimeIntersection(task1, task2)
 * if (intersection) {
 *   console.log('冲突时间段:', intersection.start, '~', intersection.end)
 * }
 */
export function getTimeIntersection(
  task1: Task | { startDate?: string; endDate?: string },
  task2: Task | { startDate?: string; endDate?: string }
): TimeIntersection | null {
  // 解析日期
  const start1 = parseDate(task1.startDate)
  const end1 = parseDate(task1.endDate)
  const start2 = parseDate(task2.startDate)
  const end2 = parseDate(task2.endDate)

  // 任意一个任务没有有效日期，返回null
  if (!start1 || !end1 || !start2 || !end2) {
    return null
  }

  // endDate包含当天，需要+1天来判断交集
  const end1Plus = new Date(end1.getTime() + 24 * 60 * 60 * 1000)
  const end2Plus = new Date(end2.getTime() + 24 * 60 * 60 * 1000)

  // 判断是否有交集：task1.start < task2.end+1 && task2.start < task1.end+1
  if (start1 >= end2Plus || start2 >= end1Plus) {
    return null
  }

  // 计算交集（返回的end是包含当天的，不需要+1）
  const intersectionStart = new Date(Math.max(start1.getTime(), start2.getTime()))
  const intersectionEnd = new Date(Math.min(end1.getTime(), end2.getTime()))

  return {
    start: intersectionStart,
    end: intersectionEnd,
  }
}

/**
 * 判断冲突等级
 *
 * @param totalPercent 总投入比例（百分比）
 * @returns 冲突等级
 *
 * @example
 * getConflictLevel(110) // 'light'
 * getConflictLevel(130) // 'medium'
 * getConflictLevel(160) // 'severe'
 */
export function getConflictLevel(
  totalPercent: number
): 'light' | 'medium' | 'severe' {
  if (totalPercent > 150) {
    return 'severe' // 严重冲突
  } else if (totalPercent > 120) {
    return 'medium' // 中度冲突
  } else {
    return 'light' // 轻度冲突
  }
}

/**
 * 解析日期字符串为Date对象
 */
function parseDate(dateString: string | undefined): Date | null {
  if (!dateString) return null

  // 处理ISO格式 (YYYY-MM-DD 或 YYYY-MM-DD HH:mm)
  if (typeof dateString === 'string') {
    // 只有日期部分
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number)
      return new Date(year, month - 1, day)
    }

    // 包含时间部分
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dateString)) {
      const [datePart, timePart] = dateString.split(' ')
      const [year, month, day] = datePart.split('-').map(Number)
      const [hour, minute] = timePart.split(':').map(Number)
      return new Date(year, month - 1, day, hour, minute)
    }
  }

  // 尝试直接解析
  const date = new Date(dateString)
  return isNaN(date.getTime()) ? null : date
}

/**
 * 计算两个日期之间的天数差
 */
export function getDaysDiff(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * 检查日期是否在指定范围内
 */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end
}

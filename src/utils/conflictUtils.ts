/**
 * conflictUtils.ts - 资源冲突检测工具函数
 *
 * 用于检测同一资源在同一时间段的任务冲突（总投入比例超载）
 * v1.9.2
 * v1.9.3 - 实现区间树算法优化冲突检测性能
 * v1.9.6 - 修复冲突区域endDate计算：精确定位资源最后超载时刻
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
    capacity: number
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
  resourceId: string | number,
  timeScale?: string
): ConflictZone[] {
  // v1.9.10 过滤出包含指定资源的任务
  // 注意：如果任务没有resources字段或为空，视为100%分配给该资源（资源视图中任务必然属于某个资源）
  const resourceTasks = tasks.filter(task => {
    // 如果没有resources字段或为空，视为100%分配
    if (!task.resources || task.resources.length === 0) return true
    return task.resources.some(r => String(r.id) === String(resourceId))
  })

  if (resourceTasks.length < 2) {
    // 少于2个任务不会冲突
    return []
  }

  let result: ConflictZone[]

  // 根据任务数量选择算法
  if (resourceTasks.length > 100) {
    // 使用区间树算法（O(n log n)）
    result = detectConflictsWithIntervalTree(resourceTasks, resourceId, timeScale)
  } else {
    // 使用暴力遍历（O(n²)）
    result = detectConflictsBruteForce(resourceTasks, resourceId, timeScale)
  }

  return result
}

/**
 * 暴力遍历检测冲突（O(n²)算法）
 */
function detectConflictsBruteForce(
  tasks: Task[],
  resourceId: string | number,
  timeScale?: string
): ConflictZone[] {
  const conflictZones: ConflictZone[] = []
  const processedIntervals = new Set<string>() // 用于去重

  // 遍历所有任务对
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const task1 = tasks[i]
      const task2 = tasks[j]

      // 检查时间是否重叠
      const intersection = getTimeIntersection(task1, task2, timeScale)
      if (!intersection) continue

      // 收集该时间段内的所有任务
      // 将intersection的Date对象转换为字符串格式传入getTimeIntersection
      const fmtDate = (d: Date): string => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const hour = String(d.getHours()).padStart(2, '0')
        const min = String(d.getMinutes()).padStart(2, '0')
        // 小时视图保留时分精度，其他视图只需日期
        return timeScale === 'hour'
          ? `${year}-${month}-${day} ${hour}:${min}`
          : `${year}-${month}-${day}`
      }
      const overlappingTasks = tasks.filter(task => {
        const taskIntersection = getTimeIntersection(
          { startDate: fmtDate(intersection.start), endDate: fmtDate(intersection.end) },
          task,
          timeScale
        )
        return taskIntersection !== null
      })

      // 计算总投入比例
      let totalPercent = 0
      const taskDetails = overlappingTasks.map(task => {
        // v1.9.10 如果没有resources字段，默认100%；否则查找对应资源的capacity
        // 这确保了资源视图中未明确指定占比的任务被正确计入冲突检测
        const resource = task.resources?.find(r => String(r.id) === String(resourceId))
        const capacity =
          !task.resources || task.resources.length === 0 ? 100 : resource?.capacity || 0
        totalPercent += capacity
        return {
          id: task.id!,
          name: task.name || '未命名任务',
          capacity,
        }
      })

      // 只有超载（>100%）才算冲突
      if (totalPercent <= 100) {
        continue
      }

      // 计算冲突范围：所有参与冲突的任务在intersection范围内的并集
      // 过滤出有资源分配的任务（没有resources字段视为100%分配）
      const tasksWithResource = overlappingTasks.filter(task => {
        if (!task.resources || task.resources.length === 0) return true
        const resource = task.resources?.find(r => String(r.id) === String(resourceId))
        return resource && resource.capacity && resource.capacity > 0
      })

      // v1.9.6 修复：精确计算真正超载的时间段
      // 收集所有任务的时间边界点（开始和结束时间）
      // 小时视图用分钟精度，其他视图用天精度
      const DAY_MS = 24 * 60 * 60 * 1000
      const isHourView = timeScale === 'hour'
      // 日期边界偏移：日视图 endDate 包含当天所以 +1天；小时视图直接用精确时间
      const endBoundaryOffset = isHourView ? 0 : DAY_MS

      const timePoints = new Set<number>()
      for (const task of tasksWithResource) {
        const taskStart = parseDate(task.startDate)
        const taskEnd = parseDate(task.endDate)
        if (taskStart && taskEnd) {
          // 只添加在intersection范围内的时间点
          const overlapStart = Math.max(taskStart.getTime(), intersection.start.getTime())
          const overlapEnd = Math.min(taskEnd.getTime(), intersection.end.getTime())
          timePoints.add(overlapStart)
          timePoints.add(overlapEnd + endBoundaryOffset)
        }
      }

      // 按时间排序
      const sortedTimePoints = Array.from(timePoints).sort((a, b) => a - b)

      // 遍历每个时间段，找出真正超载的区间
      const overloadedIntervals: Array<{ start: number; end: number }> = []
      for (let k = 0; k < sortedTimePoints.length - 1; k++) {
        const segmentStart = sortedTimePoints[k]
        const segmentEnd = sortedTimePoints[k + 1]

        // 计算这个时间段内的总占比
        let segmentPercent = 0
        for (const task of tasksWithResource) {
          const taskStart = parseDate(task.startDate)
          const taskEnd = parseDate(task.endDate)
          if (!taskStart || !taskEnd) continue

          // 检查任务是否在这个时间段内活跃
          // 日视图：endDate包含当天，+1天作为不含边界；小时视图：直接用精确时间
          const taskEndInclusive = taskEnd.getTime() + endBoundaryOffset
          if (taskStart.getTime() <= segmentStart && taskEndInclusive > segmentStart) {
            const resource = task.resources?.find(r => String(r.id) === String(resourceId))
            const capacity =
              !task.resources || task.resources.length === 0 ? 100 : resource?.capacity || 0
            segmentPercent += capacity
          }
        }

        // 只保留超载的时间段
        if (segmentPercent > 100) {
          overloadedIntervals.push({ start: segmentStart, end: segmentEnd })
        }
      }

      // 如果没有超载区间，跳过（理论上不应该发生，因为之前已经检查过totalPercent > 100）
      if (overloadedIntervals.length === 0) continue

      // 合并相邻的超载区间
      const realStart = overloadedIntervals[0].start
      let realEnd = overloadedIntervals[0].end
      for (let k = 1; k < overloadedIntervals.length; k++) {
        if (overloadedIntervals[k].start === realEnd) {
          // 相邻区间，合并
          realEnd = overloadedIntervals[k].end
        }
      }
      // realEnd是边界点。日视图：需要-1天得到实际endDate（包含当天语义）；小时视图：直接使用
      realEnd = isHourView ? realEnd : realEnd - DAY_MS

      // 创建区间标识符用于去重（避免多个任务对产生相同的冲突区间）
      const intervalKey = `${realStart}-${realEnd}`

      // 避免重复添加相同的冲突区间
      if (processedIntervals.has(intervalKey)) continue
      processedIntervals.add(intervalKey)

      // 创建冲突区域（使用真实超载的时间范围）
      conflictZones.push({
        startDate: new Date(realStart),
        endDate: new Date(realEnd),
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
      if (task.capacity > existing.capacity) {
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
  task2: Task | { startDate?: string; endDate?: string },
  timeScale?: string
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

  if (timeScale === 'hour') {
    // 小时视图：直接用精确时间戳比较，无需+1天
    if (start1.getTime() >= end2.getTime() || start2.getTime() >= end1.getTime()) {
      return null
    }
    const intersectionStart = new Date(Math.max(start1.getTime(), start2.getTime()))
    const intersectionEnd = new Date(Math.min(end1.getTime(), end2.getTime()))
    return { start: intersectionStart, end: intersectionEnd }
  }

  // 日/周/月等视图：endDate包含当天，需要+1天来判断交集
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
export function getConflictLevel(totalPercent: number): 'light' | 'medium' | 'severe' {
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

// ==================== 区间树算法实现 ====================

/**
 * 区间树节点
 */
interface IntervalTreeNode {
  /** 区间开始时间 */
  start: number
  /** 区间结束时间 */
  end: number
  /** 子树中最大的结束时间 */
  max: number
  /** 关联的任务 */
  task: Task
  /** 左子节点 */
  left: IntervalTreeNode | null
  /** 右子节点 */
  right: IntervalTreeNode | null
}

/**
 * 区间树类
 */
class IntervalTree {
  private root: IntervalTreeNode | null = null

  /**
   * 插入区间
   */
  insert(task: Task): void {
    const start = parseDate(task.startDate)
    const end = parseDate(task.endDate)
    if (!start || !end) return

    const node: IntervalTreeNode = {
      start: start.getTime(),
      end: end.getTime(),
      max: end.getTime(),
      task,
      left: null,
      right: null,
    }

    if (!this.root) {
      this.root = node
    } else {
      this.insertNode(this.root, node)
    }
  }

  /**
   * 递归插入节点
   */
  private insertNode(root: IntervalTreeNode, node: IntervalTreeNode): void {
    // 更新子树最大值
    if (node.end > root.max) {
      root.max = node.end
    }

    // 根据开始时间判断插入左子树还是右子树
    if (node.start < root.start) {
      if (root.left === null) {
        root.left = node
      } else {
        this.insertNode(root.left, node)
      }
    } else {
      if (root.right === null) {
        root.right = node
      } else {
        this.insertNode(root.right, node)
      }
    }
  }

  /**
   * 查询与指定区间重叠的所有任务
   */
  query(start: number, end: number): Task[] {
    const result: Task[] = []
    this.queryNode(this.root, start, end, result)
    return result
  }

  /**
   * 递归查询节点
   */
  private queryNode(
    node: IntervalTreeNode | null,
    start: number,
    end: number,
    result: Task[]
  ): void {
    if (!node) return

    // 当前节点是否与查询区间重叠
    if (node.start <= end && node.end >= start) {
      result.push(node.task)
    }

    // 左子树可能有重叠
    if (node.left && node.left.max >= start) {
      this.queryNode(node.left, start, end, result)
    }

    // 右子树可能有重叠
    if (node.right && node.start <= end) {
      this.queryNode(node.right, start, end, result)
    }
  }
}

/**
 * 使用区间树检测冲突（O(n log n) 算法）
 */
function detectConflictsWithIntervalTree(
  tasks: Task[],
  resourceId: string | number,
  timeScale?: string
): ConflictZone[] {
  // 构建区间树（O(n log n)）
  const tree = new IntervalTree()
  for (const task of tasks) {
    tree.insert(task)
  }

  const conflictZones: ConflictZone[] = []
  const processedIntervals = new Set<string>()

  // 对每个任务查询重叠任务（O(n log n)）
  for (const task of tasks) {
    const start = parseDate(task.startDate)
    const end = parseDate(task.endDate)
    if (!start || !end) continue

    // 查询与当前任务重叠的所有任务
    const overlappingTasks = tree.query(start.getTime(), end.getTime())

    // 至少需要2个任务才可能冲突
    if (overlappingTasks.length < 2) continue

    // 计算总投入比例
    let totalPercent = 0
    const taskDetails = overlappingTasks.map(t => {
      // 如果没有resources字段，默认100%；否则查找对应资源的percent
      const resource = t.resources?.find(r => String(r.id) === String(resourceId))
      const capacity = !t.resources || t.resources.length === 0 ? 100 : resource?.capacity || 0
      totalPercent += capacity
      return {
        id: t.id!,
        name: t.name || '未命名任务',
        capacity,
      }
    })

    // 只有超载（>100%）才算冲突
    if (totalPercent <= 100) continue

    // v1.9.6 修复：精确计算真正超载的时间段
    // 过滤出有资源分配的任务
    const tasksWithResource = overlappingTasks.filter(t => {
      if (!t.resources || t.resources.length === 0) return true
      const resource = t.resources?.find(r => String(r.id) === String(resourceId))
      return resource && resource.capacity && resource.capacity > 0
    })

    // 小时视图用分钟精度，其他视图用天精度
    const DAY_MS_IT = 24 * 60 * 60 * 1000
    const isHourViewIT = timeScale === 'hour'
    const endBoundaryOffsetIT = isHourViewIT ? 0 : DAY_MS_IT

    // 收集所有任务的时间边界点
    const timePoints = new Set<number>()
    timePoints.add(start.getTime()) // 当前任务的开始
    timePoints.add(end.getTime() + endBoundaryOffsetIT) // 当前任务的结束边界

    for (const t of tasksWithResource) {
      const tStart = parseDate(t.startDate)
      const tEnd = parseDate(t.endDate)
      if (tStart && tEnd) {
        timePoints.add(tStart.getTime())
        timePoints.add(tEnd.getTime() + endBoundaryOffsetIT)
      }
    }

    // 按时间排序
    const sortedTimePoints = Array.from(timePoints).sort((a, b) => a - b)

    // 遍历每个时间段，找出真正超载的区间
    const overloadedIntervals: Array<{ start: number; end: number }> = []
    for (let k = 0; k < sortedTimePoints.length - 1; k++) {
      const segmentStart = sortedTimePoints[k]
      const segmentEnd = sortedTimePoints[k + 1]

      // 计算这个时间段内的总占比
      let segmentPercent = 0
      for (const t of tasksWithResource) {
        const tStart = parseDate(t.startDate)
        const tEnd = parseDate(t.endDate)
        if (!tStart || !tEnd) continue

        // 检查任务是否在这个时间段内活跃
        const tEndInclusive = tEnd.getTime() + endBoundaryOffsetIT
        if (tStart.getTime() <= segmentStart && tEndInclusive > segmentStart) {
          const resource = t.resources?.find(r => String(r.id) === String(resourceId))
          const capacity = !t.resources || t.resources.length === 0 ? 100 : resource?.capacity || 0
          segmentPercent += capacity
        }
      }

      // 只保留超载的时间段
      if (segmentPercent > 100) {
        overloadedIntervals.push({ start: segmentStart, end: segmentEnd })
      }
    }

    // 如果没有超载区间，跳过
    if (overloadedIntervals.length === 0) continue

    // 合并相邻的超载区间
    const realStart = overloadedIntervals[0].start
    let realEnd = overloadedIntervals[0].end
    for (let k = 1; k < overloadedIntervals.length; k++) {
      if (overloadedIntervals[k].start === realEnd) {
        realEnd = overloadedIntervals[k].end
      }
    }
    // realEnd是边界点。日视图：-1天得到实际endDate（包含当天语义）；小时视图：直接使用
    realEnd = isHourViewIT ? realEnd : realEnd - DAY_MS_IT

    // 去重
    const intervalKey = `${realStart}-${realEnd}`
    if (processedIntervals.has(intervalKey)) continue
    processedIntervals.add(intervalKey)

    conflictZones.push({
      startDate: new Date(realStart),
      endDate: new Date(realEnd),
      totalPercent,
      level: getConflictLevel(totalPercent),
      tasks: taskDetails,
    })
  }

  // 合并重叠的冲突区域
  return mergeConflictZones(conflictZones)
}

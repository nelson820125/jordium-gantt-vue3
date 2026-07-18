/**
 * useResourceUsageAggregation.ts - 资源工时聚合计算（Epic 3, T3.1.1）
 *
 * 工时折算规则（已与用户确认，见 .ai/.claude/records/frontend-engineer/v1.12.5/task-notes-phase1.md）：
 * - 总小时数 = 占用比例(capacity/100) × 分配的预估总工时(estimatedHours)
 * - 若无 estimatedHours：占用比例 × 8 小时/天（按工作日折算，排除周末）
 * - 若无占用比例(capacity)：默认 100% × 8 小时/天
 * - 工时按任务所跨工作日平均分摊到每一天，每日基准上限 8 小时
 * - 周末（周六/周日）不计入工作日分母与分子
 *
 * 颜色阈值不在本composable中判定（保持聚合逻辑与展示逻辑解耦），
 * 由 ResourceUsageView.vue 根据 totalPercent 与可配置的 overloadThreshold/underloadThreshold 决定展示颜色。
 */

import { computed, type Ref } from 'vue'
import type { Resource } from '../models/classes/Resource'
import type {
  ResourceUsageScale,
  ResourceUsageCellData,
  ResourceUsageTaskBreakdown,
} from '../models/types/ResourceUsageTypes'

const DAY_MS = 24 * 60 * 60 * 1000
const DAILY_CAPACITY_HOURS = 8

const isWeekend = (date: Date): boolean => {
  const day = date.getDay()
  return day === 0 || day === 6
}

const startOfDay = (date: Date): Date => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** 枚举 [start, end] 闭区间内的所有工作日（排除周末），含首尾 */
function enumerateWorkingDays(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const cursor = startOfDay(start)
  const last = startOfDay(end)
  while (cursor.getTime() <= last.getTime()) {
    if (!isWeekend(cursor)) days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

const parseDate = (value?: string): Date | null => {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/** 解析任务在指定资源上的占用比例（百分比），规则见文件头注释 */
function resolveCapacity(
  task: { resources?: Array<{ id: string | number; capacity?: number }> },
  resourceId: string | number
): number {
  if (!task.resources || task.resources.length === 0) return 100
  const entry = task.resources.find(r => String(r.id) === String(resourceId))
  if (!entry) return 100
  return entry.capacity ?? 100
}

/** 按周期刻度枚举 [start, end] 范围内的桶边界 */
function enumeratePeriods(
  start: Date,
  end: Date,
  scale: ResourceUsageScale
): Array<{ start: Date; end: Date }> {
  const periods: Array<{ start: Date; end: Date }> = []
  const rangeStart = startOfDay(start)
  const rangeEnd = startOfDay(end)

  if (scale === 'day') {
    const cursor = new Date(rangeStart)
    while (cursor.getTime() <= rangeEnd.getTime()) {
      const periodEnd = new Date(cursor)
      periodEnd.setHours(23, 59, 59, 999)
      periods.push({ start: new Date(cursor), end: periodEnd })
      cursor.setDate(cursor.getDate() + 1)
    }
    return periods
  }

  if (scale === 'week') {
    const cursor = new Date(rangeStart)
    // 对齐到周一
    const dow = cursor.getDay() || 7
    cursor.setDate(cursor.getDate() - (dow - 1))
    while (cursor.getTime() <= rangeEnd.getTime()) {
      const periodEnd = new Date(cursor)
      periodEnd.setDate(periodEnd.getDate() + 6)
      periodEnd.setHours(23, 59, 59, 999)
      periods.push({ start: new Date(cursor), end: periodEnd })
      cursor.setDate(cursor.getDate() + 7)
    }
    return periods
  }

  // month
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
  while (cursor.getTime() <= rangeEnd.getTime()) {
    const periodEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999)
    periods.push({ start: new Date(cursor), end: periodEnd })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return periods
}

export interface UseResourceUsageAggregationOptions {
  resources: Ref<Resource[]>
  scale: Ref<ResourceUsageScale>
  dateRange: Ref<{ start: Date; end: Date }>
  overloadThreshold?: Ref<number>
}

export function useResourceUsageAggregation(options: UseResourceUsageAggregationOptions) {
  const cellsByResource = computed<Map<string | number, ResourceUsageCellData[]>>(() => {
    const result = new Map<string | number, ResourceUsageCellData[]>()
    const overloadThreshold = options.overloadThreshold?.value ?? 100
    const periods = enumeratePeriods(
      options.dateRange.value.start,
      options.dateRange.value.end,
      options.scale.value
    )

    for (const resource of options.resources.value) {
      // 每日小时累加表：key 为日期(startOfDay时间戳)，value 为按任务拆分的小时数
      const dailyByTask = new Map<number, Map<number | string, { name: string; hours: number }>>()

      for (const task of resource.tasks ?? []) {
        const taskStart = parseDate(task.startDate as string | undefined)
        const taskEnd = parseDate(task.endDate as string | undefined)
        if (!taskStart || !taskEnd) continue

        const workingDays = enumerateWorkingDays(taskStart, taskEnd)
        if (workingDays.length === 0) continue

        const capacity = resolveCapacity(task, resource.id)
        const ratio = capacity / 100

        let dailyHours: number
        if (typeof task.estimatedHours === 'number' && task.estimatedHours > 0) {
          const totalTaskHours = ratio * task.estimatedHours
          dailyHours = totalTaskHours / workingDays.length
        } else {
          dailyHours = ratio * DAILY_CAPACITY_HOURS
        }

        for (const day of workingDays) {
          const key = day.getTime()
          if (!dailyByTask.has(key)) dailyByTask.set(key, new Map())
          const taskMap = dailyByTask.get(key)!
          const existing = taskMap.get(task.id) ?? { name: task.name, hours: 0 }
          existing.hours += dailyHours
          taskMap.set(task.id, existing)
        }
      }

      const cells: ResourceUsageCellData[] = periods.map(period => {
        const workingDaysInPeriod = enumerateWorkingDays(period.start, period.end)
        const taskTotals = new Map<number | string, { name: string; hours: number }>()
        let totalHours = 0

        for (const day of workingDaysInPeriod) {
          const taskMap = dailyByTask.get(day.getTime())
          if (!taskMap) continue
          for (const [taskId, entry] of taskMap) {
            totalHours += entry.hours
            const existing = taskTotals.get(taskId) ?? { name: entry.name, hours: 0 }
            existing.hours += entry.hours
            taskTotals.set(taskId, existing)
          }
        }

        const denominator = workingDaysInPeriod.length * DAILY_CAPACITY_HOURS
        const totalPercent = denominator > 0 ? (totalHours / denominator) * 100 : 0

        const taskBreakdown: ResourceUsageTaskBreakdown[] = Array.from(taskTotals.entries()).map(
          ([taskId, entry]) => ({
            taskId,
            taskName: entry.name,
            hours: entry.hours,
            percent: denominator > 0 ? (entry.hours / denominator) * 100 : 0,
          })
        )

        return {
          resourceId: resource.id,
          periodStart: period.start,
          periodEnd: period.end,
          totalHours,
          totalPercent,
          isOverloaded: totalPercent > overloadThreshold,
          taskBreakdown,
        }
      })

      result.set(resource.id, cells)
    }

    return result
  })

  return { cellsByResource }
}

export { DAY_MS, DAILY_CAPACITY_HOURS }

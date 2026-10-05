/**
 * useResourceUsageAggregation.ts - 资源工时聚合计算（Epic 3, T3.1.1）
 *
 * 工时折算规则（已与用户确认，见 .ai/.claude/records/frontend-engineer/v1.12.5/task-notes-phase1.md）：
 * - 总小时数 = 占用比例(capacity/100) × 分配的预估总工时(estimatedHours)
 * - 若无 estimatedHours：占用比例 × 每日基准工时（按工作日折算，默认排除周末）
 * - 若无占用比例(capacity)：默认 100% × 每日基准工时
 * - 工时按任务所跨工作日（按有效工作占比加权）分摊到每一天
 *
 * 工作日/工时可配置化（v1.14.0，见 .ai/.claude/requirements/v1.13.6.md 第 11/12 节）：
 * - `resolveWorkingMinutes`/`workCalendarExceptions`：决定"某天对某资源算不算工作日、算多少比例"，
 *   替换原来硬编码的 `isWeekend()`；未提供时内部按周六日不计、其余整天计入的默认行为向后兼容。
 * - `dailyCapacityHours`：决定"一个完整工作日折算多少小时"，替换原来硬编码的 `DAILY_CAPACITY_HOURS`
 *   常量，支持按资源类型差异化（如人工 8 小时 / 设备 24 小时）；未提供时默认 8，与升级前一致。
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
  ResolveWorkingMinutes,
  ResourceOffOrLeaveLevel,
} from '../models/types/ResourceUsageTypes'

const DAY_MS = 24 * 60 * 60 * 1000
const DAILY_CAPACITY_HOURS = 8
/** resolveWorkingMinutes 返回值的归一化基准：1 个自然日 = 1440 分钟（100% 基准工时） */
const REFERENCE_DAY_MINUTES = 24 * 60

const isWeekend = (date: Date): boolean => {
  const day = date.getDay()
  return day === 0 || day === 6
}

const startOfDay = (date: Date): Date => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** 默认工作日判定：未提供 resolveWorkingMinutes 时，weekday→整天(1440)，weekend→0，
 *  与升级前 isWeekend() 硬编码行为在数值上完全等价 */
const defaultResolveWorkingMinutes: ResolveWorkingMinutes = rangeStart =>
  isWeekend(rangeStart) ? 0 : REFERENCE_DAY_MINUTES

/** 某资源在某天的有效工作占比（0~1），封装 resolveWorkingMinutes 的调用与归一化 */
function resolveDayWorkRatio(
  day: Date,
  resource: Resource,
  resolver?: ResolveWorkingMinutes
): number {
  const dayEnd = new Date(day)
  dayEnd.setDate(dayEnd.getDate() + 1)
  const minutes = (resolver ?? defaultResolveWorkingMinutes)(day, dayEnd, resource)
  return Math.min(1, Math.max(0, minutes / REFERENCE_DAY_MINUTES))
}

/** 某资源的每日基准工时（小时），支持固定值或按资源差异化的函数 */
function resolveDailyCapacityHours(
  resource: Resource,
  config?: number | ((resource: Resource) => number)
): number {
  if (typeof config === 'function') return config(resource)
  if (typeof config === 'number') return config
  return DAILY_CAPACITY_HOURS
}

/** 枚举 [start, end] 闭区间内的所有自然日，含首尾（不再预先排除周末，工作占比改由 resolver 决定） */
function enumerateCalendarDays(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const cursor = startOfDay(start)
  const last = startOfDay(end)
  while (cursor.getTime() <= last.getTime()) {
    days.push(new Date(cursor))
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
  /** v1.14.0：工作日/工时可配置化扩展点，均可选，未提供时行为与升级前完全一致 */
  resolveWorkingMinutes?: Ref<ResolveWorkingMinutes | undefined>
  dailyCapacityHours?: Ref<number | ((resource: Resource) => number) | undefined>
  /**
   * v1.14.1：表头/单元格周末灰色展示的独立覆盖层，与上述 resolveWorkingMinutes（数值计算管线）
   * 完全解耦：只影响返回结果中的 isWeekend 展示字段，不参与 totalHours/totalPercent 等数值计算。
   * 返回 undefined 时回退为纯日历判断（周六日）。
   */
  resolveWeekendDisplay?: Ref<((date: Date) => boolean | undefined) | undefined>
}

export function useResourceUsageAggregation(options: UseResourceUsageAggregationOptions) {
  const cellsByResource = computed<Map<string | number, ResourceUsageCellData[]>>(() => {
    const result = new Map<string | number, ResourceUsageCellData[]>()
    const overloadThreshold = options.overloadThreshold?.value ?? 100
    const resolver = options.resolveWorkingMinutes?.value
    const capacityConfig = options.dailyCapacityHours?.value
    const periods = enumeratePeriods(
      options.dateRange.value.start,
      options.dateRange.value.end,
      options.scale.value
    )

    for (const resource of options.resources.value) {
      const capacityHours = resolveDailyCapacityHours(resource, capacityConfig)
      // 每日小时累加表：key 为日期(startOfDay时间戳)，value 为按任务拆分的小时数
      const dailyByTask = new Map<number, Map<number | string, { name: string; hours: number }>>()

      for (const task of resource.tasks ?? []) {
        const taskStart = parseDate(task.startDate as string | undefined)
        const taskEnd = parseDate(task.endDate as string | undefined)
        if (!taskStart || !taskEnd) continue

        const days = enumerateCalendarDays(taskStart, taskEnd)
        if (days.length === 0) continue

        const weights = days.map(day => resolveDayWorkRatio(day, resource, resolver))
        const totalWeight = weights.reduce((sum, w) => sum + w, 0)
        if (totalWeight <= 0) continue // 任务周期整体落在非工作日/假期内，无工时可分摊

        const capacity = resolveCapacity(task, resource.id)
        const ratio = capacity / 100
        const totalTaskHours =
          typeof task.estimatedHours === 'number' && task.estimatedHours > 0
            ? ratio * task.estimatedHours
            : null

        days.forEach((day, index) => {
          const weight = weights[index]
          if (weight <= 0) return
          const dailyHours =
            totalTaskHours !== null
              ? totalTaskHours * (weight / totalWeight)
              : ratio * capacityHours * weight

          const key = day.getTime()
          if (!dailyByTask.has(key)) dailyByTask.set(key, new Map())
          const taskMap = dailyByTask.get(key)!
          const existing = taskMap.get(task.id) ?? { name: task.name, hours: 0 }
          existing.hours += dailyHours
          taskMap.set(task.id, existing)
        })
      }

      const scale = options.scale.value
      const cells: ResourceUsageCellData[] = periods.map(period => {
        const daysInPeriod = enumerateCalendarDays(period.start, period.end)
        const taskTotals = new Map<number | string, { name: string; hours: number }>()
        let totalHours = 0
        let denominator = 0
        // 仅 scale === 'day' 时有意义：daysInPeriod 长度恒为 1，记录当天的资源专属工作比例，
        // 用于判断"该资源当天是否因专属例外/自定义回调而全天不可用"（见 resourceOffOrLeaveLevel）
        let singleDayRatio: number | null = null

        for (const day of daysInPeriod) {
          const dayRatio = resolveDayWorkRatio(day, resource, resolver)
          if (scale === 'day') singleDayRatio = dayRatio
          denominator += dayRatio * capacityHours

          const taskMap = dailyByTask.get(day.getTime())
          if (!taskMap) continue
          for (const [taskId, entry] of taskMap) {
            totalHours += entry.hours
            const existing = taskTotals.get(taskId) ?? { name: entry.name, hours: 0 }
            existing.hours += entry.hours
            taskTotals.set(taskId, existing)
          }
        }

        const totalPercent = denominator > 0 ? (totalHours / denominator) * 100 : 0

        const taskBreakdown: ResourceUsageTaskBreakdown[] = Array.from(taskTotals.entries()).map(
          ([taskId, entry]) => ({
            taskId,
            taskName: entry.name,
            hours: entry.hours,
            percent: denominator > 0 ? (entry.hours / denominator) * 100 : 0,
          })
        )

        const isWeekendValue =
          scale === 'day'
            ? (options.resolveWeekendDisplay?.value?.(period.start) ?? isWeekend(period.start))
            : false

        // 与 isWeekend 互斥：仅当"资源当天比例为 0"且"当天并非公司级共享周末/假期"时才标记，
        // 避免默认规则下每个普通周末都被重复标记为"资源专属请假/停机"
        const resourceOffOrLeaveLevel: ResourceOffOrLeaveLevel | undefined =
          scale === 'day' && singleDayRatio === 0 && !isWeekendValue ? 'full' : undefined

        return {
          resourceId: resource.id,
          periodStart: period.start,
          periodEnd: period.end,
          totalHours,
          totalPercent,
          isOverloaded: totalPercent > overloadThreshold,
          isWeekend: isWeekendValue,
          resourceOffOrLeaveLevel,
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

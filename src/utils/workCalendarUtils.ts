/**
 * workCalendarUtils.ts - 工作日历例外（节假日/调休/请假）转换为 ResolveWorkingMinutes 回调
 * @version 1.14.1
 *
 * 背景：.ai/.claude/requirements/v1.13.6.md 第 8/11 节。ResourceUsageView 的工时计算内核只依赖
 * 一个回调 `resolveWorkingMinutes(dayStart, dayEnd, resource)`，返回值语义是"该自然日在 1440
 * 分钟（24 小时）归一化坐标系下的有效工作分钟数"：默认整天（1440，等价 100% 基准工时）为工作日，
 * 0 为非工作日，与升级前 `isWeekend()` 硬编码在数值上完全等价。
 *
 * 本文件提供"例外表（数组） → 回调"的转换工具，供不想自己写回调的宿主使用：只需维护一份
 * `WorkCalendarException[]`（法定节假日 / 调休补班 / 个人请假等），调用 `createWorkCalendarResolver()`
 * 即可得到符合上述语义的回调函数，直接传给 `ResourceUsageView` 的 `resolveWorkingMinutes` 属性
 * （或经由其 `workCalendarExceptions` 属性隐式调用，见 ResourceUsageView.vue）。
 *
 * v1.14.1 新增 `resolveWorkCalendarDisplayOverride()`：把同一份例外表用于 Timeline/CalendarView/
 * ResourceUsageView 共享表头的"周末灰色"展示层判断（与工时数值计算是独立的两条链路，见该函数注释）。
 *
 * 与 GanttChart 现有 `workingHours`（上午/下午具体钟点，服务于日历视图小时格渲染）的关系：
 * 这里的 `workingHours` 参数仅用于换算"半天/跨天例外"覆盖了当天工作时段的比例（例如
 * 08:00-12:00 的请假恰好覆盖了默认上午时段的全部 3 小时），不代表每日基准工时本身——
 * 每日基准工时由 `ResourceUsageView` 的 `dailyCapacityHours` 单独配置。两者是两个独立维度：
 * workingHours 回答"一天里哪几个钟点算上班"，dailyCapacityHours 回答"一个完整工作日该资源
 * 应折算多少小时的工时"。未提供 workingHours 时，回退到与 GanttChart `workingHours` 属性
 * 相同的默认值（上午 8-11 + 下午 13-17）。
 */

import type { Resource } from '../models/classes/Resource'
import type {
  ResolveWorkingMinutes,
  WorkCalendarException,
} from '../models/types/ResourceUsageTypes'
import { hasExplicitTimePart } from './dateBoundaryUtils'

/** ResolveWorkingMinutes 的归一化基准：1 个自然日 = 1440 分钟 */
const FULL_DAY_MINUTES = 24 * 60

export interface WorkCalendarWorkingHours {
  morning?: { start: number; end: number }
  afternoon?: { start: number; end: number }
}

/** 与 GanttChart.workingHours 默认值保持一致 */
const DEFAULT_WORKING_HOURS: Required<WorkCalendarWorkingHours> = {
  morning: { start: 8, end: 11 },
  afternoon: { start: 13, end: 17 },
}

const isWeekend = (date: Date): boolean => {
  const day = date.getDay()
  return day === 0 || day === 6
}

const startOfDay = (date: Date): Date => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** 解析 'YYYY-MM-DD' 或 'YYYY-MM-DD HH:mm'，本地时区安全（不走 Date 单参构造的 UTC 解析） */
function parseLocalDateTime(value: string): Date {
  const [datePart, timePart] = value.trim().split(' ')
  const [year, month, day] = datePart.split('-').map(Number)
  if (!timePart) return new Date(year, month - 1, day)
  const [hour, minute] = timePart.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute)
}

/** 把某天的 'HH:mm' 区间转换为该天的具体 Date 区间 */
function timeRangeOnDay(day: Date, start: string, end: string): [Date, Date] {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return [
    new Date(day.getFullYear(), day.getMonth(), day.getDate(), sh, sm),
    new Date(day.getFullYear(), day.getMonth(), day.getDate(), eh, em),
  ]
}

/** 把 workingHours 配置转换为某天的具体钟点区间数组（上午/下午） */
function workingHoursSegmentsOnDay(
  day: Date,
  workingHours: WorkCalendarWorkingHours
): Array<[Date, Date]> {
  const segments: Array<[Date, Date]> = []
  if (workingHours.morning) {
    segments.push(
      timeRangeOnDay(day, `${workingHours.morning.start}:00`, `${workingHours.morning.end}:00`)
    )
  }
  if (workingHours.afternoon) {
    segments.push(
      timeRangeOnDay(day, `${workingHours.afternoon.start}:00`, `${workingHours.afternoon.end}:00`)
    )
  }
  return segments
}

/** 两个时间区间的重叠分钟数（区间均为闭开 [start, end)） */
function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime())
  const end = Math.min(aEnd.getTime(), bEnd.getTime())
  return end > start ? (end - start) / 60000 : 0
}

/** 解析例外记录的起止时刻：start 不带时间部分 = 当天 0 点；end 不带时间部分 = 次日 0 点（含全天） */
function resolveExceptionClockRange(exception: WorkCalendarException): [Date, Date] {
  const start = parseLocalDateTime(exception.start)
  const rawEnd = parseLocalDateTime(exception.end)
  const end = hasExplicitTimePart(exception.end) ? rawEnd : addDays(startOfDay(rawEnd), 1)
  return [start, end]
}

const appliesToResource = (exception: WorkCalendarException, resource: Resource): boolean => {
  if (!exception.resourceIds || exception.resourceIds.length === 0) return true
  return exception.resourceIds.some(id => String(id) === String(resource.id))
}

/** 计算单个自然日（dayStart 为该日 0 点）在给定例外表下的有效工作分钟数（0~1440） */
function computeDayMinutes(
  dayStart: Date,
  resource: Resource,
  exceptions: WorkCalendarException[],
  workingHours: WorkCalendarWorkingHours
): number {
  const dayEnd = addDays(dayStart, 1)
  const segments = workingHoursSegmentsOnDay(dayStart, workingHours)
  const segmentTotalMinutes = segments.reduce(
    (sum, [s, e]) => sum + overlapMinutes(s, e, dayStart, dayEnd),
    0
  )

  let minutes = isWeekend(dayStart) ? 0 : FULL_DAY_MINUTES

  for (const exception of exceptions) {
    if (!appliesToResource(exception, resource)) continue
    const [excStart, excEnd] = resolveExceptionClockRange(exception)
    const overlapStart = new Date(Math.max(excStart.getTime(), dayStart.getTime()))
    const overlapEnd = new Date(Math.min(excEnd.getTime(), dayEnd.getTime()))
    if (overlapEnd.getTime() <= overlapStart.getTime()) continue
    if (segmentTotalMinutes <= 0) continue

    // working=true 且提供了 timeRanges：按显式时段计算；否则按全局 workingHours 的钟点区间计算
    // （即"该段时间是否落在正常上班钟点内"，用于折算比例，见文件头注释）
    const affectedMinutes =
      exception.working && exception.timeRanges?.length
        ? exception.timeRanges.reduce((sum, tr) => {
            const [s, e] = timeRangeOnDay(dayStart, tr.start, tr.end)
            return sum + overlapMinutes(s, e, overlapStart, overlapEnd)
          }, 0)
        : segments.reduce((sum, [s, e]) => sum + overlapMinutes(s, e, overlapStart, overlapEnd), 0)

    if (affectedMinutes <= 0) continue
    const delta = (affectedMinutes / segmentTotalMinutes) * FULL_DAY_MINUTES
    minutes = exception.working ? minutes + delta : Math.max(0, minutes - delta)
  }

  return Math.min(FULL_DAY_MINUTES, Math.max(0, minutes))
}

/**
 * 全局工作日历例外 → 表头"是否按非工作日(灰色)展示"的展示层覆盖判断（v1.14.1）。
 * 供 Timeline / CalendarView / ResourceUsageView 等共享表头统一使用，与 `createWorkCalendarResolver`
 * 计算的工时数值是两条独立链路：
 * - 只采纳"整天例外"（start/end 均不带具体时间部分）：半天/部分时段请假无法用一个布尔值精确表达
 *   是否"这一整列都算非工作日"，因此不改变表头颜色，只通过 resolveWorkingMinutes 影响工时数值。
 * - 只采纳"未指定 resourceIds"（公司级）的例外：表头是所有资源共享的一列，不能因为某个人请假
 *   就把这一列整体变灰；资源级例外继续只影响该资源的工时数值计算。
 * - 命中多条整天例外时，按数组顺序取最后一条命中记录（与 `computeDayMinutes` 的"后覆盖前"约定一致）。
 *
 * @returns true=按非工作日(灰色)展示；false=按工作日(非灰)展示；undefined=当天未命中任何全局整天例外，
 *          调用方应回退到内置默认规则（周六日）
 */
export function resolveWorkCalendarDisplayOverride(
  date: Date,
  exceptions: WorkCalendarException[] | undefined
): boolean | undefined {
  if (!exceptions || exceptions.length === 0) return undefined
  const day = startOfDay(date)
  const dayEnd = addDays(day, 1)
  let override: boolean | undefined

  for (const exception of exceptions) {
    if (exception.resourceIds && exception.resourceIds.length > 0) continue
    if (hasExplicitTimePart(exception.start) || hasExplicitTimePart(exception.end)) continue

    const excStart = startOfDay(parseLocalDateTime(exception.start))
    const excEnd = addDays(startOfDay(parseLocalDateTime(exception.end)), 1)
    if (excStart.getTime() >= dayEnd.getTime() || excEnd.getTime() <= day.getTime()) continue

    override = !exception.working
  }

  return override
}

/**
 * 由 `WorkCalendarException[]` 数组构建 `ResolveWorkingMinutes` 回调（"例外表 → 回调"转换）。
 * 未命中任何例外的日期，行为等价于内置默认规则（周六日不计、其余整天计入）。
 *
 * @param exceptions 节假日/调休/请假等例外记录，数组顺序即优先级（后面的记录覆盖前面的重叠部分）
 * @param workingHours 用于换算例外时段与"正常上班钟点"重叠比例的钟点配置，未提供时使用插件默认值
 */
export function createWorkCalendarResolver(
  exceptions: WorkCalendarException[],
  workingHours: WorkCalendarWorkingHours = DEFAULT_WORKING_HOURS
): ResolveWorkingMinutes {
  return (rangeStart: Date, rangeEnd: Date, resource: Resource): number => {
    let total = 0
    let cursor = startOfDay(rangeStart)
    const last = startOfDay(new Date(rangeEnd.getTime() - 1))

    while (cursor.getTime() <= last.getTime()) {
      const dayStart = cursor
      const dayEnd = addDays(dayStart, 1)
      const overlapStart = Math.max(dayStart.getTime(), rangeStart.getTime())
      const overlapEnd = Math.min(dayEnd.getTime(), rangeEnd.getTime())
      const dayOverlapRatio =
        overlapEnd > overlapStart
          ? (overlapEnd - overlapStart) / (dayEnd.getTime() - dayStart.getTime())
          : 0

      if (dayOverlapRatio > 0) {
        total += computeDayMinutes(dayStart, resource, exceptions, workingHours) * dayOverlapRatio
      }
      cursor = dayEnd
    }

    return total
  }
}

/**
 * calendarTimeUtils.ts - 日历视图时间计算工具函数
 *
 * v1.12.5 新增：为 CalendarView 及其子视图（日/周/月）提供独立的时间网格生成与
 * 工作时段判定能力。
 *
 * 设计说明（对应 architect-v1.12.5.md 风险 R1）：
 * 本文件的 isWorkingHour 判定逻辑与 Timeline.vue 内部实现保持算法一致（周末优先判定 +
 * 上午/下午双时段判断），但为独立实现，不直接从 Timeline.vue 导入或修改其内部代码，
 * 以避免在当前迭代引入对现有 Timeline 渲染路径的回归风险。是否将 Timeline.vue 的内部
 * 实现重构为调用本文件，需与架构师/项目经理另行确认（见 T1.1.2）。
 */

import type { WorkingHoursConfig } from '../models/types/CalendarTypes'

/** 一天的毫秒数 */
export const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 判断某天是否为周末（周六=6，周日=0）
 */
export function isWeekendDay(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 6
}

/**
 * 判断两个日期是否为同一天
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

/**
 * 解析任务 startDate/endDate 字符串为 Date 对象，正确处理"仅日期"格式（如 "2025-04-15"）。
 *
 * 修复：`new Date("2025-04-15")` 这类不带时间部分的 ISO 8601 日期字符串，会被 JS 引擎按
 * **UTC 零点**解析（规范行为），在东八区等非 UTC 时区下会被转换成本地时间 08:00 而非
 * 00:00，导致 `classifyTaskForDate` 里的"整点判断"（`start.getHours()===0`）失真，把本应
 * 全天展示的任务误判为"从 08:00 开始的具体时段"（表现为日历日/周视图里全天任务被错误地
 * 画进小时网格，标题显示为 "08:00 ~ 24:00"）。
 * 而 `"2025-04-15 00:00"`（空格分隔，带时间部分）等格式本身就会被解析为本地时间，不受
 * 此问题影响，无需特殊处理，直接走 `new Date(value)` 即可。
 */
export function parseTaskDateTime(value?: string): Date | null {
  if (!value) return null
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch
    return new Date(Number(y), Number(m) - 1, Number(d))
  }
  const parsed = new Date(value)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * 计算某个时间点距当日零点的分钟数（用于"当前时间指示线"定位）
 */
export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * 判断一段任务起止时间是否覆盖到指定日期（按天粒度比较，忽略起止时间的具体时分秒）。
 * 修复此前 `start <= date && end >= date` 直接比较 Date 对象的缺陷：
 * 当任务起止带有具体时分（如 08:00）时，与当日 00:00 的 date 参数比较会恒为 false，
 * 导致月视图等按天渲染的场景遗漏当天有明确起止小时的任务。
 */
export function isTaskOnDate(start: Date, end: Date, date: Date): boolean {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  return start < dayEnd && end >= dayStart
}

/**
 * 判断指定小时是否为工作时间
 * @param hour 0-23 小时数
 * @param dayOfWeek 0-6，0=周日
 * @param workingHours 工作时间配置，不传则视为全部非工作时间
 */
export function isWorkingHour(
  hour: number,
  dayOfWeek: number,
  workingHours?: WorkingHoursConfig
): boolean {
  if (isWeekendDay(dayOfWeek)) {
    return false
  }

  if (!workingHours) return false

  if (workingHours.morning) {
    const { start, end } = workingHours.morning
    if (hour >= start && hour <= end) {
      return true
    }
  }

  if (workingHours.afternoon) {
    const { start, end } = workingHours.afternoon
    if (hour >= start && hour <= end) {
      return true
    }
  }

  return false
}

/** 日历日视图使用的小时单元数据 */
export interface CalendarHourCell {
  hour: number
  label: string
  date: Date
  isWorkingHour: boolean
  isCurrentHour: boolean
}

/**
 * 生成指定日期的 24 小时单元数据（供日视图/周视图复用）
 */
export function generateDayHours(
  date: Date,
  workingHours?: WorkingHoursConfig
): CalendarHourCell[] {
  const dayOfWeek = date.getDay()
  const now = new Date()
  const hours: CalendarHourCell[] = []

  for (let hour = 0; hour < 24; hour++) {
    const hourDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour)
    hours.push({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      date: hourDate,
      isWorkingHour: isWorkingHour(hour, dayOfWeek, workingHours),
      isCurrentHour: isSameDay(date, now) && hour === now.getHours(),
    })
  }

  return hours
}

/**
 * 获取指定日期所在周的周一（周起始日）
 */
export function getWeekStart(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayOfWeek = result.getDay() || 7 // 周日按 7 处理，方便计算与周一的偏移
  result.setDate(result.getDate() - (dayOfWeek - 1))
  return result
}

/** 日历周视图使用的一天数据 */
export interface CalendarWeekDayCell {
  date: Date
  dayOfWeek: number
  isWeekend: boolean
  isToday: boolean
  hours: CalendarHourCell[]
}

/**
 * 生成指定日期所在周的 7 天数据（周一到周日）
 */
export function generateWeekDays(
  anchorDate: Date,
  workingHours?: WorkingHoursConfig
): CalendarWeekDayCell[] {
  const weekStart = getWeekStart(anchorDate)
  const days: CalendarWeekDayCell[] = []

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    const dayOfWeek = date.getDay()
    days.push({
      date,
      dayOfWeek,
      isWeekend: isWeekendDay(dayOfWeek),
      isToday: isToday(date),
      hours: generateDayHours(date, workingHours),
    })
  }

  return days
}

/** 日历月视图使用的一天格子数据 */
export interface CalendarMonthDayCell {
  date: Date
  /** 是否属于当前展示月份（false 表示为补齐网格的上月/下月弱化日期） */
  isCurrentMonth: boolean
  isWeekend: boolean
  isToday: boolean
}

/**
 * 生成传统日历方格所需的月视图网格（含首尾补齐的相邻月日期）
 * 固定周一为一周首日，网格行数随自然月天数浮动（5~6 行）
 */
export function generateMonthGrid(anchorDate: Date): CalendarMonthDayCell[][] {
  const year = anchorDate.getFullYear()
  const month = anchorDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const gridStart = getWeekStart(firstDayOfMonth)

  const weeks: CalendarMonthDayCell[][] = []
  const cursor = new Date(gridStart)

  // 最多渲染 6 周以覆盖跨月网格的最坏情况
  for (let w = 0; w < 6; w++) {
    const week: CalendarMonthDayCell[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(cursor)
      week.push({
        date,
        isCurrentMonth: date.getMonth() === month,
        isWeekend: isWeekendDay(date.getDay()),
        isToday: isToday(date),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)

    // 若已经越过当月最后一天所在周，且下一周首日已进入下下月，可提前结束（避免多余空白行）
    if (cursor.getMonth() !== month && cursor > firstDayOfMonth && w >= 3) {
      const nextMonthProbe = new Date(cursor)
      nextMonthProbe.setDate(nextMonthProbe.getDate() + 6)
      if (nextMonthProbe.getMonth() !== month) {
        break
      }
    }
  }

  return weeks
}

/**
 * 将日期按指定分钟粒度吸附（向下取整），用于拖拽选区的最小刻度吸附
 */
export function snapToMinuteStep(date: Date, minuteStep: number): Date {
  if (minuteStep <= 0) return new Date(date)
  const result = new Date(date)
  const totalMinutes = result.getHours() * 60 + result.getMinutes()
  const snappedMinutes = Math.floor(totalMinutes / minuteStep) * minuteStep
  result.setHours(Math.floor(snappedMinutes / 60), snappedMinutes % 60, 0, 0)
  return result
}

/**
 * 将日期吸附到当天 00:00（用于月视图的天粒度选区）
 */
export function snapToDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * 将 Date 格式化为 Task.startDate/endDate 使用的字符串格式（YYYY-MM-DD HH:mm），
 * 与 GanttChart.vue 中 handleCalendarSelectionComplete 的 formatForDrawer 保持一致（v1.13.0）
 */
export function formatTaskDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

/**
 * 将时间格式化为 HH:mm（用于任务卡片时间段展示）
 */
export function formatHourMinute(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * 格式化任务时间段文案，如 "08:30 ~ 09:30"（v1.13.0 任务卡片标题追加时间信息）
 */
export function formatTaskTimeRange(start: Date, end: Date): string {
  return `${formatHourMinute(start)} ~ ${formatHourMinute(end)}`
}

/**
 * 生成日历任务卡片标题：全天任务展示 "任务名 - 全天"，有具体起止时间的任务展示
 * "任务名 - HH:mm ~ HH:mm"（v1.13.0）
 */
export function formatTaskCardTitle(
  taskName: string,
  isAllDay: boolean,
  start: Date,
  end: Date,
  allDayLabel = '全天'
): string {
  return isAllDay
    ? `${taskName} - ${allDayLabel}`
    : `${taskName} - ${formatTaskTimeRange(start, end)}`
}

/** 任务在指定日期（date）上的展示分类结果，供日/周视图统一判定全天/具体时段 */
export interface TaskDateClassification {
  /** 'all-day' 展示为全天条目；'timed' 按分钟区间绘制具体时段；'none' 与该日期无关，不展示 */
  type: 'all-day' | 'timed' | 'none'
  /** type === 'timed' 时有效：当日区间起点（距当日零点的分钟数） */
  startMinutes?: number
  /** type === 'timed' 时有效：当日区间止点（距当日零点的分钟数）；跨天任务在起始日的止点固定为 1440（当日24:00） */
  endMinutes?: number
}

/**
 * 判断任务在指定日期（date）应如何展示。仅依据 startDate/endDate 的日期与时间部分判断，
 * 不依赖 estimatedHours（预计工时仅用于资源利用率占比计算，与日历展示位置无关）。
 *
 * 规则：
 * 1. 起止日期为同一天：起止时间均为 00:00 -> 全天；否则按实际起止时间绘制具体时段。
 * 2. 起止日期不同（跨天任务），按 date 与起止日期的关系分别处理：
 *    a. date 等于起始日期：起始时间为 00:00 -> 全天；否则从起始时间 ~ 当日24:00 绘制。
 *    b. date 等于结束日期：结束时间为 00:00 -> 全天；否则从当日00:00 ~ 结束时间绘制。
 *    c. date 严格介于起止日期之间（不含两端）-> 全天。
 * 与 date 无任何交集 -> 'none'。
 */
export function classifyTaskForDate(start: Date, end: Date, date: Date): TaskDateClassification {
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const startIsMidnight = start.getHours() === 0 && start.getMinutes() === 0
  const endIsMidnight = end.getHours() === 0 && end.getMinutes() === 0
  const startMinutesRaw = start.getHours() * 60 + start.getMinutes()
  const endMinutesRaw = end.getHours() * 60 + end.getMinutes()

  if (startDay === endDay) {
    if (targetDay !== startDay) return { type: 'none' }
    if (startIsMidnight && endIsMidnight) return { type: 'all-day' }
    return { type: 'timed', startMinutes: startMinutesRaw, endMinutes: endMinutesRaw }
  }

  if (targetDay === startDay) {
    if (startIsMidnight) return { type: 'all-day' }
    return { type: 'timed', startMinutes: startMinutesRaw, endMinutes: 24 * 60 }
  }

  if (targetDay === endDay) {
    if (endIsMidnight) return { type: 'all-day' }
    return { type: 'timed', startMinutes: 0, endMinutes: endMinutesRaw }
  }

  if (targetDay > startDay && targetDay < endDay) {
    return { type: 'all-day' }
  }

  return { type: 'none' }
}

/** 将"距当日零点分钟数"格式化为 HH:mm；跨天任务当日片段的终点 1440 分钟格式化为 24:00 */
export function formatMinutesLabel(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, 24 * 60))
  if (clamped === 24 * 60) return '24:00'
  const hh = Math.floor(clamped / 60)
  const mm = clamped % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/**
 * 依据"距当日零点分钟数"区间生成任务卡片标题："标题 - HH:mm ~ HH:mm"。
 * 用于跨天任务：传入的是当日片段区间（如起始日的 "09:30 ~ 24:00"），而非任务整体起止时间。
 */
export function formatTaskCardTitleByMinutes(
  taskName: string,
  startMinutes: number,
  endMinutes: number
): string {
  return `${taskName} - ${formatMinutesLabel(startMinutes)} ~ ${formatMinutesLabel(endMinutes)}`
}

/** Outlook 风格拖拽选区的分段渲染数据：每个半小时（或指定粒度）槽位一组 slot(底色)/indicator(精确覆盖比例) 矩形 */
export interface SelectionSegmentRect {
  /** 槽位（如半小时格）在网格中的像素顶部偏移 */
  slotTop: number
  /** 槽位整体像素高度 */
  slotHeight: number
  /** 实际选区与该槽位重叠部分的像素顶部偏移 */
  indicatorTop: number
  /** 实际选区与该槽位重叠部分的像素高度（未占满槽位时小于 slotHeight，对应"不满30分钟"的比例呈现） */
  indicatorHeight: number
}

/**
 * 按固定粒度（默认 30 分钟）将一段选区拆分为多个槽位，每个槽位返回：
 * - 槽位自身的完整像素区间（用于渲染整槽浅色背景）
 * - 选区与该槽位的实际重叠像素区间（用于渲染左侧深色比例指示条）
 * 供 CalendarDayView/CalendarWeekView 的拖拽选区高亮使用，实现类似 Outlook 的
 * "半小时格淡蓝底 + 左侧比例指示条" 视觉效果。
 */
export function computeSelectionSegments(
  startMinutesRaw: number,
  endMinutesRaw: number,
  hourHeight: number,
  slotMinutes = 30
): SelectionSegmentRect[] {
  const start = Math.min(startMinutesRaw, endMinutesRaw)
  const end = Math.max(startMinutesRaw, endMinutesRaw)
  if (slotMinutes <= 0 || hourHeight <= 0) return []

  const pxPerMinute = hourHeight / 60
  const segments: SelectionSegmentRect[] = []
  let slotStart = Math.floor(start / slotMinutes) * slotMinutes

  do {
    const slotEnd = slotStart + slotMinutes
    const overlapStart = Math.max(start, slotStart)
    const overlapEnd = Math.min(end, slotEnd)
    const overlapMinutes = Math.max(overlapEnd - overlapStart, 0)

    segments.push({
      slotTop: slotStart * pxPerMinute,
      slotHeight: slotMinutes * pxPerMinute,
      indicatorTop: overlapStart * pxPerMinute,
      indicatorHeight: Math.max(overlapMinutes * pxPerMinute, 3),
    })

    slotStart += slotMinutes
  } while (slotStart < end)

  return segments
}

/** 一段以"距当日零点分钟数"表示的时间区间 */
export interface MinuteRange {
  start: number
  end: number
}

/**
 * 计算指定星期几的工作时间区间（分钟粒度，供全天任务的"工作时间高亮"渲染使用）。
 * 周末或未配置 workingHours 时返回空数组。
 */
export function getWorkingHourMinuteRanges(
  dayOfWeek: number,
  workingHours?: WorkingHoursConfig
): MinuteRange[] {
  if (isWeekendDay(dayOfWeek) || !workingHours) return []

  const ranges: MinuteRange[] = []
  if (workingHours.morning) {
    ranges.push({ start: workingHours.morning.start * 60, end: workingHours.morning.end * 60 })
  }
  if (workingHours.afternoon) {
    ranges.push({
      start: workingHours.afternoon.start * 60,
      end: workingHours.afternoon.end * 60,
    })
  }
  return ranges
}

/** 时间轴任务的列布局结果：column 为 0 基列序号，columnCount 为其所属重叠簇的总列数 */
export interface TimedTaskLayout {
  column: number
  columnCount: number
}

/**
 * 经典的"日历事件重叠布局"算法（Google Calendar/Outlook 日视图同款思路）：
 * 按开始时间排序后，尽量复用已结束的列，无法复用时新增列；当某个重叠簇处理完毕
 * （下一个事件的开始时间不早于当前簇内所有事件的最大结束时间）时，回填该簇内所有
 * 事件的 columnCount，使同一簇内的事件按列等宽并排显示。
 */
export function computeTimedTaskLayout(intervals: MinuteRange[]): TimedTaskLayout[] {
  const result: TimedTaskLayout[] = intervals.map(() => ({ column: 0, columnCount: 1 }))
  const order = intervals
    .map((_, index) => index)
    .sort((a, b) => intervals[a].start - intervals[b].start || intervals[a].end - intervals[b].end)

  let clusterIndices: number[] = []
  let clusterColumnEnds: number[] = []
  let clusterMaxEnd = -Infinity

  const finalizeCluster = () => {
    if (clusterIndices.length === 0) return
    const count = clusterColumnEnds.length
    for (const idx of clusterIndices) {
      result[idx].columnCount = count
    }
    clusterIndices = []
    clusterColumnEnds = []
    clusterMaxEnd = -Infinity
  }

  for (const idx of order) {
    const { start, end } = intervals[idx]

    if (start >= clusterMaxEnd) {
      finalizeCluster()
    }

    let placedColumn = -1
    for (let c = 0; c < clusterColumnEnds.length; c++) {
      if (clusterColumnEnds[c] <= start) {
        clusterColumnEnds[c] = end
        placedColumn = c
        break
      }
    }
    if (placedColumn === -1) {
      placedColumn = clusterColumnEnds.length
      clusterColumnEnds.push(end)
    }

    result[idx].column = placedColumn
    clusterIndices.push(idx)
    clusterMaxEnd = Math.max(clusterMaxEnd, end)
  }
  finalizeCluster()

  return result
}

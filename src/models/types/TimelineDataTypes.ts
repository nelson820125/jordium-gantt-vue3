/**
 * 时间轴数据类型定义
 * 统一管理所有时间轴相关的数据结构
 */
import type { Task } from '../classes/Task'
import type { Milestone } from '../classes/Milestone'

// 基础时间单位接口
export interface TimelineHour {
  hour: number
  label: string
  shortLabel?: string
  hourLabel?: string
  date?: Date
  isToday?: boolean
  isWorkingHour?: boolean
  isWeekend?: boolean
}

export interface TimelineDay {
  year: number
  month: number
  day: number
  date: Date
  dateLabel: string
  label?: string
  dayOfWeek?: number
  isToday?: boolean
  isWeekend?: boolean
  hours?: TimelineHour[]
  hourOffset?: number
}

export interface TimelineWeek {
  label: string
  startDate: Date
  endDate: Date
  weekStart?: Date
  weekEnd?: Date
  weekNumber?: number
  isToday?: boolean
  belongsToYear?: number
  belongsToMonth?: number
  subDays?: Array<{
    date: Date
    dayOfWeek?: number
  }>
}

export interface TimelineMonth {
  year: number
  month: number
  startDate: Date
  endDate: Date
  monthLabel?: string
  yearMonthLabel?: string
  isToday?: boolean

  // 月视图相关
  isMonthView?: boolean
  monthData?: {
    dayCount: number
    monthLabel?: string
    isToday?: boolean
  }

  // 周视图相关
  isWeekView?: boolean
  weeks?: Array<{
    weekStart: Date
    weekEnd: Date
    subDays: Array<{
      date: Date
      dayOfWeek?: number
    }>
  }>

  // 日视图相关
  days?: Array<{
    day: number
    date: Date
    label: string
    isToday: boolean
    isWeekend: boolean
  }>

  subDays?: Array<{
    date: Date
    dayOfWeek?: number
  }>

  // 调试信息
  _debugInfo?: Record<string, unknown>
}

export interface TimelineQuarter {
  quarter: number
  label?: string
  fullLabel?: string
  quarterLabel: string
  startDate: Date
  endDate: Date
  isToday?: boolean
  year?: number
}

export interface TimelineYear {
  year: number
  yearLabel: string
  startDate: Date
  endDate: Date
  isToday?: boolean
  quarters?: TimelineQuarter[]
  halfYears?: Array<{
    startDate: Date
    endDate: Date
    label: string
  }>
}

// 联合类型，支持不同时间尺度的数据
export type TimelineData = TimelineMonth[] | TimelineYear[] | TimelineDay[]

// 时间轴数据项类型（用于模板中的泛型推断）
export type TimelineDataItem = TimelineMonth | TimelineYear | TimelineDay

// 缓存键类型
export interface TimelineCacheKey {
  startDate: string
  endDate: string
  scale: string
  workingHours: string
}

// ─── Tooltip 相关类型（Singleton Tooltip 方案） ───────────────────────────────

/**
 * TaskBar 向 Timeline emit tooltip-show 时携带的数据
 */
export interface TooltipShowPayload {
  task: Task
  taskStatus: { color: string; label: string; type?: string }
  resourcePercent: number
  hasResourceConflict: boolean
  /** TaskBar 元素的 DOMRect，用于 Timeline 计算定位 */
  targetRect: DOMRect
}

/**
 * #taskbar-tooltip scoped slot 向消费方暴露的数据
 */
export interface TaskbarTooltipSlotScope {
  task: Task
  taskStatus: { color: string; label: string }
  resourcePercent: number
}

/**
 * MilestonePoint 向 Timeline emit milestone-tooltip-show 时携带的数据
 */
export interface MilestoneTooltipShowPayload {
  milestone: Milestone
  milestoneColor: string
  /** MilestonePoint 元素的 DOMRect，用于 Timeline 计算定位 */
  targetRect: DOMRect
  /** 停靠位置，用于 tooltip 方向判断 */
  stickyPosition: 'left' | 'right'
}

/**
 * #milestone-tooltip scoped slot 向消费方暴露的数据
 */
export interface MilestoneTooltipSlotScope {
  milestone: Milestone
}

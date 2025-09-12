/**
 * 时间轴数据类型定义
 * 统一管理所有时间轴相关的数据结构
 */

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

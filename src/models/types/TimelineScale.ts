// 时间轴比例类型定义

// 使用字符串字面量类型代替enum，兼容erasableSyntaxOnly
export type TimelineScale = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'

// 导出常量值以便于使用
export const TimelineScale = {
  HOUR: 'hour' as TimelineScale, // 小时视图 - 每列显示一小时
  DAY: 'day' as TimelineScale, // 日视图 - 每列显示一天
  WEEK: 'week' as TimelineScale, // 周视图 - 每列显示一周
  MONTH: 'month' as TimelineScale, // 月视图 - 每列显示一个月
  QUARTER: 'quarter' as TimelineScale, // 季度视图 - 每列显示一个季度
  YEAR: 'year' as TimelineScale, // 年视图 - 每列显示一年
}

export interface TimelineScaleConfig {
  scale: TimelineScale
  cellWidth: number // 每个时间单元的宽度(px)
  minCellWidth?: number // cellWidth 的最小限制(px)
  maxCellWidth?: number // cellWidth 的最大限制(px)
  headerLevels: number // 表头层级数（固定为 2，不允许外部修改）
  formatters: {
    primary: string // 主要时间标签格式
    secondary?: string // 次要时间标签格式
  }
  preBuffer?: number // 前置缓冲：单位为当前刻度的自然单位（hour=小时, day=天, week=周, month=月, quarter=季度, year=年）
  sufBuffer?: number // 后置缓冲：同上
}

// 预设配置
export const SCALE_CONFIGS = {
  hour: {
    scale: TimelineScale.HOUR,
    cellWidth: 40,
    minCellWidth: 40,
    maxCellWidth: 120,
    headerLevels: 2,
    formatters: { primary: 'yyyy年MM月dd日', secondary: 'HH:mm' },
  },
  day: {
    scale: TimelineScale.DAY,
    cellWidth: 30,
    minCellWidth: 30,
    maxCellWidth: 120,
    headerLevels: 2,
    formatters: { primary: 'yyyy年MM月', secondary: 'dd' },
  },
  week: {
    scale: TimelineScale.WEEK,
    cellWidth: 60,
    minCellWidth: 60,
    maxCellWidth: 240,
    headerLevels: 2,
    formatters: { primary: 'yyyy年MM月', secondary: 'd' },
  },
  month: {
    scale: TimelineScale.MONTH,
    cellWidth: 60,
    minCellWidth: 60,
    maxCellWidth: 180,
    headerLevels: 2,
    formatters: { primary: 'yyyy年', secondary: 'MM月' },
  },
  quarter: {
    scale: TimelineScale.QUARTER,
    cellWidth: 60,
    minCellWidth: 60,
    maxCellWidth: 120,
    headerLevels: 2,
    formatters: { primary: 'yyyy年', secondary: 'Q季度' },
  },
  year: {
    scale: TimelineScale.YEAR,
    cellWidth: 180,
    minCellWidth: 180,
    maxCellWidth: 720,
    headerLevels: 2,
    formatters: { primary: 'yyyy年', secondary: '上半年|下半年' },
  },
} as Record<TimelineScale, TimelineScaleConfig>

// 时间单元数据接口
export interface TimelineUnit {
  id: string
  startDate: Date
  endDate: Date
  label: string
  isToday?: boolean
  isWeekend?: boolean
  width: number
}

// 时间轴数据结构
export interface TimelineData {
  scale: TimelineScale
  units: TimelineUnit[]
  months?: Array<{
    year: number
    month: number
    yearMonthLabel: string
    startDate: Date
    endDate: Date
    units: TimelineUnit[]
  }>
  weeks?: Array<{
    weekNumber: number
    year: number
    startDate: Date
    endDate: Date
    units: TimelineUnit[]
  }>
  years?: Array<{
    year: number
    startDate: Date
    endDate: Date
    halfYears: Array<{
      label: string
      startDate: Date
      endDate: Date
      width: number
    }>
    width: number
  }>
}

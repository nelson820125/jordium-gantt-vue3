/**
 * ResourceUsageTypes.ts - 资源工时分配视图（ResourceUsageView）相关类型定义
 * v1.12.5 新增，对应 architect-v1.12.5.md 第 4.1 节数据实体设计
 *
 * 注意：本文件不依赖 CalendarTypes.ts，刻度类型独立定义，
 * 以保持 ResourceUsageView 与 CalendarView 两个子系统互不依赖（architect 2.4 节约束）。
 */

/** 工时分配视图刻度 */
export type ResourceUsageScale = 'day' | 'week' | 'month'

/** 单个任务在某工时桶内的占比构成明细 */
export interface ResourceUsageTaskBreakdown {
  taskId: number | string
  taskName: string
  hours: number
  /** 对应 task.resources[].capacity，占比累加语义与 conflictUtils.ts 保持一致 */
  percent: number
}

/** 单个资源在某个时间刻度桶内的工时聚合结果 */
export interface ResourceUsageCellData {
  resourceId: string | number
  periodStart: Date
  periodEnd: Date
  /** 该资源在该桶内的工时总和 */
  totalHours: number
  /** 占比总和（可能 >100 表示超载），语义沿用 conflictUtils.ts 的 totalPercent */
  totalPercent: number
  /** totalPercent > overloadThreshold 时为 true */
  isOverloaded: boolean
  taskBreakdown: ResourceUsageTaskBreakdown[]
}

/** cell-click / cell-hover / onCellClick 携带的事件负载 */
export interface ResourceUsageCellPayload {
  resourceId: string | number
  cell: ResourceUsageCellData | null
}

/**
 * ResourceUsageTypes.ts - 资源工时分配视图（ResourceUsageView）相关类型定义
 * v1.12.5 新增，对应 architect-v1.12.5.md 第 4.1 节数据实体设计
 *
 * 注意：本文件不依赖 CalendarTypes.ts，刻度类型独立定义，
 * 以保持 ResourceUsageView 与 CalendarView 两个子系统互不依赖（architect 2.4 节约束）。
 *
 * 数据格式说明（供独立使用 ResourceUsageView 的开发者参考）：
 * ResourceUsageView 复用 Gantt 组件既有的 `Resource[]` 数据集，不需要单独的数据结构或转换步骤，
 * 与资源计划视图（viewMode="resource"）传入的 `resources` 完全一致：
 *   - resource.id / resource.name：资源列表左侧展示
 *   - resource.tasks: Task[]：该资源承接的任务集合，用于聚合工时，每个 task 需要：
 *       - task.startDate / task.endDate（必需，ISO 日期字符串或 Date）
 *       - task.estimatedHours（可选，任务预估总工时，缺省时按 8h/工作日折算）
 *       - task.resources: [{ id, capacity }]（可选，资源占用比例，缺省 100%）
 * 若宿主已经在使用 GanttChart 的 `resources` 数据，直接原样传给 <ResourceUsageView :resources="resources" />
 * 即可获得与资源计划视图一致的工时聚合结果，无需额外转换。
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
  /** 仅 scale === 'day' 时有效：该桶（即当天）是否为周六/周日 */
  isWeekend?: boolean
  taskBreakdown: ResourceUsageTaskBreakdown[]
}

/** cell-click / cell-hover / onCellClick 携带的事件负载 */
export interface ResourceUsageCellPayload {
  resourceId: string | number
  cell: ResourceUsageCellData | null
}

/**
 * task-detail-click / onTaskDetailClick 携带的事件负载（v1.13.0 新增，P1 待办 T7.4）
 * 点击工时单元格 Tooltip 明细中的某个任务时触发
 */
export interface ResourceUsageTaskDetailClickPayload {
  resourceId: string | number
  taskId: number | string
  taskName: string
}

/** 工时格阈值配色，均可选，未提供时回退到主题 CSS 变量的默认配色 */
export interface ResourceUsageColorConfig {
  /** 超载（totalPercent > overloadThreshold）背景色 */
  overloadColor?: string
  /** 正常区间背景色 */
  normalColor?: string
  /** 欠载（totalPercent < underloadThreshold）背景色 */
  underloadColor?: string
  /** 周末列背景色（仅 scale === 'day' 生效） */
  weekendColor?: string
}

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

import type { Resource } from '../classes/Resource'

/** 工时分配视图刻度 */
export type ResourceUsageScale = 'day' | 'week' | 'month'

/**
 * 工作日历例外（单日或跨天区间），参考 MS Project Calendar Exceptions
 * @version 1.14.0
 * @description 用于表达"某天/某段时间是否算工作时间"的特例（法定节假日、调休补班、个人请假、
 *   设备维护停机等），交给 `createWorkCalendarResolver` 转换为 `ResolveWorkingMinutes` 回调。
 */
export interface WorkCalendarException {
  id?: string
  /** 描述，便于宿主 UI 展示，如"元旦""国庆调休补班" */
  name?: string
  /** 起始时刻：'YYYY-MM-DD'（当天 0 点）或 'YYYY-MM-DD HH:mm' */
  start: string
  /** 结束时刻，格式同上；不带时间部分时含全天（次日 0 点为排他边界） */
  end: string
  /** true=这段区间照常/额外计工时（补班、加班）；false=不计工时（放假、请假） */
  working: boolean
  /** 仅 working=true 时按需覆盖当天的计时段；不提供则套用全局 workingHours 的钟点区间 */
  timeRanges?: Array<{ start: string; end: string }>
  /** 该例外仅对指定资源生效；不提供则对所有资源生效（企业统一节假日） */
  resourceIds?: Array<string | number>
}

/**
 * 查询某资源在 [rangeStart, rangeEnd) 内的有效工作分钟数
 * @version 1.14.0
 * @description 归一化基准为 1 个自然日 = 1440 分钟（100%）；未提供时资源利用率计算按
 *   现状默认行为（周六日不计、其余整天计入）折算，保证向后兼容。
 */
export type ResolveWorkingMinutes = (rangeStart: Date, rangeEnd: Date, resource: Resource) => number

/** 单个任务在某工时桶内的占比构成明细 */
export interface ResourceUsageTaskBreakdown {
  taskId: number | string
  taskName: string
  hours: number
  /** 对应 task.resources[].capacity，占比累加语义与 conflictUtils.ts 保持一致 */
  percent: number
}

/**
 * 资源专属"全天不可用"等级（v1.14.0）。当前仅有 'full' 一种取值：该资源在这一天的
 * resolveWorkingMinutes/workCalendarExceptions 折算比例恰好为 0（如个人请假一整天、设备全天停机），
 * 且当天并非公司级共享的周末/假期（那种情况已由 `isWeekend` 表达，不重复标记，避免同一天被两套
 * 样式同时命中）。预留字符串字面量联合类型（而非 boolean）是为未来可能新增的 'partial'（半天/部分
 * 时段例外）留出扩展空间；命名不用 personalOffLevel 是因为该场景不止个人（人力资源）请假，
 * 也包括设备资源停机等非人力场景。
 */
export type ResourceOffOrLeaveLevel = 'full'

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
  /**
   * 仅 scale === 'day' 时有效（v1.14.0）：该资源在这一天是否因专属例外（workCalendarExceptions
   * 的 resourceIds 命中，或自定义 resolveWorkingMinutes）而全天不可用。与 `isWeekend`（公司级共享）
   * 互斥——若当天已经是公司级周末/假期，本字段不会重复置位。
   */
  resourceOffOrLeaveLevel?: ResourceOffOrLeaveLevel
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
  /**
   * 资源专属请假/停机背景色（v1.14.0，仅 scale === 'day' 且 showResourceOffOrLeaveStyle 未关闭时生效）。
   * 未提供时使用内置淡紫色默认值（参考 Microsoft Teams「休假中」状态配色）。
   */
  resourceOffOrLeaveColor?: string
}

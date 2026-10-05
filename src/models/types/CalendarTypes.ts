/**
 * CalendarTypes.ts - 日历视图（CalendarView）相关类型定义
 * v1.12.5 新增，对应 architect-v1.12.5.md 第 4.1 节数据实体设计
 */

import type { Task } from '../classes/Task'

/** 工作时间配置（与 GanttChart.vue 现有 workingHours 结构保持一致，便于宿主复用同一份配置） */
export interface WorkingHoursConfig {
  morning?: { start: number; end: number }
  afternoon?: { start: number; end: number }
}

/** 日历刻度 */
export type CalendarScale = 'day' | 'week' | 'month'

/**
 * 拖拽选区草稿：mousedown~mouseup 过程中，前置钩子（onBeforeSelect）接收到的候选选区
 */
export interface CalendarSelectionDraft {
  startDate: Date
  endDate: Date
  /** 当前资源筛选态下的资源上下文，未筛选时为 undefined */
  resourceId?: string | number
  /** 选区产生时所在的刻度，决定了下游解析选区的最小粒度语义 */
  scale: CalendarScale
}

/**
 * 拖拽选区结果：前置钩子放行后，对外通知的最终选区
 * 结构与 Draft 一致，仅用于语义上区分"草稿"与"已确认结果"
 */
export type CalendarSelectionRange = CalendarSelectionDraft

/** 选区被取消时的原因 */
export type CalendarSelectionCancelReason = 'before-hook-rejected' | 'user-cancelled'

/**
 * v1.13.0 任务卡片拖拽移动结果：日/周/月视图中拖拽已创建任务松开后对外通知的新旧时间范围，
 * 供宿主应用同步到自身业务数据（如后端持久化）
 */
export interface CalendarTaskMovePayload {
  /** 被拖拽的任务（日期已更新为拖拽结果，可直接用于后续保存） */
  task: Task
  /** 拖拽前的开始时间 */
  previousStartDate: Date
  /** 拖拽前的结束时间 */
  previousEndDate: Date
  /** 拖拽后的开始时间 */
  newStartDate: Date
  /** 拖拽后的结束时间 */
  newEndDate: Date
  /** 当前资源筛选态下的资源上下文，未筛选时为 undefined */
  resourceId?: string | number
}

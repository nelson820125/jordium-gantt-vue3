/**
 * useCalendarSelection.ts - 日历拖拽选区状态机
 * v1.12.5 新增，参照 useTaskRowDrag.ts 的实现范式（阈值判定 + mousedown/mousemove/mouseup 生命周期）
 *
 * 职责：
 * - 管理拖拽选区的 isDragging/draft 状态
 * - 在 mousemove 阶段只做本地渲染更新（不触发任何回调），保证 60fps
 * - 在 mouseup 释放时调用前置钩子（onBeforeSelect），根据返回结果触发完成/取消
 *
 * 像素坐标 -> 日期的换算由调用方（CalendarDayView/WeekView/MonthView）通过
 * resolveDraft 提供，本 composable 不感知具体的网格布局，以便三种子视图复用同一状态机。
 */

import { ref, type Ref } from 'vue'
import type {
  CalendarSelectionDraft,
  CalendarSelectionRange,
  CalendarSelectionCancelReason,
} from '../models/types/CalendarTypes'

const DRAG_THRESHOLD = 4 // px，超过该位移才视为拖拽（避免单击误触发选区，对应 US-C03 验收标准5）

export interface UseCalendarSelectionOptions {
  /** 禁用后不响应任何拖拽事件（对应 disabled prop / 禁用态） */
  disabled?: Ref<boolean>
  /**
   * 将鼠标事件解析为选区草稿，由调用方（具体子视图）实现像素->日期的换算，
   * 返回 null 表示当前事件不应产生选区（如落在非法区域）
   */
  resolveDraft: (event: MouseEvent) => CalendarSelectionDraft | null
  onBeforeSelect?: (draft: CalendarSelectionDraft) => boolean | Promise<boolean>
  onSelectionComplete?: (range: CalendarSelectionRange) => void
  onSelectionCancel?: (reason: CalendarSelectionCancelReason) => void
}

export function useCalendarSelection(options: UseCalendarSelectionOptions) {
  const isDragging = ref(false)
  const isPending = ref(false) // 前置钩子异步校验中（Promise pending）
  const isRejected = ref(false) // 前置钩子刚拒绝，用于短暂展示警示态
  const isConfirmed = ref(false) // 选区已成功提交（onSelectionComplete 已回调），保持高亮展示直到显式 clear()，
  // 用于保持拖拽选区高亮在后续弹出的 TaskDrawer 新建任务流程中仍旧可见
  const draft = ref<CalendarSelectionDraft | null>(null)

  let startEvent: MouseEvent | null = null
  let startClientX = 0
  let startClientY = 0
  let hasPassedThreshold = false

  const isDisabled = () => !!options.disabled?.value

  const handleMouseDown = (event: MouseEvent) => {
    if (isDisabled()) return
    if (event.button !== 0) return // 仅响应左键

    // 阻止浏览器原生文本选中/拖拽行为，避免拖拽选区时选中页面其他内容或触发其他鼠标事件
    event.preventDefault()

    startEvent = event
    startClientX = event.clientX
    startClientY = event.clientY
    hasPassedThreshold = false
    isRejected.value = false
    isConfirmed.value = false // 开始新一轮拖拽时，清除上一次已确认选区的高亮

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (!startEvent) return

    // 拖拽过程中持续阻止原生文本选中（部分浏览器在 mousemove 时仍会产生选区）
    event.preventDefault()

    if (!hasPassedThreshold) {
      const dx = Math.abs(event.clientX - startClientX)
      const dy = Math.abs(event.clientY - startClientY)
      if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
        return
      }
      hasPassedThreshold = true
      isDragging.value = true
    }

    // 仅本地更新草稿用于渲染，不触发任何 Hook 调用（保证 mousemove 阶段 60fps）
    const nextDraft = options.resolveDraft(event)
    if (nextDraft) {
      draft.value = nextDraft
    }
  }

  const reset = () => {
    startEvent = null
    hasPassedThreshold = false
    isDragging.value = false
    isConfirmed.value = false
    draft.value = null
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }

  const handleMouseUp = async (event: MouseEvent) => {
    const wasDragging = hasPassedThreshold
    const finalDraft = wasDragging ? options.resolveDraft(event) || draft.value : null

    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)

    if (!wasDragging || !finalDraft) {
      // 单击（无有效位移）不触发选区创建，对应 US-C03 验收标准5
      reset()
      return
    }

    draft.value = finalDraft

    if (options.onBeforeSelect) {
      isPending.value = true
      let allowed = false
      try {
        allowed = await options.onBeforeSelect(finalDraft)
      } catch {
        allowed = false
      }
      isPending.value = false

      if (!allowed) {
        isRejected.value = true
        isDragging.value = false
        options.onSelectionCancel?.('before-hook-rejected')
        // 短暂保留草稿以展示警示态，由调用方决定何时清空（如 200ms 后）
        startEvent = null
        hasPassedThreshold = false
        return
      }
    }

    options.onSelectionComplete?.(finalDraft)
    isDragging.value = false
    isConfirmed.value = true
    startEvent = null
    hasPassedThreshold = false
  }

  const cancel = () => {
    options.onSelectionCancel?.('user-cancelled')
    reset()
  }

  const clear = () => {
    draft.value = null
    isRejected.value = false
    isDragging.value = false
    isConfirmed.value = false
  }

  return {
    isDragging,
    isPending,
    isRejected,
    isConfirmed,
    draft,
    handleMouseDown,
    cancel,
    clear,
  }
}

/**
 * useCalendarTaskDrag.ts - 日历任务卡片"点击/拖拽移动"状态机（v1.13.0 新增）
 * 参照 useCalendarSelection.ts 的阈值判定范式：mousedown~mouseup 位移未超过阈值时视为点击（触发 onClick），
 * 超过阈值后视为拖拽移动（持续触发 onDragMove 用于本地预览渲染，松开时触发 onDragEnd 提交最终结果）。
 *
 * 像素位移 -> 日期换算由调用方（CalendarDayView/WeekView/MonthView）自行实现，本 composable 只负责
 * 点击/拖拽的生命周期与阈值判定，不感知具体的网格布局。
 */

import { ref, type Ref } from 'vue'
import type { Task } from '../models/classes/Task'

const DRAG_THRESHOLD = 4 // px，超过该位移才视为拖拽，避免单击任务卡片被误判为拖拽

export interface CalendarTaskDragDelta {
  deltaX: number
  deltaY: number
}

export interface UseCalendarTaskDragOptions {
  /** 禁用后不响应任何拖拽/点击事件（对应 disabled prop） */
  disabled?: Ref<boolean>
  /** 拖拽过程中持续触发，仅用于本地预览渲染 */
  onDragMove?: (task: Task, delta: CalendarTaskDragDelta, event: MouseEvent) => void
  /** 拖拽松开时触发一次，用于提交最终的任务移动结果 */
  onDragEnd?: (task: Task, delta: CalendarTaskDragDelta, event: MouseEvent) => void
  /** 未产生有效位移（视为点击）时触发 */
  onClick?: (task: Task, event: MouseEvent) => void
}

export function useCalendarTaskDrag(options: UseCalendarTaskDragOptions) {
  const isDragging = ref(false)
  const draggingTaskId = ref<number | null>(null)
  const dragDelta = ref<CalendarTaskDragDelta>({ deltaX: 0, deltaY: 0 })

  let currentTask: Task | null = null
  let startClientX = 0
  let startClientY = 0
  let hasPassedThreshold = false

  const isDisabled = () => !!options.disabled?.value

  const reset = () => {
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
    isDragging.value = false
    draggingTaskId.value = null
    dragDelta.value = { deltaX: 0, deltaY: 0 }
    hasPassedThreshold = false
    currentTask = null
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (!currentTask) return
    event.preventDefault()

    const dx = event.clientX - startClientX
    const dy = event.clientY - startClientY

    if (!hasPassedThreshold) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
      hasPassedThreshold = true
      isDragging.value = true
      draggingTaskId.value = currentTask.id
    }

    dragDelta.value = { deltaX: dx, deltaY: dy }
    options.onDragMove?.(currentTask, dragDelta.value, event)
  }

  const handleMouseUp = (event: MouseEvent) => {
    const task = currentTask
    const wasDragging = hasPassedThreshold
    const delta = { ...dragDelta.value }

    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)

    if (!task) {
      reset()
      return
    }

    if (wasDragging) {
      options.onDragEnd?.(task, delta, event)
    } else {
      options.onClick?.(task, event)
    }
    reset()
  }

  const handleMouseDown = (task: Task, event: MouseEvent) => {
    if (isDisabled()) return
    if (event.button !== 0) return // 仅响应左键
    event.preventDefault()
    event.stopPropagation() // 阻止冒泡到网格空白处的选区创建 mousedown

    currentTask = task
    startClientX = event.clientX
    startClientY = event.clientY
    hasPassedThreshold = false
    dragDelta.value = { deltaX: 0, deltaY: 0 }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return { isDragging, draggingTaskId, dragDelta, handleMouseDown }
}

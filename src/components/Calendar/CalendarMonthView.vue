<template>
  <div class="gantt-calendar-month-view">
    <div class="gantt-calendar-month-header">
      <div v-for="label in weekdayLabels" :key="label" class="gantt-calendar-month-weekday">
        {{ label }}
      </div>
    </div>

    <div ref="gridRef" class="gantt-calendar-month-grid" @mousedown="handleMouseDown">
      <div
        v-for="(week, weekIndex) in monthGrid"
        :key="weekIndex"
        class="gantt-calendar-month-week"
      >
        <div
          v-for="(day, dayIndex) in week"
          :key="dayIndex"
          class="gantt-calendar-month-day"
          :class="{
            'is-other-month': !day.isCurrentMonth,
            'is-weekend': day.isWeekend,
            'is-today': day.isToday,
            'is-drop-target': dragOverDate && isSameDay(dragOverDate, day.date),
          }"
          :data-week-index="weekIndex"
          :data-day-index="dayIndex"
        >
          <div class="gantt-calendar-month-day-number">{{ day.date.getDate() }}</div>
          <div class="gantt-calendar-month-tasks">
            <div
              v-for="task in tasksForDay(day.date).slice(0, 3)"
              :key="task.id"
              class="gantt-calendar-task-chip"
              :class="{ 'is-task-dragging': draggingTaskId === task.id }"
              :style="{ backgroundColor: task.barColor || 'var(--gantt-primary)' }"
              :title="task.name"
              @mousedown="handleTaskMouseDown(task, day.date, $event)"
            >
              {{ task.name }}
            </div>
            <button
              v-if="tasksForDay(day.date).length > 3"
              type="button"
              class="gantt-calendar-more-trigger"
              @click.stop="openMorePopover(day.date, $event)"
            >
              +{{ tasksForDay(day.date).length - 3 }} 更多
            </button>
          </div>
        </div>
      </div>

      <CalendarSelectionLayer :rect="selectionRect" :state="selectionState" />
    </div>

    <CalendarMoreTasksPopover
      v-if="morePopover"
      :date="morePopover.date"
      :tasks="tasksForDay(morePopover.date)"
      :anchor="morePopover.anchor"
      @close="morePopover = null"
      @task-click="(task, event) => emit('task-click', task, event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CalendarSelectionLayer from './CalendarSelectionLayer.vue'
import CalendarMoreTasksPopover from './CalendarMoreTasksPopover.vue'
import { useCalendarSelection } from '../../composables/useCalendarSelection'
import { useCalendarTaskDrag } from '../../composables/useCalendarTaskDrag'
import {
  generateMonthGrid,
  isSameDay,
  isTaskOnDate,
  snapToDayStart,
  formatTaskDateTime,
} from '../../utils/calendarTimeUtils'
import type {
  CalendarSelectionDraft,
  CalendarTaskMovePayload,
} from '../../models/types/CalendarTypes'
import type { Task } from '../../models/classes/Task'

interface Props {
  anchorDate: Date
  tasks?: Task[]
  resourceId?: string | number
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  tasks: () => [],
  disabled: false,
})

const emit = defineEmits<{
  'selection-complete': [range: CalendarSelectionDraft]
  'selection-cancel': [reason: 'before-hook-rejected' | 'user-cancelled']
  'task-click': [task: Task, event: MouseEvent]
  'task-move': [payload: CalendarTaskMovePayload]
}>()

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

const gridRef = ref<HTMLElement>()
const monthGrid = computed(() => generateMonthGrid(props.anchorDate))

const morePopover = ref<{ date: Date; anchor: HTMLElement } | null>(null)
const openMorePopover = (date: Date, event: MouseEvent) => {
  morePopover.value = { date, anchor: event.currentTarget as HTMLElement }
}

const parseTaskDate = (value?: string): Date | null => {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

const tasksForDay = (date: Date): Task[] => {
  return props.tasks.filter(task => {
    const start = parseTaskDate(task.startDate)
    const end = parseTaskDate(task.endDate)
    if (!start || !end) return false
    return isTaskOnDate(start, end, date)
  })
}

// ------ 拖拽选区（天粒度） ------

const dragStartDate = ref<Date | null>(null)

const resolveDayFromEvent = (event: MouseEvent): Date | null => {
  const target = (event.target as HTMLElement)?.closest(
    '.gantt-calendar-month-day'
  ) as HTMLElement | null
  if (!target) return null
  const weekIndex = Number(target.dataset.weekIndex)
  const dayIndex = Number(target.dataset.dayIndex)
  const cell = monthGrid.value[weekIndex]?.[dayIndex]
  return cell ? snapToDayStart(cell.date) : null
}

const resolveDraft = (event: MouseEvent): CalendarSelectionDraft | null => {
  const date = resolveDayFromEvent(event)
  if (!date || !dragStartDate.value) return null
  return {
    startDate: dragStartDate.value,
    endDate: date,
    resourceId: props.resourceId,
    scale: 'month',
  }
}

const disabledRef = computed(() => props.disabled)

const selection = useCalendarSelection({
  disabled: disabledRef,
  resolveDraft,
  onSelectionComplete: range => emit('selection-complete', range),
  onSelectionCancel: reason => emit('selection-cancel', reason),
})

const handleMouseDown = (event: MouseEvent) => {
  if (props.disabled) return
  const date = resolveDayFromEvent(event)
  if (!date) return
  dragStartDate.value = date
  selection.handleMouseDown(event)
}

// ------ 任务卡片点击/拖拽移动（天粒度，可拖拽至其他日期 cell） ------

const draggingSourceDate = ref<Date | null>(null)
const dragOverDate = ref<Date | null>(null)

const resolveCellDateFromPoint = (clientX: number, clientY: number): Date | null => {
  const el = document.elementFromPoint(clientX, clientY)
  const cellEl = el?.closest('.gantt-calendar-month-day') as HTMLElement | null
  if (!cellEl) return null
  const weekIndex = Number(cellEl.dataset.weekIndex)
  const dayIndex = Number(cellEl.dataset.dayIndex)
  const cell = monthGrid.value[weekIndex]?.[dayIndex]
  return cell ? cell.date : null
}

const { draggingTaskId, handleMouseDown: handleTaskMouseDownRaw } = useCalendarTaskDrag({
  disabled: disabledRef,
  onClick: (task, event) => emit('task-click', task, event),
  onDragMove: (_task, _delta, event) => {
    dragOverDate.value = resolveCellDateFromPoint(event.clientX, event.clientY)
  },
  onDragEnd: (task, _delta, event) => {
    dragOverDate.value = null
    const targetDate = resolveCellDateFromPoint(event.clientX, event.clientY)
    const sourceDate = draggingSourceDate.value
    draggingSourceDate.value = null
    if (!targetDate || !sourceDate || isSameDay(targetDate, sourceDate)) return

    const start = parseTaskDate(task.startDate)
    const end = parseTaskDate(task.endDate)
    if (!start || !end) return

    const dayDiffMs = snapToDayStart(targetDate).getTime() - snapToDayStart(sourceDate).getTime()
    const newStart = new Date(start.getTime() + dayDiffMs)
    const newEnd = new Date(end.getTime() + dayDiffMs)

    const updatedTask: Task = {
      ...task,
      startDate: formatTaskDateTime(newStart),
      endDate: formatTaskDateTime(newEnd),
    }
    emit('task-move', {
      task: updatedTask,
      previousStartDate: start,
      previousEndDate: end,
      newStartDate: newStart,
      newEndDate: newEnd,
      resourceId: props.resourceId,
    })
  },
})

const handleTaskMouseDown = (task: Task, date: Date, event: MouseEvent) => {
  draggingSourceDate.value = date
  handleTaskMouseDownRaw(task, event)
}

/** 月视图选区为天粒度，直接以高亮起止两端所覆盖的格子范围呈现（拖拽中或已确认/等待 TaskDrawer 处理时均展示） */
const selectionRect = computed(() => {
  const draft = selection.draft.value
  if (!draft || (!selection.isDragging.value && !selection.isConfirmed.value)) return null
  const gridEl = gridRef.value
  const startEl = gridEl?.querySelector(
    `[data-week-index] .gantt-calendar-month-day`
  ) as HTMLElement | null
  if (!gridEl || !startEl) return null

  const findCellEl = (date: Date): HTMLElement | null => {
    for (let w = 0; w < monthGrid.value.length; w++) {
      for (let d = 0; d < 7; d++) {
        if (isSameDay(monthGrid.value[w][d].date, date)) {
          return gridEl.querySelector(
            `[data-week-index="${w}"][data-day-index="${d}"]`
          ) as HTMLElement | null
        }
      }
    }
    return null
  }

  const startCell = findCellEl(draft.startDate)
  const endCell = findCellEl(draft.endDate)
  if (!startCell || !endCell) return null

  const gridRect = gridEl.getBoundingClientRect()
  const sRect = startCell.getBoundingClientRect()
  const eRect = endCell.getBoundingClientRect()

  const top = Math.min(sRect.top, eRect.top) - gridRect.top
  const left = Math.min(sRect.left, eRect.left) - gridRect.left
  const right = Math.max(sRect.right, eRect.right) - gridRect.left
  const bottom = Math.max(sRect.bottom, eRect.bottom) - gridRect.top

  return { top, left, width: right - left, height: bottom - top }
})

const selectionState = computed(() => {
  if (selection.isRejected.value) return 'rejected'
  if (selection.isPending.value) return 'pending'
  return 'active'
})

defineExpose({ clearSelection: () => selection.clear() })
</script>

<style scoped>
.gantt-calendar-month-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: var(--gantt-bg-primary);
}

.gantt-calendar-month-header {
  display: flex;
  border-bottom: 1px solid var(--gantt-border-medium);
}

.gantt-calendar-month-weekday {
  flex: 1;
  text-align: center;
  font-size: 12px;
  padding: 6px 0;
  color: var(--gantt-text-header);
  background-color: var(--gantt-bg-secondary);
}

.gantt-calendar-month-grid {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  user-select: none;
}

.gantt-calendar-month-week {
  display: flex;
  flex: 1;
}

.gantt-calendar-month-day {
  flex: 1;
  min-height: 88px;
  border-right: 1px solid var(--gantt-border-light);
  border-bottom: 1px solid var(--gantt-border-light);
  padding: 4px;
  box-sizing: border-box;
  background-color: var(--gantt-bg-primary);
}

.gantt-calendar-month-day.is-other-month {
  background-color: var(--gantt-bg-tertiary);
  color: var(--gantt-text-muted);
}

.gantt-calendar-month-day.is-weekend {
  background-color: var(--gantt-bg-secondary);
}

/* v1.13.0 任务卡片拖拽悬停至该日期格时高亮提示放下目标 */
.gantt-calendar-month-day.is-drop-target {
  background-color: color-mix(in srgb, var(--gantt-primary) 15%, transparent);
  box-shadow: inset 0 0 0 2px var(--gantt-primary);
}

.gantt-calendar-month-day.is-today .gantt-calendar-month-day-number {
  color: var(--gantt-text-white);
  background-color: var(--gantt-primary);
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.gantt-calendar-month-day-number {
  font-size: 12px;
  margin-bottom: 2px;
}

.gantt-calendar-month-tasks {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gantt-calendar-task-chip {
  font-size: 11px;
  color: var(--gantt-text-white);
  padding: 1px 4px;
  border-radius: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: grab;
}

/* v1.13.0 拖拽移动任务时，凸显当前被拖拽的卡片 */
.gantt-calendar-task-chip.is-task-dragging {
  z-index: 50;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  opacity: 0.92;
  cursor: grabbing;
  transform: scale(1.05);
  pointer-events: none;
}

.gantt-calendar-more-trigger {
  font-size: 11px;
  color: var(--gantt-primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-align: left;
}
</style>

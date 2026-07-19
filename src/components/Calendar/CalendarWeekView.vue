<template>
  <div class="gantt-calendar-week-view">
    <div class="gantt-calendar-week-header">
      <div class="gantt-calendar-hour-label-placeholder" />
      <div
        v-for="day in weekDays"
        :key="day.date.toISOString()"
        class="gantt-calendar-week-day-header"
        :class="{ 'is-today': day.isToday, 'is-weekend': day.isWeekend }"
      >
        {{ formatDayHeader(day.date) }}
      </div>
    </div>

    <div class="gantt-calendar-week-allday-row" v-if="hasAnyAllDayTask">
      <div class="gantt-calendar-hour-label-placeholder gantt-calendar-allday-label">
        {{ allDayLabel }}
      </div>
      <div
        v-for="day in weekDays"
        :key="'allday-' + day.date.toISOString()"
        class="gantt-calendar-week-allday-col"
      >
        <div
          v-for="task in allDayTasksForDay(day.date)"
          :key="task.id"
          class="gantt-calendar-task-chip"
          :style="{ backgroundColor: task.barColor || 'var(--gantt-primary)' }"
          :title="task.name"
          @click="emit('task-click', task, $event)"
        >
          {{ task.name }} - {{ allDayLabel }}
        </div>
      </div>
    </div>

    <div ref="gridRef" class="gantt-calendar-week-grid" @mousedown="handleMouseDown">
      <div class="gantt-calendar-hour-label-column">
        <div v-for="h in 24" :key="h" class="gantt-calendar-hour-label">
          {{ String(h - 1).padStart(2, '0') }}:00
        </div>
      </div>

      <div
        v-for="(day, dayIndex) in weekDays"
        :key="day.date.toISOString()"
        class="gantt-calendar-week-day-column"
        :data-day-index="dayIndex"
      >
        <div
          v-for="cell in day.hours"
          :key="cell.hour"
          class="gantt-calendar-hour-cell"
          :class="{ 'is-working-hour': cell.isWorkingHour, 'is-current-hour': cell.isCurrentHour }"
        />
      </div>

      <div
        v-for="(block, bIndex) in timedBlockLayouts"
        :key="'timed-' + block.task.id + '-' + bIndex"
        class="gantt-calendar-timed-task"
        :class="{ 'is-task-dragging': draggingTaskId === block.task.id }"
        :style="blockStyle(block)"
        :title="block.task.name"
        @mousedown="handleTaskMouseDown(block.task, $event)"
      >
        <slot name="task-card" :task="block.task" :style="blockStyle(block)">
          {{ taskCardTitle(block.task) }}
        </slot>
      </div>

      <CalendarSelectionLayer
        :rect="selectionState !== 'active' ? selectionRect : null"
        :segments="selectionSegments"
        :left="selectionRect ? selectionRect.left : 0"
        :width="selectionRect ? selectionRect.width : 0"
        :indicator-width="4"
        :state="selectionState"
      />

      <div
        v-if="nowIndicatorTop !== null && nowIndicatorLeft !== null"
        class="gantt-calendar-now-line"
        :style="{
          top: `${nowIndicatorTop}px`,
          left: `${nowIndicatorLeft}px`,
          width: `${nowIndicatorWidth}px`,
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CalendarSelectionLayer from './CalendarSelectionLayer.vue'
import { useCalendarSelection } from '../../composables/useCalendarSelection'
import { useCalendarTaskDrag } from '../../composables/useCalendarTaskDrag'
import {
  generateWeekDays,
  snapToMinuteStep,
  isSameDay,
  isTaskOnDate,
  computeSelectionSegments,
  minutesSinceMidnight,
  computeTimedTaskLayout,
  formatTaskDateTime,
  formatTaskCardTitle,
} from '../../utils/calendarTimeUtils'
import type {
  WorkingHoursConfig,
  CalendarSelectionDraft,
  CalendarTaskMovePayload,
} from '../../models/types/CalendarTypes'
import type { Task } from '../../models/classes/Task'

const HOUR_HEIGHT = 48 // 与日视图行高保持一致
const HOUR_LABEL_WIDTH = 60

interface Props {
  anchorDate: Date
  tasks?: Task[]
  workingHours?: WorkingHoursConfig
  resourceId?: string | number
  selectionMinuteStep?: number
  disabled?: boolean
  allDayLabel?: string
  /** v1.13.0 任务卡片底色透明度（0-1），底色为任务强调色（task.barColor 或主题色）与透明色的混合比例 */
  taskCardOpacity?: number
  /** v1.13.0 任务卡片左侧强调条宽度（px） */
  taskAccentWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  tasks: () => [],
  selectionMinuteStep: 15,
  disabled: false,
  allDayLabel: '全天',
  taskCardOpacity: 0.18,
  taskAccentWidth: 5,
})

const emit = defineEmits<{
  'selection-complete': [range: CalendarSelectionDraft]
  'selection-cancel': [reason: 'before-hook-rejected' | 'user-cancelled']
  'task-click': [task: Task, event: MouseEvent]
  'task-move': [payload: CalendarTaskMovePayload]
}>()

const gridRef = ref<HTMLElement>()

const weekDays = computed(() => generateWeekDays(props.anchorDate, props.workingHours))

const formatDayHeader = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`

const parseTaskDate = (value?: string): Date | null => {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/** 指定日期的全天/跨天任务（逻辑与 CalendarDayView 保持一致） */
const allDayTasksForDay = (date: Date): Task[] => {
  return props.tasks.filter(task => {
    const start = parseTaskDate(task.startDate)
    const end = parseTaskDate(task.endDate)
    if (!start || !end) return false
    if (!isTaskOnDate(start, end, date)) return false
    const sameDayTimed =
      isSameDay(start, end) && (start.getHours() !== 0 || start.getMinutes() !== 0)
    return !sameDayTimed
  })
}

const hasAnyAllDayTask = computed(() =>
  weekDays.value.some(day => allDayTasksForDay(day.date).length > 0)
)

/** 指定日期内有明确起止小时的任务 */
const timedTasksForDay = (date: Date): Task[] => {
  return props.tasks.filter(task => {
    const start = parseTaskDate(task.startDate)
    const end = parseTaskDate(task.endDate)
    if (!start || !end) return false
    return (
      isSameDay(start, end) &&
      isSameDay(start, date) &&
      (start.getHours() !== 0 || start.getMinutes() !== 0)
    )
  })
}

/** 任务卡片默认展示标题：具体时段任务展示 "标题 - HH:mm ~ HH:mm"（v1.13.0，供 #task-card 插槽默认内容使用） */
const taskCardTitle = (task: Task): string => {
  const start = parseTaskDate(task.startDate)
  const end = parseTaskDate(task.endDate)
  if (!start || !end) return task.name
  return formatTaskCardTitle(task.name, false, start, end)
}

/** 当前时间指示线所在列的横向偏移，仅当本周包含今天时才有值 */
const nowIndicatorLeft = computed(() => {
  const idx = weekDays.value.findIndex(d => d.isToday)
  if (idx === -1) return null
  return HOUR_LABEL_WIDTH + idx * columnWidth()
})

/** 当前时间指示线的宽度：与单日列宽保持一致 */
const nowIndicatorWidth = computed(() => columnWidth())

/** 当前时间指示线的纵向偏移，精确到分钟 */
const nowIndicatorTop = computed(() => {
  if (nowIndicatorLeft.value === null) return null
  return (minutesSinceMidnight(new Date()) / 60) * HOUR_HEIGHT
})

// ------ 拖拽选区（跨列） ------

const dragStartInfo = ref<{ dayIndex: number; date: Date } | null>(null)

const columnWidth = () => {
  const el = gridRef.value
  if (!el) return 0
  return (el.clientWidth - HOUR_LABEL_WIDTH) / 7
}

/** 每天独立计算重叠任务的并排列布局，输出为纯数值布局（不含颜色样式），便于拖拽预览时叠加实时位移量 */
interface TimedBlockLayout {
  task: Task
  dayIndex: number
  top: number
  height: number
  left: number
  width: number
}

const timedBlockLayouts = computed<TimedBlockLayout[]>(() => {
  const colWidth = columnWidth()
  const layouts: TimedBlockLayout[] = []

  weekDays.value.forEach((day, dayIndex) => {
    const dayTasks = timedTasksForDay(day.date)
    const intervals = dayTasks.map(task => {
      const start = parseTaskDate(task.startDate)!
      const end = parseTaskDate(task.endDate)!
      const startMinutes = start.getHours() * 60 + start.getMinutes()
      const endMinutes = Math.max(end.getHours() * 60 + end.getMinutes(), startMinutes + 15)
      return { start: startMinutes, end: endMinutes }
    })
    const columnLayouts = computeTimedTaskLayout(intervals)

    dayTasks.forEach((task, i) => {
      const { start, end } = intervals[i]
      const columnLayout = columnLayouts[i]
      const top = (start / 60) * HOUR_HEIGHT
      const height = ((end - start) / 60) * HOUR_HEIGHT
      const subWidth = colWidth / columnLayout.columnCount
      const left = HOUR_LABEL_WIDTH + dayIndex * colWidth + columnLayout.column * subWidth
      layouts.push({
        task,
        dayIndex,
        top,
        height,
        left,
        width: Math.max(subWidth - 2, 0),
      })
    })
  })

  return layouts
})

/** 将数值布局转换为样式对象；若该任务正在被拖拽，叠加实时像素位移实现跟随鼠标预览 */
const blockStyle = (block: TimedBlockLayout) => {
  let top = block.top
  let left = block.left
  if (isTaskDragging.value && draggingTaskId.value === block.task.id) {
    top += taskDragDelta.value.deltaY
    left += taskDragDelta.value.deltaX
  }
  const accent = block.task.barColor || 'var(--gantt-primary)'
  const opacityPercent = Math.round(Math.min(Math.max(props.taskCardOpacity, 0), 1) * 100)
  return {
    top: `${top}px`,
    height: `${block.height}px`,
    left: `${left}px`,
    width: `${block.width}px`,
    borderLeftWidth: `${props.taskAccentWidth}px`,
    borderLeftColor: accent,
    backgroundColor: `color-mix(in srgb, ${accent} ${opacityPercent}%, transparent)`,
  }
}

const resolveEventPoint = (event: MouseEvent) => {
  const el = gridRef.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const offsetX = Math.min(
    Math.max(event.clientX - rect.left - HOUR_LABEL_WIDTH, 0),
    rect.width - HOUR_LABEL_WIDTH
  )
  const offsetY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height)
  const colWidth = columnWidth()
  const dayIndex = colWidth > 0 ? Math.min(Math.floor(offsetX / colWidth), 6) : 0
  const totalMinutes = (offsetY / HOUR_HEIGHT) * 60
  const day = weekDays.value[dayIndex]?.date ?? props.anchorDate
  const date = new Date(day)
  date.setHours(0, totalMinutes, 0, 0)
  return { dayIndex, date: snapToMinuteStep(date, props.selectionMinuteStep) }
}

const resolveDraft = (event: MouseEvent): CalendarSelectionDraft | null => {
  const point = resolveEventPoint(event)
  if (!point || !dragStartInfo.value) return null
  return {
    startDate: dragStartInfo.value.date,
    endDate: point.date,
    resourceId: props.resourceId,
    scale: 'week',
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
  const point = resolveEventPoint(event)
  if (!point) return
  dragStartInfo.value = point
  selection.handleMouseDown(event)
}

// ------ 任务卡片点击/拖拽移动（垂直改时段，水平跨日移动） ------

const {
  isDragging: isTaskDragging,
  draggingTaskId,
  dragDelta: taskDragDelta,
  handleMouseDown: handleTaskMouseDown,
} = useCalendarTaskDrag({
  disabled: disabledRef,
  onClick: (task, event) => emit('task-click', task, event),
  onDragEnd: (task, delta) => {
    const start = parseTaskDate(task.startDate)
    const end = parseTaskDate(task.endDate)
    if (!start || !end) return
    const durationMs = end.getTime() - start.getTime()
    const colWidth = columnWidth()
    if (colWidth <= 0) return

    const originalDayIndex = weekDays.value.findIndex(d => isSameDay(d.date, start))
    if (originalDayIndex === -1) return

    const dayDelta = Math.round(delta.deltaX / colWidth)
    const deltaMinutesRaw = (delta.deltaY / HOUR_HEIGHT) * 60
    const snappedMinuteDelta =
      Math.round(deltaMinutesRaw / props.selectionMinuteStep) * props.selectionMinuteStep

    const newDayIndex = Math.max(
      0,
      Math.min(originalDayIndex + dayDelta, weekDays.value.length - 1)
    )
    const originalStartMinutes = start.getHours() * 60 + start.getMinutes()
    const maxStartMinutes = 24 * 60 - durationMs / 60000
    const newStartMinutes = Math.max(
      0,
      Math.min(originalStartMinutes + snappedMinuteDelta, maxStartMinutes)
    )

    if (newDayIndex === originalDayIndex && newStartMinutes === originalStartMinutes) return

    const targetDay = weekDays.value[newDayIndex].date
    const newStart = new Date(targetDay)
    newStart.setHours(0, newStartMinutes, 0, 0)
    const newEnd = new Date(newStart.getTime() + durationMs)

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

const selectionRect = computed(() => {
  const draft = selection.draft.value
  if (
    !draft ||
    (!selection.isDragging.value && !selection.isConfirmed.value) ||
    !dragStartInfo.value
  )
    return null
  const colWidth = columnWidth()
  const dayIndex = dragStartInfo.value.dayIndex
  const startMinutes = draft.startDate.getHours() * 60 + draft.startDate.getMinutes()
  const endMinutes = draft.endDate.getHours() * 60 + draft.endDate.getMinutes()
  const top = (Math.min(startMinutes, endMinutes) / 60) * HOUR_HEIGHT
  const height = (Math.abs(endMinutes - startMinutes) / 60) * HOUR_HEIGHT || 4
  return {
    top,
    left: HOUR_LABEL_WIDTH + dayIndex * colWidth,
    width: colWidth,
    height,
  }
})

const selectionState = computed(() => {
  if (selection.isRejected.value) return 'rejected'
  if (selection.isPending.value) return 'pending'
  return 'active'
})

/** Outlook 风格分段渲染：拖拽中或已确认（等待 TaskDrawer 处理）时均展示，rejected/pending 态沿用原有整块 rect 渲染 */
const selectionSegments = computed(() => {
  if (selectionState.value !== 'active') return []
  const draft = selection.draft.value
  if (!draft || (!selection.isDragging.value && !selection.isConfirmed.value)) return []
  const startMinutes = draft.startDate.getHours() * 60 + draft.startDate.getMinutes()
  const endMinutes = draft.endDate.getHours() * 60 + draft.endDate.getMinutes()
  return computeSelectionSegments(
    startMinutes,
    endMinutes,
    HOUR_HEIGHT,
    props.selectionMinuteStep
  ).map(seg => ({
    top: seg.slotTop,
    height: seg.slotHeight,
    indicatorTop: seg.indicatorTop,
    indicatorHeight: seg.indicatorHeight,
  }))
})

defineExpose({ clearSelection: () => selection.clear() })
</script>

<style scoped>
.gantt-calendar-week-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background-color: var(--gantt-bg-primary);

  /* 细滚动条，对齐 .timeline/.task-list-body 容器 */
  scrollbar-width: thin;
  scrollbar-color: var(--gantt-scrollbar-thumb) transparent;
}

.gantt-calendar-week-view::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.gantt-calendar-week-view::-webkit-scrollbar-track {
  background: transparent;
}

.gantt-calendar-week-view::-webkit-scrollbar-thumb {
  background-color: var(--gantt-scrollbar-thumb);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.gantt-calendar-week-view::-webkit-scrollbar-thumb:hover {
  background-color: var(--gantt-scrollbar-thumb-hover);
}

.gantt-calendar-week-view::-webkit-scrollbar-corner {
  background: transparent;
}

.gantt-calendar-week-header {
  display: flex;
  position: sticky;
  top: 0;
  background-color: var(--gantt-bg-secondary);
  z-index: var(--gantt-z-sticky, 30);
  border-bottom: 1px solid var(--gantt-border-medium);
}

.gantt-calendar-hour-label-placeholder {
  width: 60px;
  flex-shrink: 0;
}

/* v1.13.0 全天任务行前的占位列展示"全天"文案，与日视图 .gantt-calendar-allday-label 视觉保持一致 */
.gantt-calendar-allday-label {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--gantt-text-muted);
  text-align: center;
}

.gantt-calendar-week-day-header {
  flex: 1;
  text-align: center;
  font-size: 12px;
  padding: 6px 0;
  color: var(--gantt-text-header);
}

.gantt-calendar-week-day-header.is-today {
  color: var(--gantt-primary);
  font-weight: 600;
}

.gantt-calendar-week-day-header.is-weekend {
  background-color: var(--gantt-bg-tertiary);
}

.gantt-calendar-week-allday-row {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--gantt-border-light);
}

.gantt-calendar-week-allday-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 4px;
  min-width: 0;
}

.gantt-calendar-task-chip {
  font-size: 12px;
  color: var(--gantt-text-white);
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gantt-calendar-week-grid {
  position: relative;
  display: flex;
  width: 100%;
  user-select: none;
}

.gantt-calendar-hour-label-column {
  width: 60px;
  flex-shrink: 0;
}

.gantt-calendar-hour-label {
  height: 48px;
  font-size: 12px;
  color: var(--gantt-text-secondary);
  padding: 2px 6px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--gantt-border-light);
}

.gantt-calendar-week-day-column {
  flex: 1;
  border-right: 1px solid var(--gantt-border-light);
}

.gantt-calendar-hour-cell {
  height: 48px;
  border-bottom: 1px solid var(--gantt-border-light);
  background-color: var(--gantt-bg-primary);
  box-sizing: border-box;
}

.gantt-calendar-hour-cell:not(.is-working-hour) {
  background-color: var(--gantt-bg-tertiary);
}

/* v1.13.0 任务卡片：淡蓝色半透明底 + 左侧 5px 深色强调条，与 CalendarDayView 保持一致 */
.gantt-calendar-timed-task {
  position: absolute;
  border-radius: 4px;
  border-left: 5px solid var(--gantt-primary);
  background-color: color-mix(in srgb, var(--gantt-primary) 18%, transparent);
  color: var(--gantt-text-primary);
  font-size: 12px;
  padding: 2px 6px 2px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  z-index: var(--gantt-z-bar, 10);
  box-sizing: border-box;
  cursor: grab;
}

/* v1.13.0 拖拽移动任务时，凸显当前被拖拽的卡片：提升层级、阴影与轻微放大 */
.gantt-calendar-timed-task.is-task-dragging {
  z-index: 50;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  opacity: 0.92;
  cursor: grabbing;
  transform: scale(1.02);
  pointer-events: none;
}

/* 当前时间指示线：仅在本周包含今天时渲染，横向仅覆盖今天所在列 */
.gantt-calendar-now-line {
  position: absolute;
  height: 2px;
  background-color: var(--gantt-danger);
  z-index: 6;
  pointer-events: none;
}

.gantt-calendar-now-line::before {
  content: '';
  position: absolute;
  left: -4px;
  top: -3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--gantt-danger);
}
</style>

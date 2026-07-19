<template>
  <div class="gantt-calendar-day-view">
    <div class="gantt-calendar-allday-row" v-if="allDayTasks.length">
      <div class="gantt-calendar-allday-label">{{ allDayLabel }}</div>
      <div class="gantt-calendar-allday-chips">
        <div
          v-for="task in allDayTasks"
          :key="task.id"
          class="gantt-calendar-task-chip"
          :style="{ backgroundColor: task.barColor || 'var(--gantt-primary)' }"
          :title="`${task.name} - ${allDayLabel}`"
          @click="emit('task-click', task, $event)"
        >
          {{ task.name }} - {{ allDayLabel }}
        </div>
      </div>
    </div>

    <div ref="gridRef" class="gantt-calendar-day-grid" @mousedown="handleMouseDown">
      <div
        v-for="cell in hourCells"
        :key="cell.hour"
        class="gantt-calendar-hour-row"
        :class="{
          'is-working-hour': cell.isWorkingHour,
          'is-current-hour': cell.isCurrentHour,
        }"
      >
        <div class="gantt-calendar-hour-label">{{ cell.label }}</div>
        <div class="gantt-calendar-hour-cell" :data-hour="cell.hour" />
      </div>

      <div
        v-if="nowIndicatorTop !== null"
        class="gantt-calendar-now-line"
        :style="{
          top: `${nowIndicatorTop}px`,
          left: `${HOUR_LABEL_WIDTH}px`,
          width: `${selectionWidth}px`,
        }"
      />

      <div
        v-for="(task, tIndex) in timedTasks"
        :key="task.id"
        class="gantt-calendar-timed-task"
        :class="{ 'is-task-dragging': draggingTaskId === task.id }"
        :style="taskBlockStyle(task, tIndex)"
        :title="task.name"
        @mousedown="handleTaskMouseDown(task, $event)"
      >
        <slot name="task-card" :task="task" :style="taskBlockStyle(task, tIndex)">
          <div class="gantt-calendar-task-card-title">{{ taskCardTitle(task, tIndex) }}</div>
          <div v-if="task.description" class="gantt-calendar-task-card-desc">
            {{ task.description }}
          </div>
        </slot>
      </div>

      <CalendarSelectionLayer
        :rect="selectionState !== 'active' ? selectionRect : null"
        :segments="selectionSegments"
        :left="HOUR_LABEL_WIDTH"
        :width="selectionWidth"
        :indicator-width="4"
        :state="selectionState"
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
  generateDayHours,
  snapToMinuteStep,
  isSameDay,
  computeSelectionSegments,
  minutesSinceMidnight,
  computeTimedTaskLayout,
  formatTaskDateTime,
  classifyTaskForDate,
  formatTaskCardTitleByMinutes,
  parseTaskDateTime,
} from '../../utils/calendarTimeUtils'
import type {
  WorkingHoursConfig,
  CalendarSelectionDraft,
  CalendarTaskMovePayload,
} from '../../models/types/CalendarTypes'
import type { Task } from '../../models/classes/Task'

const HOUR_HEIGHT = 48 // px，对应 UI 设计 1.2 节

interface Props {
  date: Date
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
  onBeforeSelect?: (draft: CalendarSelectionDraft) => boolean | Promise<boolean>
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

const hourCells = computed(() => generateDayHours(props.date, props.workingHours))

/** 当前时间指示线的纵向偏移（仅当展示日期为今天时渲染，否则为 null 表示不展示） */
const nowIndicatorTop = computed(() => {
  if (!isSameDay(props.date, new Date())) return null
  return (minutesSinceMidnight(new Date()) / 60) * HOUR_HEIGHT
})

const parseTaskDate = parseTaskDateTime

/** 全天/跨天任务：无法用小时坐标精确表达，展示为全天条目（判定规则见 classifyTaskForDate） */
const allDayTasks = computed(() => {
  return props.tasks.filter(task => {
    const start = parseTaskDate(task.startDate)
    const end = parseTaskDate(task.endDate)
    if (!start || !end) return false
    return classifyTaskForDate(start, end, props.date).type === 'all-day'
  })
})

/** 当天有明确起止小时的任务（含跨天任务在起始日/结束日的当日片段），按坐标定位渲染 */
interface TimedEntry {
  task: Task
  startMinutes: number
  endMinutes: number
}

const timedEntries = computed<TimedEntry[]>(() => {
  const entries: TimedEntry[] = []
  for (const task of props.tasks) {
    const start = parseTaskDate(task.startDate)
    const end = parseTaskDate(task.endDate)
    if (!start || !end) continue
    const classification = classifyTaskForDate(start, end, props.date)
    if (classification.type !== 'timed') continue
    const startMinutes = classification.startMinutes!
    const endMinutes = Math.max(classification.endMinutes!, startMinutes + 15)
    entries.push({ task, startMinutes, endMinutes })
  }
  return entries
})

/** 供模板 `v-for` 与既有 taskBlockStyle(task, index) 调用方式保持不变 */
const timedTasks = computed(() => timedEntries.value.map(entry => entry.task))

/** 任务卡片默认展示标题：具体时段任务展示 "标题 - HH:mm ~ HH:mm"（v1.13.0，供 #task-card 插槽默认内容使用） */
const taskCardTitle = (task: Task, index: number): string => {
  const entry = timedEntries.value[index]
  if (!entry) return task.name
  return formatTaskCardTitleByMinutes(task.name, entry.startMinutes, entry.endMinutes)
}

/** timedTasks 的重叠列布局（同一时段内多个任务并排显示，而非层叠覆盖） */
const timedTaskLayout = computed(() => {
  const intervals = timedEntries.value.map(entry => ({
    start: entry.startMinutes,
    end: entry.endMinutes,
  }))
  return computeTimedTaskLayout(intervals)
})

const taskBlockStyle = (task: Task, index: number) => {
  const entry = timedEntries.value[index]
  const startMinutes = entry?.startMinutes ?? 0
  const endMinutes = entry?.endMinutes ?? startMinutes + 15
  let top = (startMinutes / 60) * HOUR_HEIGHT
  if (isTaskDragging.value && draggingTaskId.value === task.id) {
    top += taskDragDelta.value.deltaY
  }
  const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT
  const layout = timedTaskLayout.value[index] ?? { column: 0, columnCount: 1 }
  const gridWidth = gridRef.value?.clientWidth ?? 0
  const usableWidth = Math.max(gridWidth - HOUR_LABEL_WIDTH - 8, 0)
  const columnWidth = usableWidth / layout.columnCount
  const left = HOUR_LABEL_WIDTH + layout.column * columnWidth
  // v1.13.0 任务卡片视觉：左侧 5px 强调条使用任务强调色（barColor 或主题色）实色填充，
  // 卡片主体改为该强调色与透明色的混合（浅色调），提升同屏多任务的可读性
  const accent = task.barColor || 'var(--gantt-primary)'
  const opacityPercent = Math.round(Math.min(Math.max(props.taskCardOpacity, 0), 1) * 100)
  return {
    top: `${top}px`,
    height: `${height}px`,
    left: `${left}px`,
    width: `${Math.max(columnWidth - 2, 0)}px`,
    borderLeftWidth: `${props.taskAccentWidth}px`,
    borderLeftColor: accent,
    backgroundColor: `color-mix(in srgb, ${accent} ${opacityPercent}%, transparent)`,
  }
}

// ------ 拖拽选区 ------

const resolveDraft = (event: MouseEvent): CalendarSelectionDraft | null => {
  const el = gridRef.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const offsetY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height)
  const totalMinutes = (offsetY / HOUR_HEIGHT) * 60
  const rawDate = new Date(props.date)
  rawDate.setHours(0, totalMinutes, 0, 0)
  const snapped = snapToMinuteStep(rawDate, props.selectionMinuteStep)

  // 拖拽起点固定为 mousedown 时刻，这里简化为：以当前指针位置为终点，起点由 selection 状态机内部通过首次 resolveDraft 结果记录
  return {
    startDate: dragStartDate.value ?? snapped,
    endDate: snapped,
    resourceId: props.resourceId,
    scale: 'day',
  }
}

const dragStartDate = ref<Date | null>(null)

const disabledRef = computed(() => props.disabled)

const selection = useCalendarSelection({
  disabled: disabledRef,
  resolveDraft,
  onBeforeSelect: props.onBeforeSelect,
  onSelectionComplete: range => emit('selection-complete', range),
  onSelectionCancel: reason => emit('selection-cancel', reason),
})

const handleMouseDown = (event: MouseEvent) => {
  if (props.disabled) return
  const el = gridRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const offsetY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height)
  const totalMinutes = (offsetY / HOUR_HEIGHT) * 60
  const rawDate = new Date(props.date)
  rawDate.setHours(0, totalMinutes, 0, 0)
  dragStartDate.value = snapToMinuteStep(rawDate, props.selectionMinuteStep)
  selection.handleMouseDown(event)
}

// ------ 任务卡片点击/拖拽移动（仅支持垂直方向改变时段，同日内移动） ------

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
    // 跨天任务在当日仅展示起始日/结束日的局部片段，不支持在单日网格内直接拖拽改时段
    if (!isSameDay(start, end)) return
    const durationMs = end.getTime() - start.getTime()
    const deltaMinutesRaw = (delta.deltaY / HOUR_HEIGHT) * 60
    const snappedDelta =
      Math.round(deltaMinutesRaw / props.selectionMinuteStep) * props.selectionMinuteStep
    if (snappedDelta === 0) return

    const dayStart = new Date(props.date)
    dayStart.setHours(0, 0, 0, 0)
    const maxStartMinutes = 24 * 60 - durationMs / 60000
    const originalStartMinutes = start.getHours() * 60 + start.getMinutes()
    const newStartMinutes = Math.max(
      0,
      Math.min(originalStartMinutes + snappedDelta, maxStartMinutes)
    )
    if (newStartMinutes === originalStartMinutes) return

    const newStart = new Date(dayStart)
    newStart.setMinutes(newStartMinutes)
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

const HOUR_LABEL_WIDTH = 64 // 与 .gantt-calendar-hour-label 宽度(60px)+间距保持一致

const selectionRect = computed(() => {
  const draft = selection.draft.value
  if (!draft || (!selection.isDragging.value && !selection.isConfirmed.value)) return null
  const startMinutes = draft.startDate.getHours() * 60 + draft.startDate.getMinutes()
  const endMinutes = draft.endDate.getHours() * 60 + draft.endDate.getMinutes()
  const top = (Math.min(startMinutes, endMinutes) / 60) * HOUR_HEIGHT
  const height = (Math.abs(endMinutes - startMinutes) / 60) * HOUR_HEIGHT || 4
  const gridWidth = gridRef.value?.clientWidth ?? 0
  const width = Math.max(gridWidth - HOUR_LABEL_WIDTH - 8, 0)
  return { top, left: HOUR_LABEL_WIDTH, width, height }
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

const selectionWidth = computed(() => {
  const gridWidth = gridRef.value?.clientWidth ?? 0
  return Math.max(gridWidth - HOUR_LABEL_WIDTH - 8, 0)
})

defineExpose({ clearSelection: () => selection.clear() })
</script>

<style scoped>
.gantt-calendar-day-view {
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

.gantt-calendar-day-view::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.gantt-calendar-day-view::-webkit-scrollbar-track {
  background: transparent;
}

.gantt-calendar-day-view::-webkit-scrollbar-thumb {
  background-color: var(--gantt-scrollbar-thumb);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.gantt-calendar-day-view::-webkit-scrollbar-thumb:hover {
  background-color: var(--gantt-scrollbar-thumb-hover);
}

.gantt-calendar-day-view::-webkit-scrollbar-corner {
  background: transparent;
}

.gantt-calendar-allday-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--gantt-border-light);
  padding: 4px 8px;
  gap: 8px;
}

.gantt-calendar-allday-label {
  font-size: 12px;
  color: var(--gantt-text-muted);
  flex-shrink: 0;
}

.gantt-calendar-allday-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.gantt-calendar-task-chip {
  font-size: 12px;
  color: var(--gantt-text-white);
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.gantt-calendar-day-grid {
  position: relative;
  width: 100%;
  user-select: none;
}

.gantt-calendar-hour-row {
  display: flex;
  height: 48px;
  border-bottom: 1px solid var(--gantt-border-light);
  box-sizing: border-box;
}

.gantt-calendar-hour-label {
  width: 60px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--gantt-text-secondary);
  padding: 4px 8px;
  box-sizing: border-box;
  border-right: 1px solid var(--gantt-border-light);
}

.gantt-calendar-hour-cell {
  flex: 1;
  background-color: var(--gantt-bg-primary);
}

.gantt-calendar-hour-row.is-working-hour .gantt-calendar-hour-cell {
  background-color: var(--gantt-bg-primary);
}

.gantt-calendar-hour-row:not(.is-working-hour) .gantt-calendar-hour-cell {
  background-color: var(--gantt-bg-tertiary);
}

/* v1.13.0 任务卡片：淡蓝色半透明底 + 左侧 5px 深色强调条（默认蓝色，task.barColor 可覆盖），
   较原先纯色底提升同屏多任务时的可读性；具体颜色/透明度由 taskBlockStyle() 内联样式决定 */
.gantt-calendar-timed-task {
  position: absolute;
  border-radius: 4px;
  border-left: 5px solid var(--gantt-primary);
  background-color: color-mix(in srgb, var(--gantt-primary) 18%, transparent);
  color: var(--gantt-text-primary);
  font-size: 12px;
  padding: 2px 6px 2px 8px;
  overflow: hidden;
  z-index: var(--gantt-z-bar, 10);
  box-sizing: border-box;
  cursor: grab;
}

/* v1.13.0 任务卡片默认内容：标题（含时间段）+ 描述换行展示，均单行截断避免撑破卡片高度 */
.gantt-calendar-task-card-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.gantt-calendar-task-card-desc {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  color: var(--gantt-text-secondary);
  margin-top: 1px;
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

/* 当前时间指示线：仅在展示日期为今天时渲染，标注精确到分钟的当前时刻位置 */
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

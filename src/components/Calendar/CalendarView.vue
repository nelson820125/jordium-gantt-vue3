<template>
  <div class="gantt-calendar-view" :class="{ 'is-disabled': disabled }">
    <div class="gantt-calendar-toolbar">
      <div class="gantt-calendar-nav">
        <button type="button" class="gantt-calendar-nav-btn" :title="prevLabel" @click="goToPrev">
          ‹
        </button>
        <button type="button" class="gantt-calendar-today-btn" @click="goToToday">今天</button>
        <button type="button" class="gantt-calendar-nav-btn" :title="nextLabel" @click="goToNext">
          ›
        </button>

        <slot name="date-picker" :date="currentDateInternal" :on-change="handleDatePickerChange">
          <div class="gantt-calendar-date-picker-wrapper" :title="currentLabel">
            <DatePicker
              :model-value="currentDateStr"
              type="date"
              :clearable="false"
              @update:model-value="handleDatePickerChange"
            />
          </div>
        </slot>
      </div>

      <div class="gantt-calendar-controls">
        <select
          v-if="resources && resources.length"
          class="gantt-calendar-resource-select"
          :value="selectedResourceIdInternal ?? ''"
          @change="handleResourceSelectChange"
        >
          <option value="">全部资源</option>
          <option v-for="res in resources" :key="res.id" :value="res.id">{{ res.name }}</option>
        </select>
      </div>
    </div>

    <div class="gantt-calendar-body">
      <CalendarDayView
        v-if="scaleInternal === 'day'"
        ref="subViewRef"
        :date="currentDateInternal"
        :tasks="filteredTasks"
        :working-hours="workingHours"
        :resource-id="selectedResourceIdInternal ?? undefined"
        :selection-minute-step="selectionMinuteStep"
        :disabled="disabled"
        :all-day-label="allDayLabel"
        :task-card-opacity="taskCardOpacity"
        :task-accent-width="taskAccentWidth"
        :on-before-select="onBeforeSelect"
        @selection-complete="handleSelectionComplete"
        @selection-cancel="handleSelectionCancel"
        @task-click="handleTaskClick"
        @task-move="handleTaskMove"
      >
        <template v-if="$slots['task-card']" #task-card="slotProps">
          <slot name="task-card" v-bind="slotProps" />
        </template>
      </CalendarDayView>
      <CalendarWeekView
        v-else-if="scaleInternal === 'week'"
        ref="subViewRef"
        :anchor-date="currentDateInternal"
        :tasks="filteredTasks"
        :working-hours="workingHours"
        :resource-id="selectedResourceIdInternal ?? undefined"
        :selection-minute-step="selectionMinuteStep"
        :disabled="disabled"
        :all-day-label="allDayLabel"
        :task-card-opacity="taskCardOpacity"
        :task-accent-width="taskAccentWidth"
        @selection-complete="handleSelectionComplete"
        @selection-cancel="handleSelectionCancel"
        @task-click="handleTaskClick"
        @task-move="handleTaskMove"
      >
        <template v-if="$slots['task-card']" #task-card="slotProps">
          <slot name="task-card" v-bind="slotProps" />
        </template>
      </CalendarWeekView>
      <CalendarMonthView
        v-else
        ref="subViewRef"
        :anchor-date="currentDateInternal"
        :tasks="filteredTasks"
        :resource-id="selectedResourceIdInternal ?? undefined"
        :disabled="disabled"
        @selection-complete="handleSelectionComplete"
        @selection-cancel="handleSelectionCancel"
        @task-click="handleTaskClick"
        @task-move="handleTaskMove"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * CalendarView - Outlook 风格日历视图容器（v1.12.5 新增）
 * 独立顶层组件：仅依赖自身 props（tasks/resources），不依赖 GanttChart 的 provide/inject 机制，
 * 可脱离 GanttChart 单独 import 挂载使用。
 */
import { computed, ref, watch } from 'vue'
import CalendarDayView from './CalendarDayView.vue'
import CalendarWeekView from './CalendarWeekView.vue'
import CalendarMonthView from './CalendarMonthView.vue'
import DatePicker from '../DatePicker.vue'
import type {
  WorkingHoursConfig,
  CalendarScale,
  CalendarSelectionDraft,
  CalendarSelectionRange,
  CalendarTaskMovePayload,
} from '../../models/types/CalendarTypes'
import type { Task } from '../../models/classes/Task'
import type { Resource } from '../../models/classes/Resource'

interface Props {
  tasks: Task[]
  resources?: Resource[]
  scale?: CalendarScale
  defaultScale?: CalendarScale
  currentDate?: Date | string
  selectedResourceId?: string | number | null
  workingHours?: WorkingHoursConfig
  selectionMinuteStep?: number
  disabled?: boolean
  locale?: 'zh-CN' | 'en-US'
  onBeforeSelect?: (range: CalendarSelectionDraft) => boolean | Promise<boolean>
  onBeforeResourceChange?: (
    nextId: string | number | null,
    prevId: string | number | null
  ) => boolean | Promise<boolean>
  onBeforeViewChange?: (next: CalendarScale, prev: CalendarScale) => boolean | Promise<boolean>
  onSelectionComplete?: (range: CalendarSelectionRange) => void
  onResourceChange?: (nextId: string | number | null, prevId: string | number | null) => void
  /** v1.13.0 点击已创建任务卡片时触发 */
  onTaskClick?: (task: Task, event: MouseEvent) => void
  /** v1.13.0 拖拽任务卡片松开后触发 */
  onTaskMove?: (payload: CalendarTaskMovePayload) => void
  /** v1.13.0 日/周视图全天任务行的标签文字 */
  allDayLabel?: string
  /** v1.13.0 日/周视图任务卡片底色透明度（0-1） */
  taskCardOpacity?: number
  /** v1.13.0 日/周视图任务卡片左侧强调条宽度（px） */
  taskAccentWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  resources: () => [],
  defaultScale: 'day',
  selectionMinuteStep: 15,
  disabled: false,
  locale: 'zh-CN',
  workingHours: () => ({
    morning: { start: 8, end: 11 },
    afternoon: { start: 13, end: 17 },
  }),
  allDayLabel: '全天',
  taskCardOpacity: 0.18,
  taskAccentWidth: 5,
})

const emit = defineEmits<{
  'selection-complete': [range: CalendarSelectionRange]
  'selection-cancel': [payload: { reason: 'before-hook-rejected' | 'user-cancelled' }]
  'resource-change': [payload: { next: string | number | null; prev: string | number | null }]
  'view-change': [payload: { next: CalendarScale; prev: CalendarScale }]
  'date-change': [payload: { next: Date; prev: Date }]
  'task-click': [task: Task, event: MouseEvent]
  'task-move': [payload: CalendarTaskMovePayload]
}>()

// 上一页/下一页按钮的 title 提示，随当前刻度变化（日/周/月）
const prevLabel = computed(() => {
  if (scaleInternal.value === 'day') return '上一天'
  if (scaleInternal.value === 'week') return '上一周'
  return '上一月'
})
const nextLabel = computed(() => {
  if (scaleInternal.value === 'day') return '下一天'
  if (scaleInternal.value === 'week') return '下一周'
  return '下一月'
})

// ------ 受控/非受控刻度 ------
const uncontrolledScale = ref<CalendarScale>(props.defaultScale)
const scaleInternal = computed(() => props.scale ?? uncontrolledScale.value)

// ------ 受控/非受控日期指针 ------
const toDate = (value?: Date | string): Date => {
  if (!value) return new Date()
  return value instanceof Date ? value : new Date(value)
}
const uncontrolledDate = ref<Date>(toDate(props.currentDate))
const currentDateInternal = computed(() =>
  props.currentDate ? toDate(props.currentDate) : uncontrolledDate.value
)

watch(
  () => props.currentDate,
  next => {
    if (next) uncontrolledDate.value = toDate(next)
  }
)

// ------ 受控/非受控资源筛选 ------
const uncontrolledResourceId = ref<string | number | null>(props.selectedResourceId ?? null)
const selectedResourceIdInternal = computed(() =>
  props.selectedResourceId !== undefined ? props.selectedResourceId : uncontrolledResourceId.value
)

/**
 * 日历视图强依赖"资源"维度：未选择具体资源时不加载/展示任何任务（含全天任务），
 * 避免所有资源的任务混杂展示在同一日期格子里造成误解；仅当选中某个资源后，
 * 才加载该资源名下的任务到日历网格上。
 */
const filteredTasks = computed(() => {
  const resId = selectedResourceIdInternal.value
  if (resId === null || resId === undefined || resId === '') return []
  return props.tasks.filter(task => task.resources?.some(r => r.id === resId))
})

const currentLabel = computed(() => {
  const d = currentDateInternal.value
  if (scaleInternal.value === 'month') return `${d.getFullYear()}年${d.getMonth() + 1}月`
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
})

// 供默认 DatePicker 使用的 YYYY-MM-DD 字符串
const currentDateStr = computed(() => {
  const d = currentDateInternal.value
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const subViewRef = ref<{ clearSelection: () => void } | null>(null)

// ------ 导航 ------
const setCurrentDate = (next: Date) => {
  const prev = currentDateInternal.value
  if (props.currentDate === undefined) {
    uncontrolledDate.value = next
  }
  emit('date-change', { next, prev })
}

const goToToday = () => setCurrentDate(new Date())
const goToDate = (date: Date | string) => setCurrentDate(toDate(date))

/** DatePicker 选择新日期后的回调，供默认 DatePicker 与自定义 #date-picker 插槽共用 */
const handleDatePickerChange = (value: string | [string, string]) => {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return
  goToDate(raw)
}

const goToPrev = () => {
  const d = new Date(currentDateInternal.value)
  if (scaleInternal.value === 'day') d.setDate(d.getDate() - 1)
  else if (scaleInternal.value === 'week') d.setDate(d.getDate() - 7)
  else d.setMonth(d.getMonth() - 1)
  setCurrentDate(d)
}

const goToNext = () => {
  const d = new Date(currentDateInternal.value)
  if (scaleInternal.value === 'day') d.setDate(d.getDate() + 1)
  else if (scaleInternal.value === 'week') d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  setCurrentDate(d)
}

// ------ 刻度切换（含前置钩子） ------
const applyScaleChange = (next: CalendarScale) => {
  const prev = scaleInternal.value
  if (props.scale === undefined) {
    uncontrolledScale.value = next
  }
  emit('view-change', { next, prev })
}

const handleScaleChange = async (next: CalendarScale) => {
  const prev = scaleInternal.value
  if (next === prev || props.disabled) return
  if (props.onBeforeViewChange) {
    const allowed = await props.onBeforeViewChange(next, prev)
    if (!allowed) return
  }
  applyScaleChange(next)
}

const setScale = (scale: CalendarScale) => {
  void handleScaleChange(scale)
}

// ------ 资源筛选切换（含前置钩子） ------
const handleResourceSelectChange = async (event: Event) => {
  const raw = (event.target as HTMLSelectElement).value
  const next: string | number | null = raw === '' ? null : raw
  const prev = selectedResourceIdInternal.value

  if (props.onBeforeResourceChange) {
    const allowed = await props.onBeforeResourceChange(next, prev)
    if (!allowed) {
      ;(event.target as HTMLSelectElement).value = String(prev ?? '')
      return
    }
  }

  if (props.selectedResourceId === undefined) {
    uncontrolledResourceId.value = next
  }
  props.onResourceChange?.(next, prev)
  emit('resource-change', { next, prev })
}

// ------ 选区结果转发 ------
const handleSelectionComplete = (range: CalendarSelectionRange) => {
  props.onSelectionComplete?.(range)
  emit('selection-complete', range)
}

const handleSelectionCancel = (reason: 'before-hook-rejected' | 'user-cancelled') => {
  emit('selection-cancel', { reason })
}

// ------ 任务点击/拖拽结果转发 ------
const handleTaskClick = (task: Task, event: MouseEvent) => {
  props.onTaskClick?.(task, event)
  emit('task-click', task, event)
}

const handleTaskMove = (payload: CalendarTaskMovePayload) => {
  props.onTaskMove?.(payload)
  emit('task-move', payload)
}

const clearSelection = () => {
  subViewRef.value?.clearSelection()
}

defineExpose({ goToToday, goToDate, clearSelection, setScale })
</script>

<style scoped>
.gantt-calendar-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: var(--gantt-bg-primary);
  color: var(--gantt-text-primary);
}

.gantt-calendar-view.is-disabled {
  opacity: 0.7;
  pointer-events: none;
}

.gantt-calendar-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--gantt-border-medium);
  background-color: var(--gantt-bg-toolbar);
  flex-shrink: 0;
}

.gantt-calendar-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gantt-calendar-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--gantt-border-medium, #dcdfe6);
  background-color: var(--gantt-bg-primary, #ffffff);
  color: var(--gantt-text-primary, #606266);
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
}

.gantt-calendar-today-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--gantt-border-medium, #dcdfe6);
  background-color: var(--gantt-bg-primary, #ffffff);
  color: var(--gantt-text-primary, #606266);
  border-radius: 4px;
  padding: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
}

.gantt-calendar-nav-btn:hover,
.gantt-calendar-today-btn:hover {
  background-color: var(--gantt-bg-hover);
}

.gantt-calendar-date-picker-wrapper {
  width: 140px;
}

.gantt-calendar-date-picker-wrapper :deep(.el-input) {
  height: 36px;
}

.gantt-calendar-date-picker-wrapper :deep(.el-input__wrapper) {
  border-radius: 4px;
}

.gantt-calendar-date-picker-wrapper :deep(.el-input__inner-input) {
  font-size: 14px;
  font-weight: 500;
}

.gantt-calendar-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.gantt-calendar-resource-select {
  border: 1px solid var(--gantt-border-medium, #dcdfe6);
  background-color: var(--gantt-bg-primary, #ffffff);
  color: var(--gantt-text-primary, #606266);
  border-radius: 4px;
  padding: 8px;
  font-size: 14px;
  font-weight: 500;
  height: 36px;
  box-sizing: border-box;
}

.gantt-calendar-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
</style>

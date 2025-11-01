/* eslint-disable @typescript-eslint/no-explicit-any */
<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted, nextTick, watch, useSlots } from 'vue'
import type { Task } from '../models/classes/Task'
import { TimelineScale } from '../models/types/TimelineScale'
import TaskContextMenu from './TaskContextMenu.vue'

import { useI18n } from '../composables/useI18n'
import type { TaskBarConfig } from '../models/configs/TaskBarConfig'
import { DEFAULT_TASK_BAR_CONFIG } from '../models/configs/TaskBarConfig'

interface Props {
  task: Task
  rowHeight: number
  dayWidth: number
  startDate: Date
  isParent?: boolean
  onClick?: (task: Task, event: MouseEvent) => void
  // 新增：用于粘性文字显示的滚动位置信息
  scrollLeft?: number
  containerWidth?: number
  // 新增：外部控制半圆隐藏状态（用于Timeline初始化等场景）
  hideBubbles?: boolean
  // 新增：时间线数据，用于精确计算subDays定位
  timelineData?: any
  // 新增：当前时间刻度
  currentTimeScale?: TimelineScale
  // TaskBar 配置
  taskBarConfig?: TaskBarConfig
  // 是否允许拖拽和拉伸（默认为 true）
  allowDragAndResize?: boolean
  // 是否被高亮显示（前置或后置任务）
  isHighlighted?: boolean
  // 是否是主要高亮（被长按的任务）
  isPrimaryHighlight?: boolean
  // 是否处于高亮模式（有任务被高亮）
  isInHighlightMode?: boolean
}

interface TaskStatus {
  type: string
  color: string
  bgColor: string
  borderColor: string
}

interface TaskBarSlotProps {
  type: string
  task: Task
  status: TaskStatus
  statusType: string
  isParent?: boolean
  progress: number
  currentTimeScale?: TimelineScale
  rowHeight: number
  dayWidth: number
}

const props = defineProps<Props>()

const emit = defineEmits([
  'update:task',
  'bar-mounted',
  'click',
  'dblclick',
  'drag-end',
  'resize-end',
  'scroll-to-position',
  'start-timer',
  'stop-timer',
  'add-predecessor',
  'add-successor',
  'delete',
  'context-menu',
  'long-press',
])

defineSlots<{
  'custom-task-content'(props: TaskBarSlotProps): unknown
}>()

const slots = useSlots()
const { getTranslation } = useI18n()
const t = (key: string): string => {
  return getTranslation(key)
}

const hasContentSlot = computed(() => Boolean(slots['custom-task-content']))

// 合并默认配置和用户配置
const barConfig = computed(() => ({
  ...DEFAULT_TASK_BAR_CONFIG,
  ...props.taskBarConfig,
}))

// 日期工具函数 - 处理时区安全的日期创建和操作
const createLocalDate = (dateString: string | Date | undefined | null): Date | null => {
  if (!dateString) return null
  if (dateString instanceof Date) {
    return dateString
  }
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  // 支持带时间的日期字符串 (yyyy-mm-dd hh:mm)
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dateString)) {
    const [datePart, timePart] = dateString.split(' ')
    const [year, month, day] = datePart.split('-').map(Number)
    const [hour, minute] = timePart.split(':').map(Number)
    return new Date(year, month - 1, day, hour, minute)
  }
  const d = new Date(dateString)
  return isNaN(d.getTime()) ? null : d
}

const createLocalToday = (): Date => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const formatDateToLocalString = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  // 在小时视图中，格式化为包含时间的字符串
  if (props.currentTimeScale === TimelineScale.HOUR) {
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }

  return `${year}-${month}-${day}`
}

const addDaysToLocalDate = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// 新增：小时视图下的时间计算工具函数
const addMinutesToDate = (date: Date, minutes: number): Date => {
  const result = new Date(date)
  result.setMinutes(result.getMinutes() + minutes)
  return result
}

// 新增：计算两个日期之间的分钟差
const getMinutesDiff = (startDate: Date, endDate: Date): number => {
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))
}

// 计算是否应该禁用拖拽和调整大小（年度视图下禁用或任务不可编辑时禁用）
const isInteractionDisabled = computed(() => {
  // 检查任务的 isEditable 属性
  if (props.task.isEditable === false) {
    return true
  }
  // 年度视图下禁用
  return props.currentTimeScale === TimelineScale.YEAR
})

// 拖拽状态
const isDragging = ref(false)
const isResizingLeft = ref(false)
const isResizingRight = ref(false)
const justFinishedDragOrResize = ref(false) // 标记刚刚完成拖拽或调整大小
const dragStartX = ref(0)
const dragStartLeft = ref(0)
const dragStartWidth = ref(0)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)
const resizeStartLeft = ref(0)

// 长按检测状态
const longPressTimer = ref<number | null>(null)
const longPressTriggered = ref(false)
const LONG_PRESS_DURATION = 1000 // 1秒（缩短了）

// 防误触配置 - 使用配置项或默认值
const dragThreshold = computed(() => barConfig.value.dragThreshold ?? 5)
const isDragThresholdMet = ref(false) // 是否达到拖拽阈值
const dragType = ref<'drag' | 'resize-left' | 'resize-right' | null>(null) // 记录操作类型
const dragDelayTimer = ref<number | null>(null) // 延迟拖拽定时器
const isDelayPassed = ref(false) // 延迟是否已过

// 相对位置拖拽方案：记录鼠标相对于TaskBar的位置
const mouseOffsetX = ref(0) // 鼠标在TaskBar内的相对位置

// 缓存拖拽/拉伸过程中的临时数据，只在鼠标抬起时提交更新
const tempTaskData = ref<{
  startDate?: string
  endDate?: string
} | null>(null)

// 季度视图拖拽时的位置覆盖（直接使用像素位置）
const quarterDragOverride = ref<{
  left?: number
  width?: number
} | null>(null)

const barRef = ref<HTMLElement | null>(null)

const taskBarNameRef = ref<HTMLElement | null>(null)
const nameTextWidth = ref(0)

// 计算任务条位置和宽度
const taskBarStyle = computed(() => {
  // 季度视图拖拽时使用位置覆盖
  if (quarterDragOverride.value && props.currentTimeScale === TimelineScale.QUARTER) {
    return {
      left: `${quarterDragOverride.value.left ?? 0}px`,
      width: `${quarterDragOverride.value.width ?? 100}px`,
      height: `${props.rowHeight - 10}px`,
      top: '4px',
    }
  }

  const currentStartDate = tempTaskData.value?.startDate || props.task.startDate
  const currentEndDate = tempTaskData.value?.endDate || props.task.endDate

  const startDate = createLocalDate(currentStartDate)
  const endDate = createLocalDate(currentEndDate)
  const baseStart = createLocalDate(props.startDate)
  if (!startDate || !endDate || !baseStart) {
    return {
      left: '0px',
      width: '0px',
      height: `${props.rowHeight - 10}px`,
      top: '4px',
    }
  }

  let left = 0
  let width = 0

  // 小时视图：按分钟精确计算位置（需要考虑时间部分）
  if (props.currentTimeScale === TimelineScale.HOUR) {
    // 确保 baseStart 是当天的 00:00:00
    const baseStartOfDay = new Date(baseStart)
    baseStartOfDay.setHours(0, 0, 0, 0)

    // 处理没有时间部分的日期字符串
    let adjustedStartDate = startDate
    let adjustedEndDate = endDate

    // 检查原始日期字符串是否包含时间部分
    const originalStartStr = currentStartDate || props.task.startDate
    const originalEndStr = currentEndDate || props.task.endDate

    // 如果startDate没有时间部分（格式为YYYY-MM-DD），设置为当日00:00
    if (
      typeof originalStartStr === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(originalStartStr.trim())
    ) {
      adjustedStartDate = new Date(startDate)
      adjustedStartDate.setHours(0, 0, 0, 0)
    }

    // 如果endDate没有时间部分（格式为YYYY-MM-DD），设置为次日00:00
    if (typeof originalEndStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(originalEndStr.trim())) {
      adjustedEndDate = new Date(endDate)
      adjustedEndDate.setDate(adjustedEndDate.getDate() + 1)
      adjustedEndDate.setHours(0, 0, 0, 0)
    }

    // 计算从当天00:00到任务开始和结束的分钟数
    const startMinutes = getMinutesDiff(baseStartOfDay, adjustedStartDate)
    const endMinutes = getMinutesDiff(baseStartOfDay, adjustedEndDate)

    // 每小时40px，每分钟40/60 = 2/3 px
    const pixelPerMinute = 40 / 60

    left = Math.max(0, startMinutes * pixelPerMinute)
    width = Math.max(4, (endMinutes - startMinutes) * pixelPerMinute) // 确保最小4px宽度
  } else {
    // 日视图、周视图、月视图、年视图：只考虑日期部分，忽略时间部分

    // 将日期标准化为当天的00:00:00，忽略时间部分
    const startDateOnly = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
    )
    const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
    const baseStartOnly = new Date(
      baseStart.getFullYear(),
      baseStart.getMonth(),
      baseStart.getDate(),
    )

    if (
      props.timelineData &&
      props.currentTimeScale &&
      (props.currentTimeScale === TimelineScale.WEEK ||
        props.currentTimeScale === TimelineScale.MONTH ||
        props.currentTimeScale === TimelineScale.QUARTER ||
        props.currentTimeScale === TimelineScale.YEAR)
    ) {
      // 优先使用基于timelineData的精确定位（适用于周视图、月视图、季度视图和年度视图）
      // 计算开始位置
      const startPosition = calculatePositionFromTimelineData(
        startDateOnly,
        props.timelineData,
        props.currentTimeScale,
      )
      // 计算结束位置：为结束日期添加一天来获取正确的结束位置
      const nextDay = new Date(endDateOnly)
      nextDay.setDate(nextDay.getDate() + 1)
      let endPosition = calculatePositionFromTimelineData(
        nextDay,
        props.timelineData,
        props.currentTimeScale,
      )

      // 如果结束日期+1天超出范围，使用结束日期的位置+一天的宽度
      if (endPosition === startPosition) {
        let dayWidth = 60 / 30 // 默认月视图
        if (props.currentTimeScale === TimelineScale.WEEK) {
          dayWidth = 60 / 7
        } else if (props.currentTimeScale === TimelineScale.QUARTER) {
          dayWidth = 60 / 90 // 季度视图：每季度60px，约90天
        } else if (props.currentTimeScale === TimelineScale.YEAR) {
          dayWidth = 180 / 182 // 年度视图：每半年180px，约182天
        }
        endPosition =
          calculatePositionFromTimelineData(
            endDateOnly,
            props.timelineData,
            props.currentTimeScale,
          ) + dayWidth
      }

      left = startPosition
      width = Math.max(endPosition - startPosition, 4) // 确保最小4px宽度
    } else if (
      props.timelineData &&
      props.currentTimeScale === TimelineScale.DAY
    ) {
      // 日视图：使用 timelineData 精确定位
      const startPosition = calculatePositionFromTimelineData(
        startDateOnly,
        props.timelineData,
        props.currentTimeScale,
      )

      // 计算结束位置：为结束日期添加一天来获取正确的结束位置
      const nextDay = new Date(endDateOnly)
      nextDay.setDate(nextDay.getDate() + 1)
      let endPosition = calculatePositionFromTimelineData(
        nextDay,
        props.timelineData,
        props.currentTimeScale,
      )

      // 如果结束日期+1天超出范围，使用结束日期的位置+一天的宽度
      if (endPosition === startPosition) {
        endPosition = calculatePositionFromTimelineData(
          endDateOnly,
          props.timelineData,
          props.currentTimeScale,
        ) + 30 // 日视图每天30px
      }

      left = startPosition
      width = Math.max(endPosition - startPosition, 4) // 确保最小4px宽度
    } else {
      // 其他情况（没有 timelineData）：基于日期的简单计算
      const startDiff = Math.floor(
        (startDateOnly.getTime() - baseStartOnly.getTime()) / (1000 * 60 * 60 * 24),
      )

      // 计算持续天数（基于日期，忽略时间）
      const timeDiffMs = endDateOnly.getTime() - startDateOnly.getTime()
      const daysDiff = Math.round(timeDiffMs / (1000 * 60 * 60 * 24))

      // 如果开始和结束是同一天，duration = 1；否则是实际天数差 + 1（包含结束日期）
      const duration = daysDiff === 0 ? 1 : daysDiff + 1

      left = startDiff * props.dayWidth
      width = duration * props.dayWidth
    }
  }

  return {
    left: `${left}px`,
    width: `${width}px`,
    height: `${props.rowHeight - 10}px`,
    top: '4px',
  }
})

// 计算任务状态和颜色
const taskStatus = computed(() => {
  // 父级任务(Story类型)使用与新建按钮一致的配色
  if (props.isParent) {
    return {
      type: 'parent',
      color: '#409eff', // 与新建按钮一致的蓝色
      bgColor: '#409eff',
      borderColor: '#409eff',
    }
  }

  const today = createLocalToday()
  const endDate = createLocalDate(props.task.endDate || '')
  const progress = props.task.progress || 0

  // 已完成
  if (progress >= 100) {
    return {
      type: 'completed',
      color: '#909399', // info color
      bgColor: '#f4f4f5',
      borderColor: '#d3d4d6',
    }
  }

  // 已延迟（结束日期早于今天且未完成）
  if (endDate && endDate < today && progress < 100) {
    return {
      type: 'delayed',
      color: '#f56c6c', // danger color
      bgColor: '#fef0f0',
      borderColor: '#fbc4c4',
    }
  }

  // 进行中（结束日期晚于今天且进度>0）
  if (endDate && endDate >= today && progress > 0) {
    return {
      type: 'in-progress',
      color: '#e6a23c', // warning color
      bgColor: '#fdf6ec',
      borderColor: '#f5dab1',
    }
  }

  // 未开始（进度为0且未延迟）
  return {
    type: 'not-started',
    color: '#409eff', // primary color
    bgColor: '#ecf5ff',
    borderColor: '#b3d8ff',
  }
})

// Slot payload for content slot - 使用 v-bind 方式传递所有属性
const slotPayload = computed(() => ({
  type: 'task-bar',
  task: props.task,
  status: taskStatus.value,
  statusType: taskStatus.value.type,
  isParent: props.isParent ?? false,
  progress: props.task.progress || 0,
  currentTimeScale: props.currentTimeScale,
  rowHeight: props.rowHeight,
  dayWidth: props.dayWidth,
}))

// 判断是否已完成
const isCompleted = computed(() => (props.task.progress || 0) >= 100)

// 判断是否应该显示为暗淡（处于高亮模式但自己不是高亮的）
const isDimmed = computed(() => {
  return props.isInHighlightMode && !props.isHighlighted && !props.isPrimaryHighlight
})

// 计算完成部分的宽度
const progressWidth = computed(() => {
  const progress = props.task.progress || 0
  const totalWidth = parseInt(taskBarStyle.value.width)
  return `${(progress / 100) * totalWidth}px`
})

// 判断是否为周视图（dayWidth小于等于9为周视图）
const isWeekView = computed(() => props.dayWidth <= 9)

// 判断是否为短TaskBar（宽度小于80px）
const isShortTaskBar = computed(() => {
  const width = parseFloat(taskBarStyle.value.width || '0')
  return width < 80
})

// 判断是否需要溢出效果（周视图且短TaskBar）
const needsOverflowEffect = computed(() => isWeekView.value && isShortTaskBar.value)

// 鼠标事件处理 - 使用相对位置拖拽方案（带防误触机制）
const handleMouseDown = (e: MouseEvent, type: 'drag' | 'resize-left' | 'resize-right') => {
  // 如果处于高亮状态，不阻止事件传播，让Timeline可以滚动
  if (props.isHighlighted || props.isPrimaryHighlight) {
    // 不调用 e.preventDefault() 和 e.stopPropagation()
    // 让事件继续传播到父容器，从而触发 Timeline 的滚动
    return
  }

  // 如果禁用了拖拽和拉伸，直接返回
  if (props.allowDragAndResize === false) {
    return
  }

  // 如果已完成或是父级任务或年度视图，禁用所有交互
  if (isCompleted.value || props.isParent || isInteractionDisabled.value) {
    return
  }

  e.preventDefault()
  e.stopPropagation()

  // 清空之前的临时数据
  tempTaskData.value = null

  // 重置防误触状态
  isDragThresholdMet.value = false
  isDelayPassed.value = false
  dragType.value = type

  // 重置长按状态
  longPressTriggered.value = false
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  // 启动长按检测定时器（仅在拖拽模式下）
  if (type === 'drag') {
    longPressTimer.value = window.setTimeout(() => {
      // 检查是否发生了拖拽或拉伸（通过检查是否达到拖拽阈值）
      const noDragOrResize =
        !isDragThresholdMet.value &&
        !isDragging.value &&
        !isResizingLeft.value &&
        !isResizingRight.value
      if (noDragOrResize) {
        longPressTriggered.value = true
        emit('long-press', props.task.id)
      }
      longPressTimer.value = null
    }, LONG_PRESS_DURATION)
  }

  // 如果启用了拖拽延迟，设置定时器
  if (barConfig.value.enableDragDelay && barConfig.value.dragDelayTime) {
    dragDelayTimer.value = window.setTimeout(() => {
      isDelayPassed.value = true
      dragDelayTimer.value = null
    }, barConfig.value.dragDelayTime)
  } else {
    // 未启用延迟，立即标记为已过延迟
    isDelayPassed.value = true
  }

  // 获取TaskBar相对于Timeline容器的位置
  const timelineContainer = document.querySelector('.timeline') as HTMLElement
  if (!timelineContainer || !barRef.value) return

  const barRect = barRef.value.getBoundingClientRect()

  // 计算鼠标相对于TaskBar的位置
  mouseOffsetX.value = e.clientX - barRect.left

  // 记录初始状态，但不立即激活拖拽
  dragStartX.value = e.clientX
  dragStartLeft.value = parseInt(taskBarStyle.value.left)
  dragStartWidth.value = parseInt(taskBarStyle.value.width)

  if (type === 'resize-left') {
    resizeStartX.value = e.clientX
    resizeStartWidth.value = parseInt(taskBarStyle.value.width)
    resizeStartLeft.value = parseInt(taskBarStyle.value.left)
  } else if (type === 'resize-right') {
    resizeStartX.value = e.clientX
    resizeStartWidth.value = parseInt(taskBarStyle.value.width)
    resizeStartLeft.value = parseInt(taskBarStyle.value.left)
  }

  // 监听自动滚动事件
  window.addEventListener('timeline-auto-scroll', handleAutoScroll as EventListener)

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// 处理自动滚动事件
const handleAutoScroll = (event: CustomEvent) => {
  const { scrollDelta } = event.detail

  // 当Timeline滚动时，调整鼠标起始位置以保持相对位置
  if (isDragging.value) {
    dragStartX.value -= scrollDelta
  } else if (isResizingLeft.value || isResizingRight.value) {
    resizeStartX.value -= scrollDelta
  }
}

function reportBarPosition() {
  if (barRef.value) {
    const rect = barRef.value.getBoundingClientRect()
    emit('bar-mounted', {
      id: props.task.id,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    })
  }
}

// 拖拽时的实时日期提示框状态
const dragTooltipVisible = ref(false)
const dragTooltipPosition = ref({ x: 0, y: 0 })
const dragTooltipContent = ref({ startDate: '', endDate: '' })

const handleMouseMove = (e: MouseEvent) => {
  // 如果处于高亮状态，立即返回，不执行任何拖拽/拉伸操作
  if (props.isHighlighted || props.isPrimaryHighlight) {
    return
  }

  // 检查延迟是否已过（如果启用了延迟）
  if (barConfig.value.enableDragDelay && !isDelayPassed.value) {
    return
  }

  // 检查是否达到拖拽阈值
  if (!isDragThresholdMet.value) {
    const deltaX = Math.abs(e.clientX - dragStartX.value)

    // 如果移动距离小于阈值，不执行任何操作
    if (deltaX < dragThreshold.value) {
      return
    }

    // 达到阈值，激活对应的拖拽/拉伸状态
    isDragThresholdMet.value = true
    if (dragType.value === 'drag') {
      isDragging.value = true
    } else if (dragType.value === 'resize-left') {
      isResizingLeft.value = true
    } else if (dragType.value === 'resize-right') {
      isResizingRight.value = true
    }
  }

  // 只有达到阈值后才执行边界检测和提示框显示
  if (!isDragThresholdMet.value) {
    return
  }

  // 发送边界检测事件给Timeline
  window.dispatchEvent(
    new CustomEvent('drag-boundary-check', {
      detail: {
        mouseX: e.clientX,
        isDragging: isDragging.value || isResizingLeft.value || isResizingRight.value,
      },
    }),
  )

  // 更新拖拽提示框位置
  if (isDragging.value || isResizingLeft.value || isResizingRight.value) {
    dragTooltipVisible.value = true
    dragTooltipPosition.value = {
      x: e.clientX + 15, // 鼠标右侧偏移
      y: e.clientY - 60, // 鼠标上方偏移
    }
  }

  if (isDragging.value) {
    const deltaX = e.clientX - dragStartX.value

    if (props.currentTimeScale === TimelineScale.HOUR) {
      // 小时视图：15分钟刻度对齐
      const pixelPerMinute = 40 / 60 // 每分钟的像素数
      const pixelPer15Minutes = pixelPerMinute * 15 // 15分钟的像素数

      // 计算新的左侧位置，对齐到15分钟刻度
      const newLeftRaw = Math.max(0, dragStartLeft.value + deltaX)
      const newLeft = Math.round(newLeftRaw / pixelPer15Minutes) * pixelPer15Minutes

      // 计算新的开始时间（分钟精度）
      const newStartMinutes = Math.round(newLeft / pixelPerMinute)
      // 确保使用当天的00:00:00作为基准
      const baseStartOfDay = new Date(props.startDate)
      baseStartOfDay.setHours(0, 0, 0, 0)
      const newStartDate = addMinutesToDate(baseStartOfDay, newStartMinutes)

      // 保持任务的持续时间（计算原始任务的时长）
      const originalStartDate = createLocalDate(props.task.startDate) || props.startDate
      const originalEndDate = createLocalDate(props.task.endDate) || props.startDate

      // 如果原始任务是日期格式，转换为当天的时间范围
      let originalDurationMinutes: number
      if (props.task.startDate && !props.task.startDate.includes(' ')) {
        // 纯日期格式，默认按天计算（一天 = 1440 分钟）
        const timeDiffMs = originalEndDate.getTime() - originalStartDate.getTime()
        const daysDiff = Math.max(1, Math.round(timeDiffMs / (1000 * 60 * 60 * 24)) + 1)
        originalDurationMinutes = daysDiff * 24 * 60 // 天数转分钟
      } else {
        // 包含时间格式，按实际时间差计算
        originalDurationMinutes = getMinutesDiff(originalStartDate, originalEndDate)
      }

      const newEndDate = addMinutesToDate(newStartDate, originalDurationMinutes)

      // 只更新临时数据，不触发事件
      tempTaskData.value = {
        startDate: formatDateToLocalString(newStartDate),
        endDate: formatDateToLocalString(newEndDate),
      }

      // 更新拖拽提示框内容
      dragTooltipContent.value = {
        startDate: formatDateToLocalString(newStartDate),
        endDate: formatDateToLocalString(newEndDate),
      }
    } else if (props.currentTimeScale === TimelineScale.QUARTER) {
      // 季度视图：直接使用像素位置，保持拖拽跟随鼠标
      const newLeft = Math.max(0, dragStartLeft.value + deltaX)

      // 更新位置覆盖
      quarterDragOverride.value = {
        left: newLeft,
        width: dragStartWidth.value,
      }

      // 同时计算日期用于提示框（使用与Timeline相同的季度视图计算）
      const quarterWidth = 60 // 与Timeline.vue保持一致
      const daysInQuarter = 90 // 季度平均天数
      const pixelsPerDay = quarterWidth / daysInQuarter // 约0.67px/天
      const dayOffset = Math.round(deltaX / pixelsPerDay)

      // 基于原始任务日期计算新日期
      const originalStartDate = createLocalDate(props.task.startDate) || props.startDate
      const originalEndDate = createLocalDate(props.task.endDate) || props.startDate

      const newStartDate = new Date(originalStartDate)
      newStartDate.setDate(newStartDate.getDate() + dayOffset)

      // 计算任务持续天数
      const durationMs = originalEndDate.getTime() - originalStartDate.getTime()
      const duration = Math.ceil(durationMs / (1000 * 60 * 60 * 24))
      const newEndDate = new Date(newStartDate)
      newEndDate.setDate(newEndDate.getDate() + Math.max(0, duration))

      // 只更新临时数据，不触发事件
      tempTaskData.value = {
        startDate: formatDateToLocalString(newStartDate),
        endDate: formatDateToLocalString(newEndDate),
      }

      // 更新拖拽提示框内容
      dragTooltipContent.value = {
        startDate: formatDateToLocalString(newStartDate),
        endDate: formatDateToLocalString(newEndDate),
      }
    } else {
      // 其他视图（包括日视图、周视图、月视图、季度视图、年度视图）：保持原有逻辑
      const newLeft = Math.max(0, dragStartLeft.value + deltaX)

      // 日视图、月视图、季度视图或年度视图：如果有 timelineData，使用精确计算
      if (
        (props.currentTimeScale === TimelineScale.DAY ||
          props.currentTimeScale === TimelineScale.MONTH ||
          props.currentTimeScale === TimelineScale.QUARTER ||
          props.currentTimeScale === TimelineScale.YEAR) &&
        props.timelineData
      ) {
        const newStartDate = calculateDateFromPosition(
          newLeft,
          props.timelineData,
          props.currentTimeScale,
        )

        if (newStartDate) {
          // 计算任务持续天数
          const originalStartDate = createLocalDate(props.task.startDate) || props.startDate
          const originalEndDate = createLocalDate(props.task.endDate) || props.startDate
          const durationMs = originalEndDate.getTime() - originalStartDate.getTime()
          const duration = Math.ceil(durationMs / (1000 * 60 * 60 * 24))

          const newEndDate = new Date(newStartDate)
          newEndDate.setDate(newEndDate.getDate() + Math.max(0, duration))

          // 只更新临时数据，不触发事件
          tempTaskData.value = {
            startDate: formatDateToLocalString(newStartDate),
            endDate: formatDateToLocalString(newEndDate),
          }

          // 更新拖拽提示框内容
          dragTooltipContent.value = {
            startDate: formatDateToLocalString(newStartDate),
            endDate: formatDateToLocalString(newEndDate),
          }
        }
      } else {
        // 其他情况：使用原有的简单计算
        const newStartDate = addDaysToLocalDate(props.startDate, newLeft / props.dayWidth)
        const duration = dragStartWidth.value / props.dayWidth
        const newEndDate = addDaysToLocalDate(newStartDate, duration - 1)

        // 只更新临时数据，不触发事件
        tempTaskData.value = {
          startDate: formatDateToLocalString(newStartDate),
          endDate: formatDateToLocalString(newEndDate),
        }

        // 更新拖拽提示框内容
        dragTooltipContent.value = {
          startDate: formatDateToLocalString(newStartDate),
          endDate: formatDateToLocalString(newEndDate),
        }
      }
    }
  } else if (isResizingLeft.value) {
    const deltaX = e.clientX - resizeStartX.value

    if (props.currentTimeScale === TimelineScale.HOUR) {
      // 小时视图：15分钟刻度对齐
      const pixelPerMinute = 40 / 60
      const pixelPer15Minutes = pixelPerMinute * 15

      // 计算新的左侧位置，对齐到15分钟刻度
      const newLeftRaw = Math.max(0, resizeStartLeft.value + deltaX)
      const newLeft = Math.round(newLeftRaw / pixelPer15Minutes) * pixelPer15Minutes

      // 计算新的开始时间
      const newStartMinutes = Math.round(newLeft / pixelPerMinute)
      // 确保使用当天的00:00:00作为基准
      const baseStartOfDay = new Date(props.startDate)
      baseStartOfDay.setHours(0, 0, 0, 0)
      const newStartDate = addMinutesToDate(baseStartOfDay, newStartMinutes)

      // 只更新临时数据，不触发事件
      tempTaskData.value = {
        startDate: formatDateToLocalString(newStartDate),
        endDate: props.task.endDate, // 保持原来的结束日期
      }

      // 更新拖拽提示框内容
      dragTooltipContent.value = {
        startDate: formatDateToLocalString(newStartDate),
        endDate: props.task.endDate || '',
      }
    } else if (props.currentTimeScale === TimelineScale.QUARTER) {
      // 季度视图：左侧resize直接使用像素位置
      const newLeft = Math.max(0, resizeStartLeft.value + deltaX)
      const newWidth = Math.max(10, resizeStartWidth.value - deltaX) // 保持最小宽度

      // 更新位置覆盖
      quarterDragOverride.value = {
        left: newLeft,
        width: newWidth,
      }

      // 计算日期用于提示框（使用与Timeline相同的季度视图计算）
      const quarterWidth = 60 // 与Timeline.vue保持一致
      const daysInQuarter = 90 // 季度平均天数
      const pixelsPerDay = quarterWidth / daysInQuarter // 约0.67px/天
      const dayOffset = Math.round(deltaX / pixelsPerDay)

      const originalStartDate = createLocalDate(props.task.startDate) || props.startDate
      const newStartDate = new Date(originalStartDate)
      newStartDate.setDate(newStartDate.getDate() + dayOffset)

      // 只更新临时数据，不触发事件
      tempTaskData.value = {
        startDate: formatDateToLocalString(newStartDate),
        endDate: props.task.endDate, // 保持原来的结束日期
      }

      // 更新拖拽提示框内容
      dragTooltipContent.value = {
        startDate: formatDateToLocalString(newStartDate),
        endDate: props.task.endDate || '',
      }
    } else {
      // 其他视图（包括日视图、周视图、月视图、季度视图、年度视图）：保持原有逻辑
      const newLeft = Math.max(0, resizeStartLeft.value + deltaX)

      // 日视图、月视图、季度视图或年度视图：如果有 timelineData，使用精确计算
      if (
        (props.currentTimeScale === TimelineScale.DAY ||
          props.currentTimeScale === TimelineScale.MONTH ||
          props.currentTimeScale === TimelineScale.QUARTER ||
          props.currentTimeScale === TimelineScale.YEAR) &&
        props.timelineData
      ) {
        const newStartDate = calculateDateFromPosition(
          newLeft,
          props.timelineData,
          props.currentTimeScale,
        )

        if (newStartDate) {
          // 只更新临时数据，不触发事件
          tempTaskData.value = {
            startDate: formatDateToLocalString(newStartDate),
            endDate: props.task.endDate, // 保持原来的结束日期
          }

          // 更新拖拽提示框内容
          dragTooltipContent.value = {
            startDate: formatDateToLocalString(newStartDate),
            endDate: props.task.endDate || '',
          }
        }
      } else {
        // 其他情况：使用原有的简单计算
        const newStartDate = addDaysToLocalDate(props.startDate, newLeft / props.dayWidth)

        // 只更新临时数据，不触发事件
        tempTaskData.value = {
          startDate: formatDateToLocalString(newStartDate),
          endDate: props.task.endDate, // 保持原来的结束日期
        }

        // 更新拖拽提示框内容
        dragTooltipContent.value = {
          startDate: formatDateToLocalString(newStartDate),
          endDate: props.task.endDate || '',
        }
      }
    }
  } else if (isResizingRight.value) {
    const deltaX = e.clientX - resizeStartX.value

    if (props.currentTimeScale === TimelineScale.HOUR) {
      // 小时视图：15分钟刻度对齐
      const pixelPerMinute = 40 / 60
      const pixelPer15Minutes = pixelPerMinute * 15

      // 计算新的宽度，对齐到15分钟刻度
      const newWidthRaw = Math.max(pixelPer15Minutes, resizeStartWidth.value + deltaX)
      const newWidth = Math.round(newWidthRaw / pixelPer15Minutes) * pixelPer15Minutes

      // 计算新的持续时间（分钟）
      const newDurationMinutes = Math.round(newWidth / pixelPerMinute)

      // 计算新的结束时间
      const originalStartDate = createLocalDate(props.task.startDate) || props.startDate
      const newEndDate = addMinutesToDate(originalStartDate, newDurationMinutes)

      // 只更新临时数据，不触发事件
      tempTaskData.value = {
        startDate: props.task.startDate, // 保持原来的开始日期
        endDate: formatDateToLocalString(newEndDate),
      }

      // 更新拖拽提示框内容
      dragTooltipContent.value = {
        startDate: props.task.startDate || '',
        endDate: formatDateToLocalString(newEndDate),
      }
    } else if (props.currentTimeScale === TimelineScale.QUARTER) {
      // 季度视图：右侧resize直接使用像素位置
      const newWidth = Math.max(10, resizeStartWidth.value + deltaX) // 保持最小宽度

      // 更新位置覆盖
      quarterDragOverride.value = {
        left: resizeStartLeft.value,
        width: newWidth,
      }

      // 计算日期用于提示框（使用与Timeline相同的季度视图计算）
      const quarterWidth = 60 // 与Timeline.vue保持一致
      const daysInQuarter = 90 // 季度平均天数
      const pixelsPerDay = quarterWidth / daysInQuarter // 约0.67px/天
      const dayOffset = Math.round(deltaX / pixelsPerDay)

      const originalEndDate = createLocalDate(props.task.endDate) || props.startDate
      const newEndDate = new Date(originalEndDate)
      newEndDate.setDate(newEndDate.getDate() + dayOffset)

      // 只更新临时数据，不触发事件
      tempTaskData.value = {
        startDate: props.task.startDate, // 保持原来的开始日期
        endDate: formatDateToLocalString(newEndDate),
      }

      // 更新拖拽提示框内容
      dragTooltipContent.value = {
        startDate: props.task.startDate || '',
        endDate: formatDateToLocalString(newEndDate),
      }
    } else {
      // 其他视图（包括日视图、周视图、月视图、季度视图、年度视图）：保持原有逻辑
      const newWidth = Math.max(props.dayWidth, resizeStartWidth.value + deltaX)

      // 日视图、月视图、季度视图或年度视图：如果有 timelineData，使用精确计算
      if (
        (props.currentTimeScale === TimelineScale.DAY ||
          props.currentTimeScale === TimelineScale.MONTH ||
          props.currentTimeScale === TimelineScale.QUARTER ||
          props.currentTimeScale === TimelineScale.YEAR) &&
        props.timelineData
      ) {
        // 计算新的结束位置（左侧位置 + 新宽度）
        const newRightPosition = resizeStartLeft.value + newWidth
        const newEndDate = calculateDateFromPosition(
          newRightPosition,
          props.timelineData,
          props.currentTimeScale,
        )

        if (newEndDate) {
          // 只更新临时数据，不触发事件
          tempTaskData.value = {
            startDate: props.task.startDate, // 保持原来的开始日期
            endDate: formatDateToLocalString(newEndDate),
          }

          // 更新拖拽提示框内容
          dragTooltipContent.value = {
            startDate: props.task.startDate || '',
            endDate: formatDateToLocalString(newEndDate),
          }
        }
      } else {
        // 其他情况：使用原有的简单计算
        const newDurationDays = newWidth / props.dayWidth
        const newEndDate = addDaysToLocalDate(
          props.startDate,
          resizeStartLeft.value / props.dayWidth + newDurationDays - 1,
        )

        // 只更新临时数据，不触发事件
        tempTaskData.value = {
          startDate: props.task.startDate, // 保持原来的开始日期
          endDate: formatDateToLocalString(newEndDate),
        }

        // 更新拖拽提示框内容
        dragTooltipContent.value = {
          startDate: props.task.startDate || '',
          endDate: formatDateToLocalString(newEndDate),
        }
      }
    }
  }
}

const handleMouseUp = () => {
  // 清除延迟定时器
  if (dragDelayTimer.value !== null) {
    window.clearTimeout(dragDelayTimer.value)
    dragDelayTimer.value = null
  }

  // 清除长按定时器
  if (longPressTimer.value !== null) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  // 隐藏拖拽提示框
  dragTooltipVisible.value = false

  // 清除季度视图位置覆盖
  quarterDragOverride.value = null

  // 停止边界检测
  window.dispatchEvent(
    new CustomEvent('drag-boundary-check', {
      detail: {
        mouseX: 0,
        isDragging: false,
      },
    }),
  )

  // 只有达到拖拽阈值且有临时数据时才提交更新
  if (isDragThresholdMet.value && tempTaskData.value) {
    const updatedTask = {
      ...props.task,
      ...tempTaskData.value,
    }

    // 判断是拖拽还是拉伸
    if (isDragging.value) {
      emit('drag-end', updatedTask)
    } else if (isResizingLeft.value || isResizingRight.value) {
      emit('resize-end', updatedTask)
    }
    emit('update:task', updatedTask)

    // 清空临时数据
    tempTaskData.value = null

    // 下一帧报告新位置
    nextTick(() => {
      reportBarPosition()
    })
  }

  // 清理自动滚动监听器
  window.removeEventListener('timeline-auto-scroll', handleAutoScroll as EventListener)

  // 如果发生了拖拽或调整大小，设置标志防止触发 click 事件
  if (isDragging.value || isResizingLeft.value || isResizingRight.value) {
    justFinishedDragOrResize.value = true
    // 200ms 后清除标志
    setTimeout(() => {
      justFinishedDragOrResize.value = false
    }, 200)
  }

  // 重置所有拖拽状态
  isDragging.value = false
  isResizingLeft.value = false
  isResizingRight.value = false
  isDragThresholdMet.value = false
  isDelayPassed.value = false
  dragType.value = null

  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

onMounted(() => {
  nextTick(() => {
    reportBarPosition()
    if (taskBarNameRef.value) {
      nameTextWidth.value = taskBarNameRef.value.getBoundingClientRect().width
    }
  })

  // 监听时间刻度变化事件，重新计算位置
  const handleTimelineScaleUpdate = () => {
    nextTick(() => {
      reportBarPosition()
    })
  }

  // 监听强制重新计算事件
  const handleForceRecalculate = () => {
    // 延迟稍长一点，确保DOM完全更新
    nextTick(() => {
      setTimeout(() => {
        reportBarPosition()
      }, 10)
    })
  }

  window.addEventListener('timeline-scale-updated', handleTimelineScaleUpdate)
  window.addEventListener('timeline-force-recalculate', handleForceRecalculate)

  // 监听全局关闭菜单事件
  window.addEventListener('close-all-taskbar-menus', closeContextMenu)

  // 清理函数
  onUnmounted(() => {
    window.removeEventListener('timeline-scale-updated', handleTimelineScaleUpdate)
    window.removeEventListener('timeline-force-recalculate', handleForceRecalculate)
    window.removeEventListener('close-all-taskbar-menus', closeContextMenu)

    // 清除长按定时器
    if (longPressTimer.value !== null) {
      clearTimeout(longPressTimer.value)
      longPressTimer.value = null
    }
  })
})

// 监听任务数据变化，重新报告位置
watch(
  () => [props.task.startDate, props.task.endDate],
  () => {
    nextTick(() => {
      reportBarPosition()
    })
  },
  { deep: true },
)

// 监听高亮状态变化（调试）
watch(
  () => [props.isHighlighted, props.isPrimaryHighlight],
  ([highlighted, primary]) => {
    if (highlighted || primary) {
      // 当TaskBar变为高亮状态时，立即清理所有拖拽状态和事件监听器
      // 无条件清理，即使没有正在拖拽也要重置状态
      isDragging.value = false
      isResizingLeft.value = false
      isResizingRight.value = false
      isDragThresholdMet.value = false
      isDelayPassed.value = false
      dragType.value = null
      dragTooltipVisible.value = false

      // 清理事件监听器
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('timeline-auto-scroll', handleAutoScroll as EventListener)

      // 清理定时器
      if (longPressTimer.value) {
        clearTimeout(longPressTimer.value)
        longPressTimer.value = null
      }
      if (dragDelayTimer.value) {
        clearTimeout(dragDelayTimer.value)
        dragDelayTimer.value = null
      }

      // 触发自定义事件，通知Timeline启动拖拽滚动
      window.dispatchEvent(
        new CustomEvent('taskbar-highlighted', {
          detail: {
            taskId: props.task.id,
          },
        }),
      )
    }
  },
)

// 单击/双击延迟处理
let clickTimer: number | null = null
const clickDelay = 250 // 延迟时间（毫秒）

// 处理TaskBar单击事件（使用延迟以区分双击）
const handleTaskBarClick = (e: MouseEvent) => {
  // 如果正在拖拽或调整大小，或者刚刚完成拖拽/调整大小，不触发点击事件
  if (
    isDragging.value ||
    isResizingLeft.value ||
    isResizingRight.value ||
    justFinishedDragOrResize.value
  ) {
    return
  }

  // 如果刚刚触发了长按，不触发点击事件
  if (longPressTriggered.value) {
    longPressTriggered.value = false // 重置标记
    return
  }

  // 如果已有定时器，说明是双击的第二次点击，清除定时器不触发单击
  if (clickTimer !== null) {
    return
  }

  // 设置延迟触发单击事件
  clickTimer = window.setTimeout(() => {
    clickTimer = null

    // 优先调用外部传入的单击处理器
    if (props.onClick && typeof props.onClick === 'function') {
      props.onClick(props.task, e)
    } else {
      // 默认行为：发出单击事件给父组件
      emit('click', props.task, e)
    }
  }, clickDelay)
}

// 处理TaskBar双击事件
const handleTaskBarDoubleClick = (e: MouseEvent) => {
  // 阻止事件冒泡，避免触发拖拽等其他事件
  e.stopPropagation()
  e.preventDefault()

  // 清除单击定时器，防止触发单击事件
  if (clickTimer !== null) {
    clearTimeout(clickTimer)
    clickTimer = null
  }

  // 清理任何可能残留的拖拽状态和临时数据
  isDragging.value = false
  isResizingLeft.value = false
  isResizingRight.value = false
  tempTaskData.value = null

  // 移除可能残留的事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)

  // 发出双击事件给父组件
  emit('dblclick', props.task, e)
}

// 计算粘性样式 - 支持左右边界的精细控制
const stickyStyles = computed(() => {
  const scrollLeft = props.scrollLeft || 0
  const containerWidth = props.containerWidth || 0

  if (!scrollLeft && !containerWidth) {
    return {
      nameLeft: '',
      namePosition: '',
      nameTop: '',
      progressLeft: '',
      progressPosition: '',
      progressTop: '',
      avatarLeft: '',
      avatarPosition: '',
    }
  }

  const taskLeft = parseInt(taskBarStyle.value.left)
  const taskWidth = parseInt(taskBarStyle.value.width)
  const taskRight = taskLeft + taskWidth
  const taskCenterX = taskLeft + taskWidth / 2
  const leftBoundary = scrollLeft
  const rightBoundary = scrollLeft + containerWidth

  // 默认样式
  let nameLeft = ''
  let namePosition = ''
  let nameTop = ''
  let progressLeft = ''
  let progressPosition = ''
  let progressTop = ''
  let avatarLeft = ''
  let avatarPosition = ''

  // 估算文字内容的实际位置
  const nameWidth = Math.max(nameTextWidth.value, 40) // 最小40px
  const progressWidth = 35
  const avatarWidth = 22 // avatar 宽度
  const handleWidth = actualHandleWidth.value // 拉伸手柄宽度

  // === 第一步：检测 Avatar 是否需要粘性定位 ===
  const avatarDefaultLeft = handleWidth + 3 // 手柄宽度 + 3px 间距
  const avatarLeftPos = taskLeft + avatarDefaultLeft
  const avatarRightPos = taskLeft + avatarDefaultLeft + avatarWidth

  // Avatar 左侧粘性逻辑
  const avatarNeedsLeftSticky =
    (avatarLeftPos < leftBoundary && taskRight > leftBoundary) ||
    (taskCenterX < leftBoundary && taskRight > leftBoundary)

  // Avatar 右侧粘性逻辑：当 avatar 接近右边框 + name/progress 宽度 + 15px 时触发
  const maxContentWidth = Math.max(nameWidth, progressWidth)
  const avatarNeedsRightSticky =
    (avatarRightPos + maxContentWidth + 15 > rightBoundary && taskLeft < rightBoundary)

  // 计算 avatar 粘性时的偏移量
  let avatarStickyOffset = 0
  if (avatarNeedsLeftSticky) {
    const offset = leftBoundary - taskLeft
    avatarLeft = `${offset + handleWidth + 3}px` // 手柄宽度 + 3px 间距
    avatarPosition = 'absolute'
    avatarStickyOffset = avatarWidth + 8 // avatar 宽度 + 右侧间距
  } else if (avatarNeedsRightSticky) {
    // avatar 应该停靠在 name/progress 左侧 15px 的位置
    // 计算 name/progress 在右边界时的位置（它们会贴在右边框上）
    const maxContentWidth = Math.max(nameWidth, progressWidth)
    // 内容贴右边框时的左侧位置，考虑手柄宽度
    const contentRightPos = rightBoundary - taskLeft - maxContentWidth - handleWidth - 3
    const offset = contentRightPos - avatarWidth - 15 // avatar 在内容左侧 15px
    avatarLeft = `${offset}px`
    avatarPosition = 'absolute'
    avatarStickyOffset = -(avatarWidth + 15) // 负值表示在右侧，avatar宽度 + 15px间距
  }

  // === 第二步：处理名称粘性定位（考虑 avatar 偏移） ===
  const nameLeftPos = taskCenterX - nameWidth / 2
  const nameRightPos = taskCenterX + nameWidth / 2

  // 判断是否显示 avatar（只要配置开启就显示，包括默认头像）
  const hasAvatar = barConfig.value.showAvatar

  // Name 左侧磁吸触发条件优化
  let nameNeedsLeftSticky = false
  if (hasAvatar) {
    // 如果 avatar 存在：当 name 左侧接近左边界（预留 avatar+间距 的空间）时触发
    // name 默认居中，当它向左移动到需要为 avatar 留出空间时触发磁吸
    const nameActualLeft = nameLeftPos // name 实际左侧位置
    const avatarReservedSpace = avatarWidth + 15 // avatar 需要的空间
    nameNeedsLeftSticky =
      nameActualLeft < leftBoundary + avatarReservedSpace && taskRight > leftBoundary
  } else {
    // 如果 avatar 不存在：保留原逻辑
    nameNeedsLeftSticky =
      nameLeftPos < leftBoundary && taskRight > leftBoundary && taskCenterX < leftBoundary
  }

  const nameNeedsRightSticky =
    nameRightPos > rightBoundary && taskLeft < rightBoundary && taskCenterX > rightBoundary

  if (nameNeedsLeftSticky) {
    const offset = leftBoundary - taskLeft
    // 如果 avatar 也在左侧粘性，则 title 需要在 avatar 右侧
    const extraOffset = avatarNeedsLeftSticky ? avatarStickyOffset : 0
    nameLeft = `${offset + handleWidth + 3 + extraOffset}px` // 考虑手柄宽度 + 间距
    namePosition = 'absolute'
    nameTop = '2px'
  } else if (nameNeedsRightSticky) {
    const offset = rightBoundary - taskLeft - nameWidth
    // name 右侧磁吸时应始终保持与右边框固定距离，需要减去右侧手柄宽度
    nameLeft = `${offset - handleWidth - 3}px` // 考虑手柄宽度 + 间距
    namePosition = 'absolute'
    nameTop = '2px'
  }

  // === 第三步：处理进度粘性定位（考虑 avatar 偏移） ===
  const progressLeftPos = taskCenterX - progressWidth / 2
  const progressRightPos = taskCenterX + progressWidth / 2

  // Progress 左侧磁吸触发条件优化
  let progressNeedsLeftSticky = false
  if (hasAvatar) {
    // 如果 avatar 存在：当 progress 左侧接近左边界（预留 avatar+间距 的空间）时触发
    // progress 默认居中，当它向左移动到需要为 avatar 留出空间时触发磁吸
    const progressActualLeft = progressLeftPos // progress 实际左侧位置
    const avatarReservedSpace = avatarWidth + 15 // avatar 需要的空间
    progressNeedsLeftSticky =
      progressActualLeft < leftBoundary + avatarReservedSpace && taskRight > leftBoundary
  } else {
    // 如果 avatar 不存在：保留原逻辑
    progressNeedsLeftSticky =
      progressLeftPos < leftBoundary && taskRight > leftBoundary && taskCenterX < leftBoundary
  }

  const progressNeedsRightSticky =
    progressRightPos > rightBoundary && taskLeft < rightBoundary && taskCenterX > rightBoundary

  if (progressNeedsLeftSticky) {
    const offset = leftBoundary - taskLeft
    // 如果 avatar 也在左侧粘性，则进度需要在 avatar 右侧
    const extraOffset = avatarNeedsLeftSticky ? avatarStickyOffset : 0
    progressLeft = `${offset + handleWidth + 3 + extraOffset}px` // 考虑手柄宽度 + 间距
    progressPosition = 'absolute'
    progressTop = '18px'
  } else if (progressNeedsRightSticky) {
    const offset = rightBoundary - taskLeft - progressWidth
    // progress 右侧磁吸时应始终保持与右边框固定距离，需要减去右侧手柄宽度
    progressLeft = `${offset - handleWidth - 3}px` // 考虑手柄宽度 + 间距
    progressPosition = 'absolute'
    progressTop = '18px'
  }

  return {
    nameLeft,
    namePosition,
    nameTop,
    progressLeft,
    progressPosition,
    progressTop,
    avatarLeft,
    avatarPosition,
  }
})

// 计算气泡指示器的显示状态和位置
const bubbleIndicator = computed(() => {
  const scrollLeft = props.scrollLeft || 0
  const containerWidth = props.containerWidth || 0

  // 如果没有有效的滚动信息，不显示气泡
  if (!containerWidth || containerWidth <= 0) {
    return {
      show: false,
      left: '0px',
      side: 'left',
      color: '#409eff',
      animationType: 'none',
    }
  }

  // 如果正在初始化、强制隐藏状态或外部要求隐藏，不显示气泡
  if (isInitializing.value || bubbleHidden.value || props.hideBubbles) {
    return {
      show: false,
      left: '0px',
      side: 'left',
      color: taskStatus.value.color,
      animationType: 'none',
    }
  }

  // 获取实际的DOM位置（考虑缩放等因素）
  const taskLeft = parseInt(taskBarStyle.value.left)
  const taskWidth = parseInt(taskBarStyle.value.width)
  const taskRight = taskLeft + taskWidth
  const leftBoundary = scrollLeft
  const rightBoundary = scrollLeft + containerWidth

  // 检查边界状态
  const isCompletelyOutOfLeft = taskRight <= leftBoundary
  const isCompletelyOutOfRight = taskLeft >= rightBoundary

  // 只有完全超出边界时才显示半圆
  if (isCompletelyOutOfLeft) {
    return {
      show: true,
      left: `${leftBoundary - taskLeft - 4}px`, // 圆心在边界上，向左偏移半径(4px)
      side: 'left',
      color: taskStatus.value.color,
      animationType: 'morphToSemiCircle',
    }
  }

  if (isCompletelyOutOfRight) {
    return {
      show: true,
      left: `${rightBoundary - taskLeft - 8}px`, // 右侧半圆位置调整，减少偏移量
      side: 'right',
      color: taskStatus.value.color,
      animationType: 'morphToSemiCircle',
    }
  }

  // 部分可见或完全可见时不显示
  return {
    show: false,
    left: '0px',
    side: 'left',
    color: taskStatus.value.color,
    animationType: 'none',
  }
})

// 气泡 tooltip 状态
const showTooltip = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })

// 跟踪滚动状态，避免非滚动时的动画
const isScrollingContext = ref(false)
const scrollTimeout = ref<number | null>(null)
const hasManualResize = ref(false) // 跟踪是否有手动resize事件
const isInitializing = ref(true) // 跟踪初始化状态
const isAutoScrolling = ref(false) // 跟踪自动滚动状态（如定位到今日、点击半圆定位等）
const bubbleHidden = ref(false) // 控制半圆的强制隐藏状态

// 气泡点击事件 - 将TaskBar定位到Timeline中间
const handleBubbleClick = (e: MouseEvent) => {
  // 阻止事件冒泡，避免触发 TaskBar 的 click 事件
  e.stopPropagation()
  e.preventDefault()

  const scrollLeft = props.scrollLeft || 0
  const containerWidth = props.containerWidth || 0

  if (!scrollLeft && !containerWidth) return

  const taskLeft = parseInt(taskBarStyle.value.left)
  const taskWidth = parseInt(taskBarStyle.value.width)
  const taskCenterX = taskLeft + taskWidth / 2

  // 计算将TaskBar中心定位到Timeline中心所需的滚动位置
  const targetScrollLeft = taskCenterX - containerWidth / 2

  // 标记为自动滚动状态，隐藏所有半圆
  isAutoScrolling.value = true
  bubbleHidden.value = true

  // 立即隐藏tooltip
  showTooltip.value = false

  // 通过事件向Timeline发送滚动请求
  emit('scroll-to-position', targetScrollLeft)
}

// 监听滚动相关的props变化，判断是否在滚动
watch(
  () => [props.scrollLeft, props.containerWidth],
  (newValues, oldValues) => {
    // 检查是否是真实的滚动变化（而非初始化或resize）
    const [newScrollLeft, newContainerWidth] = newValues
    const [oldScrollLeft, oldContainerWidth] = oldValues || [0, 0]

    // 确保数值有效
    const safeNewScrollLeft = newScrollLeft || 0
    const safeNewContainerWidth = newContainerWidth || 0
    const safeOldScrollLeft = oldScrollLeft || 0
    const safeOldContainerWidth = oldContainerWidth || 0

    // 如果容器宽度发生变化（包括Splitter拖拽、TaskList展开收起、窗口resize等）
    if (Math.abs(safeNewContainerWidth - safeOldContainerWidth) > 1 && safeOldContainerWidth > 0) {
      hasManualResize.value = true

      // 容器宽度变化时，强制重新计算气泡显示状态
      // 立即触发bubbleIndicator重新计算
      nextTick(() => {
        // computed会自动重新计算
      })

      // 延长禁用动画的时间，确保各种resize操作稳定
      setTimeout(() => {
        hasManualResize.value = false
      }, 500) // 给容器变化留足够时间稳定
      return
    }

    // 首次接收到有效的滚动数据，标记初始化完成
    if (isInitializing.value && safeNewScrollLeft >= 0 && safeNewContainerWidth > 0) {
      // 延迟标记初始化完成，等待初始滚动动画结束
      setTimeout(() => {
        isInitializing.value = false
      }, 1000) // 给初始化滚动留足够时间
    }

    // 只有在scrollLeft变化且没有resize时才认为是滚动
    if (safeNewScrollLeft !== safeOldScrollLeft && !hasManualResize.value) {
      isScrollingContext.value = true

      // 清除之前的超时
      if (scrollTimeout.value) {
        clearTimeout(scrollTimeout.value)
      }

      // 滚动结束后的处理
      scrollTimeout.value = setTimeout(() => {
        isScrollingContext.value = false

        // 如果是自动滚动结束，恢复半圆显示
        if (isAutoScrolling.value) {
          isAutoScrolling.value = false
          // 延迟一点时间再显示半圆，确保滚动完全停止
          setTimeout(() => {
            bubbleHidden.value = false
          }, 300)
        }
      }, 200)
    }
  },
)

// 监听外部hideBubbles属性变化，确保Timeline的容器变化能及时反应
watch(
  () => props.hideBubbles,
  (newHidden, oldHidden) => {
    // 当Timeline设置hideBubbles从true变为false时，强制重新计算半圆状态
    if (oldHidden && !newHidden) {
      nextTick(() => {
        // 强制重新计算bubbleIndicator，确保容器宽度变化后正确显示半圆
      })
    }
  },
)

// 监听TaskBar可见性变化，只在滚动时实现重新出现动画
watch(
  () => bubbleIndicator.value.show,
  () => {
    // TaskBar重新出现时，不需要动画效果
    // 半圆会自然消失，TaskBar会立即显示
  },
)

// 监听页面缩放和大小变化，重新计算气泡位置
const handleResize = () => {
  // timeline区域resize时，立即重新计算半圆显示状态
  hasManualResize.value = true

  // 强制重新计算bubbleIndicator
  nextTick(() => {
    // computed会自动重新计算
  })

  // 短时间后恢复正常状态，允许动画
  setTimeout(() => {
    hasManualResize.value = false
  }, 300) // 缩短时间，快速恢复
}

onMounted(() => {
  // 监听窗口大小变化和缩放
  window.addEventListener('resize', handleResize)
  window.addEventListener('zoom', handleResize) // 某些浏览器支持
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('zoom', handleResize)
})

// 处理气泡悬停
const handleBubbleMouseEnter = (event: MouseEvent) => {
  // 阻止事件冒泡
  event.stopPropagation()

  showTooltip.value = true

  // 智能定位：右侧气泡在左侧显示tooltip，左侧气泡在右侧显示
  const isRightBubble = bubbleIndicator.value.side === 'right'
  const offsetX = isRightBubble ? -180 : 15 // 右侧气泡向左偏移距离调整，与左侧距离一致

  tooltipPosition.value = {
    x: event.clientX + offsetX,
    y: event.clientY - 10,
  }
}

const handleBubbleMouseLeave = (event: MouseEvent) => {
  // 阻止事件冒泡
  event.stopPropagation()

  showTooltip.value = false
}

// 处理气泡点击事件 - 点击时隐藏tooltip，但不影响定位功能
const handleBubbleMouseDown = (event: MouseEvent) => {
  // 阻止mousedown事件冒泡，防止影响其他功能
  event.stopPropagation()
  // 点击时隐藏tooltip
  showTooltip.value = false
}

// 格式化日期显示
const formatDisplayDate = (dateStr: string | undefined): string => {
  if (!dateStr) return t('dateNotSet')
  const date = createLocalDate(dateStr)
  if (!date) return t('dateNotSet')

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 计算工时信息
const workHourInfo = computed(() => {
  // 这里可以根据实际的数据结构调整
  const startDate = createLocalDate(props.task.startDate)
  const endDate = createLocalDate(props.task.endDate)

  let totalHours = 0
  if (startDate && endDate) {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    totalHours = diffDays * 8 // 假设每天8小时
  }

  const progress = props.task.progress || 0
  const usedHours = Math.round((totalHours * progress) / 100)

  return {
    total: totalHours,
    used: usedHours,
  }
})

// 判断是否应该显示进度百分比
const shouldShowProgress = computed(() => {
  // 任何情况下都显示完成率（包括0%和undefined），确保始终展示
  return true
})

// Helper functions to create type-safe style objects
const getNameStyles = () => {
  const styles = stickyStyles.value
  const result: Record<string, string> = {}

  if (styles.nameLeft) result.left = styles.nameLeft
  if (styles.namePosition) result.position = styles.namePosition
  if (styles.nameTop) result.top = styles.nameTop

  return result
}

const getProgressStyles = () => {
  const styles = stickyStyles.value
  const result: Record<string, string> = {}

  if (styles.progressLeft) result.left = styles.progressLeft
  if (styles.progressPosition) result.position = styles.progressPosition
  if (styles.progressTop) result.top = styles.progressTop

  return result
}

const getAvatarStyles = () => {
  const styles = stickyStyles.value
  const result: Record<string, string> = {}

  if (styles.avatarLeft) result.left = styles.avatarLeft
  if (styles.avatarPosition) result.position = styles.avatarPosition

  return result
}

// 计算 avatar 是否应该渲染在外框边缘
const shouldRenderAvatarOutside = computed(() => {
  const taskWidth = parseInt(taskBarStyle.value.width)
  const avatarWidth = 22
  return taskWidth - 10 < avatarWidth
})

// 计算 resize-handle 的样式
const resizeHandleStyle = computed(() => {
  const width = Math.min(barConfig.value.resizeHandleWidth ?? 5, 15) // 最大15px
  return {
    width: `${width}px`,
  }
})

// 计算实际手柄宽度（用于位置计算）
const actualHandleWidth = computed(() => {
  return Math.min(barConfig.value.resizeHandleWidth ?? 5, 15)
})

// 基于timelineData和subDays精确计算日期位置的函数
const calculatePositionFromTimelineData = (
  targetDate: Date,
  timelineData: Array<{
    year: number
    month: number
    startDate: Date
    endDate: Date
    days?: Array<{ date: Date; day: number }>
    subDays?: Array<{ date: Date; dayOfWeek?: number }>
    monthData?: { dayCount: number }
    weeks?: Array<{
      weekStart: Date
      weekEnd: Date
      subDays: Array<{ date: Date; dayOfWeek?: number }>
    }>
  }>,
  timeScale: TimelineScale,
) => {
  let cumulativePosition = 0

  for (const periodData of timelineData) {
    if (timeScale === TimelineScale.DAY) {
      // 日视图：处理days数组
      const days = periodData.days || []

      for (let i = 0; i < days.length; i++) {
        const dayData = days[i]
        const dayDate = new Date(dayData.date)

        // 比较日期（忽略时分秒）
        if (
          dayDate.getFullYear() === targetDate.getFullYear() &&
          dayDate.getMonth() === targetDate.getMonth() &&
          dayDate.getDate() === targetDate.getDate()
        ) {
          // 找到目标日期，返回累计位置 + 当前天数索引 * 日宽度
          return cumulativePosition + i * 30 // 日视图每天30px
        }
      }

      // 累加当前月份所有天数的宽度
      cumulativePosition += days.length * 30
    } else if (timeScale === TimelineScale.QUARTER) {
      // 季度视图：处理years数组，每个year包含quarters
      const quarters = (periodData as any).quarters || []

      for (const quarter of quarters) {
        const quarterStart = new Date(quarter.startDate)
        const quarterEnd = new Date(quarter.endDate)

        if (targetDate >= quarterStart && targetDate <= quarterEnd) {
          // 找到目标日期所在的季度
          const quarterWidth = 60
          const daysInQuarter = Math.ceil(
            (quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24),
          )
          const dayWidth = quarterWidth / daysInQuarter
          const dayInQuarter = Math.ceil(
            (targetDate.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24),
          )
          return cumulativePosition + dayInQuarter * dayWidth
        }

        // 累加每季度的宽度
        cumulativePosition += 60
      }
    } else if (timeScale === TimelineScale.WEEK) {
      // 周视图：处理嵌套的weeks结构
      const weeks = periodData.weeks || []

      for (const week of weeks) {
        const weekStart = new Date(week.weekStart)
        const weekEnd = new Date(week.weekEnd)

        if (targetDate >= weekStart && targetDate <= weekEnd) {
          // 找到目标日期所在的周
          const weekWidth = 60
          const subDays = week.subDays || []
          const dayWidth = weekWidth / 7

          // 在subDays中查找目标日期的位置
          for (let i = 0; i < subDays.length; i++) {
            const subDay = subDays[i]
            const subDayDate = new Date(subDay.date)
            // 比较日期（忽略时分秒）
            if (
              subDayDate.getFullYear() === targetDate.getFullYear() &&
              subDayDate.getMonth() === targetDate.getMonth() &&
              subDayDate.getDate() === targetDate.getDate()
            ) {
              return cumulativePosition + i * dayWidth
            }
          }

          // 如果没找到精确匹配，回退到dayOfWeek计算
          const dayOfWeek = targetDate.getDay()
          return cumulativePosition + dayOfWeek * dayWidth
        }

        // 累加每周的宽度
        cumulativePosition += 60
      }
    } else if (timeScale === TimelineScale.MONTH) {
      // 月视图：处理扁平化的subDays结构
      const periodStart = new Date(periodData.startDate)
      const periodEnd = new Date(periodData.endDate)

      if (targetDate >= periodStart && targetDate <= periodEnd) {
        // 找到目标日期所在的时间段
        const monthWidth = 60
        const daysInMonth = periodData.monthData?.dayCount || 30
        const dayWidth = monthWidth / daysInMonth
        const dayInMonth = targetDate.getDate()
        return cumulativePosition + (dayInMonth - 1) * dayWidth
      }

      // 累加每月的宽度
      cumulativePosition += 60
    } else if (timeScale === TimelineScale.YEAR) {
      // 年度视图：处理years数组，每个year包含halfYears
      const halfYears = (periodData as any).halfYears || []

      for (const halfYear of halfYears) {
        const halfYearStart = new Date(halfYear.startDate)
        const halfYearEnd = new Date(halfYear.endDate)

        if (targetDate >= halfYearStart && targetDate <= halfYearEnd) {
          // 找到目标日期所在的半年
          const halfYearWidth = 180 // 年度视图每半年180px
          const daysInHalfYear = Math.ceil(
            (halfYearEnd.getTime() - halfYearStart.getTime()) / (1000 * 60 * 60 * 24),
          )
          const dayWidth = halfYearWidth / daysInHalfYear
          const dayInHalfYear = Math.ceil(
            (targetDate.getTime() - halfYearStart.getTime()) / (1000 * 60 * 60 * 24),
          )
          return cumulativePosition + dayInHalfYear * dayWidth
        }

        // 累加每半年的宽度
        cumulativePosition += 180
      }
    }
  }

  // 周视图没找到目标日期时返回-1
  if (timeScale === TimelineScale.WEEK) {
    // eslint-disable-next-line no-console
    console.warn('[Gantt Debug] 周视图定位失败，任务日期未找到 week 匹配，返回 -1', { targetDate })
    return -1
  }
  return cumulativePosition // 其他视图保持原逻辑
}

// 反向函数：从像素位置计算日期（基于 timelineData）
const calculateDateFromPosition = (
  pixelPosition: number,
  timelineData: Array<{
    year: number
    month: number
    startDate: Date
    endDate: Date
    days?: Array<{ date: Date; day: number }>
    monthData?: { dayCount: number }
  }>,
  timeScale: TimelineScale,
): Date | null => {
  if (!timelineData) {
    return null
  }

  let cumulativePosition = 0

  if (timeScale === TimelineScale.DAY) {
    // 日视图：基于 days 数组
    for (const periodData of timelineData) {
      const days = periodData.days || []
      const periodWidth = days.length * 30 // 日视图每天30px

      // 检查像素位置是否在当前时间段内
      if (pixelPosition >= cumulativePosition && pixelPosition < cumulativePosition + periodWidth) {
        // 计算在当前时间段内的相对位置
        const relativePosition = pixelPosition - cumulativePosition
        const dayIndex = Math.floor(relativePosition / 30)

        // 确保索引在范围内
        if (dayIndex >= 0 && dayIndex < days.length) {
          return new Date(days[dayIndex].date)
        }
      }

      cumulativePosition += periodWidth
    }
  } else if (timeScale === TimelineScale.MONTH) {
    // 月视图：每个月60px
    for (const periodData of timelineData) {
      const monthWidth = 60

      // 检查像素位置是否在当前月份内
      if (pixelPosition >= cumulativePosition && pixelPosition < cumulativePosition + monthWidth) {
        // 计算在当前月份内的相对位置
        const relativePosition = pixelPosition - cumulativePosition
        const daysInMonth = periodData.monthData?.dayCount || 30
        const dayWidth = monthWidth / daysInMonth

        // 计算是该月的第几天
        const dayIndex = Math.floor(relativePosition / dayWidth)
        const day = Math.min(dayIndex + 1, daysInMonth) // 1-based，确保不超过该月天数

        return new Date(periodData.year, periodData.month - 1, day)
      }

      cumulativePosition += monthWidth
    }
  } else if (timeScale === TimelineScale.QUARTER) {
    // 季度视图：每个季度60px
    for (const periodData of timelineData) {
      const quarters = (periodData as any).quarters || []

      for (const quarter of quarters) {
        const quarterStart = new Date(quarter.startDate)
        const quarterEnd = new Date(quarter.endDate)
        const quarterWidth = 60

        // 检查像素位置是否在当前季度内
        if (
          pixelPosition >= cumulativePosition &&
          pixelPosition < cumulativePosition + quarterWidth
        ) {
          // 计算在当前季度内的相对位置
          const relativePosition = pixelPosition - cumulativePosition
          const daysInQuarter = Math.ceil(
            (quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24),
          )
          const dayWidth = quarterWidth / daysInQuarter

          // 计算是该季度的第几天
          const dayIndex = Math.floor(relativePosition / dayWidth)

          // 从季度开始日期加上天数
          const resultDate = new Date(quarterStart)
          resultDate.setDate(resultDate.getDate() + dayIndex)

          return resultDate
        }

        cumulativePosition += quarterWidth
      }
    }
  } else if (timeScale === TimelineScale.YEAR) {
    // 年度视图：每半年180px
    for (const periodData of timelineData) {
      const halfYears = (periodData as any).halfYears || []

      for (const halfYear of halfYears) {
        const halfYearStart = new Date(halfYear.startDate)
        const halfYearEnd = new Date(halfYear.endDate)
        const halfYearWidth = 180

        // 检查像素位置是否在当前半年内
        if (
          pixelPosition >= cumulativePosition &&
          pixelPosition < cumulativePosition + halfYearWidth
        ) {
          // 计算在当前半年内的相对位置
          const relativePosition = pixelPosition - cumulativePosition
          const daysInHalfYear = Math.ceil(
            (halfYearEnd.getTime() - halfYearStart.getTime()) / (1000 * 60 * 60 * 24),
          )
          const dayWidth = halfYearWidth / daysInHalfYear

          // 计算是该半年的第几天
          const dayIndex = Math.floor(relativePosition / dayWidth)

          // 从半年开始日期加上天数
          const resultDate = new Date(halfYearStart)
          resultDate.setDate(resultDate.getDate() + dayIndex)

          return resultDate
        }

        cumulativePosition += halfYearWidth
      }
    }
  }

  return null // 如果没找到，返回 null
}

// 处理右键菜单
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuTask = computed(() => props.task)

function handleContextMenu(event: MouseEvent) {
  // 高亮模式下禁用右键菜单
  if (props.isHighlighted || props.isPrimaryHighlight) {
    event.preventDefault()
    return
  }

  // 先广播关闭所有TaskBar菜单
  window.dispatchEvent(new CustomEvent('close-all-taskbar-menus'))
  if (props.task.type !== 'task' && props.task.type !== 'story') {
    // 为了排除里程碑类型
    event.preventDefault()
    contextMenuVisible.value = false
    return
  }
  event.preventDefault()
  contextMenuVisible.value = true
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
}
function closeContextMenu() {
  contextMenuVisible.value = false
}

const handleTaskDelete = (task: Task, deleteChildren?: boolean) => {
  // 触发删除事件
  emit('delete', task, deleteChildren)
  closeContextMenu()
}

// 监听全局关闭菜单事件
onMounted(() => {
  window.addEventListener('close-all-taskbar-menus', closeContextMenu)
})
onUnmounted(() => {
  window.removeEventListener('close-all-taskbar-menus', closeContextMenu)

  // 清理单击定时器
  if (clickTimer !== null) {
    clearTimeout(clickTimer)
    clickTimer = null
  }
})
</script>

<template>
  <div
    ref="barRef"
    class="task-bar"
    :style="{
      ...taskBarStyle,
      backgroundColor: taskStatus.bgColor,
      borderColor: taskStatus.borderColor,
      color: taskStatus.color,
      cursor: isCompleted || isParent ? 'default' : 'move',
      '--row-height': `${rowHeight}px` /* 传递行高给CSS变量 */,
      '--handle-width': `${actualHandleWidth}px` /* 传递手柄宽度给CSS变量 */,
    }"
    :class="{
      dragging: isDragging,
      resizing: isResizingLeft || isResizingRight,
      completed: isCompleted,
      'parent-task': isParent,
      'week-view': isWeekView,
      'short-task-bar': isShortTaskBar,
      'overflow-effect': needsOverflowEffect,
      highlighted: isHighlighted,
      'primary-highlight': isPrimaryHighlight,
      dimmed: isDimmed,
    }"
    @click="handleTaskBarClick"
    @contextmenu="handleContextMenu"
    @dblclick="handleTaskBarDoubleClick"
  >
    <!-- 父级任务的标签 -->
    <div v-if="isParent" class="parent-label">
      <slot v-if="hasContentSlot" name="custom-task-content" v-bind="slotPayload" />
      <template v-else> {{ task.name }} ({{ task.progress || 0 }}%) </template>
    </div>

    <!-- 完成进度条（非父级任务） -->
    <div
      v-if="!isParent && task.progress && task.progress > 0"
      class="progress-bar"
      :style="{
        width: progressWidth,
        backgroundColor: taskStatus.color,
      }"
    ></div>

    <!-- 左侧调整把手 -->
    <div
      v-if="
        !isCompleted &&
        !isParent &&
        !isInteractionDisabled &&
        props.allowDragAndResize !== false &&
        !isHighlighted &&
        !isPrimaryHighlight
      "
      class="resize-handle resize-handle-left"
      :style="resizeHandleStyle"
      @mousedown="e => handleMouseDown(e, 'resize-left')"
    ></div>

    <!-- 任务条主体（非父级任务） -->
    <div
      v-if="!isParent"
      class="task-bar-content"
      :style="{
        cursor:
          isInteractionDisabled ||
          props.allowDragAndResize === false ||
          isHighlighted ||
          isPrimaryHighlight
            ? 'grab'
            : 'move',
      }"
      @mousedown="
        e => {
          // 高亮状态下不处理，让事件冒泡到Timeline
          if (isHighlighted || isPrimaryHighlight) {
            return
          }
          // 禁用交互时也不处理
          if (isInteractionDisabled || props.allowDragAndResize === false) {
            return
          }
          // 正常拖拽
          handleMouseDown(e, 'drag')
        }
      "
    >
      <!-- 任务头像 -->
      <div
        v-if="barConfig.showAvatar"
        class="task-avatar"
        :class="{ 'avatar-outside': shouldRenderAvatarOutside, 'avatar-default': !task.avatar }"
        :style="getAvatarStyles()"
      >
        <!-- 图片头像 -->
        <img v-if="task.avatar" :src="task.avatar" :alt="task.assignee || 'avatar'" />
        <!-- 文字头像（负责人首字母） -->
        <span v-else-if="task.assignee" class="avatar-text">
          {{ task.assignee.charAt(0).toUpperCase() }}
        </span>
        <!-- 默认灰色用户图标 -->
        <svg v-else class="avatar-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
        </svg>
      </div>

      <!-- 任务名称 -->
      <div v-if="barConfig.showTitle" ref="taskBarNameRef" :style="getNameStyles()">
        <slot v-if="hasContentSlot" name="custom-task-content" v-bind="slotPayload" />
        <div v-else class="task-name">
          {{ task.name }}
        </div>
      </div>

      <!-- 进度百分比 -->
      <div
        v-if="barConfig.showProgress && shouldShowProgress"
        class="task-progress"
        :style="getProgressStyles()"
      >
        {{ task.progress || 0 }}%
      </div>
    </div>

    <!-- 右侧调整把手 -->
    <div
      v-if="
        !isCompleted &&
        !isParent &&
        !isInteractionDisabled &&
        props.allowDragAndResize !== false &&
        !isHighlighted &&
        !isPrimaryHighlight
      "
      class="resize-handle resize-handle-right"
      :style="resizeHandleStyle"
      @mousedown="e => handleMouseDown(e, 'resize-right')"
    ></div>

    <!-- 半圆气泡指示器 - 只在 TaskBar 完全消失时显示 -->
    <div
      v-if="bubbleIndicator.show && !isParent"
      class="bubble-indicator"
      :class="[
        `bubble-${bubbleIndicator.side}`,
        `bubble-animation-${bubbleIndicator.animationType}`,
      ]"
      :style="{
        left: bubbleIndicator.left,
        backgroundColor: bubbleIndicator.color,
        borderColor: bubbleIndicator.color,
      }"
      @mouseenter.stop="handleBubbleMouseEnter"
      @mouseleave.stop="handleBubbleMouseLeave"
      @mousedown.stop="handleBubbleMouseDown"
      @click.stop="handleBubbleClick"
    ></div>

    <TaskContextMenu
      :visible="contextMenuVisible"
      :task="contextMenuTask"
      :position="contextMenuPosition"
      @close="closeContextMenu"
      @start-timer="$emit('start-timer', props.task)"
      @stop-timer="$emit('stop-timer', props.task)"
      @add-predecessor="$emit('add-predecessor', props.task)"
      @add-successor="$emit('add-successor', props.task)"
      @delete="handleTaskDelete"
    />
  </div>

  <!-- Tooltip 弹窗 -->
  <Teleport to="body">
    <div
      v-if="showTooltip"
      class="task-tooltip"
      :style="{
        left: `${tooltipPosition.x}px`,
        top: `${tooltipPosition.y}px`,
      }"
    >
      <div class="tooltip-arrow"></div>
      <div class="tooltip-title">{{ task.name }}</div>
      <div class="tooltip-content">
        <div class="tooltip-row">
          <span class="tooltip-label"> {{ t('startDate') }}:</span>
          <span class="tooltip-value">{{ formatDisplayDate(task.startDate) }}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">{{ t('endDate') }}:</span>
          <span class="tooltip-value">{{ formatDisplayDate(task.endDate) }}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">{{ t('estimatedHours') }}:</span>
          <span class="tooltip-value">{{ workHourInfo.total }}h</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label"> {{ t('actualHours') }}:</span>
          <span class="tooltip-value">{{ workHourInfo.used }}h</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label"> {{ t('progress') }}:</span>
          <span class="tooltip-value">{{ task.progress || 0 }}%</span>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 拖拽实时反馈提示框 -->
  <Teleport to="body">
    <div
      v-if="dragTooltipVisible"
      class="drag-tooltip"
      :style="{
        left: `${dragTooltipPosition.x}px`,
        top: `${dragTooltipPosition.y}px`,
      }"
    >
      <div class="drag-tooltip-content">
        <div class="tooltip-row">
          <span class="tooltip-label">{{ t('startDate') }}:</span>
          <span class="tooltip-value">{{ formatDisplayDate(dragTooltipContent.startDate) }}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">{{ t('endDate') }}:</span>
          <span class="tooltip-value">{{ formatDisplayDate(dragTooltipContent.endDate) }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.task-bar {
  position: absolute;
  border-radius: 4px;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition:
    box-shadow 0.2s,
    transform 0.3s,
    filter 0.3s;
  z-index: 100;
  border: 2px solid;
  overflow: visible; /* 允许内容超出 TaskBar */
}

.task-bar:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  cursor: pointer;
}

.task-bar.completed {
  cursor: pointer !important;
}

.task-bar.completed:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
}

.task-bar.dragging {
  opacity: 0.8;
  z-index: 1000;
}

.task-bar.resizing {
  z-index: 1000;
}

/* 高亮模式下，非高亮的TaskBar变暗淡 */
.task-bar.dimmed {
  opacity: 0.35 !important;
  filter: grayscale(0.3) !important;
  transition: all 0.3s ease !important;
}

/* 高亮样式 - 前置/后置任务 */
.task-bar.highlighted {
  z-index: 1002 !important;
  box-shadow:
    0 8px 24px rgba(64, 158, 255, 0.5),
    0 6px 16px rgba(0, 0, 0, 0.3) !important;
  transform: translateY(-5px) scale(1.05) !important;
  transition: all 0.3s ease !important;
  cursor: grab !important;
}

/* 高亮TaskBar的内容加粗 */
.task-bar.highlighted .task-bar-content {
  font-weight: bold !important;
}

/* 主要高亮样式 - 被长按的任务 */
.task-bar.primary-highlight {
  z-index: 1003 !important;
  box-shadow:
    0 12px 32px rgba(64, 158, 255, 0.6),
    0 8px 20px rgba(0, 0, 0, 0.35) !important;
  transform: translateY(-8px) scale(1.08) !important;
  transition: all 0.3s ease !important;
  cursor: grab !important;
}

/* 主要高亮TaskBar的内容加粗 */
.task-bar.primary-highlight .task-bar-content {
  font-weight: bold !important;
}

.task-bar.parent-task {
  position: relative;
  border-radius: 0; /* 移除圆角，使用线性设计 */
  margin-bottom: 20px; /* 为标签和垂直线留出空间 */
  height: 10px !important; /* 降低高度，让条更细 */
  border: none; /* 移除边框 */
  background: #409eff !important; /* 与新建按钮一致的蓝色 */
  box-shadow: none; /* 移除阴影 */
  top: 50% !important; /* 上下居中 */
  transform: translateY(-50%); /* 上下居中 */
  cursor: pointer !important; /* 允许双击编辑 */
  overflow: visible; /* 确保伪元素可见 */
}

/* 高亮的父任务覆盖默认样式 */
.task-bar.parent-task.highlighted {
  box-shadow:
    0 8px 24px rgba(64, 158, 255, 0.5),
    0 6px 16px rgba(0, 0, 0, 0.3) !important;
  filter: brightness(1.2) drop-shadow(0 0 8px rgba(64, 158, 255, 0.4)) !important;
  transform: translateY(-50%) translateY(-5px) scale(1.05) !important;
}

.task-bar.parent-task.primary-highlight {
  box-shadow:
    0 12px 32px rgba(64, 158, 255, 0.6),
    0 8px 20px rgba(0, 0, 0, 0.35) !important;
  filter: brightness(1.25) drop-shadow(0 0 12px rgba(64, 158, 255, 0.6)) !important;
  transform: translateY(-50%) translateY(-8px) scale(1.08) !important;
}

/* 父级任务的标签 */
.task-bar.parent-task .parent-label {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  background: #409eff; /* 与新建按钮一致的蓝色 */
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  z-index: 20;
}

/* 左侧向下箭头 - 更尖 */
.task-bar.parent-task::before {
  content: '';
  position: absolute;
  top: 10px; /* 位于进度条下方 */
  left: 0;
  width: 0;
  height: 0;
  border-right: 6px solid transparent; /* 减小宽度，让箭头更尖 */
  border-top: 10px solid #409eff; /* 与新建按钮一致的蓝色 */
  z-index: 15;
}

/* 右侧向下箭头 - 更尖 */
.task-bar.parent-task::after {
  content: '';
  position: absolute;
  top: 10px; /* 位于进度条下方 */
  right: 0;
  width: 0;
  height: 0;
  border-left: 6px solid transparent; /* 减小宽度，让箭头更尖 */
  border-top: 10px solid #409eff; /* 与新建按钮一致的蓝色 */
  z-index: 15;
}

.progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  opacity: 0.3;
  transition: width 0.3s ease;
}

.task-bar-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  overflow: visible; /* 允许内容超出 */
  position: relative;
  z-index: 1;
}

.task-avatar {
  position: absolute;
  left: calc(var(--handle-width, 5px) + 3px); /* 手柄宽度 + 3px 间距 */
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  overflow: hidden;
  background: #f0f0f0;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  z-index: 15;
  pointer-events: none; /* 不阻止拖拽 */
  flex-shrink: 0; /* 防止被压缩 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 默认头像样式（灰色背景） */
.task-avatar.avatar-default {
  background: var(--gantt-bg-tertiary, #e0e0e0);
  color: var(--gantt-text-tertiary, #9e9e9e);
}

/* 文字头像样式 */
.task-avatar .avatar-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--gantt-text-white, #ffffff);
  background: var(--gantt-primary-color, #409eff);
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

/* 默认图标样式 */
.task-avatar .avatar-icon {
  width: 14px;
  height: 14px;
  color: var(--gantt-text-tertiary, #9e9e9e);
}

/* 当 taskbar 较窄时，将 avatar 渲染到外框左边缘 */
.task-avatar.avatar-outside {
  left: -12px; /* 位于 taskbar 左侧外框边缘 */
  z-index: 20; /* 提高层级确保在最上层 */
  border-width: 2px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

/* 当任务条较窄时，调整内容padding以避免与头像重叠 */
.task-bar-content:has(.task-avatar) {
  padding-left: 36px; /* 为头像留出空间 */
}

/* 当 avatar 在外框时，不需要额外的 padding */
.task-bar-content:has(.task-avatar.avatar-outside) {
  padding-left: 8px;
}

.task-name {
  white-space: nowrap;
  overflow: visible;
  line-height: 1.2;
  font-size: 12px;
  font-weight: 700; /* 加粗显示 */
  z-index: 10;
  /* 移除背景样式，保持原始状态 */
}

.task-progress {
  opacity: 0.9;
  font-size: 11px;
  font-weight: 700; /* 加粗显示 */
  z-index: 10;
  /* 移除背景样式，保持原始状态 */
}

.resize-handle {
  position: absolute;
  top: 0;
  /* 宽度通过内联样式设置，默认10px */
  height: 100%;
  cursor: ew-resize;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  transition: all 0.2s;
  z-index: 2;
}

.resize-handle:hover {
  background: rgba(0, 0, 0, 0.25); /* 悬停时更明显 */
  transform: scaleX(1.2); /* 悬停时稍微增宽 */
}

.resize-handle-left {
  left: 0;
}

.resize-handle-right {
  right: 0;
}

/* 溢出效果下的拉伸handle优化 */
.task-bar.overflow-effect .resize-handle {
  z-index: 20; /* 确保handle在溢出内容之上 */
  background: rgba(0, 0, 0, 0.15); /* 稍微加深以提高可见性 */
}

.task-bar.overflow-effect .resize-handle:hover {
  background: rgba(0, 0, 0, 0.3);
  transform: scaleX(1.3); /* 悬停时进一步增宽 */
}

/* 溢出模式下左右handle的位置调整 */
.task-bar.overflow-effect .resize-handle-left {
  left: 0;
}

.task-bar.overflow-effect .resize-handle-right {
  right: 0;
}

/* === 半圆气泡指示器样式 === */
.bubble-indicator {
  position: absolute;
  top: 50%;
  width: 8px; /* 半圆宽度 */
  height: 16px; /* 半圆高度 */
  z-index: 15;
  cursor: pointer;
  border: 2px solid;
  transform: translateY(-50%);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.15),
    0 1px 3px rgba(0, 0, 0, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 左侧半圆 - 圆心在边界上，只显示右半部分 */
.bubble-left {
  border-radius: 0 8px 8px 0;
  border-left: none;
  transform: translateY(-50%); /* 不需要额外偏移，圆心已在边界 */
}

/* 右侧半圆 - 圆心在边界上，只显示左半部分 */
.bubble-right {
  border-radius: 8px 0 0 8px;
  border-right: none;
  transform: translateY(-50%); /* 不需要额外偏移，圆心已在边界 */
}

/* 悬停效果 */
.bubble-indicator:hover {
  transform: translateY(-50%) scale(1.2);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.2),
    0 2px 6px rgba(0, 0, 0, 0.4);
}

.bubble-left:hover {
  transform: translateY(-50%) scale(1.2);
}

.bubble-right:hover {
  transform: translateY(-50%) scale(1.2);
}

/* === 半圆气泡动画效果 === */

/* TaskBar 边缘变成左侧半圆的动画 */
@keyframes morphToLeftSemiCircle {
  0% {
    width: 60px;
    height: 30px;
    border-radius: 4px 0 0 4px;
    border-right: 2px solid;
    border-left: none;
    opacity: 0.8;
    transform: translateY(-50%);
  }

  30% {
    width: 30px;
    height: 28px;
    border-radius: 6px 0 0 6px;
    opacity: 0.9;
    transform: translateY(-50%);
  }

  70% {
    width: 12px;
    height: 20px;
    border-radius: 0 10px 10px 0;
    border-right: 2px solid;
    border-left: none;
    opacity: 1;
    transform: translateY(-50%);
  }

  100% {
    width: 8px;
    height: 16px;
    border-radius: 0 8px 8px 0;
    border-right: 2px solid;
    border-left: none;
    opacity: 1;
    transform: translateY(-50%);
  }
}

/* TaskBar 边缘变成右侧半圆的动画 */
@keyframes morphToRightSemiCircle {
  0% {
    width: 60px;
    height: 30px;
    border-radius: 0 4px 4px 0;
    border-left: 2px solid;
    border-right: none;
    opacity: 0.8;
    transform: translateY(-50%);
  }

  30% {
    width: 30px;
    height: 28px;
    border-radius: 0 6px 6px 0;
    opacity: 0.9;
    transform: translateY(-50%);
  }

  70% {
    width: 12px;
    height: 20px;
    border-radius: 10px 0 0 10px;
    border-left: 2px solid;
    border-right: none;
    opacity: 1;
    transform: translateY(-50%);
  }

  100% {
    width: 8px;
    height: 16px;
    border-radius: 8px 0 0 8px;
    border-left: 2px solid;
    border-right: none;
    opacity: 1;
    transform: translateY(-50%);
  }
}

/* 半圆的脉动效果 */
@keyframes semiCirclePulse {
  0% {
    opacity: 0.8;
    transform: translateY(-50%) scale(1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  50% {
    opacity: 1;
    transform: translateY(-50%) scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }
  100% {
    opacity: 0.8;
    transform: translateY(-50%) scale(1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
}

/* 左侧半圆脉动 */
@keyframes leftSemiCirclePulse {
  0% {
    opacity: 0.8;
    transform: translateY(-50%) scale(1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  50% {
    opacity: 1;
    transform: translateY(-50%) scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }
  100% {
    opacity: 0.8;
    transform: translateY(-50%) scale(1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
}

/* 右侧半圆脉动 */
@keyframes rightSemiCirclePulse {
  0% {
    opacity: 0.8;
    transform: translateY(-50%) scale(1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  50% {
    opacity: 1;
    transform: translateY(-50%) scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }
  100% {
    opacity: 0.8;
    transform: translateY(-50%) scale(1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
}

/* 应用动画类 */
.bubble-animation-morphToSemiCircle {
  animation: semiCirclePulse 2s ease-in-out infinite;
}

/* 左侧半圆的变换动画 */
.bubble-left.bubble-animation-morphToSemiCircle {
  animation:
    morphToLeftSemiCircle 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards,
    leftSemiCirclePulse 2s ease-in-out 0.8s infinite;
}

/* 右侧半圆的变换动画 */
.bubble-right.bubble-animation-morphToSemiCircle {
  animation:
    morphToRightSemiCircle 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards,
    rightSemiCirclePulse 2s ease-in-out 0.8s infinite;
}

/* TaskBar 重新出现动画已移除，保持简洁 */

/* === Tooltip 样式 === */
.task-tooltip {
  position: fixed;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  z-index: 10000; /* 确保在最上层 */
  max-width: 250px;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.4),
    0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  backdrop-filter: blur(4px); /* 增加模糊背景效果 */
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.tooltip-title {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 18px;
}

.tooltip-label {
  opacity: 0.8;
  min-width: 60px;
  color: #e5e5e5;
}

.tooltip-value {
  font-weight: 600;
  text-align: right;
  color: #ffffff;
}

/* === 拖拽实时反馈提示框样式 === */
.drag-tooltip {
  position: fixed;
  background: rgba(0, 123, 255, 0.95);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  z-index: 10001;
  box-shadow: 0 2px 12px rgba(0, 123, 255, 0.4);
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(2px);
}

.drag-tooltip .tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.drag-tooltip .tooltip-row:last-child {
  margin-bottom: 0;
}

.drag-tooltip .tooltip-label {
  opacity: 0.9;
  min-width: 55px;
  font-size: 11px;
}

.drag-tooltip .tooltip-value {
  font-weight: 600;
  text-align: right;
  font-size: 11px;
  margin-left: 8px;
}

.sticky-text {
  position: absolute;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: 1.2;
  z-index: 10;
}

/* 暗色主题支持 */
:global(html[data-theme='dark']) .task-bar {
  border-color: #111827 !important;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.7),
    0 2px 4px rgba(0, 0, 0, 0.3) !important;
}

:global(html[data-theme='dark']) .task-bar:hover {
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.8),
    0 4px 8px rgba(0, 0, 0, 0.4) !important;
  transform: translateY(-2px);
  transition: all 0.2s ease;
}

:global(html[data-theme='dark']) .task-bar:hover::after {
  background: rgba(7, 10, 15, 0.98) !important;
  color: #f9fafb !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6) !important;
}

:global(html[data-theme='dark']) .task-bar.normal {
  background: linear-gradient(135deg, #1e40af, #1e3a8a) !important;
  border-color: #1e3a8a !important;
}

:global(html[data-theme='dark']) .task-bar.milestone {
  background: linear-gradient(135deg, #c2410c, #9a3412) !important;
  border-color: #9a3412 !important;
}

:global(html[data-theme='dark']) .task-bar.completed {
  background: linear-gradient(135deg, #14532d, #16a34a) !important;
  border-color: #14532d !important;
}

:global(html[data-theme='dark']) .task-bar.delayed {
  background: linear-gradient(135deg, #991b1b, #dc2626) !important;
  border-color: #991b1b !important;
}

:global(html[data-theme='dark']) .task-bar.parent {
  background: linear-gradient(135deg, #581c87, #7c3aed) !important;
  border-color: #581c87 !important;
}

:global(html[data-theme='dark']) .task-content {
  color: #ffffff !important;
}

:global(html[data-theme='dark']) .task-name {
  color: #ffffff !important;
}

:global(html[data-theme='dark']) .progress-bar {
  background: rgba(255, 255, 255, 0.2) !important;
}

:global(html[data-theme='dark']) .progress-fill {
  background: rgba(255, 255, 255, 0.8) !important;
}

:global(html[data-theme='dark']) .resize-handle {
  background: rgba(255, 255, 255, 0.1) !important;
}

:global(html[data-theme='dark']) .resize-handle:hover {
  background: rgba(255, 255, 255, 0.3) !important;
}

/* 周视图下的短TaskBar样式优化 */
.task-bar.week-view.short-task-bar {
  position: relative;
  overflow: visible;
}

/* 周视图下短TaskBar的内容溢出效果 */
.task-bar.overflow-effect .task-bar-content {
  /* 保持与日视图一致的布局 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  overflow: visible;
  position: relative;
  z-index: 10;
  /* 确保主体内容区域仍可拖拽 */
  pointer-events: auto;
}

.task-bar.overflow-effect .task-name {
  /* 保持与日视图一致的样式 */
  white-space: nowrap;
  overflow: visible;
  line-height: 1.2;
  font-size: 12px;
  font-weight: 700;
  z-index: 15;
  pointer-events: none;
  /* 允许溢出显示，但保持原始样式 */
  min-width: max-content;
}

/* 周视图下进度百分比保持与日视图一致 */
.task-bar.overflow-effect .task-progress {
  /* 保持与日视图一致的基础样式 */
  opacity: 0.9;
  font-size: 11px;
  font-weight: 700;
  z-index: 16;
  pointer-events: none;
  padding: 1px 3px;
  border-radius: 2px;
}

/* 周视图下的TaskBar基础样式调整 */
.task-bar.week-view {
  min-width: 4px; /* 确保即使很短的任务也有最小可见宽度 */
  border-width: 1px;
  border-radius: 2px;
}

/* 暗色主题下的短TaskBar溢出效果 */
:global(html[data-theme='dark']) .task-bar.overflow-effect .resize-handle {
  background: rgba(255, 255, 255, 0.15);
}

:global(html[data-theme='dark']) .task-bar.overflow-effect .resize-handle:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 暗色主题下的进度百分比样式 */
:global(html[data-theme='dark']) .task-bar.overflow-effect .task-progress {
  background: rgba(0, 0, 0, 0.9);
  color: white;
}

:global(html[data-theme='dark']) .task-bar.week-view {
  border-color: var(--gantt-border-light, #555555);
}

/* 暗色主题下的头像样式 */
:global(html[data-theme='dark']) .task-avatar {
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

/* 暗色主题下的默认头像 */
:global(html[data-theme='dark']) .task-avatar.avatar-default {
  background: var(--gantt-bg-tertiary, #4a5568);
  color: var(--gantt-text-tertiary, #718096);
}

/* 暗色主题下的图标颜色 */
:global(html[data-theme='dark']) .task-avatar .avatar-icon {
  color: var(--gantt-text-tertiary, #718096);
}

:global(html[data-theme='dark']) .task-avatar.avatar-outside {
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
}
</style>

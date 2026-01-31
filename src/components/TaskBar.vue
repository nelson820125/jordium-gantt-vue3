/* eslint-disable @typescript-eslint/no-explicit-any */
<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted, nextTick, watch, useSlots, inject, type ComputedRef, type Ref } from 'vue'
import type { Task } from '../models/classes/Task'
import { TimelineScale } from '../models/types/TimelineScale'
import TaskContextMenu from './TaskContextMenu.vue'
import LinkAnchor from './LinkAnchor.vue'
import TaskBarTab from './Timeline/TaskBarTab.vue'

import { useI18n } from '../composables/useI18n'
import type { TaskBarConfig } from '../models/configs/TaskBarConfig'
import { DEFAULT_TASK_BAR_CONFIG } from '../models/configs/TaskBarConfig'

// 禁用自动继承attributes，手动应用到wrapper
defineOptions({
  inheritAttrs: false
})

// 从 GanttChart 注入 enableLinkAnchor 配置
const enableLinkAnchor = inject<ComputedRef<boolean>>('enable-link-anchor', computed(() => true))

// v1.9.0 计算当前资源的投入占比
const resourcePercent = computed(() => {
  // 如果直接传递了占比，使用传递的值
  if (props.resourceAllocationPercent !== undefined) {
    const val = Number(props.resourceAllocationPercent)
    if (Number.isFinite(val) && val > 0) {
      return Math.max(0, Math.min(100, val))
    }
  }

  // 在资源视图中，尝试从task.resources中查找当前资源的占比
  if (viewMode.value === 'resource' && props.currentResourceId && props.task.resources) {
    const allocation = props.task.resources.find((r: any) => {
      // 确保ID类型匹配（可能是字符串或数字）
      return String(r.id) === String(props.currentResourceId)
    })

    if (allocation && allocation.percent !== undefined) {
      const val = Number(allocation.percent)
      if (Number.isFinite(val) && val >= 0) {
        return Math.max(0, Math.min(100, val))
      }
    }
  }

  // 默认100%（向后兼容）
  return 100
})

// v1.9.2 获取当前资源颜色
const currentResourceColor = computed(() => {
  if (viewMode.value === 'resource' && props.currentResourceId && props.resources) {
    // 从外部传入的 resources 列表中查找资源颜色（与 TaskRow 逻辑一致）
    console.log('🎨 TaskBar - 查找资源颜色:', {
      currentResourceId: props.currentResourceId,
      resources: props.resources,
      taskId: props.task.id,
      taskName: props.task.name
    })
    const resource = props.resources.find(r => String(r.id) === String(props.currentResourceId))
    console.log('🎨 TaskBar - 找到的资源:', resource)
    const finalColor = resource?.color || '#85ce61'
    console.log('🎨 TaskBar - 最终颜色:', finalColor)
    return finalColor
  }
  return '#85ce61'
})

// v1.9.2 当前资源总负载（用于超载警告）
const currentResourceTotalLoad = computed(() => {
  // 这个值应该从外部传入，这里暂时返回undefined
  // 实际应该在Timeline层计算好并通过props传递
  return undefined
})

// v1.9.2 当前资源名称
const currentResourceName = computed(() => {
  if (!props.currentResourceId) return ''
  const resource = props.resources?.find(r => r.id === props.currentResourceId)
  return resource?.name || ''
})

// v1.9.0 是否显示占比文字（占比<100%时显示）
const shouldShowPercentText = computed(() => {
  return viewMode.value === 'resource' && resourcePercent.value < 100
})

interface Props {
  task: Task
  rowHeight: number
  dayWidth: number
  startDate: Date
  isParent?: boolean
  onClick?: (task: Task, event: MouseEvent) => void
  rowIndex?: number
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
  // 是否显示实际任务条（默认为 false）
  showActualTaskbar?: boolean
  // 是否启用 TaskBar 气泡提示框（默认为 true）
  enableTaskBarTooltip?: boolean
  // 自定义任务状态背景色
  pendingTaskBackgroundColor?: string
  delayTaskBackgroundColor?: string
  completeTaskBackgroundColor?: string
  ongoingTaskBackgroundColor?: string
  // 是否被高亮显示（前置或后置任务）
  isHighlighted?: boolean
  // 是否是主要高亮（被长按的任务）
  isPrimaryHighlight?: boolean
  // 是否处于高亮模式（有任务被高亮）
  isInHighlightMode?: boolean
  // 连接线拖拽模式：'predecessor' | 'successor' | null
  dragLinkMode?: 'predecessor' | 'successor' | null
  // 是否是连接线拖拽的起始任务
  isLinkDragSource?: boolean
  // 是否是有效的连接目标
  isValidLinkTarget?: boolean
  // 是否是无效的连接目标
  isInvalidLinkTarget?: boolean
  // 所有任务列表（用于右键菜单删除链接功能）
  allTasks?: Task[]
  // v1.9.0 资源视图：是否存在资源冲突（时间重叠）
  hasResourceConflict?: boolean
  // v1.9.2 资源视图：冲突任务列表（用于显示详细冲突信息）
  conflictTasks?: Task[]
  // v1.9.0 资源视图：当前资源在任务中的投入占比 (20-100)
  resourceAllocationPercent?: number
  // v1.9.0 资源视图：当前资源ID（用于查找占比信息）
  currentResourceId?: string | number
  // v1.9.0 资源视图：任务在子行中的索引（换行布局）
  taskSubRow?: number
  // v1.9.0 资源视图：每个子行的高度数组（换行布局）
  rowHeights?: number[]
  // v1.9.2 资源列表（用于查找资源名称等信息）
  resources?: Array<{ id: string | number; name: string; color?: string }>
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
  'delete-link',
  'context-menu',
  'long-press',
  'link-drag-start',
  'link-drag-move',
  'link-drag-end',
])

defineSlots<{
  'custom-task-content'(props: TaskBarSlotProps): unknown
}>()

const slots = useSlots()

// 注入视图模式
const viewMode = inject<Ref<'task' | 'resource'>>('gantt-view-mode', ref('task'))

// 注入资源布局信息（用于判断跨行拖拽边界）
const resourceRowPositions = inject<ComputedRef<Map<string, number>>>('resourceRowPositions', computed(() => new Map()))
const resourceTaskLayouts = inject<ComputedRef<Map<string, { taskRowMap: Map<string | number, number>, rowHeights: number[], totalHeight: number }>>>('resourceTaskLayouts', computed(() => new Map()))

// 注入右键菜单配置
const enableTaskBarContextMenu = inject<ComputedRef<boolean>>('enable-task-bar-context-menu', computed(() => true))
const hasTaskBarContextMenuSlot = inject<ComputedRef<boolean>>('task-bar-context-menu-slot', computed(() => false))
const declarativeTaskBarContextMenu = inject<ComputedRef<any>>('declarative-task-bar-context-menu', computed(() => null))

// 判断是否应该显示任何右键菜单
const shouldShowAnyContextMenu = computed(() => {
  // 如果 enableTaskBarContextMenu 为 false，则不显示任何菜单
  if (!enableTaskBarContextMenu.value) {
    return false
  }
  return true
})

// 判断是否显示默认右键菜单（enableTaskBarContextMenu=true 且没有自定义 slot 时显示）
const shouldShowDefaultContextMenu = computed(() => {
  if (!enableTaskBarContextMenu.value) {
    return false
  }
  return !hasTaskBarContextMenuSlot.value
})

// 判断是否显示自定义右键菜单（enableTaskBarContextMenu=true 且有自定义 slot 时显示）
const shouldShowCustomContextMenu = computed(() => {
  if (!enableTaskBarContextMenu.value) {
    return false
  }
  if (!hasTaskBarContextMenuSlot.value) {
    return false
  }

  // 检查 taskType 过滤
  const config = declarativeTaskBarContextMenu.value
  if (config?.taskType !== undefined) {
    const taskType = props.task.type || 'task'
    const allowedTypes = Array.isArray(config.taskType) ? config.taskType : [config.taskType]
    return allowedTypes.includes(taskType)
  }

  return true
})

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

// 缓存今天的日期，避免频繁创建
// 每分钟更新一次缓存（对于日期判断来说足够了）
const cachedToday = ref(createLocalToday())
let todayCacheTimer: number | null = null

onMounted(() => {
  // 每60秒更新一次今天的日期缓存
  todayCacheTimer = window.setInterval(() => {
    cachedToday.value = createLocalToday()
  }, 60000)
})

onUnmounted(() => {
  if (todayCacheTimer !== null) {
    clearInterval(todayCacheTimer)
    todayCacheTimer = null
  }
})

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
const dragStartY = ref(0)  // v1.9.0 用于资源视图垂直拖拽
const dragStartLeft = ref(0)
const dragStartWidth = ref(0)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)
const resizeStartLeft = ref(0)

// v1.9.2 注入Timeline的拖拽状态（用于冲突检测优化）
const timelineIsDraggingTaskBar = inject<Ref<boolean>>('isDraggingTaskBar', ref(false))

// v1.9.0 拖拽预览效果（资源视图垂直拖拽）
const dragPreviewVisible = ref(false)
const dragPreviewPosition = ref({ x: 0, y: 0 })
const dragPreviewOffsetX = ref(0) // 鼠标在TaskBar内的X偏移量，用于保持预览对齐
const dragEndX = ref(0) // 记录松开鼠标时的X位置，用于计算新日期
const tempTaskPixelLeft = ref<number | null>(null) // 资源视图拖拽时的精确像素位置

// 长按检测状态
const longPressTimer = ref<number | null>(null)
const longPressTriggered = ref(false)
const LONG_PRESS_DURATION = 1000 // 1秒（缩短了）

// TaskBar 悬停状态（用于显示 LinkAnchor）
const isTaskBarHovered = ref(false)

// v1.9.2 Tab悬停状态（用于阻止tooltip）
const isTabHovered = ref(false)

// v1.9.2 动态边框颜色（tab悬停时使用资源颜色）
const dynamicBorderColor = computed(() => {
  if (isTabHovered.value && viewMode.value === 'resource') {
    return currentResourceColor.value
  }
  return taskStatus.value.borderColor
})

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
    const taskBarHeight = props.rowHeight - 10
    const topOffset = (props.rowHeight - taskBarHeight) / 2
    return {
      left: `${quarterDragOverride.value.left ?? 0}px`,
      width: `${quarterDragOverride.value.width ?? 100}px`,
      height: `${taskBarHeight}px`,
      top: `${topOffset}px`,
    }
  }

  const currentStartDate = tempTaskData.value?.startDate || props.task.startDate
  const currentEndDate = tempTaskData.value?.endDate || props.task.endDate

  const startDate = createLocalDate(currentStartDate)
  const endDate = createLocalDate(currentEndDate)
  const baseStart = parsedBaseStartDate.value

  // 如果startDate和endDate都不存在，返回0宽度（实际不会渲染，由shouldRenderTaskBar控制）
  if (!startDate && !endDate) {
    const taskBarHeight = props.rowHeight - 10
    const topOffset = (props.rowHeight - taskBarHeight) / 2
    return {
      left: '0px',
      width: '0px',
      height: `${taskBarHeight}px`,
      top: `${topOffset}px`,
    }
  }

  // 渲染时使用有效日期：如果只有startDate或endDate，用它来计算开始和结束位置
  // 注意：不修改原始的startDate/endDate变量，只用于渲染计算
  const renderStartDate = startDate || endDate
  const renderEndDate = endDate || startDate
  const renderBaseStart = baseStart

  // 安全检查：renderStartDate和renderEndDate必定存在（因为上面已经检查过）
  // 但baseStart可能不存在，如果不存在则无法计算位置
  if (!renderStartDate || !renderEndDate || !renderBaseStart) {
    const taskBarHeight = props.rowHeight - 10
    const topOffset = (props.rowHeight - taskBarHeight) / 2
    return {
      left: '0px',
      width: '0px',
      height: `${taskBarHeight}px`,
      top: `${topOffset}px`,
    }
  }

  let left = 0
  let width = 0

  // v1.9.0 资源视图拖拽时，优先使用精确的像素位置
  if (viewMode.value === 'resource' && tempTaskPixelLeft.value !== null) {
    left = tempTaskPixelLeft.value
    // 计算宽度（基于日期）
    const startDate = createLocalDate(currentStartDate)
    const endDate = createLocalDate(currentEndDate)
    if (startDate && endDate) {
      const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
      const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
      const timeDiffMs = endDateOnly.getTime() - startDateOnly.getTime()
      const daysDiff = Math.round(timeDiffMs / (1000 * 60 * 60 * 24))
      const duration = daysDiff === 0 ? 1 : daysDiff + 1
      width = duration * props.dayWidth
    } else {
      width = props.dayWidth // 默认宽度
    }
  } else if (props.currentTimeScale === TimelineScale.HOUR) {
    // 小时视图：按分钟精确计算位置（需要考虑时间部分）
    // 确保 baseStart 是当天的 00:00:00
    const baseStartOfDay = new Date(renderBaseStart)
    baseStartOfDay.setHours(0, 0, 0, 0)

    // 处理没有时间部分的日期字符串
    let adjustedStartDate = renderStartDate
    let adjustedEndDate = renderEndDate

    // 检查原始日期字符串是否包含时间部分
    const originalStartStr = currentStartDate || props.task.startDate
    const originalEndStr = currentEndDate || props.task.endDate

    // 如果startDate没有时间部分（格式为YYYY-MM-DD），设置为当日00:00
    if (
      typeof originalStartStr === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(originalStartStr.trim())
    ) {
      adjustedStartDate = new Date(renderStartDate)
      adjustedStartDate.setHours(0, 0, 0, 0)
    }

    // 如果endDate没有时间部分（格式为YYYY-MM-DD），设置为次日00:00
    if (typeof originalEndStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(originalEndStr.trim())) {
      adjustedEndDate = new Date(renderEndDate)
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
      renderStartDate.getFullYear(),
      renderStartDate.getMonth(),
      renderStartDate.getDate(),
    )
    const endDateOnly = new Date(
      renderEndDate.getFullYear(),
      renderEndDate.getMonth(),
      renderEndDate.getDate(),
    )
    const baseStartOnly = new Date(
      renderBaseStart.getFullYear(),
      renderBaseStart.getMonth(),
      renderBaseStart.getDate(),
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

  // v1.9.1 计算TaskBar高度：资源视图固定41px全高度，不再按占比缩放
  const baseTaskBarHeight = props.rowHeight - 10 // 基础高度（与任务视图一致）
  let taskBarHeight = baseTaskBarHeight

  // v1.9.1 资源视图：固定全高度，不缩放（占比通过CSS伪元素实现）
  // 任务视图：保持原有高度
  // （资源视图的占比视觉效果通过CSS的::before和::after伪元素实现）

  // v1.9.1 计算垂直位置：资源视图中支持换行布局
  let topOffset = (props.rowHeight - taskBarHeight) / 2 // 默认：居中对齐

  if (viewMode.value === 'resource' && props.taskSubRow !== undefined && props.rowHeights && props.rowHeights.length > 0) {
    // 换行布局：根据子行索引和每行高度计算垂直位置
    const subRow = props.taskSubRow
    const rowHeights = props.rowHeights
    const currentRowHeight = rowHeights[subRow] || 51

    // 计算当前子行距离顶部的偏移量（累加前面所有行的高度）
    let cumulativeOffset = 0
    for (let i = 0; i < subRow; i++) {
      cumulativeOffset += rowHeights[i] || 51
    }

    // v1.9.1 在当前子行内居中对齐（因为TaskBar固定41px高度）
    // 第一行：padding-top(5px) + 居中
    // 后续行：居中（无padding-top）
    if (subRow === 0) {
      // 第一行：顶部5px padding，居中对齐
      topOffset = cumulativeOffset + 5 + (currentRowHeight - 5 - taskBarHeight) / 2
    } else {
      // 后续行：居中对齐
      topOffset = cumulativeOffset + (currentRowHeight - taskBarHeight) / 2
    }
  }

  return {
    left: `${left}px`,
    width: `${width}px`,
    height: `${taskBarHeight}px`,
    top: `${topOffset}px`,
  }
})

// 缓存 TaskBar 的位置信息，减少 DOM 读取频率
const cachedPosition = ref({
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  timestamp: 0,
})

// 位置缓存有效期（毫秒）
const POSITION_CACHE_TTL = 100 // 100ms 内使用缓存值

// 缓存解析后的结束日期，避免在 taskStatus 中重复解析
const parsedEndDate = computed(() => createLocalDate(props.task.endDate || ''))

// 缓存解析后的基准开始日期
const parsedBaseStartDate = computed(() => createLocalDate(props.startDate))

// 判断是否应该渲染TaskBar：只考虑startDate和endDate，都不存在时不渲染
const shouldRenderTaskBar = computed(() => {
  const currentStartDate = tempTaskData.value?.startDate || props.task.startDate
  const currentEndDate = tempTaskData.value?.endDate || props.task.endDate

  // 只要startDate或endDate有一个存在就渲染
  return !!(currentStartDate || currentEndDate)
})

// v1.9.2 TaskBar宽度（用于Tab组件判断是否紧凑模式）
const taskBarWidth = computed(() => {
  const width = parseFloat(taskBarStyle.value.width)
  return isNaN(width) ? 0 : width
})

// 计算任务状态和颜色
const taskStatus = computed(() => {
  // 优先级最高：如果task设置了barColor自定义颜色
  if (props.task.barColor) {
    // 将十六进制颜色转换为RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 64, g: 158, b: 255 } // 默认蓝色
    }

    const rgb = hexToRgb(props.task.barColor)

    // 父级任务直接使用自定义颜色作为主色
    if (props.isParent) {
      return {
        type: 'custom-parent',
        color: props.task.barColor,
        bgColor: props.task.barColor,
        borderColor: props.task.barColor,
      }
    }

    // 普通任务生成浅色背景和中间色边框
    // 生成浅色背景（接近白色，保持色调）- 约95%白色 + 5%原色
    const bgColor = `rgb(${Math.round(255 * 0.95 + rgb.r * 0.05)}, ${Math.round(255 * 0.95 + rgb.g * 0.05)}, ${Math.round(255 * 0.95 + rgb.b * 0.05)})`

    // 生成中间色边框（约70%白色 + 30%原色）
    const borderColor = `rgb(${Math.round(255 * 0.7 + rgb.r * 0.3)}, ${Math.round(255 * 0.7 + rgb.g * 0.3)}, ${Math.round(255 * 0.7 + rgb.b * 0.3)})`

    return {
      type: 'custom',
      color: props.task.barColor,
      bgColor: bgColor,
      borderColor: borderColor,
    }
  }

  // 父级任务(Story类型)使用与新建按钮一致的配色
  if (props.isParent) {
    return {
      type: 'parent',
      color: '#409eff', // 与新建按钮一致的蓝色
      bgColor: '#409eff',
      borderColor: '#409eff',
    }
  }

  // 辅助函数：根据主色生成浅色背景和中间色边框
  const generateColorsFromMain = (mainColor: string) => {
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 64, g: 158, b: 255 }
    }
    const rgb = hexToRgb(mainColor)
    const bgColor = `rgb(${Math.round(255 * 0.95 + rgb.r * 0.05)}, ${Math.round(255 * 0.95 + rgb.g * 0.05)}, ${Math.round(255 * 0.95 + rgb.b * 0.05)})`
    const borderColor = `rgb(${Math.round(255 * 0.7 + rgb.r * 0.3)}, ${Math.round(255 * 0.7 + rgb.g * 0.3)}, ${Math.round(255 * 0.7 + rgb.b * 0.3)})`
    return { bgColor, borderColor }
  }

  // 使用缓存的今天日期，避免频繁创建日期对象
  const today = cachedToday.value
  const endDate = parsedEndDate.value
  const progress = props.task.progress || 0
  const actualStartDate = props.task.actualStartDate ? new Date(props.task.actualStartDate) : null

  // 已完成（优先级高）
  if (progress >= 100) {
    // 优先使用自定义颜色，否则使用默认
    const mainColor = props.completeTaskBackgroundColor || '#909399'
    const colors = generateColorsFromMain(mainColor)
    return {
      type: 'completed',
      color: mainColor,
      bgColor: colors.bgColor,
      borderColor: colors.borderColor,
    }
  }

  // 已延迟（结束日期早于今天且未完成）
  if (endDate && endDate < today && progress < 100) {
    const mainColor = props.delayTaskBackgroundColor || '#f56c6c'
    const colors = generateColorsFromMain(mainColor)
    return {
      type: 'delayed',
      color: mainColor,
      bgColor: colors.bgColor,
      borderColor: colors.borderColor,
    }
  }

  // 进行中（actualStartDate存在，未完成，且未逾期）
  if (actualStartDate && progress < 100 && endDate && endDate >= today) {
    const mainColor = props.ongoingTaskBackgroundColor || '#e6a23c'
    const colors = generateColorsFromMain(mainColor)
    return {
      type: 'ongoing',
      color: mainColor,
      bgColor: colors.bgColor,
      borderColor: colors.borderColor,
    }
  }

  // 待处理（未开始且未逾期）- actualStartDate不存在，当前日期早于计划结束日
  if (!actualStartDate && (!endDate || endDate >= today)) {
    const mainColor = props.pendingTaskBackgroundColor || '#409eff'
    const colors = generateColorsFromMain(mainColor)
    return {
      type: 'pending',
      color: mainColor,
      bgColor: colors.bgColor,
      borderColor: colors.borderColor,
    }
  }

  // 默认状态（兜底）
  return {
    type: 'default',
    color: '#409eff',
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

// 处理avatar数组和assignee生成头像
const avatarList = computed(() => {
  const avatar = props.task.avatar
  const assignee = props.task.assignee

  // 如果有avatar，使用avatar
  if (avatar) {
    return Array.isArray(avatar) ? avatar : [avatar]
  }

  // 如果没有avatar但有assignee，使用assignee生成头像数据
  if (assignee) {
    const assigneeList = Array.isArray(assignee) ? assignee : [assignee]
    // 返回对象数组，包含名字信息用于生成文字头像
    return assigneeList.map(name => ({ isText: true, name }))
  }

  return []
})

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

// 判断是否有实际进度数据
const hasActualProgress = computed(() => {
  return !!(props.task.actualStartDate || props.task.actualEndDate)
})

// 计算实际进度条的样式（独立的TaskBar，在下层）
const actualBarStyle = computed(() => {
  // 只有当showActualTaskbar=true且存在actualStartDate时才显示实际任务条
  if (!props.showActualTaskbar || !props.task.actualStartDate || props.isParent) {
    return null
  }

  const actualStart = createLocalDate(props.task.actualStartDate)
  const actualEnd = createLocalDate(props.task.actualEndDate)
  const planStart = createLocalDate(props.task.startDate)
  const baseStartOnly = parsedBaseStartDate.value

  if (!baseStartOnly) {
    return null
  }

  // 实际开始日期，如果没有则使用计划开始日期
  const effectiveStart = actualStart || planStart
  // 实际结束日期，如果没有则使用当前日期（任务进行中）
  const effectiveEnd = actualEnd || (actualStart ? createLocalToday() : null)

  if (!effectiveStart || !effectiveEnd) {
    return null
  }

  // 计算实际进度条的绝对位置（与计划条使用相同逻辑）
  let actualLeft = 0
  let actualWidth = 100

  // 根据时间刻度计算位置（与taskBarStyle逻辑一致）
  if (
    props.timelineData &&
    props.currentTimeScale &&
    (props.currentTimeScale === TimelineScale.WEEK ||
      props.currentTimeScale === TimelineScale.MONTH ||
      props.currentTimeScale === TimelineScale.QUARTER ||
      props.currentTimeScale === TimelineScale.YEAR)
  ) {
    const startPosition = calculatePositionFromTimelineData(
      effectiveStart,
      props.timelineData,
      props.currentTimeScale,
    )
    const nextDay = new Date(effectiveEnd)
    nextDay.setDate(nextDay.getDate() + 1)
    let endPosition = calculatePositionFromTimelineData(
      nextDay,
      props.timelineData,
      props.currentTimeScale,
    )

    if (endPosition === startPosition) {
      let dayWidth = 60 / 30
      if (props.currentTimeScale === TimelineScale.WEEK) {
        dayWidth = 60 / 7
      } else if (props.currentTimeScale === TimelineScale.QUARTER) {
        dayWidth = 60 / 90
      } else if (props.currentTimeScale === TimelineScale.YEAR) {
        dayWidth = 180 / 182
      }
      endPosition = calculatePositionFromTimelineData(
        effectiveEnd,
        props.timelineData,
        props.currentTimeScale,
      ) + dayWidth
    }

    actualLeft = startPosition
    actualWidth = Math.max(endPosition - startPosition, 4)
  } else if (props.timelineData && props.currentTimeScale === TimelineScale.DAY) {
    const startPosition = calculatePositionFromTimelineData(
      effectiveStart,
      props.timelineData,
      props.currentTimeScale,
    )
    const nextDay = new Date(effectiveEnd)
    nextDay.setDate(nextDay.getDate() + 1)
    let endPosition = calculatePositionFromTimelineData(
      nextDay,
      props.timelineData,
      props.currentTimeScale,
    )

    if (endPosition === startPosition) {
      endPosition = calculatePositionFromTimelineData(
        effectiveEnd,
        props.timelineData,
        props.currentTimeScale,
      ) + 30
    }

    actualLeft = startPosition
    actualWidth = Math.max(endPosition - startPosition, 4)
  } else {
    const startDiff = Math.floor(
      (effectiveStart.getTime() - baseStartOnly.getTime()) / (1000 * 60 * 60 * 24),
    )
    const timeDiffMs = effectiveEnd.getTime() - effectiveStart.getTime()
    const daysDiff = Math.round(timeDiffMs / (1000 * 60 * 60 * 24))
    const duration = daysDiff === 0 ? 1 : daysDiff + 1

    actualLeft = startDiff * props.dayWidth
    actualWidth = duration * props.dayWidth
  }

  // 实际进度条固定高度20px，垂直居中显示
  const actualHeight = 20
  const topOffset = (props.rowHeight - actualHeight) / 2 // 上下居中对齐

  return {
    left: `${actualLeft}px`,
    width: `${actualWidth}px`,
    height: `${actualHeight}px`,
    top: `${topOffset}px`,
  }
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

  // 在 mousedown 事件中读取位置是合理的（不是高频操作）
  // 这个值用于计算拖拽偏移量，只在开始拖拽时读取一次
  const barRect = barRef.value.getBoundingClientRect()

  // 计算鼠标相对于TaskBar的位置
  mouseOffsetX.value = e.clientX - barRect.left
  // v1.9.0 记录鼠标在TaskBar内的偏移量，用于拖拽预览对齐
  dragPreviewOffsetX.value = e.clientX - barRect.left

  // 记录初始状态，但不立即激活拖拽
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY  // v1.9.0 记录Y坐标用于资源视图垂直拖拽
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

// 使用缓存机制减少 DOM 读取频率，但保证位置准确性
let reportPositionScheduled = false

function reportBarPosition() {
  // 如果已经安排了本帧的位置报告，则跳过
  if (reportPositionScheduled) return

  reportPositionScheduled = true

  requestAnimationFrame(() => {
    reportPositionScheduled = false

    if (!barRef.value) return

    const now = Date.now()

    // 如果缓存未过期，使用缓存值
    if (now - cachedPosition.value.timestamp < POSITION_CACHE_TTL) {
      emit('bar-mounted', {
        id: props.task.id,
        left: cachedPosition.value.left,
        top: cachedPosition.value.top,
        width: cachedPosition.value.width,
        height: cachedPosition.value.height,
      })
      return
    }

    // 缓存过期或首次调用，读取 DOM 并更新缓存
    // TaskBar 传递绝对位置（相对于视口），Timeline 会将其转换为相对位置
    const rect = barRef.value.getBoundingClientRect()

    // 计算并缓存位置
    const position = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    }

    // 更新缓存
    cachedPosition.value = {
      ...position,
      timestamp: now,
    }

    emit('bar-mounted', {
      id: props.task.id,
      ...position,
    })
  })
}

// 拖拽时的实时日期提示框状态
const dragTooltipVisible = ref(false)
const dragTooltipPosition = ref({ x: 0, y: 0 })
const dragTooltipContent = ref({ startDate: '', endDate: '' })

const handleMouseMove = (e: MouseEvent) => {
  // 记录最新的鼠标Y位置（用于资源视图垂直拖拽）
  if (viewMode.value === 'resource') {
    ;(window as any).lastDragMouseY = e.clientY

    // v1.9.0 检测是否跨行拖拽（基于资源行的实际高度）
    const timelineBody = document.querySelector('.timeline-body')
    let isCrossRowDrag = false

    if (timelineBody && isDragging.value && isDragThresholdMet.value && props.currentResourceId) {
      const bodyRect = timelineBody.getBoundingClientRect()
      const relativeY = e.clientY - bodyRect.top + (timelineBody as HTMLElement).scrollTop

      // 获取当前资源行的位置和高度
      const currentResourceId = String(props.currentResourceId)
      const currentRowTop = resourceRowPositions.value.get(currentResourceId) || 0
      const currentRowLayout = resourceTaskLayouts.value.get(currentResourceId)
      const currentRowHeight = currentRowLayout?.totalHeight || 51
      const currentRowBottom = currentRowTop + currentRowHeight

      // 判断鼠标是否超出当前资源行的边界
      isCrossRowDrag = relativeY < currentRowTop || relativeY >= currentRowBottom

      // 只有在跨行拖拽时才显示预览
      if (isCrossRowDrag) {
        dragPreviewVisible.value = true
        // 虚拟预览应该显示在鼠标位置
        dragPreviewPosition.value = {
          x: e.clientX - dragPreviewOffsetX.value,
          y: e.clientY - (props.rowHeight / 2)
        }
      } else {
        dragPreviewVisible.value = false
      }
    }
  }

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
    const deltaY = Math.abs(e.clientY - dragStartY.value)

    // v1.9.0 资源视图中，同时考虑Y轴移动（垂直拖拽）
    const threshold = viewMode.value === 'resource' && dragType.value === 'drag'
      ? Math.max(deltaX, deltaY)  // 资源视图拖拽：X或Y有一个达到阈值即可
      : deltaX  // 任务视图或拉伸：只考虑X轴

    // 如果移动距离小于阈值，不执行任何操作
    if (threshold < dragThreshold.value) {
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
        mouseY: e.clientY,  // v1.9.0 添加Y坐标用于资源视图垂直拖拽检测
        taskId: props.task.id,  // v1.9.0 添加taskId
        rowIndex: props.rowIndex,  // v1.9.0 添加当前行索引
        isDragging: isDragging.value || isResizingLeft.value || isResizingRight.value,
        isResourceView: viewMode.value === 'resource',  // v1.9.0 标识是否资源视图
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

    // v1.9.0 资源视图垂直拖拽：使用与任务视图相同的日期计算算法
    if (viewMode.value === 'resource') {
      // 计算TaskBar的新左边缘位置（鼠标位置 - 偏移量）
      const taskBarNewLeft = e.clientX - dragPreviewOffsetX.value

      // 需要获取timeline body的位置来计算相对位置
      const timelineBody = document.querySelector('.timeline-body')
      if (timelineBody) {
        const bodyRect = timelineBody.getBoundingClientRect()
        const scrollLeft = (timelineBody as HTMLElement).scrollLeft
        // 计算相对于timeline body的位置
        const relativeX = taskBarNewLeft - bodyRect.left + scrollLeft

        // 保存精确的像素位置，避免通过日期往返计算导致的精度损失
        tempTaskPixelLeft.value = relativeX

        // 使用与任务视图相同的日期计算算法
        let newStartDate: Date | null = null

        if (props.timelineData &&
            (props.currentTimeScale === TimelineScale.DAY ||
             props.currentTimeScale === TimelineScale.MONTH ||
             props.currentTimeScale === TimelineScale.QUARTER ||
             props.currentTimeScale === TimelineScale.YEAR)) {
          // 有timelineData时，使用精确的日期计算
          newStartDate = calculateDateFromPosition(
            relativeX,
            props.timelineData,
            props.currentTimeScale,
          )
        }

        if (!newStartDate) {
          // 没有timelineData或计算失败，使用简单算法
          newStartDate = addDaysToLocalDate(props.startDate, relativeX / props.dayWidth)
        }

        // 计算任务持续时间（天数）
        const originalStartDate = createLocalDate(props.task.startDate) || props.startDate
        const originalEndDate = createLocalDate(props.task.endDate) || props.startDate
        const durationMs = originalEndDate.getTime() - originalStartDate.getTime()
        const duration = Math.ceil(durationMs / (1000 * 60 * 60 * 24))

        // 计算新的结束日期
        const newEndDate = new Date(newStartDate)
        newEndDate.setDate(newEndDate.getDate() + Math.max(0, duration))

        // 更新拖拽提示框内容
        dragTooltipContent.value = {
          startDate: formatDateToLocalString(newStartDate),
          endDate: formatDateToLocalString(newEndDate),
        }

        // v1.9.0 更新tempTaskData，让TaskBar有视觉移动效果（同行和跨行都需要）
        tempTaskData.value = {
          startDate: formatDateToLocalString(newStartDate),
          endDate: formatDateToLocalString(newEndDate),
        }
      }
      // 资源视图直接返回，不执行后续的任务视图逻辑
      return
    }

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

  // v1.9.0 资源视图垂直拖拽：检测是否移动到不同资源
  // @ts-expect-error - targetResourceRowIndex预留变量，未来可能使用
  let targetResourceRowIndex: number | undefined
  let isCrossRowDrag = false

  if (viewMode.value === 'resource' && isDragging.value && isDragThresholdMet.value && props.currentResourceId) {
    // 记录松开鼠标时的X位置（用于计算新日期）
    dragEndX.value = (window as any).event?.clientX || 0

    // 检测是否跨行（基于资源行的实际高度）
    const timelineBody = document.querySelector('.timeline-body')
    if (timelineBody) {
      const bodyRect = timelineBody.getBoundingClientRect()
      const mouseY = (window as any).lastDragMouseY || 0
      const relativeY = mouseY - bodyRect.top + (timelineBody as HTMLElement).scrollTop

      // 获取当前资源行的位置和高度
      const currentResourceId = String(props.currentResourceId)
      const currentRowTop = resourceRowPositions.value.get(currentResourceId) || 0
      const currentRowLayout = resourceTaskLayouts.value.get(currentResourceId)
      const currentRowHeight = currentRowLayout?.totalHeight || 51
      const currentRowBottom = currentRowTop + currentRowHeight

      // 判断鼠标是否超出当前资源行的边界
      isCrossRowDrag = relativeY < currentRowTop || relativeY >= currentRowBottom
    }

    // 只有跨行拖拽才发送drop事件
    if (isCrossRowDrag) {
      // 发送最后的鼠标位置给Timeline，让它确定目标资源
      window.dispatchEvent(
        new CustomEvent('resource-taskbar-drop', {
          detail: {
            taskId: props.task.id,
            task: props.task,
            sourceRowIndex: props.rowIndex,
            mouseY: (window as any).lastDragMouseY || 0,
            // v1.9.0 直接传递TaskBar已经计算好的精确日期，避免Timeline重复计算导致误差
            calculatedStartDate: tempTaskData.value?.startDate,
            calculatedEndDate: tempTaskData.value?.endDate,
          },
        }),
      )
    }

    // 隐藏拖拽预览
    dragPreviewVisible.value = false
  }

  // 只有达到拖拽阈值且有临时数据时才提交更新
  // v1.9.0 资源视图跨行拖拽时不提交，由确认对话框处理
  if (isDragThresholdMet.value && tempTaskData.value && !(viewMode.value === 'resource' && isCrossRowDrag)) {
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
  tempTaskPixelLeft.value = null  // v1.9.0 清除资源视图的像素位置缓存

  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// ResizeObserver 引用（在组件卸载时清理）
let nameResizeObserver: ResizeObserver | null = null

onMounted(() => {
  nextTick(() => {
    reportBarPosition()

    // 使用 ResizeObserver 监听任务名称宽度变化
    if (taskBarNameRef.value) {
      nameResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          nameTextWidth.value = entry.contentRect.width
        }
      })
      nameResizeObserver.observe(taskBarNameRef.value)
    }
  })

  // v1.9.0 监听资源拖拽取消事件
  const handleResourceDragCancel = (event: Event) => {
    const customEvent = event as CustomEvent
    if (customEvent.detail.taskId === props.task.id) {
      // 清除临时数据，让TaskBar恢复到原始位置
      tempTaskData.value = null
      tempTaskPixelLeft.value = null
    }
  }
  window.addEventListener('resource-drag-cancel', handleResourceDragCancel as EventListener)

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
  document.addEventListener('click', handleDocumentClick)

  // 清理函数
  onUnmounted(() => {
    // 清理 ResizeObserver
    if (nameResizeObserver) {
      nameResizeObserver.disconnect()
      nameResizeObserver = null
    }

    window.removeEventListener('timeline-scale-updated', handleTimelineScaleUpdate)
    window.removeEventListener('timeline-force-recalculate', handleForceRecalculate)
    window.removeEventListener('close-all-taskbar-menus', closeContextMenu)
    window.removeEventListener('resource-drag-cancel', handleResourceDragCancel as EventListener)
    document.removeEventListener('click', handleDocumentClick)

    // 清除长按定时器
    if (longPressTimer.value !== null) {
      clearTimeout(longPressTimer.value)
      longPressTimer.value = null
    }

    // 清理单击定时器
    if (clickTimer !== null) {
      clearTimeout(clickTimer)
      clickTimer = null
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
  const singleAvatarWidth = 22 // 单个avatar 宽度
  // 计算实际avatar总宽度（多个头像时会重叠，每个头像露出18px）
  const actualAvatarCount = avatarList.value.length
  const avatarTotalWidth = actualAvatarCount > 0
    ? (actualAvatarCount === 1 ? singleAvatarWidth : singleAvatarWidth + (actualAvatarCount - 1) * 18)
    : 0
  const handleWidth = actualHandleWidth.value // 拉伸手柄宽度

  // === 第一步：检测 Avatar 是否需要粘性定位 ===
  const avatarDefaultLeft = handleWidth + 3 // 手柄宽度 + 3px 间距
  const avatarLeftPos = taskLeft + avatarDefaultLeft
  const avatarRightPos = taskLeft + avatarDefaultLeft + avatarTotalWidth

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
    avatarStickyOffset = avatarTotalWidth + 8 // avatar 总宽度 + 右侧间距
  } else if (avatarNeedsRightSticky) {
    // avatar 应该停靠在 name/progress 左侧 15px 的位置
    // 计算 name/progress 在右边界时的位置（它们会贴在右边框上）
    const maxContentWidth = Math.max(nameWidth, progressWidth)
    // 内容贴右边框时的左侧位置，考虑手柄宽度
    const contentRightPos = rightBoundary - taskLeft - maxContentWidth - handleWidth - 3
    const offset = contentRightPos - avatarTotalWidth - 15 // avatar 在内容左侧 15px
    avatarLeft = `${offset}px`
    avatarPosition = 'absolute'
    avatarStickyOffset = -(avatarTotalWidth + 15) // 负值表示在右侧，avatar总宽度 + 15px间距
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
    const avatarReservedSpace = avatarTotalWidth + 15 // avatar 需要的空间（实际总宽度 + 间距）
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
    // 使用avatarStickyOffset，已经包含avatar总宽度 + 8px间距
    const extraOffset = avatarNeedsLeftSticky ? avatarStickyOffset : 0
    nameLeft = `${offset + handleWidth + 3 + extraOffset}px` // 考虑手柄宽度 + 间距
    namePosition = 'absolute'
    nameTop = '2px'
  } else if (nameNeedsRightSticky) {
    const offset = rightBoundary - taskLeft - nameWidth
    // name 右侧磁吸时应始终保持与右边框固定距离，需要减去右侧手柄宽度
    nameLeft = `${offset - handleWidth - 10}px` // 考虑手柄宽度 + 间距
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
    const avatarReservedSpace = avatarTotalWidth + 15 // avatar 需要的空间（实际总宽度 + 间距）
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
    // 使用avatarStickyOffset，已经包含avatar总宽度 + 8px间距
    const extraOffset = avatarNeedsLeftSticky ? avatarStickyOffset : 0
    progressLeft = `${offset + handleWidth + 3 + extraOffset}px` // 考虑手柄宽度 + 间距
    progressPosition = 'absolute'
    progressTop = '18px'
  } else if (progressNeedsRightSticky) {
    const offset = rightBoundary - taskLeft - progressWidth
    // 右侧磁吸时应始终保持与右边框固定距离，需要减去右侧手柄宽度
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

// TaskBar 悬停 tooltip 状态
const showHoverTooltip = ref(false)
const hoverTooltipPosition = ref({ x: 0, y: 0 })
const isTooltipBelow = ref(false) // v1.9.0 标记tooltip是否显示在TaskBar下方
let hoverTooltipTimer: number | null = null

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

      // 🔥 容器宽度变化时，标记初始化完成（修复 splitter 拖拽后半圆不显示的问题）
      if (isInitializing.value) {
        setTimeout(() => {
          isInitializing.value = false
        }, 300)
      }

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
  { immediate: true },
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

  // v1.9.1 隐藏TaskBar的hover tooltip，只显示bubble tooltip
  showHoverTooltip.value = false
  // 清除可能正在等待的tooltip定时器
  if (hoverTooltipTimer) {
    window.clearTimeout(hoverTooltipTimer)
    hoverTooltipTimer = null
  }

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

// 处理TaskBar悬停事件
const handleTaskBarMouseEnter = (event: MouseEvent) => {
  isTaskBarHovered.value = true

  // v1.9.2 如果 tab 正在悬停，不显示 TaskBar 的 tooltip
  if (isTabHovered.value) {
    return
  }

  // 如果启用了TaskBar Tooltip（父级任务也显示tooltip）
  // 但在拖拽或拉伸时不显示tooltip
  if (props.enableTaskBarTooltip !== false && !isDragging.value && !isResizingLeft.value && !isResizingRight.value) {
    // 保存event.currentTarget的引用，因为在setTimeout回调中它会变成null
    const targetElement = event.currentTarget as HTMLElement
    // 保存鼠标位置
    // @ts-expect-error - 预留变量，未来可能使用
    const mouseX = event.clientX
    // @ts-expect-error - 预留变量，未来可能使用
    const mouseY = event.clientY

    // 延迟显示tooltip，避免快速滑过时显示
    hoverTooltipTimer = window.setTimeout(() => {
      showHoverTooltip.value = true
      const rect = targetElement.getBoundingClientRect()

      // 计算tooltip的预估宽高（根据实际CSS设置）
      const tooltipWidth = 250 // 预估宽度
      const tooltipHeight = 120 // 预估高度（考虑实际内容高度）
      const margin = 10 // 边距

      // 视口尺寸
      const viewportWidth = window.innerWidth
      // @ts-expect-error - 预留变量，未来可能使用
      const viewportHeight = window.innerHeight

      // v1.9.0 改为基于TaskBar边界定位
      // 水平位置：TaskBar中心对齐
      let x = rect.left + rect.width / 2
      // 默认显示在TaskBar上方边缘外（CSS transform: translateY(-100%)会向上偏移tooltip高度）
      let y = rect.top - 10

      // 水平边界检测：左侧超出
      if (x - tooltipWidth / 2 < margin) {
        x = margin + tooltipWidth / 2
      }
      // 水平边界检测：右侧超出
      if (x + tooltipWidth / 2 > viewportWidth - margin) {
        x = viewportWidth - margin - tooltipWidth / 2
      }

      // 垂直边界检测：如果上方空间不足，显示在下方
      if (rect.top - 10 - tooltipHeight < margin) {
        // 显示在TaskBar下方
        y = rect.bottom + 10
        isTooltipBelow.value = true
      } else {
        isTooltipBelow.value = false
      }

      hoverTooltipPosition.value = { x, y }
    }, 300) // 300ms延迟
  }
}

const handleTaskBarMouseLeave = () => {
  isTaskBarHovered.value = false

  // 清除定时器并隐藏tooltip
  if (hoverTooltipTimer) {
    clearTimeout(hoverTooltipTimer)
    hoverTooltipTimer = null
  }
  showHoverTooltip.value = false
}

// 监听拖拽/拉伸状态，如果开始拖拽/拉伸，立即隐藏tooltip
watch([isDragging, isResizingLeft, isResizingRight], ([dragging, resizingL, resizingR]) => {
  if (dragging || resizingL || resizingR) {
    showHoverTooltip.value = false
    if (hoverTooltipTimer) {
      clearTimeout(hoverTooltipTimer)
      hoverTooltipTimer = null
    }
  }

  // v1.9.2 同步拖拽状态到Timeline（用于冲突检测优化）
  const isDraggingOrResizing = dragging || resizingL || resizingR
  if (timelineIsDraggingTaskBar.value !== isDraggingOrResizing) {
    timelineIsDraggingTaskBar.value = isDraggingOrResizing
  }
})

// v1.9.2 监听 Tab 悬停状态，当 Tab 悬停时立即隐藏 TaskBar 的 tooltip
watch(isTabHovered, (tabHovered) => {
  if (tabHovered) {
    // Tab 悬停：隐藏 TaskBar 的 tooltip
    showHoverTooltip.value = false
    if (hoverTooltipTimer) {
      clearTimeout(hoverTooltipTimer)
      hoverTooltipTimer = null
    }
  } else {
    // Tab 离开：如果鼠标还在 TaskBar 上，重新显示 tooltip
    if (isTaskBarHovered.value && props.enableTaskBarTooltip !== false) {
      showHoverTooltip.value = true
    }
  }
})

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
  // 如果不应该显示任何菜单，直接阻止
  if (!shouldShowAnyContextMenu.value) {
    event.preventDefault()
    return
  }

  // 高亮模式下禁用右键菜单
  if (props.isHighlighted || props.isPrimaryHighlight) {
    event.preventDefault()
    return
  }

  // 先广播关闭所有TaskBar菜单
  window.dispatchEvent(new CustomEvent('close-all-taskbar-menus'))
  const taskType = props.task.type || 'task'
  if (taskType !== 'task' && taskType !== 'story') {
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

// 处理文档点击事件，点击菜单外部时关闭
function handleDocumentClick(event: MouseEvent) {
  if (!contextMenuVisible.value) return

  const target = event.target as HTMLElement
  // 检查点击是否在右键菜单内部
  const contextMenuElement = document.querySelector('.task-context-menu')
  if (contextMenuElement && contextMenuElement.contains(target)) {
    return
  }

  closeContextMenu()
}

const handleTaskDelete = (task: Task, deleteChildren?: boolean) => {
  // 触发删除事件
  emit('delete', task, deleteChildren)
  closeContextMenu()
}

// 处理删除链接事件
const handleDeleteLink = (event: { sourceTaskId: number; targetTaskId: number }) => {
  emit('delete-link', event)
  closeContextMenu()
}

// 连接线触点事件处理
const handleLinkDragStart = (event: { task: Task; type: 'predecessor' | 'successor'; mouseEvent: MouseEvent }) => {
  emit('link-drag-start', event)
}

const handleLinkDragMove = (event: { mouseX: number; mouseY: number }) => {
  emit('link-drag-move', event)
}

const handleLinkDragEnd = (event: { task: Task; type: 'predecessor' | 'successor' }) => {
  emit('link-drag-end', event)
}

// 处理 LinkAnchor 的 drag-start 事件（转换为统一格式）
const handleAnchorDragStart = (anchorEvent: { taskId: number; type: 'predecessor' | 'successor'; x: number; y: number }) => {
  const mouseEvent = {
    clientX: anchorEvent.x,
    clientY: anchorEvent.y,
  } as MouseEvent

  handleLinkDragStart({
    task: props.task,
    type: anchorEvent.type,
    mouseEvent,
  })
}

// 处理 LinkAnchor 的 drag-move 事件
const handleAnchorDragMove = (anchorEvent: { x: number; y: number }) => {
  handleLinkDragMove({
    mouseX: anchorEvent.x,
    mouseY: anchorEvent.y,
  })
}

// 处理 LinkAnchor 的 drag-end 事件
const handleAnchorDragEnd = (anchorEvent: { taskId: number; type: 'predecessor' | 'successor' }) => {
  handleLinkDragEnd({
    task: props.task,
    type: anchorEvent.type,
  })
}
</script>

<template>
  <!-- 根容器：包裹所有非Teleport的元素，接收传递的style属性 -->
  <div class="task-bar-wrapper" v-bind="$attrs">
    <!-- 实际进度条（独立渲染在下层） -->
    <div
      v-if="actualBarStyle && shouldRenderTaskBar && !isParent"
      class="actual-bar"
      :data-task-id="`actual-${task.id}`"
      :class="{
        'highlighted': isHighlighted,
        'primary-highlight': isPrimaryHighlight,
        'dimmed': isDimmed,
      }"
      :style="{
        ...actualBarStyle,
        backgroundColor: taskStatus.color,
        filter: 'brightness(1.15) saturate(0.9)', /* 加白并降低饱和度，与计划TaskBar色系一致 */
        boxShadow: `0 6px 20px ${taskStatus.color}60, 0 3px 10px ${taskStatus.color}40`, /* 使用TaskBar颜色的阴影，移除白边 */
      }"
    >
    <div class="actual-bar-content">
      <span class="actual-progress">{{ task.progress || 0 }}%</span>
    </div>
    <!-- 头像和标题放置在实际TaskBar尾部外面 -->
    <div class="actual-bar-trailing">
      <!-- 实际TaskBar的多头像容器 -->
      <div
        v-if="barConfig.showAvatar && avatarList.length > 0"
        class="actual-avatars-container"
      >
        <div
          v-for="(avatarItem, index) in avatarList"
          :key="index"
          class="actual-task-avatar"
          :class="{ 'avatar-default': !avatarItem || (typeof avatarItem === 'object' && !avatarItem.isText && !avatarItem) }"
          :style="{
            zIndex: index + 1,
            marginLeft: index > 0 ? '-8px' : '0'
          }"
        >
          <!-- 文字头像（从assignee生成） -->
          <span v-if="avatarItem && typeof avatarItem === 'object' && avatarItem.isText" class="avatar-text">
            {{ avatarItem.name.charAt(0).toUpperCase() }}
          </span>
          <!-- 图片头像 -->
          <img v-else-if="avatarItem && typeof avatarItem === 'string'" :src="avatarItem" :alt="`avatar-${index}`" />
          <!-- 默认灰色用户图标 -->
          <svg v-else class="avatar-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
          </svg>
        </div>
      </div>
      <!-- 任务标题 - 支持HTML解析和自定义slot -->
      <div
        v-if="barConfig.showTitle"
        class="actual-task-name-wrapper"
        :style="{
          fontSize: '12px',
          color: taskStatus.color,
        }"
      >
        <slot v-if="hasContentSlot" name="custom-task-content" v-bind="slotPayload" />
        <div v-else class="actual-task-name" v-html="task.name"></div>
      </div>
    </div>
  </div>

  <!-- 计划进度条（原有TaskBar） -->
  <div
    v-if="shouldRenderTaskBar"
    ref="barRef"
    class="task-bar"
    :data-task-id="task.id"
    :style="{
      ...taskBarStyle,
      backgroundColor: (showActualTaskbar && hasActualProgress && isTaskBarHovered) ? 'transparent' : taskStatus.bgColor,
      borderColor: dynamicBorderColor,
      ...(viewMode === 'resource' && currentResourceId ? {
        borderTopWidth: '2px',
        borderTopStyle: 'solid',
        borderTopColor: currentResourceColor,
      } : {}),
      color: taskStatus.color,
      cursor: isCompleted || isParent ? 'default' : 'move',
      '--row-height': `${rowHeight}px` /* 传递行高给CSS变量 */,
      '--handle-width': `${actualHandleWidth}px` /* 传递手柄宽度给CSS变量 */,
      '--parent-color': taskStatus.color, /* 传递父级TaskBar颜色给伪元素箭头使用 */
      '--allocation-percent': (Number.isFinite(resourcePercent) ? resourcePercent / 100 : 1), /* v1.9.1 传递占比给CSS变量 */
      '--task-bar-bg-color': taskStatus.bgColor, /* v1.9.1 传递背景色给伪元素 */
      '--task-bar-border-color': dynamicBorderColor, /* v1.9.2 使用动态边框颜色 */
      boxShadow: isParent
        ? `0 4px 16px ${taskStatus.color}40, 0 2px 8px ${taskStatus.color}26` /* 父级任务也使用动态颜色阴影 */
        : `0 4px 16px ${taskStatus.color}40, 0 2px 8px ${taskStatus.color}26`, /* 使用TaskBar颜色的阴影 - 加强版 */
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
      'has-actual': showActualTaskbar && hasActualProgress, /* 只有在showActualTaskbar=true时才标记有实际进度 */
      'resource-conflict': props.hasResourceConflict, /* v1.9.0 资源冲突样式 */
      'resource-view': viewMode === 'resource', /* v1.9.1 资源视图专属样式 */
      'has-bubble': bubbleIndicator.show, /* v1.9.1 有气泡时提升层级，确保气泡不被其他TaskBar遮挡 */
    }"
    @click="handleTaskBarClick"
    @contextmenu="handleContextMenu"
    @dblclick="handleTaskBarDoubleClick"
    @mouseenter="handleTaskBarMouseEnter"
    @mouseleave="handleTaskBarMouseLeave"
  >
    <!-- 父级任务的标题（直接在内部居中显示） -->
    <div v-if="isParent" class="parent-label-inner">
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

    <!-- v1.9.2 资源视图Tab标签 -->
    <TaskBarTab
      v-if="viewMode === 'resource' && !isParent && currentResourceId"
      :key="`tab-${task.id}-${currentResourceId}`"
      :task="task"
      :current-resource-id="currentResourceId"
      :resource-color="currentResourceColor"
      :resource-percent="resourcePercent"
      :resource-name="currentResourceName"
      :task-bar-width="taskBarWidth"
      :has-conflict="hasResourceConflict"
      :conflict-tasks="conflictTasks"
      :resources="resources"
      @hover-change="isTabHovered = $event"
    />

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
      <!-- 任务头像 - 有实际TaskBar时隐藏，支持多头像 -->
      <div
        v-if="barConfig.showAvatar && !(showActualTaskbar && hasActualProgress) && avatarList.length > 0"
        class="task-avatars-container"
        :class="{ 'avatar-outside': shouldRenderAvatarOutside }"
        :style="getAvatarStyles()"
      >
        <div
          v-for="(avatarItem, index) in avatarList"
          :key="index"
          class="task-avatar"
          :class="{ 'avatar-default': !avatarItem || (typeof avatarItem === 'object' && !avatarItem.isText && !avatarItem) }"
          :style="{
            zIndex: index + 1,
            marginLeft: index > 0 ? '-8px' : '0'
          }"
        >
          <!-- 文字头像（从assignee生成） -->
          <span v-if="avatarItem && typeof avatarItem === 'object' && avatarItem.isText" class="avatar-text">
            {{ avatarItem.name.charAt(0).toUpperCase() }}
          </span>
          <!-- 图片头像 -->
          <img v-else-if="avatarItem && typeof avatarItem === 'string'" :src="avatarItem" :alt="`avatar-${index}`" />
          <!-- 默认灰色用户图标 -->
          <svg v-else class="avatar-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
          </svg>
        </div>
      </div>

      <!-- 任务名称 - 有实际TaskBar时隐藏 -->
      <div
        v-if="barConfig.showTitle && !(showActualTaskbar && hasActualProgress)"
        ref="taskBarNameRef"
        :style="getNameStyles()"
      >
        <slot v-if="hasContentSlot" name="custom-task-content" v-bind="slotPayload" />
        <div v-else class="task-name">
          {{ task.name }}
          <!-- v1.9.0 资源视图：显示占比文字 -->
          <span v-if="shouldShowPercentText" class="resource-percent-text">
            {{ resourcePercent }}%
          </span>
        </div>
      </div>

      <!-- 进度百分比 - 有实际TaskBar时隐藏 -->
      <div
        v-if="barConfig.showProgress && shouldShowProgress && !(showActualTaskbar && hasActualProgress)"
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

    <!-- 连接线触点 - 只在非高亮模式且非父级任务时显示 -->
    <!-- 前置任务触点（左侧） -->
    <LinkAnchor
      v-if="enableLinkAnchor && !isParent && !isInHighlightMode"
      type="predecessor"
      :task-id="task.id"
      :visible="isTaskBarHovered"
      :is-drag-source="isLinkDragSource && dragLinkMode === 'predecessor'"
      :is-drag-target="isValidLinkTarget || isInvalidLinkTarget"
      :is-valid-target="isValidLinkTarget"
      :global-dragging="!!dragLinkMode"
      @drag-start="handleAnchorDragStart"
      @drag-move="handleAnchorDragMove"
      @drag-end="handleAnchorDragEnd"
    />
    <!-- 后置任务触点（右侧） -->
    <LinkAnchor
      v-if="enableLinkAnchor && !isParent && !isInHighlightMode"
      type="successor"
      :task-id="task.id"
      :visible="isTaskBarHovered"
      :is-drag-source="isLinkDragSource && dragLinkMode === 'successor'"
      :is-drag-target="isValidLinkTarget || isInvalidLinkTarget"
      :is-valid-target="isValidLinkTarget"
      :global-dragging="!!dragLinkMode"
      @drag-start="handleAnchorDragStart"
      @drag-move="handleAnchorDragMove"
      @drag-end="handleAnchorDragEnd"
    />

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

    <!-- 默认右键菜单 -->
    <TaskContextMenu
      v-if="shouldShowDefaultContextMenu"
      :visible="contextMenuVisible"
      :task="contextMenuTask"
      :position="contextMenuPosition"
      :all-tasks="allTasks"
      @close="closeContextMenu"
      @start-timer="$emit('start-timer', props.task)"
      @stop-timer="$emit('stop-timer', props.task)"
      @add-predecessor="$emit('add-predecessor', props.task)"
      @add-successor="$emit('add-successor', props.task)"
      @delete="handleTaskDelete"
      @delete-link="handleDeleteLink"
    />

    <!-- 声明式右键菜单 -->
    <Teleport to="body">
      <div
        v-if="shouldShowCustomContextMenu && contextMenuVisible && declarativeTaskBarContextMenu?.defaultSlot"
        class="gantt-context-menu-wrapper"
        :style="{
          position: 'fixed',
          left: `${contextMenuPosition.x}px`,
          top: `${contextMenuPosition.y}px`,
          zIndex: 9999,
        }"
      >
        <component
          :is="declarativeTaskBarContextMenu.defaultSlot"
          :row="contextMenuTask"
          :$index="props.rowIndex ?? -1"
        />
      </div>
    </Teleport>
  </div>
  </div><!-- 关闭task-bar-wrapper -->

  <!-- Tooltip 弹窗（tab悬停时不显示） -->
  <Teleport to="body">
    <div
      v-if="showTooltip && !isTabHovered"
      class="task-tooltip"
      :style="{
        left: `${tooltipPosition.x}px`,
        top: `${tooltipPosition.y}px`,
      }"
    >
      <div class="tooltip-arrow"></div>
      <div class="tooltip-title">{{ task.name }}</div>
      <div class="tooltip-content">
        <!-- v1.9.0 资源视图：显示投入占比 -->
        <div v-if="viewMode === 'resource' && resourcePercent < 100" class="tooltip-row">
          <span class="tooltip-label">{{ t('investment') || '投入' }}:</span>
          <span class="tooltip-value">{{ resourcePercent }}%</span>
        </div>
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
        <!-- v1.9.0 资源冲突警告 -->
        <div v-if="props.hasResourceConflict" class="tooltip-row tooltip-warning">
          <span class="tooltip-label">⚠️ {{ t('resourceOverloaded') || '资源超负荷' }}</span>
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

  <!-- v1.9.0 拖拽预览效果（资源视图垂直拖拽） -->
  <Teleport to="body">
    <div
      v-if="dragPreviewVisible"
      class="drag-preview"
      :style="{
        left: `${dragPreviewPosition.x}px`,
        top: `${dragPreviewPosition.y}px`,
        width: taskBarStyle.width,
        height: taskBarStyle.height,
        backgroundColor: taskStatus.color,
        borderColor: taskStatus.borderColor,
      }"
    >
      <div class="drag-preview-content">{{ task.name }}</div>
    </div>
  </Teleport>

  <!-- TaskBar悬停提示框 -->
  <Teleport to="body">
    <div
      v-if="showHoverTooltip"
      class="task-hover-tooltip"
      :class="{ 'tooltip-below': isTooltipBelow }"
      :style="{
        left: `${hoverTooltipPosition.x}px`,
        top: `${hoverTooltipPosition.y}px`,
        backgroundColor: taskStatus.color,
      }"
    >
      <div class="hover-tooltip-arrow" :style="{
        borderTopColor: isTooltipBelow ? 'transparent' : taskStatus.color,
        borderBottomColor: isTooltipBelow ? taskStatus.color : 'transparent'
      }"></div>
      <div class="hover-tooltip-content">
        <div class="hover-tooltip-title">{{ task.name }}</div>
        <div class="hover-tooltip-row">
          <span class="hover-tooltip-label">{{ t('plannedStartDate') }}:</span>
          <span class="hover-tooltip-value">{{ formatDisplayDate(task.startDate) }}</span>
        </div>
        <div class="hover-tooltip-row">
          <span class="hover-tooltip-label">{{ t('plannedEndDate') }}:</span>
          <span class="hover-tooltip-value">{{ formatDisplayDate(task.endDate) }}</span>
        </div>
        <div class="hover-tooltip-row">
          <span class="hover-tooltip-label">{{ t('actualStartDate') }}:</span>
          <span class="hover-tooltip-value">{{ task.actualStartDate ? formatDisplayDate(task.actualStartDate) : '-' }}</span>
        </div>
        <div class="hover-tooltip-row">
          <span class="hover-tooltip-label">{{ t('actualEndDate') }}:</span>
          <span class="hover-tooltip-value">{{ task.actualEndDate ? formatDisplayDate(task.actualEndDate) : '-' }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* 根容器：透明容器，仅用于接收传递的style属性 */
.task-bar-wrapper {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none; /* 让所有事件穿透到子元素 */
}

.task-bar-wrapper > * {
  pointer-events: auto; /* 恢复子元素的事件响应 */
}

.task-bar {
  position: absolute;
  border-radius: 4px;
  user-select: none;
  /* 阴影通过JS动态设置，使用TaskBar的颜色 */
  transition:
    box-shadow 0.2s,
    transform 0.3s,
    filter 0.3s,
    z-index 0s; /* v1.9.0 z-index不使用动画 */
  z-index: 100;
  border: 2px solid;
  /* 添加半透明黑色边框增强对比度 */
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
  overflow: visible; /* 允许内容超出 TaskBar */
}

/* v1.9.0 悬停时提升z-index，确保资源视图中重叠的TaskBar可以正常交互 */
.task-bar:hover {
  z-index: 160 !important;
}

/* v1.9.1 有气泡指示器时提升z-index，解决DOM渲染顺序导致的遮挡问题 */
.task-bar.has-bubble {
  z-index: 200 !important;
}

/* 有实际进度时，计划条使用虚线边框样式 */
.task-bar.has-actual {
  /* 不再强制设置半透明背景，由内联样式的isTaskBarHovered控制 */
  border-width: 2px;
  border-style: dashed; /* 虚线边框表示这是计划 */
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.3) inset,
    0 2px 8px rgba(0, 0, 0, 0.15); /* 内阴影增强边缘清晰度 */
}

/* 有实际TaskBar的计划TaskBar悬停时，提升到顶层 */
.task-bar.has-actual:hover {
  z-index: 160 !important; /* 高于实际TaskBar的150 */
}

/* 有实际进度时，增强文字清晰度 */
.task-bar.has-actual .task-bar-content {
  text-shadow:
    0 1px 3px rgba(255, 255, 255, 0.8),
    0 0 1px rgba(255, 255, 255, 1); /* 白色外发光增强对比度 */
}

.task-bar.has-actual .task-name,
.task-bar.has-actual .task-progress {
  font-weight: 600;
  color: #333 !important; /* 深色文字确保可读性 */
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

/* v1.9.1 资源视图TaskBar全高度占比设计 */
.task-bar.resource-view {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

/* 上半部分：镂空区域（仅上、左、右三边虚线） */
.task-bar.resource-view::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: calc((1 - var(--allocation-percent, 1)) * 100%);
  border-top: 1.5px dashed currentColor;
  border-left: 1.5px dashed currentColor;
  border-right: 1.5px dashed currentColor;
  border-bottom: none;
  background: transparent;
  box-sizing: border-box;
  pointer-events: none;
  border-radius: 4px 4px 0 0;
  opacity: 0.6;
  z-index: -1; /* v1.9.1 设置为负值，确保不遮挡 bubble-indicator */
}

/* 占比100%时，隐藏上半部分镂空区域 */
.task-bar.resource-view[style*="--allocation-percent: 1"]::before {
  display: none;
}

/* 下半部分：实心填充区域（四边实线边框 + 背景色） */
.task-bar.resource-view::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(var(--allocation-percent, 1) * 100%);
  background: var(--task-bar-bg-color, #e3f2fd);
  /*border: 1px solid var(--task-bar-border-color, #90caf9);*/
  border-radius: 0 0 4px 4px;
  box-sizing: border-box;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
  pointer-events: none;
  z-index: -1; /* v1.9.1 设置为负值，确保不遮挡 bubble-indicator */
}

/* 占比100%时，整个TaskBar都是实心，四个角圆角 */
.task-bar.resource-view[style*="--allocation-percent: 1"]::after {
  border-radius: 4px;
}

/* 进度条限制在填充区内 */
.task-bar.resource-view .progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  top: auto;
  height: calc(var(--allocation-percent, 1) * 100%);
  z-index: 1;
  border-radius: 0 0 4px 4px;
  pointer-events: none;
  box-shadow: 2px 0 6px rgba(0, 0, 0, 0.8); /* 右侧黑色阴影，增强层次感 */
}

/* 占比100%时，进度条四个角圆角 */
.task-bar.resource-view[style*="--allocation-percent: 1"] .progress-bar {
  border-radius: 4px;
}

/* 已完成任务的进度条不显示阴影 */
.task-bar.completed.resource-view .progress-bar {
  box-shadow: none;
}

/* 文字层在最上层，覆盖整个41px高度 */
.task-bar.resource-view .task-bar-content {
  position: relative;
  /*z-index: 2;*/
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 资源视图悬停效果 */
.task-bar.resource-view:hover::after {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* v1.9.0 资源冲突样式 - 已移除，由GanttConflicts组件独立渲染 */
/*
.task-bar.resource-conflict::before {
  border-color: var(--gantt-error-color, #f56c6c) !important;
  opacity: 1 !important;
  z-index: 10 !important;
}

.task-bar.resource-conflict::after {
  border-left: 3px solid var(--gantt-error-color, #f56c6c) !important;
  background-color: rgba(245, 108, 108, 0.12) !important;
  background-image:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(245, 108, 108, 0.1) 10px,
      rgba(245, 108, 108, 0.1) 20px
    ) !important;
  z-index: 1 !important;
}

.task-bar.completed.resource-conflict::after {
  background-color: transparent !important;
  background-image: none !important;
  border-left: 3px solid var(--gantt-error-color, #f56c6c) !important;
}

.task-bar.resource-conflict .task-name,
.task-bar.resource-conflict .task-progress {
  font-weight: 600;
  z-index: 11;
}
*/


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
  z-index: 1 !important; /* 确保dimmed的任务在蒙版之下 */
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
  border-radius: 0 !important; /* 不要圆角 */
  height: 15px !important; /* 高度15px */
  border: none; /* 移除边框 */
  /* background通过内联样式设置，使用taskStatus.bgColor，支持自定义barColor */
  top: 50% !important; /* 上下居中 */
  transform: translateY(-50%); /* 上下居中 */
  cursor: pointer !important; /* 允许双击编辑 */
  overflow: visible; /* 确保标题和箭头可见 */
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 高亮的父任务覆盖默认样式 */
.task-bar.parent-task.highlighted {
  box-shadow:
    0 8px 24px rgba(64, 158, 255, 0.5),
    0 6px 16px rgba(0, 0, 0, 0.3) !important;
  filter: brightness(1.2) drop-shadow(0 0 8px rgba(64, 158, 255, 0.4)) !important;
  transform: translateY(-50%) scale(1.05) !important;
}

.task-bar.parent-task.primary-highlight {
  box-shadow:
    0 12px 32px rgba(64, 158, 255, 0.6),
    0 8px 20px rgba(0, 0, 0, 0.35) !important;
  filter: brightness(1.25) drop-shadow(0 0 12px rgba(64, 158, 255, 0.6)) !important;
  transform: translateY(-50%) scale(1.08) !important;
}

/* 左侧向下箭头 */
.task-bar.parent-task::before {
  content: '';
  position: absolute;
  top: 14px; /* 紧贴进度条下方，消除缝隙 */
  left: 0;
  width: 0;
  height: 0;
  border-right: 6px solid transparent;
  border-top: 10px solid var(--parent-color, #409eff); /* 使用父级TaskBar的动态颜色 */
  z-index: 15;
}

/* 右侧向下箭头 */
.task-bar.parent-task::after {
  content: '';
  position: absolute;
  top: 14px; /* 紧贴进度条下方，消除缝隙 */
  right: 0;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-top: 10px solid var(--parent-color, #409eff); /* 使用父级TaskBar的动态颜色 */
  z-index: 15;
}

/* 父级任务的标题（内部居中显示） */
.task-bar.parent-task .parent-label-inner {
  color: white;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}





.progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  opacity: 0.3;
  transition: width 0.3s ease;
}

/* 实际进度条样式 - 独立在顶层渲染 */
.actual-bar {
  position: absolute;
  height: 20px !important; /* 固定高度，比计划条窄 */
  border-radius: 10px; /* 两头圆形，高度20px的50% */
  /* 边框通过内联样式设置，使用TaskBar颜色 */
  /* 阴影通过JS动态设置，使用TaskBar的颜色 */
  z-index: 150; /* 高于计划条的z-index(100)，显示在顶层 */
  transition: all 0.3s ease;
  user-select: none;
  pointer-events: none; /* 不响应鼠标事件，避免干扰计划条的交互 */
  opacity: 1; /* 完全不透明，实际条要清晰可见 */
  /* 背景色通过内联样式设置，但会在filter中加白和增加透明度 */
}

/* 实际TaskBar的dimmed状态 - 确保在蒙版之下 */
.actual-bar.dimmed {
  z-index: 1 !important;
  opacity: 0.35 !important;
  filter: grayscale(0.3) brightness(1.15) saturate(0.9) !important;
}

.actual-bar:hover {
  /* hover阴影也通过JS动态设置 */
}

/* 实际TaskBar的高亮样式 - 跟随计划TaskBar */
.actual-bar.highlighted {
  z-index: 1004 !important; /* 高于计划TaskBar的highlighted(1002)，确保在上层 */
  transform: translateY(-5px) scale(1.05) !important;
  transition: all 0.3s ease !important;
  filter: brightness(1.25) saturate(1.0) !important; /* 高亮时更亮 */
}

/* 实际TaskBar的主要高亮样式 */
.actual-bar.primary-highlight {
  z-index: 1005 !important; /* 高于计划TaskBar的primary-highlight(1003)，确保在上层 */
  transform: translateY(-8px) scale(1.08) !important;
  transition: all 0.3s ease !important;
  filter: brightness(1.3) saturate(1.0) !important; /* 主要高亮时最亮 */
}

/* 实际TaskBar的头像样式 - 在尾部外面 */
.actual-task-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  background: #f0f0f0;
  border: 2px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 200; /* 显示在最顶层 */
}

.actual-task-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.actual-task-avatar .avatar-text {
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.actual-task-avatar .avatar-icon {
  width: 14px;
  height: 14px;
  color: #999;
}

.actual-bar-content {
  display: flex;
  align-items: center;
  justify-content: flex-end; /* 右对齐 */
  height: 100%;
  padding: 0 8px;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
  overflow: hidden;
  position: relative;
  z-index: 200; /* 显示在最顶层 */
}

/* 尾部外面的容器：头像 + 标题 */
.actual-bar-trailing {
  position: absolute;
  left: 100%; /* 从实际TaskBar右侧开始 */
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 10px; /* 头像和标题之间的间距 */
  margin-left: 6px;
  pointer-events: none;
  z-index: 200; /* 显示在最顶层，超过计划TaskBar */
}

/* 实际TaskBar的标题容器 */
.actual-task-name-wrapper {
  position: relative;
  z-index: 200; /* 显示在最顶层 */
  display: flex;
  align-items: center; /* 垂直居中 */
}

/* 实际TaskBar的标题样式 - 与原始.task-name完全一致 */
.actual-task-name {
  white-space: nowrap;
  overflow: visible;
  line-height: 1.2;
  font-size: 12px;
  font-weight: 700; /* 加粗显示 */
  z-index: 10;
  /* 移除背景样式，保持原始状态 */
}

/* 暗黑主题下的标题颜色 */
:global(html[data-theme='dark']) .actual-task-name {
  color: #ffffff !important;
}

.actual-progress {
  flex-shrink: 0;
  opacity: 0.95;
  font-weight: 700;
  letter-spacing: 0.3px;
  position: relative;
  z-index: 200; /* 显示在最顶层 */
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

/* 多头像容器 - 继承原始头像的定位样式 */
.task-avatars-container {
  display: flex;
  align-items: center;
  position: absolute;
  left: calc(var(--handle-width, 5px) + 3px); /* 手柄宽度 + 3px 间距 */
  top: 50%;
  transform: translateY(-50%);
}

.actual-avatars-container {
  display: flex;
  align-items: center;
  position: relative;
}

/* 多头像重叠效果 */
.task-avatars-container .task-avatar,
.actual-avatars-container .actual-task-avatar {
  transition: transform 0.2s ease, z-index 0s;
  cursor: pointer;
  position: relative; /* 改为相对定位，在容器内排列 */
}

/* 悬停时突出显示当前头像 */
.task-avatars-container .task-avatar:hover,
.actual-avatars-container .actual-task-avatar:hover {
  transform: translateY(-3px) scale(1.15);
  z-index: 999 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.task-avatar {
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
.task-avatars-container.avatar-outside {
  left: -12px; /* 位于 taskbar 左侧外框边缘 */
  z-index: 20; /* 提高层级确保在最上层 */
}

.task-avatar.avatar-outside {
  border-width: 2px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

/* 当任务条较窄时，调整内容padding以避免与头像重叠 */
.task-bar-content:has(.task-avatars-container) {
  padding-left: 36px; /* 为头像留出空间 */
}

/* 当 avatar 在外框时，不需要额外的 padding */
.task-bar-content:has(.task-avatars-container.avatar-outside) {
  padding-left: 8px;
}

/* v1.9.1 资源视图中的标题包裹器，确保在41px全高度内居中 */
.task-name-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
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

/* v1.9.0 资源占比文字样式 */
.resource-percent-text {
  display: inline-block;
  margin-left: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--gantt-text-on-primary, inherit);
  opacity: 0.9;
}

/* TaskBar宽度<40px时隐藏占比文字 */
.task-bar[style*="width: 4px"],
.task-bar[style*="width: 8px"],
.task-bar[style*="width: 12px"],
.task-bar[style*="width: 16px"],
.task-bar[style*="width: 20px"],
.task-bar[style*="width: 24px"],
.task-bar[style*="width: 28px"],
.task-bar[style*="width: 32px"],
.task-bar[style*="width: 36px"] {
  .resource-percent-text {
    display: none;
  }
}

.task-progress {
  opacity: 0.9;
  font-size: 11px;
  font-weight: 700; /* 加粗显示 */
  z-index: 10;
  line-height: 1.2;
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
  z-index: 9999 !important; /* v1.9.1 使用超高层级和 !important，确保不被任何元素遮挡 */
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
  z-index: 9999999999; /* 确保在最上层 */
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

/* v1.9.0 Tooltip警告行样式 */
.tooltip-warning {
  border-top: 1px solid rgba(255, 107, 107, 0.3);
  padding-top: 6px;
  margin-top: 4px;
}

.tooltip-warning .tooltip-label {
  color: #ff6b6b;
  font-weight: 600;
  opacity: 1;
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
  z-index: 999999999;
  box-shadow: 0 2px 12px rgba(0, 123, 255, 0.4);
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(2px);
}

/* v1.9.0 拖拽预览效果 */
.drag-preview {
  position: fixed;
  opacity: 0.5;
  border-radius: 6px;
  border: 2px dashed rgba(255, 255, 255, 0.8);
  z-index: 999999998;
  pointer-events: none;
  /* v1.9.0 不使用transform居中，直接定位保持时间对齐 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  padding: 0 8px;
}

.drag-preview-content {
  color: white;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
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

/* === TaskBar悬停提示框样式 === */
.task-hover-tooltip {
  position: fixed;
  background-color: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 12px;
  z-index: 999999999;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  transform: translate(-50%, -100%); /* 默认显示在上方 */
  margin-top: -8px;
}

/* 显示在下方时的样式 */
.task-hover-tooltip.tooltip-below {
  transform: translate(-50%, 0); /* 显示在下方 */
  margin-top: 0;
}

.hover-tooltip-arrow {
  position: absolute;
  left: 50%;
  bottom: -5px; /* 默认箭头在底部，指向下方 */
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid rgba(0, 0, 0, 0.85);
  border-bottom: 0;
}

/* 显示在下方时，箭头在顶部，指向上方 */
.tooltip-below .hover-tooltip-arrow {
  bottom: auto;
  top: -5px;
  border-top: 0;
  border-bottom: 6px solid rgba(0, 0, 0, 0.85);
}

.hover-tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hover-tooltip-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  padding-bottom: 4px;
}

.hover-tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.hover-tooltip-label {
  opacity: 0.9;
  font-size: 11px;
  white-space: nowrap;
}

.hover-tooltip-value {
  font-weight: 500;
  text-align: right;
  font-size: 11px;
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
  /*border-radius: 2px;*/
}

/* 周视图下的TaskBar基础样式调整 */
.task-bar.week-view {
  min-width: 4px; /* 确保即使很短的任务也有最小可见宽度 */
  border-width: 1px;
  /*border-radius: 2px;*/
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

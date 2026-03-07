<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick, shallowRef, inject, provide, reactive } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import TaskBar from './TaskBar.vue'
import MilestonePoint from './MilestonePoint.vue'
import GanttLinks from './GanttLinks.vue'
import LinkDragGuide from './LinkDragGuide.vue'
import GanttConflicts from './Timeline/GanttConflicts.vue'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useI18n } from '../composables/useI18n'
import { useViewMode } from '../composables/useViewMode' // v1.9.9 视图模式状态管理
import type { TaskBarConfig } from '../models/configs/TaskBarConfig'
import { getPredecessorIds } from '../utils/predecessorUtils'
import { perfMonitor } from '../utils/perfMonitor'
import { perfMonitor2 } from '../utils/perfMonitor2' // v1.9.6 性能诊断工具
import type { Task } from '../models/classes/Task'
import type { Resource } from '../models/classes/Resource'
import type { Milestone } from '../models/classes/Milestone'
import type { TimelineConfig } from '../models/configs/TimelineConfig'
import { TimelineScale } from '../models/types/TimelineScale'
import type { TooltipShowPayload } from '../models/types/TimelineDataTypes'
import { positionCache } from '../utils/positionCache' // v1.9.6 Phase1 位置计算缓存

// 定义Props接口
interface Props {
  // 任务数据
  tasks?: Task[]
  // 里程碑数据
  milestones?: Milestone[]
  startDate: Date
  endDate: Date
  useDefaultDrawer?: boolean
  useDefaultMilestoneDialog?: boolean
  onTaskDelete?: (task: Task) => void
  onTaskUpdate?: (task: Task) => void
  onMilestoneDelete?: (milestone: Milestone) => void
  onMilestoneUpdate?: (milestone: Milestone) => void
  onMilestoneSave?: (milestone: Task) => void
  workingHours?: {
    morning?: { start: number; end: number }
    afternoon?: { start: number; end: number }
  }
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
}

const props = withDefaults(defineProps<Props>(), {
  tasks: () => [],
  milestones: () => [],
  useDefaultDrawer: true,
  useDefaultMilestoneDialog: true,
  onTaskDelete: undefined,
  onTaskUpdate: undefined,
  onMilestoneDelete: undefined,
  onMilestoneUpdate: undefined,
  onMilestoneSave: undefined,
  workingHours: () => ({
    morning: { start: 8, end: 11 },
    afternoon: { start: 13, end: 17 },
  }),
  taskBarConfig: undefined,
  allowDragAndResize: true,
  showActualTaskbar: false,
  enableTaskBarTooltip: true,
  pendingTaskBackgroundColor: undefined,
  delayTaskBackgroundColor: undefined,
  completeTaskBackgroundColor: undefined,
  ongoingTaskBackgroundColor: undefined,
})

// 定义emits
const emit = defineEmits<{
  'timeline-scale-changed': [scale: TimelineScale]
  'click-task': [task: Task, event: MouseEvent]
  'edit-task': [task: Task]
  'milestone-double-click': [milestone: Milestone]
  'start-timer': [task: Task]
  'stop-timer': [task: Task]
  'add-predecessor': [task: Task] // 新增：添加前置任务事件
  'add-successor': [task: Task] // 新增：添加后置任务事件
  'predecessor-added': [{ targetTask: Task; newTask: Task }] // 前置任务已添加
  'successor-added': [{ targetTask: Task; newTask: Task }] // 后置任务已添加
  delete: [task: Task, deleteChildren?: boolean]
  'link-deleted': [{ sourceTaskId: number; targetTaskId: number; updatedTask: Task }] // 链接已删除
  'resource-drag-end': [{ task: Task; sourceResourceIndex: number; targetResourceIndex: number; targetResource: Resource; newStartDate?: string; newEndDate?: string }] // v1.9.0 资源视图垂直拖拽结束
}>()

// 多语言
const { formatYearMonth, formatMonth, getTranslation } = useI18n()

// 翻译函数
const t = (key: string): string => {
  return getTranslation(key)
}

// v1.9.9 使用useViewMode统一管理视图模式状态
const { viewMode, dataSource } = useViewMode()

// v1.9.0 从 GanttChart 注入资源冲突信息（由 GanttChart 计算并响应 updateTaskTrigger）
const resourceConflicts = inject<ComputedRef<Map<string, Set<number>>>>('resourceConflicts', computed(() => new Map()))

// TaskBar渲染key，用于在容器变化时强制重新渲染
const taskBarRenderKey = ref(0)

// v1.9.2 计算资源视图中每个任务的冲突任务列表（用于显示详细冲突信息）
const getConflictTasksForTask = (resourceId: string | number, taskId: string | number): Task[] => {
  if (viewMode.value !== 'resource') return []

  const conflictTaskIds = resourceConflicts.value.get(String(resourceId))
  if (!conflictTaskIds || !conflictTaskIds.has(Number(taskId))) return []

  const resources = dataSource.value as Resource[]
  const resource = resources.find(r => String(r.id) === String(resourceId))
  if (!resource || !resource.tasks) return []

  const currentTask = resource.tasks.find(t => t.id === taskId)
  if (!currentTask || !currentTask.startDate || !currentTask.endDate) return []

  const currentStart = new Date(currentTask.startDate).getTime()
  const currentEnd = new Date(currentTask.endDate).getTime()

  // v1.9.7 修复：返回所有与当前任务时间重叠的冲突任务
  // 不需要再次验证占比相加是否超过100%，因为resourceConflicts已经包含了所有冲突的任务ID
  // 当多个任务同时重叠时（如3个任务各75%），应该全部返回，而不是只返回第一个两两超载的任务
  // v1.9.9 修复：endDate 包含当天，需要 +1 天来判断交集（与 conflictUtils 保持一致）
  const currentEndPlus = currentEnd + 24 * 60 * 60 * 1000

  const conflictTasks = resource.tasks.filter(task => {
    if (task.id === taskId) return false
    if (!task.startDate || !task.endDate) return false
    // 任务必须在冲突任务集合中
    if (!conflictTaskIds.has(task.id)) return false

    const taskStart = new Date(task.startDate).getTime()
    const taskEnd = new Date(task.endDate).getTime()
    const taskEndPlus = taskEnd + 24 * 60 * 60 * 1000

    // 检查时间重叠：endDate 包含当天，所以需要 +1 天来判断
    // 例如：任务A endDate=12-24, 任务B startDate=12-24，应判断为重叠（都占用12-24这一天）
    return currentStart < taskEndPlus && taskStart < currentEndPlus
  })

  return conflictTasks
}

// v1.9.2 拖拽状态管理（用于冲突检测优化）
const isDraggingTaskBar = ref(false)
provide('isDraggingTaskBar', isDraggingTaskBar)

// 记录最近变化的TaskBar ID（用于增量冲突更新）
const lastChangedTaskId = ref<string | number | null>(null)
provide('lastChangedTaskId', lastChangedTaskId)

// v1.9.6 Phase1 - 提供位置计算缓存实例给所有TaskBar
provide('positionCache', positionCache)

// v1.9.5 P2-4优化 - 注入Split Bar拖拽状态
const isSplitBarDragging = inject<Ref<boolean>>('isSplitBarDragging', ref(false))

// 注入 TaskList toggle 状态（toggle 期间阻止 containerResizeObserver 误触发日期范围重算）
const isTaskListToggling = inject<Ref<boolean>>('isTaskListToggling', ref(false))

// v1.9.5 注入showConflicts配置
const showConflicts = inject<ComputedRef<boolean>>('gantt-show-conflicts', computed(() => true))

// 纵向虚拟滚动相关状态（需要在useResourceLayout之前定义）
const ROW_HEIGHT = 51 // 每行高度51px (50px + 1px border)
const VERTICAL_BUFFER = 5 // 纵向缓冲区行数
const timelineBodyScrollTop = ref(0) // 纵向滚动位置
// 滚动同步标志位：防止 TaskList ↔ Timeline 垂直滚动形成 2 跳循环派发
let _isSyncingScrollFromTaskList = false
// GanttLinks 性能优化：滚动期间暂停 canvas 重绘，滚动停止后补绘一次
const isTimelineScrolling = ref(false)
let _scrollIdleTimer: ReturnType<typeof setTimeout> | null = null
const timelineBodyHeight = ref(0) // 容器高度状态管理

// v1.9.9 优化：注入GanttChart提供的资源布局，避免重复计算
// GanttChart已经计算并provide了resourceTaskLayouts和resourceRowPositions
const resourceTaskLayouts = inject<ComputedRef<Map<string | number, any>>>('resourceTaskLayouts', computed(() => new Map()))
const resourceRowPositions = inject<ComputedRef<Map<string | number, number>>>('resourceRowPositions', computed(() => new Map()))

// ─── Singleton Tooltip 状态（方案 B：Timeline 统一渲染）─────────────────────────────────
// 注入 TaskList 宽度，用于 Tooltip 定位边界保护
const ganttTaskListWidth = inject<Ref<number>>('gantt-task-list-width', ref(0))
const tooltipState = reactive({
  visible: false,
  task: null as any,
  taskStatus: { color: '#409eff', label: '' } as { color: string; label: string; type?: string },
  resourcePercent: 100,
  hasResourceConflict: false,
  isBelow: false,
  position: { x: 0, y: 0 },
})

/** 格式化日期显示 (YYYY-MM-DD) */
const formatTooltipDate = (dateStr: string | undefined): string => {
  if (!dateStr) return t('dateNotSet')
  return String(dateStr).substring(0, 10)
}

/** TaskBar 触发, Timeline 接受并计算定位 */
const handleTooltipShow = (payload: TooltipShowPayload) => {
  if (props.enableTaskBarTooltip === false) return

  const { task, taskStatus, resourcePercent, hasResourceConflict, targetRect } = payload
  tooltipState.task = task
  tooltipState.taskStatus = taskStatus
  tooltipState.resourcePercent = resourcePercent
  tooltipState.hasResourceConflict = hasResourceConflict

  // 定位计算（迁移自 TaskBar，使用 Timeline 已有容器 ref）
  const tooltipWidth = 250
  const margin = 10
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let x = targetRect.left + targetRect.width / 2
  let y = targetRect.top - 10

  const taskListRightBoundary = ganttTaskListWidth.value + margin
  if (x - tooltipWidth / 2 < taskListRightBoundary) {
    x = taskListRightBoundary + tooltipWidth / 2
  }
  if (x + tooltipWidth / 2 > viewportWidth - margin) {
    x = viewportWidth - margin - tooltipWidth / 2
  }

  const spaceAbove = targetRect.top - margin
  const spaceBelow = viewportHeight - targetRect.bottom - margin
  const baseHeight = 80
  const rowHeight = 24
  let contentRows = 4
  if (viewMode.value === 'resource' && resourcePercent < 100) contentRows += 1
  if (hasResourceConflict) contentRows += 1
  const estimatedTooltipHeight = baseHeight + contentRows * rowHeight

  if (spaceAbove < estimatedTooltipHeight && spaceBelow > spaceAbove) {
    y = targetRect.bottom + 10
    tooltipState.isBelow = true
  } else {
    tooltipState.isBelow = false
  }

  tooltipState.position = { x, y }
  tooltipState.visible = true
}

/** TaskBar 鼠标离开 / 拖拽 / Tab悬停时触发 */
const handleTooltipHide = () => {
  tooltipState.visible = false
}

// 获取以今天为中心的时间线范围（缓存结果，避免每次计算创建新对象）
const cachedTodayCenteredRange = (() => {
  const today = new Date()

  // 计算开始日期：今天往前6个月的月初
  const startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1)

  // 计算结束日期：今天往后6个月的月末
  const endDate = new Date(today.getFullYear(), today.getMonth() + 6 + 1, 0) // +1后再设为0，得到当月最后一天

  return {
    startDate,
    endDate,
  }
})()

const getTodayCenteredRange = () => cachedTodayCenteredRange

// 新增：接收外部传入的startDate和endDate
const timelineStartDate = computed(() => {
  // 优先使用props.startDate
  return props.startDate ? new Date(props.startDate) : getTodayCenteredRange().startDate
})
const timelineEndDate = computed(() => {
  // 优先使用props.endDate
  return props.endDate ? new Date(props.endDate) : getTodayCenteredRange().endDate
})

const timelineConfig = ref<TimelineConfig>({
  startDate: timelineStartDate.value,
  endDate: timelineEndDate.value,
  zoomLevel: 1,
})

// 当前时间刻度
const currentTimeScale = ref<TimelineScale>(TimelineScale.DAY)

// 响应外部props变化，动态更新timelineConfig
watch([timelineStartDate, timelineEndDate], ([newStart, newEnd]) => {
  // 资源视图下不响应 props 变化：
  //   GanttChart 的 timelineDateRange 计算可能传入基于任务视图的日期范围（已 computed 修复，但保留守卫作为二重保险）
  //   资源视图的日期范围由 updateTimeScale / debouncedUpdateTimelineRange 内部管理
  if (viewMode.value === 'resource') return
  if (props.startDate || props.endDate) {
    if (!isUpdatingTimelineConfig) {
      timelineConfig.value.startDate = newStart
      timelineConfig.value.endDate = newEnd
    }
  }
})

// 优化：使用常量避免每次创建新空数组
const EMPTY_TASKS_ARRAY: Task[] = []

// v1.9.0 使用视图模式决定数据源：资源视图使用dataSource，任务视图使用props.tasks
const tasks = computed(() => {
  if (viewMode.value === 'resource') {
    // 资源视图：使用注入的 dataSource (Resource[])
    return (dataSource.value || []) as unknown as Task[]
  }
  // 任务视图：使用 props.tasks
  return props.tasks ?? EMPTY_TASKS_ARRAY
})

// DOM 元素缓存，避免重复查询
const timelineContainerElement = ref<HTMLElement | null>(null)
const timelinePanelElement = ref<HTMLElement | null>(null)

// 根据时间刻度计算每日宽度
const dayWidth = computed(() => {
  if (currentTimeScale.value === TimelineScale.HOUR) {
    // 小时视图：每小时40px，一天24小时，每天960px
    return 960 // 24 * 40
  } else if (currentTimeScale.value === TimelineScale.WEEK) {
    // 周视图：每周60px，分7天，每天约8.57px
    return 60 / 7
  } else if (currentTimeScale.value === TimelineScale.MONTH) {
    // 月视图：动态计算，基于当前月的实际天数
    // 这里返回一个平均值，具体定位时会根据每个月的实际天数重新计算
    return 2 // 月视图下每天约2px（60px/30天的平均值）
  } else if (currentTimeScale.value === TimelineScale.QUARTER) {
    // 季度视图：每季度60px，分90天（平均），每天约0.67px
    return 60 / 90
  } else if (currentTimeScale.value === TimelineScale.YEAR) {
    // 年视图：每年360px，分365天，每天约0.99px
    return 360 / 365
  } else {
    // 日视图：每天30px
    return 30
  }
})

type TaskDateRange = { minDate: Date; maxDate: Date } | null
let cachedTaskDateRange: TaskDateRange = null

const invalidateTaskDateRangeCache = () => {
  cachedTaskDateRange = null
}

const computeTasksDateRange = (): TaskDateRange => {
  if (!tasks.value || tasks.value.length === 0) {
    return null
  }

  const dates: Date[] = []

  const collectDatesFromTask = (task: Task) => {
    if (task.startDate) {
      dates.push(new Date(task.startDate))
    }
    if (task.endDate) {
      dates.push(new Date(task.endDate))
    }

    if (task.children && task.children.length > 0) {
      for (const child of task.children) {
        collectDatesFromTask(child)
      }
    }
  }

  // v1.9.0 资源视图：从Resource.tasks中提取任务日期
  if (viewMode.value === 'resource') {
    for (const resource of tasks.value as any) {
      if (resource.tasks && Array.isArray(resource.tasks)) {
        for (const task of resource.tasks) {
          collectDatesFromTask(task)
        }
      }
    }
  } else {
    // 任务视图：直接遍历任务
    for (const task of tasks.value) {
      collectDatesFromTask(task)
    }
  }

  if (dates.length === 0) {
    return null
  }

  let minTime = Infinity
  let maxTime = -Infinity
  for (const date of dates) {
    const time = date.getTime()
    if (!isNaN(time)) {
      if (time < minTime) minTime = time
      if (time > maxTime) maxTime = time
    }
  }

  if (minTime === Infinity || maxTime === -Infinity) {
    return null
  }

  return {
    minDate: new Date(minTime),
    maxDate: new Date(maxTime),
  }
}

// 获取任务数据的日期范围（用于月度/年度视图时间轴范围计算）
const getTasksDateRange = () => {
  if (cachedTaskDateRange) {
    return cachedTaskDateRange
  }

  cachedTaskDateRange = computeTasksDateRange()
  return cachedTaskDateRange
}

// 获取小时视图的时间范围
const getHourTimelineRange = () => {
  const taskRange = getTasksDateRange()
  const containerWidth = timelineContainerWidth.value || 1200
  const hourWidth = 40 // 小时视图：每小时40px

  if (!taskRange) {
    // 如果没有任务，只显示前一天、当天、后一天（共3天）
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 1)

    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 1)
    endDate.setHours(23, 59, 59, 999)

    return { startDate, endDate }
  }

  const { minDate, maxDate } = taskRange

  // 开始日期：任务最小开始日期的前一天0点
  const startDate = new Date(minDate)
  startDate.setHours(0, 0, 0, 0)
  startDate.setDate(startDate.getDate() - 1)

  // 结束日期：任务最大结束日期的后一天23:59:59
  const endDate = new Date(maxDate)
  endDate.setHours(23, 59, 59, 999)
  endDate.setDate(endDate.getDate() + 1)

  // 计算当前范围需要的宽度
  const hoursDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60))
  const currentWidth = hoursDiff * hourWidth

  // 如果当前宽度小于容器宽度，按天扩展范围
  if (currentWidth < containerWidth) {
    const hoursNeeded = Math.ceil(containerWidth / hourWidth)
    const additionalHours = Math.ceil((hoursNeeded - hoursDiff) / 2)
    const additionalDays = Math.ceil(additionalHours / 24)

    // 向前扩展
    startDate.setDate(startDate.getDate() - additionalDays)

    // 向后扩展
    endDate.setDate(endDate.getDate() + additionalDays)
  }

  return { startDate, endDate }
}

// 获取日视图的时间范围
const getDayTimelineRange = () => {
  const taskRange = getTasksDateRange()
  const containerWidth = timelineContainerWidth.value || 1200
  const dayWidth = 30 // 日视图：每天30px

  if (!taskRange) {
    // 如果没有任务，根据容器宽度计算范围
    const today = new Date()
    const daysNeeded = Math.max(Math.ceil(containerWidth / dayWidth), 60) // 至少60天

    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - Math.floor(daysNeeded / 2))

    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + Math.ceil(daysNeeded / 2))

    return { startDate, endDate }
  }

  const { minDate, maxDate } = taskRange

  // 开始日期：取任务最小日期所在月的前一个月月初（第1天）
  // 采用月运算而非减30天，原因：
  //   减30天后若落在月末（如1月31日），normalize 到月初会多出一整个月（1月→1月1日），
  //   而语义上只需在任务月份前保留一个完整月作为 buffer。
  // 直接用 new Date(year, month-1, 1) 使 startDate 始终为月初且精确为前一个月，
  //   generateDayTimelineData 以月为单位迭代时 setMonth(+1) 不会因日期溢出跳过任何月份。
  let startDate = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1)

  // 结束日期：任务最大结束日期+30天
  let endDate = new Date(maxDate)
  endDate.setDate(endDate.getDate() + 30)

  // 计算当前范围需要的宽度
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const currentWidth = daysDiff * dayWidth

  // 如果当前宽度小于容器宽度，扩展范围
  if (currentWidth < containerWidth) {
    const daysNeeded = Math.ceil(containerWidth / dayWidth)
    const additionalDays = Math.ceil((daysNeeded - daysDiff) / 2)

    // 向前扩展
    const newStartDate = new Date(startDate)
    newStartDate.setDate(newStartDate.getDate() - additionalDays)
    startDate = newStartDate

    // 向后扩展
    const newEndDate = new Date(endDate)
    newEndDate.setDate(newEndDate.getDate() + additionalDays)
    endDate = newEndDate
  }

  return { startDate, endDate }
}

// 获取周视图的时间范围
const getWeekTimelineRange = () => {
  const taskRange = getTasksDateRange()
  const containerWidth = timelineContainerWidth.value || 1200
  const weekWidth = 60 // 周视图：每周60px

  if (!taskRange) {
    // 如果没有任务，根据容器宽度计算范围
    const today = new Date()
    const weeksNeeded = Math.max(Math.ceil(containerWidth / weekWidth), 20) // 向上取整确保填满，至少20周

    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - Math.floor(weeksNeeded / 2) * 7)

    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + Math.ceil(weeksNeeded / 2) * 7)

    return { startDate, endDate }
  }

  const { minDate, maxDate } = taskRange

  // 工具函数：获取某日期所在周的周一
  function getMonday(date: Date) {
    const d = new Date(date)
    const day = d.getDay() || 7
    d.setDate(d.getDate() - (day - 1))
    return d
  }

  // 工具函数：获取某月第一个周一在该月的周（该月最小日期作为周一的周）
  function getFirstMondayOfMonth(year: number, month: number): Date {
    let day = 1
    while (day <= 31) {
      const date = new Date(year, month, day)
      if (date.getMonth() !== month) break // 超出该月
      const monday = getMonday(date)
      if (monday.getMonth() === month) {
        return monday
      }
      day++
    }
    return new Date(year, month, 1) // 兜底
  }

  // 工具函数：获取某月最后一个周一在该月的周（该月最大日期作为周一的周）
  function getLastMondayOfMonth(year: number, month: number): Date {
    const lastDay = new Date(year, month + 1, 0).getDate()
    for (let day = lastDay; day >= 1; day--) {
      const date = new Date(year, month, day)
      const monday = getMonday(date)
      if (monday.getMonth() === month) {
        return monday
      }
    }
    return new Date(year, month, 1) // 兜底
  }

  // 工具函数：获取某月的所有周（周一在该月的周）
  function getWeeksOfMonth(year: number, month: number): Date[] {
    const weeks: Date[] = []
    const firstMonday = getFirstMondayOfMonth(year, month)
    const lastMonday = getLastMondayOfMonth(year, month)
    const current = new Date(firstMonday)
    while (current <= lastMonday) {
      weeks.push(new Date(current))
      current.setDate(current.getDate() + 7)
    }
    return weeks
  }

  // 1. 获取最早TaskBar/Milestone的最小开始日期所在月份的第一周周一
  const minMonday = getMonday(minDate)
  const minYear = minMonday.getFullYear()
  const minMonth = minMonday.getMonth()

  // 2. 基于第一周周一往前追加一个完整月份的周数作为baseBuffer
  const prevMonth = minMonth === 0 ? 11 : minMonth - 1
  const prevYear = minMonth === 0 ? minYear - 1 : minYear
  const prevMonthWeeks = getWeeksOfMonth(prevYear, prevMonth)

  // 3. 获取最晚TaskBar/Milestone的最大开始日期所在月份的最后一周周一
  const maxMonday = getMonday(maxDate)
  const maxYear = maxMonday.getFullYear()
  const maxMonth = maxMonday.getMonth()

  // 4. 基于最后一周周日往后追加一个完整月份的周数作为baseBuffer
  const nextMonth = maxMonth === 11 ? 0 : maxMonth + 1
  const nextYear = maxMonth === 11 ? maxYear + 1 : maxYear
  const nextMonthWeeks = getWeeksOfMonth(nextYear, nextMonth)

  // 初始weeks：前buffer月 + 最小月到最大月之间所有月 + 后buffer月
  let weeks: Date[] = []

  // 添加前buffer月
  weeks.push(...prevMonthWeeks)

  // 添加最小月到最大月之间的所有月份的周
  let currentYear = minYear
  let currentMonth = minMonth
  while (currentYear < maxYear || (currentYear === maxYear && currentMonth <= maxMonth)) {
    const monthWeeks = getWeeksOfMonth(currentYear, currentMonth)
    weeks.push(...monthWeeks)
    currentMonth++
    if (currentMonth > 11) {
      currentMonth = 0
      currentYear++
    }
  }

  // 添加后buffer月
  weeks.push(...nextMonthWeeks)

  // 5. 判断是否填满容器，不够则继续扩展前后的完整月份
  let totalWidth = weeks.length * weekWidth
  while (totalWidth < containerWidth) {
    // 前面扩展一个完整月
    const firstWeek = weeks[0]
    const firstYear = firstWeek.getFullYear()
    const firstMonth = firstWeek.getMonth()
    const extendPrevMonth = firstMonth === 0 ? 11 : firstMonth - 1
    const extendPrevYear = firstMonth === 0 ? firstYear - 1 : firstYear
    const extendPrevWeeks = getWeeksOfMonth(extendPrevYear, extendPrevMonth)
    weeks = [...extendPrevWeeks, ...weeks]
    totalWidth = weeks.length * weekWidth

    if (totalWidth >= containerWidth) break

    // 后面扩展一个完整月
    const lastWeek = weeks[weeks.length - 1]
    const lastYear = lastWeek.getFullYear()
    const lastMonth = lastWeek.getMonth()
    const extendNextMonth = lastMonth === 11 ? 0 : lastMonth + 1
    const extendNextYear = lastMonth === 11 ? lastYear + 1 : lastYear
    const extendNextWeeks = getWeeksOfMonth(extendNextYear, extendNextMonth)
    weeks = [...weeks, ...extendNextWeeks]
    totalWidth = weeks.length * weekWidth
  }

  // 6. 计算最终 startDate/endDate
  const startDate = new Date(weeks[0])
  const endDate = new Date(weeks[weeks.length - 1])
  endDate.setDate(endDate.getDate() + 6) // 该周的周日

  return { startDate, endDate }
}

// 获取月度视图的时间范围（任务最小开始日期-2年 ~ 任务最大结束日期+2年）
const getMonthTimelineRange = () => {
  const taskRange = getTasksDateRange()
  if (!taskRange) {
    // 如果没有任务，使用当前日期为中心的范围
    const today = new Date()
    const startDate = new Date(today.getFullYear() - 1, 0, 1) // 当前年-1年的1月1日
    const endDate = new Date(today.getFullYear() + 1, 11, 31) // 当前年+1年的12月31日
    return { startDate, endDate }
  }

  const { minDate, maxDate } = taskRange
  const containerWidth = timelineContainerWidth.value || 1200 // 默认1200px

  // 开始日期：任务最小开始日期-1年，月初
  let startDate = new Date(minDate.getFullYear() - 1, 0, 1)

  // 结束日期：任务最大结束日期+1年，月末
  let endDate = new Date(maxDate.getFullYear() + 1, 11, 31)

  // 计算当前范围的月数
  const yearsDiff = endDate.getFullYear() - startDate.getFullYear()
  const monthsDiff = yearsDiff * 12 + (endDate.getMonth() - startDate.getMonth())

  // 月视图：每月60px
  const monthWidth = 60
  const currentWidth = monthsDiff * monthWidth

  // 如果当前宽度小于容器宽度，扩展范围
  if (currentWidth < containerWidth) {
    const monthsNeeded = Math.ceil(containerWidth / monthWidth)
    const additionalMonths = Math.ceil((monthsNeeded - monthsDiff) / 2)

    // 向前扩展
    const newStartDate = new Date(startDate)
    newStartDate.setMonth(newStartDate.getMonth() - additionalMonths)
    startDate = new Date(newStartDate.getFullYear(), newStartDate.getMonth(), 1)

    // 向后扩展
    const newEndDate = new Date(endDate)
    newEndDate.setMonth(newEndDate.getMonth() + additionalMonths)
    endDate = new Date(newEndDate.getFullYear(), newEndDate.getMonth() + 1, 0)
  }

  return { startDate, endDate }
}

// 获取年度视图的时间范围（任务最小开始日期-1年 ~ 任务最大结束日期+1年）
const getYearTimelineRange = () => {
  const taskRange = getTasksDateRange()

  if (!taskRange) {
    // 如果没有任务，根据容器宽度和时间刻度动态计算范围
    const today = new Date()
    const containerWidth = timelineContainerWidth.value || 1200 // 默认1200px

    let yearsNeeded = 3 // 默认至少3年

    if (currentTimeScale.value === TimelineScale.QUARTER) {
      // 季度视图：每季度60px，每年4个季度 = 240px
      const quarterWidth = 60
      const yearWidth = quarterWidth * 4 // 240px
      yearsNeeded = Math.max(Math.ceil(containerWidth / yearWidth) + 1, 5) // 至少5年
    } else if (currentTimeScale.value === TimelineScale.YEAR) {
      // 年度视图：每年360px
      const yearWidth = 360
      yearsNeeded = Math.max(Math.ceil(containerWidth / yearWidth) + 1, 5) // 至少5年
    }

    const startYear = today.getFullYear() - Math.floor(yearsNeeded / 2)
    const endYear = startYear + yearsNeeded - 1

    const startDate = new Date(startYear, 0, 1)
    const endDate = new Date(endYear, 11, 31)

    return { startDate, endDate }
  }

  const { minDate, maxDate } = taskRange
  const containerWidth = timelineContainerWidth.value || 1200 // 默认1200px

  // 开始日期：任务最小开始日期-1年，年初
  let startDate = new Date(minDate.getFullYear() - 1, 0, 1)

  // 结束日期：任务最大结束日期+1年，年末
  let endDate = new Date(maxDate.getFullYear() + 1, 11, 31)

  // 计算当前范围需要的宽度
  const yearsDiff = endDate.getFullYear() - startDate.getFullYear() + 1

  if (currentTimeScale.value === TimelineScale.QUARTER) {
    // 季度视图：每季度60px，每年4个季度 = 240px
    const quarterWidth = 60
    const yearWidth = quarterWidth * 4 // 240px
    const currentWidth = yearsDiff * yearWidth

    // 如果当前宽度小于容器宽度，扩展范围
    if (currentWidth < containerWidth) {
      const yearsNeeded = Math.ceil(containerWidth / yearWidth)
      const additionalYears = Math.ceil((yearsNeeded - yearsDiff) / 2)

      startDate = new Date(startDate.getFullYear() - additionalYears, 0, 1)
      endDate = new Date(endDate.getFullYear() + additionalYears, 11, 31)
    }
  } else if (currentTimeScale.value === TimelineScale.YEAR) {
    // 年度视图：每年360px
    const yearWidth = 360
    const currentWidth = yearsDiff * yearWidth

    // 如果当前宽度小于容器宽度，扩展范围
    if (currentWidth < containerWidth) {
      const yearsNeeded = Math.ceil(containerWidth / yearWidth)
      const additionalYears = Math.ceil((yearsNeeded - yearsDiff) / 2)

      startDate = new Date(startDate.getFullYear() - additionalYears, 0, 1)
      endDate = new Date(endDate.getFullYear() + additionalYears, 11, 31)
    }
  }

  return { startDate, endDate }
}

// 悬停状态管理
const hoveredTaskId = ref<number | string | null>(null)

// 高亮状态管理（用于长按高亮功能）
const highlightedTaskId = ref<number | null>(null)
const highlightedTaskIds = ref<Set<number>>(new Set())

// 计算是否处于高亮模式（禁用所有交互）
const isInHighlightMode = computed(() => highlightedTaskId.value !== null)

// 清除高亮状态
const clearHighlight = () => {
  highlightedTaskId.value = null
  highlightedTaskIds.value.clear()
}

// 设置高亮任务（包括前置和后置任务）
const setHighlightTask = (taskId: number) => {
  highlightedTaskId.value = taskId
  highlightedTaskIds.value.clear()
  highlightedTaskIds.value.add(taskId)

  // 查找当前任务
  const currentTask = tasks.value.find(t => t.id === taskId)
  if (!currentTask) {
    return
  }

  // 添加所有前置任务（从 predecessor 字符串解析）
  if (currentTask.predecessor) {
    const predecessorIds = getPredecessorIds(currentTask.predecessor)
    for (const id of predecessorIds) {
      highlightedTaskIds.value.add(id)
    }
  }

  // 添加所有后置任务（找到所有把当前任务作为前置任务的任务）
  for (const task of tasks.value) {
    if (task.predecessor) {
      const taskPredecessorIds = getPredecessorIds(task.predecessor)
      if (taskPredecessorIds.includes(taskId)) {
        highlightedTaskIds.value.add(task.id)
      }
    }
  }
}

// ==================== 连接线拖拽状态管理 ====================
const dragLinkMode = ref<'predecessor' | 'successor' | null>(null) // 当前拖拽模式
const linkDragSourceTask = shallowRef<Task | null>(null) // 拖拽起始任务（使用 shallowRef 优化性能）
const linkDragTargetTask = shallowRef<Task | null>(null) // 当前悬停的目标任务（使用 shallowRef 优化性能）
const isValidLinkTarget = ref(false) // 是否是有效的连接目标（保留用于 handleLinkDragEnd）
const linkValidationError = ref<string>('') // 连接验证失败的原因（保留用于兼容）
const linkAutoScrollInterval = ref<number | null>(null) // 自动滚动定时器

// 🚀 非响应式拖拽状态（用于高频更新，避免 Vue 响应式开销）
let nonReactiveIsValidTarget = false
let nonReactiveErrorMessage = ''

// 任务查找缓存 Map（优化性能，避免每次都遍历数组）
const taskIdMap = new Map<number, Task>()

// 性能监控开关（开发调试用）
const ENABLE_PERF_MONITOR = false

// 开始连接线拖拽
const handleLinkDragStart = (event: { task: Task; type: 'predecessor' | 'successor'; mouseEvent: MouseEvent }) => {
  dragLinkMode.value = event.type
  linkDragSourceTask.value = event.task

  // 启动帧监控
  if (ENABLE_PERF_MONITOR) {
    perfMonitor.startFrameMonitor()
  }

  // 初始化鼠标坐标（使用非响应式版本）
  updateLinkDragCoordinatesNonReactive(event.mouseEvent.clientX, event.mouseEvent.clientY)

  linkDragTargetTask.value = null
  isValidLinkTarget.value = false
  linkValidationError.value = ''
  // 🚀 重置非响应式状态
  nonReactiveTargetTask = null
  nonReactiveIsValidTarget = false
  nonReactiveErrorMessage = ''

  // 启动自动滚动检测
  startLinkAutoScroll()

  // 在 Timeline 层级添加全局鼠标监听器（防止 LinkAnchor 因虚拟滚动卸载导致拖拽中断）
  document.addEventListener('mousemove', handleGlobalMouseMove)
  document.addEventListener('mouseup', handleGlobalMouseUp)
}

// 🚀 优化：统一 RAF 调度（坐标更新 + 目标检测在同一帧处理）
let linkDragRafId: number | null = null
let pendingMouseX = 0
let pendingMouseY = 0

// 🚀 非响应式拖拽坐标（避免 Vue 响应式系统开销）
let currentDragX = 0
let currentDragY = 0

// 🚀 优化后的 RAF 回调：在一帧内批量处理坐标更新、目标检测和绘制
const processLinkDragFrame = () => {
  linkDragRafId = null

  if (ENABLE_PERF_MONITOR) {
    const startTime = performance.now()
    updateLinkDragCoordinatesNonReactive(pendingMouseX, pendingMouseY)
    perfMonitor.recordLinkDragCoordUpdate(performance.now() - startTime)
  } else {
    updateLinkDragCoordinatesNonReactive(pendingMouseX, pendingMouseY)
  }

  if (ENABLE_PERF_MONITOR) {
    const startTime = performance.now()
    detectLinkTargetNonReactive(pendingMouseX, pendingMouseY)
    perfMonitor.recordLinkDragTargetDetect(performance.now() - startTime)
  } else {
    detectLinkTargetNonReactive(pendingMouseX, pendingMouseY)
  }

  if (linkDragGuideRef.value && linkDragSourceTask.value) {
    linkDragGuideRef.value.draw(
      getLinkDragStartX(),
      getLinkDragStartY(),
      currentDragX,
      currentDragY,
      nonReactiveIsValidTarget,
      nonReactiveErrorMessage,
    )
  }
}

// 全局鼠标移动处理（🚀 优化：使用 RAF 统一调度，避免每次 mousemove 都触发响应式更新）
const handleGlobalMouseMove = (e: MouseEvent) => {
  if (!dragLinkMode.value) return

  // 🚀 记录最新鼠标位置，但不立即更新
  pendingMouseX = e.clientX
  pendingMouseY = e.clientY

  // 🚀 如果已有 RAF 待处理，跳过（下一帧会使用最新坐标）
  if (linkDragRafId !== null) {
    return
  }

  // 🚀 调度下一帧处理
  linkDragRafId = requestAnimationFrame(processLinkDragFrame)
}

// 全局鼠标释放处理
const handleGlobalMouseUp = () => {
  if (!dragLinkMode.value) return

  // 停止帧监控
  if (ENABLE_PERF_MONITOR) {
    perfMonitor.stopFrameMonitor()
  }

  // 🚀 取消待处理的 RAF
  if (linkDragRafId !== null) {
    cancelAnimationFrame(linkDragRafId)
    linkDragRafId = null
  }

  // 触发拖拽结束
  if (linkDragSourceTask.value) {
    handleLinkDragEnd({
      task: linkDragSourceTask.value,
      type: dragLinkMode.value,
    })
  }
}

// 缓存 bodyContent 的位置信息（避免频繁调用 getBoundingClientRect）
let cachedBodyRect: DOMRect | null = null
let bodyRectCacheTime = 0
const BODY_RECT_CACHE_DURATION = 200 // 200ms 缓存（优化：增加缓存时间）
let bodyRectInvalidated = false // 缓存失效标记（滚动时失效）

// 🚀 坐标更新辅助函数（提取重复逻辑）
const updateCoordinates = (mouseX: number, mouseY: number): void => {
  if (!bodyContentRef.value) {
    currentDragX = mouseX
    currentDragY = mouseY
    return
  }

  const now = Date.now()
  const shouldRefreshRect =
    !cachedBodyRect || bodyRectInvalidated || now - bodyRectCacheTime > BODY_RECT_CACHE_DURATION
  if (shouldRefreshRect) {
    cachedBodyRect = bodyContentRef.value.getBoundingClientRect()
    bodyRectCacheTime = now
    bodyRectInvalidated = false
  }
  currentDragX = mouseX - cachedBodyRect!.left
  currentDragY = mouseY - cachedBodyRect!.top
}

// 🚀 非响应式坐标更新（完全绕过 Vue 响应式系统）
const updateLinkDragCoordinatesNonReactive = (mouseX: number, mouseY: number) => {
  updateCoordinates(mouseX, mouseY)
}

// 拖拽过程中更新鼠标位置（🚀 优化：使用统一 RAF 调度）
const handleLinkDragMove = (event: { mouseX: number; mouseY: number }) => {
  // 🚀 记录最新鼠标位置
  pendingMouseX = event.mouseX
  pendingMouseY = event.mouseY

  // 🚀 如果已有 RAF 待处理，跳过
  if (linkDragRafId !== null) {
    return
  }

  // 🚀 调度下一帧处理
  linkDragRafId = requestAnimationFrame(processLinkDragFrame)
}

// 结束连接线拖拽
const handleLinkDragEnd = (event: { task: Task; type: 'predecessor' | 'successor' }) => {
  // 清除缓存的 rect
  cachedBodyRect = null

  // 移除全局鼠标监听器
  document.removeEventListener('mousemove', handleGlobalMouseMove)
  document.removeEventListener('mouseup', handleGlobalMouseUp)

  // 停止自动滚动
  stopLinkAutoScroll()

  // 🚀 清除 LinkDragGuide 画布
  linkDragGuideRef.value?.clear()

  // 如果有有效目标，创建连接
  if (linkDragTargetTask.value && isValidLinkTarget.value) {
    createLink(event.task, linkDragTargetTask.value, event.type)
  }

  // 重置拖拽状态
  dragLinkMode.value = null
  linkDragSourceTask.value = null
  linkDragTargetTask.value = null
  isValidLinkTarget.value = false
}

// 触点碰撞检测常量
const ANCHOR_SIZE = 8 // 触点视觉大小（px）
const ANCHOR_TOLERANCE = 4 // 碰撞容差（px），扩大点击区域

// 🚀 目标检测辅助函数（提取重复逻辑）
// 返回 { taskId: number, anchorType: 'left' | 'right' } 或 null
const detectTargetTaskId = (mouseX: number, mouseY: number): { taskId: number; anchorType: 'left' | 'right' } | null => {
  // 使用缓存的 rect
  if (!cachedBodyRect) {
    cachedBodyRect = bodyContentRef.value!.getBoundingClientRect()
    bodyRectCacheTime = Date.now()
  }

  const relativeX = mouseX - cachedBodyRect.left
  const relativeY = mouseY - cachedBodyRect.top

  const halfSize = (ANCHOR_SIZE + ANCHOR_TOLERANCE) / 2
  const expandedHalfSize = halfSize + 10

  for (const taskIdStr in taskBarPositions.value) {
    const pos = taskBarPositions.value[taskIdStr]
    const taskId = Number(taskIdStr)

    if (
      relativeY < pos.top - expandedHalfSize ||
      relativeY > pos.top + pos.height + expandedHalfSize
    ) {
      continue
    }

    const anchorY = pos.top + pos.height / 2

    // 检查左侧触点（predecessor）
    const leftAnchorX = pos.left
    if (
      relativeX >= leftAnchorX - halfSize &&
      relativeX <= leftAnchorX + halfSize &&
      relativeY >= anchorY - halfSize &&
      relativeY <= anchorY + halfSize
    ) {
      return { taskId, anchorType: 'left' }
    }

    // 检查右侧触点（successor）
    const rightAnchorX = pos.left + pos.width
    if (
      relativeX >= rightAnchorX - halfSize &&
      relativeX <= rightAnchorX + halfSize &&
      relativeY >= anchorY - halfSize &&
      relativeY <= anchorY + halfSize
    ) {
      return { taskId, anchorType: 'right' }
    }
  }

  return null
}

// 🚀 更新目标任务的状态
const updateTargetTaskState = (foundTarget: Task | null, anchorType?: 'left' | 'right'): void => {
  const currentTargetId = nonReactiveTargetTask?.id ?? null
  const newTargetId = foundTarget?.id ?? null

  if (currentTargetId !== newTargetId) {
    nonReactiveTargetTask = foundTarget

    if (foundTarget && linkDragSourceTask.value) {
      const validation = validateLink(
        linkDragSourceTask.value,
        foundTarget,
        dragLinkMode.value!,
        anchorType,
      )
      nonReactiveIsValidTarget = validation.valid
      nonReactiveErrorMessage = validation.error || ''
      isValidLinkTarget.value = validation.valid
      linkDragTargetTask.value = foundTarget
    } else {
      nonReactiveIsValidTarget = false
      nonReactiveErrorMessage = ''
      isValidLinkTarget.value = false
      linkDragTargetTask.value = null
    }
  }
}

// 🚀 非响应式目标检测（完全绕过 Vue 响应式系统）
// 缓存当前检测到的目标任务（用于 handleLinkDragEnd）
let nonReactiveTargetTask: Task | null = null

const detectLinkTargetNonReactive = (mouseX: number, mouseY: number) => {
  if (!linkDragSourceTask.value || !bodyContentRef.value) return

  const result = detectTargetTaskId(mouseX, mouseY)
  const foundTarget = result !== null ? taskIdMap.get(result.taskId) || null : null
  const anchorType = result?.anchorType

  updateTargetTaskState(foundTarget, anchorType)
}

// 验证连接是否有效（返回 { valid: boolean, error?: string }）
const validateLink = (
  sourceTask: Task,
  targetTask: Task,
  mode: 'predecessor' | 'successor',
  targetAnchorType?: 'left' | 'right',
): { valid: boolean; error?: string } => {
  // 0. 检查触点方向是否正确
  if (targetAnchorType) {
    if (mode === 'predecessor' && targetAnchorType !== 'right') {
      return { valid: false, error: '前置任务应连接到右侧触点' }
    }
    if (mode === 'successor' && targetAnchorType !== 'left') {
      return { valid: false, error: '后置任务应连接到左侧触点' }
    }
  }

  // 1. 不能连接到自己
  if (sourceTask.id === targetTask.id) {
    return { valid: false, error: '不能连接到自己' }
  }

  // 2. 不能连接父级任务或里程碑
  if (targetTask.isParent || targetTask.type === 'milestone') {
    return { valid: false, error: '不能连接到父级任务或里程碑' }
  }

  // 3. 不能创建循环依赖
  if (mode === 'predecessor') {
    // predecessor模式：从B的左触点拖拽到A，要建立 A→B 的关系
    // 检查：如果B已经（直接或间接）依赖A，会形成循环
    if (hasCircularDependency(targetTask.id, sourceTask.id)) {
      return { valid: false, error: '会产生循环依赖' }
    }
  } else {
    // successor模式：从A的右触点拖拽到B，要建立 A→B 的关系
    // 检查：如果A已经（直接或间接）依赖B，会形成循环
    if (hasCircularDependency(sourceTask.id, targetTask.id)) {
      return { valid: false, error: '会产生循环依赖' }
    }
  }

  // 4. 检查是否已存在该连接
  // 注意：A→B 的关系存储在 B.predecessor 中，值为 [A.id]
  if (mode === 'predecessor') {
    // predecessor模式：从B的左触点拖拽到A，要建立 A→B 的关系
    // 检查 B.predecessor 中是否已包含 A.id
    if (sourceTask.predecessor) {
      const predecessorIds = getPredecessorIds(sourceTask.predecessor)
      if (predecessorIds.includes(targetTask.id)) {
        return { valid: false, error: '关系已存在' }
      }
    }
  } else {
    // successor模式：从A的右触点拖拽到B，要建立 A→B 的关系
    // 检查 B.predecessor 中是否已包含 A.id
    if (targetTask.predecessor) {
      const predecessorIds = getPredecessorIds(targetTask.predecessor)
      if (predecessorIds.includes(sourceTask.id)) {
        return { valid: false, error: '关系已存在' }
      }
    }
  }

  return { valid: true }
}

// 检查循环依赖
const hasCircularDependency = (taskId: number, targetId: number): boolean => {
  const visited = new Set<number>()
  const queue: number[] = [taskId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (currentId === targetId) {
      return true // 找到循环依赖
    }

    if (visited.has(currentId)) {
      continue
    }
    visited.add(currentId)

    // 查找当前任务
    const currentTask = tasks.value.find(t => t.id === currentId)
    if (currentTask && currentTask.predecessor) {
      const predecessorIds = getPredecessorIds(currentTask.predecessor)
      queue.push(...predecessorIds)
    }
  }

  return false
}

// 创建连接
const createLink = (sourceTask: Task, targetTask: Task, mode: 'predecessor' | 'successor') => {
  if (mode === 'predecessor') {
    // mode='predecessor' 表示从左侧 anchor 拖出
    // 从左侧 anchor 拖到右侧：sourceTask 依赖 targetTask
    // 实现：将 targetTask.id 添加到 sourceTask.predecessor 中
    const predecessorIds = sourceTask.predecessor ? getPredecessorIds(sourceTask.predecessor) : []
    if (!predecessorIds.includes(targetTask.id)) {
      predecessorIds.push(targetTask.id)
      sourceTask.predecessor = predecessorIds
      // 触发任务更新事件
      updateTask(sourceTask)
      // 发射 predecessor-added 事件
      emit('predecessor-added', { targetTask: sourceTask, newTask: targetTask })
    }
  } else {
    // mode='successor' 表示从右侧 anchor 拖出
    // 从右侧 anchor 拖到左侧：sourceTask 是 targetTask 的前置任务
    // 实现：将 sourceTask.id 添加到 targetTask.predecessor 中
    const predecessorIds = targetTask.predecessor ? getPredecessorIds(targetTask.predecessor) : []
    if (!predecessorIds.includes(sourceTask.id)) {
      predecessorIds.push(sourceTask.id)
      targetTask.predecessor = predecessorIds
      // 触发任务更新事件
      updateTask(targetTask)
      // 发射 successor-added 事件
      emit('successor-added', { targetTask, newTask: sourceTask })
    }
  }
}

// 启动自动滚动检测
const startLinkAutoScroll = () => {
  linkAutoScrollInterval.value = window.setInterval(() => {
    if (!timelineContainerElement.value || !bodyContentRef.value) return

    const horizontalContainer = timelineContainerElement.value // .timeline 负责横向滚动
    const verticalContainer = timelineBodyElement.value // .timeline-body 负责纵向滚动

    if (!verticalContainer) return

    const rect = horizontalContainer.getBoundingClientRect()
    const SCROLL_ZONE = 80 // 边缘滚动区域宽度（增大以提供更好的体验）
    const SCROLL_SPEED = 15 // 滚动速度

    // 获取鼠标在视口中的实际位置（使用非响应式坐标变量）
    const mouseX = pendingMouseX // 直接使用最新的鼠标X坐标（视口坐标）
    const mouseY = pendingMouseY // 直接使用最新的鼠标Y坐标（视口坐标）

    let scrolled = false

    // 检测水平滚动（使用 horizontalContainer）
    if (mouseX < rect.left + SCROLL_ZONE && horizontalContainer.scrollLeft > 0) {
      // 向左滚动
      horizontalContainer.scrollLeft -= SCROLL_SPEED
      scrolled = true
    } else if (mouseX > rect.right - SCROLL_ZONE) {
      // 向右滚动
      const maxScrollLeft = horizontalContainer.scrollWidth - horizontalContainer.clientWidth
      if (horizontalContainer.scrollLeft < maxScrollLeft) {
        horizontalContainer.scrollLeft += SCROLL_SPEED
        scrolled = true
      }
    }

    // 检测垂直滚动（使用 verticalContainer）
    if (mouseY < rect.top + SCROLL_ZONE && verticalContainer.scrollTop > 0) {
      // 向上滚动
      verticalContainer.scrollTop -= SCROLL_SPEED
      scrolled = true
    } else if (mouseY > rect.bottom - SCROLL_ZONE) {
      // 向下滚动
      const maxScrollTop = verticalContainer.scrollHeight - verticalContainer.clientHeight
      if (verticalContainer.scrollTop < maxScrollTop) {
        verticalContainer.scrollTop += SCROLL_SPEED
        scrolled = true
      }
    }

    // 如果发生了滚动，需要重新检测目标和更新引导线
    if (scrolled) {
      // 标记缓存失效（滚动时需要重新获取位置）
      bodyRectInvalidated = true

      // 触发重新检测目标（因为滚动可能改变了元素位置）
      detectLinkTargetNonReactive(mouseX, mouseY)

      // 更新引导线绘制
      if (linkDragGuideRef.value && linkDragSourceTask.value) {
        linkDragGuideRef.value.draw(
          getLinkDragStartX(),
          getLinkDragStartY(),
          currentDragX,
          currentDragY,
          nonReactiveIsValidTarget,
          nonReactiveErrorMessage,
        )
      }
    }
  }, 30) // 降低间隔以提供更流畅的滚动体验
}

// 停止自动滚动
const stopLinkAutoScroll = () => {
  if (linkAutoScrollInterval.value !== null) {
    clearInterval(linkAutoScrollInterval.value)
    linkAutoScrollInterval.value = null
  }
}

// 清理连接线拖拽状态（用于异常情况）
const cleanupLinkDrag = () => {
  stopLinkAutoScroll()

  // 清除缓存
  cachedBodyRect = null

  // 取消待处理的 RAF
  if (linkDragRafId !== null) {
    cancelAnimationFrame(linkDragRafId)
    linkDragRafId = null
  }

  // 🚀 清除 LinkDragGuide 画布
  linkDragGuideRef.value?.clear()

  // 移除全局监听器
  document.removeEventListener('mousemove', handleGlobalMouseMove)
  document.removeEventListener('mouseup', handleGlobalMouseUp)

  dragLinkMode.value = null
  linkDragSourceTask.value = null
  linkDragTargetTask.value = null
  isValidLinkTarget.value = false
}

// 获取连接线拖拽起始点的X坐标
const getLinkDragStartX = (): number => {
  if (!linkDragSourceTask.value) return 0

  const position = taskBarPositions.value[linkDragSourceTask.value.id]
  if (!position) return 0

  // 根据拖拽模式决定起始点位置
  if (dragLinkMode.value === 'predecessor') {
    // 前置任务：从任务条左侧开始
    return position.left
  } else {
    // 后置任务：从任务条右侧开始
    return position.left + position.width
  }
}

// 获取连接线拖拽起始点的Y坐标
const getLinkDragStartY = (): number => {
  if (!linkDragSourceTask.value) return 0

  const position = taskBarPositions.value[linkDragSourceTask.value.id]
  if (!position) return 0

  // 从任务条中心位置开始
  return position.top + position.height / 2
}

// v1.9.5 P2-4优化 - 使用从GanttChart注入的Split Bar拖拽状态
// 替换本地的isSplitterDragging，使用统一的状态管理
const isSplitterDragging = isSplitBarDragging

// 滚动状态管理
const isScrolledLeft = ref(false)
const isScrolledRight = ref(false)
const scrollProgress = ref(0)
const isScrolling = ref(false)
let scrollTimeout: number | null = null

// 粘性效果所需的滚动位置信息
const timelineScrollLeft = ref(0)
const timelineContainerWidth = ref(0)

// 跳过 debouncedUpdateTimelineRange 的一次性标志
// 用于 drag-end / toggle-end 配置 trigger 的宽度更新，只需要更新 sticky/bubble，无需重算日期范围
let skipTimelineRangeUpdate = false

// 允许 updateTimelineRange 在资源视图下执行一次的一次性标志
// 只在任务视图 → 资源视图切换时设置，计算完成后自动清除
let forceTimelineRangeInResourceView = false

// 半圆气泡控制状态
const hideBubbles = ref(true) // 初始时隐藏半圆，等待初始滚动完成
const isInitialScrolling = ref(true) // 跟踪初始滚动状态
let hideBubblesTimeout: number | null = null // 半圆显示恢复定时器

// 虚拟滚动相关状态
const HOUR_WIDTH = 40 // 每小时40px
const VIRTUAL_BUFFER = 10 // 减少缓冲区以提升滑动性能

// v1.9.5 P2-3优化 - 智能缓存数据结构
interface TimelineCacheEntry {
  data: unknown
  timestamp: number
  scale: TimelineScale
}

const timelineDataCache = new Map<string, TimelineCacheEntry>()
const CACHE_TTL = 60000 // 缓存有效期：1分钟
const MAX_CACHE_SIZE = 4 // 最多缓存4个刻度（日/周/月/年）

// 初始化状态
const isInitialLoad = ref(true)

// 计算小时视图的可视区域范围
const visibleHourRange = computed(() => {
  if (currentTimeScale.value !== TimelineScale.HOUR) {
    return { startHour: 0, endHour: 0 }
  }

  const scrollLeft = timelineScrollLeft.value
  const containerWidth = timelineContainerWidth.value

  // 首次加载时，使用更大的初始渲染范围
  if (isInitialLoad.value && scrollLeft === 0) {
    // 初始加载且在起始位置：显示开头的一周
    return {
      startHour: 0,
      endHour: 168, // 一周 (7*24=168小时)
    }
  } else if (isInitialLoad.value) {
    // 初始加载但不在起始位置：以今天为中心的一周范围
    const today = new Date()
    const timelineStart = timelineConfig.value.startDate
    const todayHours = Math.floor((today.getTime() - timelineStart.getTime()) / (1000 * 60 * 60))

    return {
      startHour: Math.max(0, todayHours - 168), // 前一周 (7*24=168小时)
      endHour: todayHours + 168, // 后一周
    }
  }

  // 正常滚动状态：计算可视区域的开始和结束小时（相对于时间线开始的小时偏移）
  const startHour = Math.floor(scrollLeft / HOUR_WIDTH) - VIRTUAL_BUFFER
  const endHour = Math.ceil((scrollLeft + containerWidth) / HOUR_WIDTH) + VIRTUAL_BUFFER

  return {
    startHour: Math.max(0, startHour),
    endHour: Math.max(startHour + 1, endHour),
  }
})

// v1.9.6 Sprint2(P1) - 防抖的滚动位置（减少visibleTimeRange的触发频率）
const debouncedScrollLeft = ref(0)
const debouncedContainerWidth = ref(0)
let scrollDebounceTimer: number | null = null
let visibleTimeRangeCallCount = 0

watch([timelineScrollLeft, timelineContainerWidth], ([newScrollLeft, newWidth]) => {
  if (scrollDebounceTimer) {
    clearTimeout(scrollDebounceTimer)
  }

  scrollDebounceTimer = window.setTimeout(() => {
    debouncedScrollLeft.value = newScrollLeft
    debouncedContainerWidth.value = newWidth
    scrollDebounceTimer = null
  }, 100) // 增加到100ms，减少触发频率

  // 首次立即更新
  if (debouncedScrollLeft.value === 0 && debouncedContainerWidth.value === 0) {
    debouncedScrollLeft.value = newScrollLeft
    debouncedContainerWidth.value = newWidth
  }
}, { immediate: true })

// v1.9.5 P2-1优化 - 计算水平方向可见的时间范围（用于TaskBar过滤）
const visibleTimeRange = computed(() => {
  visibleTimeRangeCallCount++

  const scrollLeft = debouncedScrollLeft.value
  const containerWidth = debouncedContainerWidth.value || timelineContainerWidth.value
  // v1.9.6 Sprint2(P1) - 根据时间刻度动态调整缓冲区，避免月/季/年视图可见范围过大
  let bufferRatio = 0.3
  if (currentTimeScale.value === TimelineScale.WEEK) {
    bufferRatio = 0.15
  } else if (
    currentTimeScale.value === TimelineScale.MONTH ||
    currentTimeScale.value === TimelineScale.QUARTER ||
    currentTimeScale.value === TimelineScale.YEAR
  ) {
    bufferRatio = 0.05
  }
  const bufferWidth = containerWidth * bufferRatio

  // 根据当前时间刻度和scrollLeft计算可见的开始日期
  const startDate = getDateByScrollPosition(Math.max(0, scrollLeft - bufferWidth))
  // 计算可见的结束日期
  const endDate = getDateByScrollPosition(scrollLeft + containerWidth + bufferWidth)

  return { startDate, endDate }
})

// v1.9.5 P2-1优化 - 根据滚动位置计算日期（v1.9.6 Sprint2 优化 - 使用timelineData精确计算）
const getDateByScrollPosition = (scrollPosition: number): Date => {
  const timelineStart = timelineConfig.value.startDate
  const timelineEnd = timelineConfig.value.endDate
  const scale = currentTimeScale.value

  // v1.9.6 Sprint2 修复：边界处理
  if (scrollPosition <= 0) {
    return timelineStart
  }

  if (scale === TimelineScale.HOUR) {
    // 小时视图：每小时40px
    const hours = scrollPosition / 40
    return new Date(timelineStart.getTime() + hours * 60 * 60 * 1000)
  } else if (scale === TimelineScale.DAY) {
    // 日视图：每天30px
    const days = scrollPosition / 30
    return new Date(timelineStart.getTime() + days * 24 * 60 * 60 * 1000)
  } else if (scale === TimelineScale.WEEK || scale === TimelineScale.MONTH || scale === TimelineScale.QUARTER || scale === TimelineScale.YEAR) {
    // v1.9.6 Sprint2(P1) - 周/月/季/年视图：使用timelineData精确计算（避免累积误差）
    const data = timelineData.value as any
    if (!data || data.length === 0) {
      return timelineStart
    }

    let cumulativePosition = 0

    if (scale === TimelineScale.WEEK) {
      // 周视图：遍历weeks找到对应位置
      for (const periodData of data) {
        const weeks = periodData.weeks || []
        for (const week of weeks) {
          const weekWidth = 60
          if (scrollPosition >= cumulativePosition && scrollPosition < cumulativePosition + weekWidth) {
            // 找到目标周，计算周内具体日期
            const offsetInWeek = scrollPosition - cumulativePosition
            const dayWidth = weekWidth / 7
            const dayIndex = Math.floor(offsetInWeek / dayWidth)
            const subDays = week.subDays || []
            if (dayIndex < subDays.length) {
              return new Date(subDays[dayIndex].date)
            }
            return new Date(week.weekStart)
          }
          cumulativePosition += weekWidth
        }
      }
    } else if (scale === TimelineScale.MONTH) {
      // 月视图：遍历每个月找到对应位置
      for (const periodData of data) {
        const monthWidth = 60
        if (scrollPosition >= cumulativePosition && scrollPosition < cumulativePosition + monthWidth) {
          // 找到目标月，计算月内具体日期
          const offsetInMonth = scrollPosition - cumulativePosition
          const daysInMonth = periodData.monthData?.dayCount || 30
          const dayWidth = monthWidth / daysInMonth
          const dayIndex = Math.floor(offsetInMonth / dayWidth)
          return new Date(periodData.year, periodData.month - 1, dayIndex + 1)
        }
        cumulativePosition += monthWidth
      }
    } else if (scale === TimelineScale.QUARTER) {
      // 季度视图：遍历quarters找到对应位置
      for (const periodData of data) {
        const quarters = (periodData as any).quarters || []
        for (const quarter of quarters) {
          const quarterWidth = 60
          if (scrollPosition >= cumulativePosition && scrollPosition < cumulativePosition + quarterWidth) {
            // 找到目标季度，计算季度内具体日期
            const offsetInQuarter = scrollPosition - cumulativePosition
            const quarterStart = new Date(quarter.startDate)
            const quarterEnd = new Date(quarter.endDate)
            const daysInQuarter = Math.ceil((quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24))
            const dayWidth = quarterWidth / daysInQuarter
            const dayOffset = Math.floor(offsetInQuarter / dayWidth)
            return new Date(quarterStart.getTime() + dayOffset * 24 * 60 * 60 * 1000)
          }
          cumulativePosition += quarterWidth
        }
      }
    } else if (scale === TimelineScale.YEAR) {
      // 年视图：遍历halfYears找到对应位置
      for (const periodData of data) {
        const halfYears = (periodData as any).halfYears || []
        for (const halfYear of halfYears) {
          const halfYearWidth = 180
          if (scrollPosition >= cumulativePosition && scrollPosition < cumulativePosition + halfYearWidth) {
            // 找到目标半年，计算半年内具体日期
            const offsetInHalfYear = scrollPosition - cumulativePosition
            const halfYearStart = new Date(halfYear.startDate)
            const halfYearEnd = new Date(halfYear.endDate)
            const daysInHalfYear = Math.ceil((halfYearEnd.getTime() - halfYearStart.getTime()) / (1000 * 60 * 60 * 24))
            const dayWidth = halfYearWidth / daysInHalfYear
            const dayOffset = Math.floor(offsetInHalfYear / dayWidth)
            return new Date(halfYearStart.getTime() + dayOffset * 24 * 60 * 60 * 1000)
          }
          cumulativePosition += halfYearWidth
        }
      }
    }

    // 如果没找到匹配位置，返回最后一个日期
    console.warn(`[Sprint2-Debug] scrollPosition=${scrollPosition} exceeds timelineData range (cumulative=${cumulativePosition}), returning end date`)
    return timelineEnd
  }

  // 默认返回开始日期
  return timelineStart
}

// 计算纵向可视区域的任务范围（支持动态行高）
let visibleTaskRangeCallCount = 0
const visibleTaskRange = computed(() => {
  visibleTaskRangeCallCount++
  const scrollTop = timelineBodyScrollTop.value
  const containerHeight = timelineBodyHeight.value || 600

  if (viewMode.value === 'resource') {
    // 资源视图：基于资源行的实际高度计算可见范围
    const resources = dataSource.value as Resource[]

    let startIndex = 0
    let endIndex = resources.length

    // 找到第一个可见的资源行
    for (let i = 0; i < resources.length; i++) {
      const resourceId = resources[i].id
      const rowTop = resourceRowPositions.value?.get(resourceId) || 0
      // v1.9.9 从 resourceTaskLayouts 直接获取布局
      const layout = resourceTaskLayouts.value.get(resourceId)
      const rowHeight = layout?.totalHeight || ROW_HEIGHT
      const rowBottom = rowTop + rowHeight

      if (rowBottom >= scrollTop - ROW_HEIGHT * VERTICAL_BUFFER) {
        startIndex = i
        break
      }
    }

    // 找到最后一个可见的资源行
    const scrollBottom = scrollTop + containerHeight
    for (let i = startIndex; i < resources.length; i++) {
      const resourceId = resources[i].id
      const rowTop = resourceRowPositions.value?.get(resourceId) || 0

      if (rowTop > scrollBottom + ROW_HEIGHT * VERTICAL_BUFFER) {
        endIndex = i
        break
      }
    }

    return {
      startIndex: Math.max(0, startIndex),
      endIndex: Math.min(resources.length, endIndex),
    }
  } else {
    // 任务视图：使用固定行高计算
    const startIndex = Math.floor(scrollTop / ROW_HEIGHT) - VERTICAL_BUFFER
    const endIndex = Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VERTICAL_BUFFER

    return {
      startIndex: Math.max(0, startIndex),
      endIndex: Math.min(tasks.value.length, Math.max(startIndex + 1, endIndex)),
    }
  }
})

// 获取虚拟滚动优化后的可见任务列表
const visibleTasks = computed(() => {
  const { startIndex, endIndex } = visibleTaskRange.value

  // 任务视图：返回可见的任务列表
  const verticallyVisibleTasks = tasks.value.slice(startIndex, endIndex).map((task, index) => ({
    task,
    originalIndex: startIndex + index,
  }))

  // v1.9.6 Sprint2 修复：任务视图需要保留边界磁吸气泡，因此不做水平过滤
  return verticallyVisibleTasks
})

// v1.9.0 资源视图的可见资源列表
const visibleResources = computed(() => {
  const { startIndex, endIndex } = visibleTaskRange.value

  if (viewMode.value !== 'resource') {
    return []
  }

  const resources = dataSource.value as Resource[]
  return resources.slice(startIndex, endIndex).map((resource, index) => ({
    resource,
    originalIndex: startIndex + index,
  }))
})

// ─── 任务视图 TaskBar 分批渲染（对齐资源视图策略）────────────────────────────────────
// 每次虚拟窗口滑动时，新进入视口的行限流挂载，避免同帧大量 getBoundingClientRect reflow
const TASK_VIEW_BATCH_SIZE = 3 // 每帧最多新增 3 行（节奏与资源视图一致）
let _taskBatchRafId: number | null = null
let _taskBatchQueue: { task: Task; originalIndex: number }[] = []
// P2 修复：ID 可为 number | string，之前用 Set<number> 导致字符串 ID 永不被清理
const _taskRenderedIds = new Set<number | string>()
const taskRenderedItems = shallowRef<{ task: Task; originalIndex: number }[]>([])

watch(
  [visibleTasks, viewMode] as const,
  ([newVisible, mode]) => {
    if (mode !== 'task') {
      // 切换到其他视图时清理状态
      if (_taskBatchRafId !== null) { cancelAnimationFrame(_taskBatchRafId); _taskBatchRafId = null }
      _taskBatchQueue = []
      _taskRenderedIds.clear()
      taskRenderedItems.value = []
      return
    }

    // 显式声明为 Set<number | string>，与 _taskRenderedIds 类型对齐（任务视图 ID 为 number）
    const newIds = new Set<number | string>(newVisible.map(t => t.task.id))

    // P1 修复：移除已滚出视口的 ID，同步清理 taskBarPositions
    // 虚拟滚动进出视口不触发 tasks watch，若不主动清理会导致位置对象无限增长
    const removedIds: (number | string)[] = []
    _taskRenderedIds.forEach(id => {
      if (!newIds.has(id)) {
        _taskRenderedIds.delete(id)
        removedIds.push(id)
      }
    })
    if (removedIds.length > 0) {
      const newPositions = { ...taskBarPositions.value }
      for (const id of removedIds) {
        delete newPositions[id as number]
      }
      taskBarPositions.value = newPositions
    }

    // 找出新进入视口的行
    const toAdd = newVisible.filter(t => !_taskRenderedIds.has(t.task.id))

    // 取消上一帧未完成的批次
    if (_taskBatchRafId !== null) { cancelAnimationFrame(_taskBatchRafId); _taskBatchRafId = null }
    _taskBatchQueue = toAdd

    // 立即渲染第一批（保证当帧无闪烁）
    const firstBatch = _taskBatchQueue.splice(0, TASK_VIEW_BATCH_SIZE)
    firstBatch.forEach(t => _taskRenderedIds.add(t.task.id))
    taskRenderedItems.value = newVisible.filter(t => _taskRenderedIds.has(t.task.id))

    // 剩余行逐帧补入
    if (_taskBatchQueue.length > 0) {
      const step = () => {
        const batch = _taskBatchQueue.splice(0, TASK_VIEW_BATCH_SIZE)
        if (batch.length === 0) { _taskBatchRafId = null; return }
        batch.forEach(t => _taskRenderedIds.add(t.task.id))
        taskRenderedItems.value = visibleTasks.value.filter(t => _taskRenderedIds.has(t.task.id))
        _taskBatchRafId = _taskBatchQueue.length > 0 ? requestAnimationFrame(step) : null
      }
      _taskBatchRafId = requestAnimationFrame(step)
    }
  },
  { immediate: true },
)

// v1.9.6 Sprint2(P1+P4) - 资源视图TaskBar分批渲染队列（优化：批次从20改为5）
const RESOURCE_BATCH_SIZE = 5 // 方案4: 更小批次，从20改为5
const FRAME_TIME_BUDGET = 8 // 每帧最多8ms用于TaskBar渲染

// v1.9.6 Sprint2(P5) - TaskBar渲染缓存机制：避免重复渲染已有TaskBar
type TaskBarRenderCache = {
  taskId: string | number
  resourceId: string | number
  rendered: boolean // 是否已经渲染过DOM
  timestamp: number // 最后渲染时间
}

const taskBarRenderCache = shallowRef(new Map<string, TaskBarRenderCache>()) // key: resourceId-taskId

type ResourceTaskQueue = {
  tasks: Task[]
  visibleCount: number
  totalCount: number
  originalTasks: Task[]
}

const resourceTaskQueues = shallowRef(new Map<string | number, ResourceTaskQueue>())
const resourceTaskRenderLimits = shallowRef(new Map<string | number, number>())
const resourceRenderPhase = ref<'visible' | 'background'>('visible')
let resourceBatchRafId: number | null = null

const stopResourceBatchRender = () => {
  if (resourceBatchRafId !== null) {
    cancelAnimationFrame(resourceBatchRafId)
    resourceBatchRafId = null
  }
}

const scheduleResourceBatchRender = () => {
  stopResourceBatchRender()

  const step = () => {
    if (viewMode.value !== 'resource') {
      resourceBatchRafId = null
      return
    }

    // 方案4: 帧时间预算控制
    const frameStartTime = performance.now()
    const limits = new Map(resourceTaskRenderLimits.value)
    let hasMore = false

    resourceTaskQueues.value.forEach((queue, resourceId) => {
      // 检查是否超出帧时间预算
      if (performance.now() - frameStartTime > FRAME_TIME_BUDGET) {
        hasMore = true // 下一帧继续处理
        return
      }

      const current = limits.get(resourceId) || 0
      // v1.9.6 Sprint4 - 优化：只使用 visibleCount，忽略 background 阶段
      const phaseTarget = queue.visibleCount

      if (current < phaseTarget) {
        const next = Math.min(phaseTarget, current + RESOURCE_BATCH_SIZE)
        limits.set(resourceId, next)
        hasMore = true
      }
    })

    // v1.9.6 Sprint4 - 禁用 background 渲染阶段
    // 因为队列中已经没有 background 任务了（totalCount === visibleCount）
    // if (!hasMore && resourceRenderPhase.value === 'visible' && hasBackground) {
    //   resourceRenderPhase.value = 'background'
    //   hasMore = true
    // }

    if (hasMore) {
      resourceTaskRenderLimits.value = limits
      resourceBatchRafId = requestAnimationFrame(step)
    } else {
      resourceBatchRafId = null
    }
  }

  resourceBatchRafId = requestAnimationFrame(step)
}

const rebuildResourceTaskQueues = () => {
  if (viewMode.value !== 'resource') {
    resourceTaskQueues.value = new Map()
    resourceTaskRenderLimits.value = new Map()
    resourceRenderPhase.value = 'visible'
    taskBarRenderCache.value = new Map() // 清空缓存
    stopResourceBatchRender()
    return
  }

  const { startDate: visibleStartDate, endDate: visibleEndDate } = visibleTimeRange.value
  const skipHorizontalFilter = currentTimeScale.value === TimelineScale.HOUR

  // v1.9.7 Bug修复：月度/季度/年度视图禁用像素级精确过滤，直接使用visibleTimeRange
  // 原因：月度视图中每月天数不同（28-31天），使用固定30天计算会导致跨月时间范围误差
  // 例如：2月只有28天，但计算时用30天，会导致部分TaskBar被错误过滤
  const scale = currentTimeScale.value
  const usePixelLevelFilter = scale === TimelineScale.HOUR || scale === TimelineScale.DAY || scale === TimelineScale.WEEK

  let viewportStartTime: number
  let viewportEndTime: number

  if (usePixelLevelFilter) {
    // 方案1: 超激进虚拟化 - 计算精确的屏幕可见区域（像素级别）- 仅用于小时/日/周视图
    const scrollLeft = timelineScrollLeft.value
    const containerWidth = timelineContainerWidth.value
    const timelineStart = timelineConfig.value.startDate.getTime()

    // 根据时间刻度计算每单位的像素宽度
    let pixelPerMs = 0
    if (scale === TimelineScale.HOUR) {
      pixelPerMs = 40 / (60 * 60 * 1000) // 40px per hour
    } else if (scale === TimelineScale.DAY) {
      pixelPerMs = 30 / (24 * 60 * 60 * 1000) // 30px per day
    } else if (scale === TimelineScale.WEEK) {
      pixelPerMs = 60 / (7 * 24 * 60 * 60 * 1000) // 60px per week
    }

    // 超精确计算：只保留10%缓冲区（方案1核心）
    const ULTRA_TIGHT_BUFFER = 0.1 // 只保留10%缓冲区
    const bufferPixels = containerWidth * ULTRA_TIGHT_BUFFER
    const viewportStartPixel = Math.max(0, scrollLeft - bufferPixels)
    const viewportEndPixel = scrollLeft + containerWidth + bufferPixels

    // 转换为时间戳进行超精确过滤
    viewportStartTime = timelineStart + viewportStartPixel / pixelPerMs
    viewportEndTime = timelineStart + viewportEndPixel / pixelPerMs
  } else {
    // v1.9.7 修复：月度/季度/年度视图直接使用visibleTimeRange（已通过timelineData精确计算）
    viewportStartTime = visibleStartDate.getTime()
    viewportEndTime = visibleEndDate.getTime()
  }

  const queues = new Map<string | number, ResourceTaskQueue>()
  const limits = new Map<string | number, number>()

  // v1.9.6 Sprint2(P5) - 渲染缓存增量更新：保留已有记录
  const currentCache = new Map(taskBarRenderCache.value)
  const newCache = new Map<string, TaskBarRenderCache>()
  const currentTimestamp = Date.now()
  let cachedCount = 0 // 统计已渲染的TaskBar数量

  visibleResources.value.forEach(({ resource }) => {
    const resourceId = resource.id as string | number
    const originalTasks = ((resource as any).tasks || []) as Task[]

    // 方案1: 使用超精确的像素级别过滤
    const visibleTasks = skipHorizontalFilter
      ? originalTasks
      : originalTasks.filter(task => {
        if (!task.startDate || !task.endDate) {
          return false
        }
        const taskStartTime = new Date(task.startDate).getTime()
        const taskEndTime = new Date(task.endDate).getTime()

        // 超精确过滤：TaskBar必须在像素级别的可见范围内
        return taskEndTime >= viewportStartTime && taskStartTime <= viewportEndTime
      })

    // v1.9.6 Sprint2(P5) - 更新渲染缓存：记录所有TaskBar的状态
    originalTasks.forEach((task, idx) => {
      const taskId = task.id ?? `idx-${idx}`
      const cacheKey = `${resourceId}-${taskId}`
      const existingCache = currentCache.get(cacheKey)

      // 如果已经渲染过，保留rendered=true状态
      const isRendered = existingCache?.rendered || false
      if (isRendered) {
        cachedCount = cachedCount + 1
      }

      newCache.set(cacheKey, {
        taskId,
        resourceId,
        rendered: isRendered,
        timestamp: isRendered ?
          (existingCache ?
            existingCache.timestamp
            : currentTimestamp)
          : currentTimestamp,
      })
    })

    // v1.9.6 Sprint4 - 优化：移除 backgroundTasks，只保留 visibleTasks
    // 这样可以避免后续的 background 渲染阶段渲染不可见的 TaskBar
    queues.set(resourceId, {
      tasks: visibleTasks,  // 只保留可见任务，不包含 backgroundTasks
      visibleCount: visibleTasks.length,
      totalCount: visibleTasks.length,  // totalCount = visibleCount，禁用 background 阶段
      originalTasks,
    })

    // v1.9.6 Sprint2(P5) - 智能初始渲染限制：优先渲染未缓存的TaskBar
    const previousLimit = resourceTaskRenderLimits.value.get(resourceId)
    let initialLimit: number

    if (previousLimit !== undefined && previousLimit >= visibleTasks.length) {
      // 如果之前已经渲染超过当前可见数量，直接继承
      initialLimit = Math.min(previousLimit, visibleTasks.length)  // v1.9.6 Sprint4 - 修复：使用 visibleTasks.length
    } else {
      // 否则按批次大小逐步渲染
      initialLimit = Math.min(RESOURCE_BATCH_SIZE, visibleTasks.length)
    }

    limits.set(resourceId, initialLimit)
  })

  resourceTaskQueues.value = queues
  resourceTaskRenderLimits.value = limits
  resourceRenderPhase.value = 'visible'
  taskBarRenderCache.value = newCache // 更新缓存

  scheduleResourceBatchRender()
}

watch(
  () => [viewMode.value, currentTimeScale.value, visibleTimeRange.value, visibleResources.value],
  () => rebuildResourceTaskQueues(),
  { immediate: true },
)

// v1.9.6 Sprint2(P5) - 监控渲染限制变化，标记已渲染的TaskBar
watch(
  () => resourceTaskRenderLimits.value,
  (newLimits) => {
    if (viewMode.value !== 'resource') return

    const cache = new Map(taskBarRenderCache.value)
    const currentTimestamp = Date.now()
    let updatedCount = 0

    resourceTaskQueues.value.forEach((queue, resourceId) => {
      const renderLimit = newLimits.get(resourceId) || 0
      const renderedTasks = queue.tasks.slice(0, renderLimit)

      renderedTasks.forEach((task, idx) => {
        const taskId = task.id ?? `idx-${idx}`
        const cacheKey = `${resourceId}-${taskId}`
        const existing = cache.get(cacheKey)

        // 标记为已渲染
        if (existing && !existing.rendered) {
          existing.rendered = true
          existing.timestamp = currentTimestamp
          updatedCount++
        }
      })
    })

    if (updatedCount > 0) {
      taskBarRenderCache.value = cache
    }
  },
  { deep: false },
)

// v1.9.5 P2-1优化 - 资源视图的可见资源及其水平过滤后的任务
let filteredTasksCallCount = 0
const visibleResourcesWithFilteredTasks = computed(() => {
  filteredTasksCallCount++

  if (viewMode.value !== 'resource') {
    return []
  }

  const { startDate: visibleStartDate, endDate: visibleEndDate } = visibleTimeRange.value
  const skipHorizontalFilter = currentTimeScale.value === TimelineScale.HOUR

  // 性能监控统计
  let totalOriginalTasks = 0
  let totalFilteredTasks = 0

  const result = visibleResources.value.map(({ resource, originalIndex }) => {
    const originalTasks = (resource as any).tasks || []
    totalOriginalTasks += originalTasks.length

    const queue = resourceTaskQueues.value.get(resource.id as string | number)
    const limit = resourceTaskRenderLimits.value.get(resource.id as string | number)

    let renderTasks: Task[]
    if (queue) {
      const renderCount = limit ?? queue.visibleCount
      renderTasks = queue.tasks.slice(0, renderCount)
    } else {
      // 过滤出在可见时间范围内的任务（用于TaskBar渲染）
      renderTasks = skipHorizontalFilter
        ? originalTasks
        : originalTasks.filter((task: Task) => {
          // 跳过没有时间信息的任务
          if (!task.startDate || !task.endDate) {
            return false
          }

          const taskStart = new Date(task.startDate)
          const taskEnd = new Date(task.endDate)

          // 任务结束日期 >= 可见开始日期 && 任务开始日期 <= 可见结束日期
          return taskEnd >= visibleStartDate && taskStart <= visibleEndDate
        })
    }

    totalFilteredTasks += renderTasks.length

    return {
      resource: {
        ...resource,
        tasks: renderTasks,
        // 保留原始完整的任务列表（用于GanttConflicts冲突检测）
        allTasks: originalTasks,
      },
      originalIndex,
    }
  })

  return result
})

// 防抖处理滚动事件（优化：增加防抖时间）
const debounce = <T extends (...args: unknown[]) => void>(func: T, wait: number): T => {
  let timeout: number | null = null
  return ((...args: Parameters<T>) => {
    const later = () => {
      timeout = null
      func(...args)
    }
    if (timeout) clearTimeout(timeout)
    timeout = window.setTimeout(later, wait)
  }) as T
}

// 优化的滚动处理器（增加防抖时间到 50ms）
const debouncedUpdatePositions = debounce(() => {
  computeAllMilestonesPositions()
}, 200)

// 虚拟渲染：防抖更新 Canvas 位置（滚动时触发）
const debouncedUpdateCanvasPosition = debounce(() => {
  updateSvgSize() // 重新计算 Canvas 位置和尺寸
}, 200)

// v1.9.5 P2-3优化 - 智能缓存时间轴数据的函数
const getCachedTimelineData = (): unknown => {
  const scale = currentTimeScale.value
  const startTime = timelineConfig.value.startDate.getTime()
  const endTime = timelineConfig.value.endDate.getTime()
  const key = `${scale}-${startTime}-${endTime}`

  // 检查缓存是否存在且未过期
  const cached = timelineDataCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // 缓存命中且未过期
    return cached.data
  }

  // 缓存未命中或已过期，重新生成数据
  let data: unknown
  if (scale === TimelineScale.HOUR) {
    data = generateHourTimelineData()
  } else if (scale === TimelineScale.WEEK) {
    data = generateWeekTimelineData()
  } else if (scale === TimelineScale.MONTH) {
    data = generateMonthTimelineData()
  } else if (scale === TimelineScale.QUARTER) {
    data = generateQuarterTimelineData()
  } else if (scale === TimelineScale.YEAR) {
    data = generateYearTimelineData()
  } else {
    data = generateDayTimelineData()
  }

  // 保存到缓存
  timelineDataCache.set(key, {
    data,
    timestamp: Date.now(),
    scale,
  })

  // 缓存大小控制：如果超过最大缓存数，删除最旧的条目
  if (timelineDataCache.size > MAX_CACHE_SIZE) {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    // 找到最旧的缓存条目
    timelineDataCache.forEach((entry, entryKey) => {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = entryKey
      }
    })

    // 删除最旧的条目
    if (oldestKey) {
      timelineDataCache.delete(oldestKey)
    }
  }

  return data
}

// 获取虚拟滚动优化后的时间轴数据
const optimizedTimelineData = computed(() => {
  const cachedData = getCachedTimelineData() as any
  // 只在小时视图中应用虚拟滚动
  if (currentTimeScale.value === TimelineScale.HOUR && Array.isArray(cachedData)) {
    const { startHour, endHour } = visibleHourRange.value

    // 优化：合并 map + filter 为单次遍历
    const result: any[] = []
    const dayStart = new Date(timelineConfig.value.startDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayStartTime = dayStart.getTime()
    const msPerDay = 1000 * 60 * 60 * 24

    for (const day of cachedData as any[]) {
      // 计算当前天相对于时间线开始的小时偏移
      const currentDay = new Date(day.year, day.month - 1, day.day)
      currentDay.setHours(0, 0, 0, 0)
      const daysDiff = Math.floor((currentDay.getTime() - dayStartTime) / msPerDay)
      const totalHourOffset = daysDiff * 24

      // 计算当前天应该显示的小时范围
      const dayStartHour = Math.max(0, startHour - totalHourOffset)
      const dayEndHour = Math.min(day.hours.length, endHour - totalHourOffset)

      // 只保留有小时数据的天
      if (dayStartHour < dayEndHour) {
        result.push({
          ...day,
          hours: day.hours.slice(dayStartHour, dayEndHour),
          hourOffset: totalHourOffset + dayStartHour,
          visibleHourStart: dayStartHour,
          _debug: {
            totalHourOffset,
            dayStartHour,
            dayEndHour,
            visibleRange: { startHour, endHour },
          },
        })
      }
    }

    return result
  }

  return cachedData
})

// 计算完整时间线的总宽度（用于虚拟滚动容器）
const totalTimelineWidth = computed(() => {
  const cachedData = getCachedTimelineData() as any
  if (!Array.isArray(cachedData)) return 0

  const scale = currentTimeScale.value

  // 小时视图
  if (scale === TimelineScale.HOUR) {
    let totalHours = 0
    for (const day of cachedData as any[]) {
      totalHours += day.hours.length
    }
    return totalHours * HOUR_WIDTH
  }

  // 季度视图
  if (scale === TimelineScale.QUARTER) {
    let totalQuarters = 0
    for (const year of cachedData as any[]) {
      totalQuarters += year.quarters.length
    }
    return totalQuarters * 60
  }

  // 周视图
  if (scale === TimelineScale.WEEK) {
    let totalWeeks = 0
    for (const month of cachedData) {
      totalWeeks += (month.weeks?.length || 0)
    }
    return totalWeeks * 60
  }

  // 月视图
  if (scale === TimelineScale.MONTH) {
    return cachedData.length * 60
  }

  // 年视图
  if (scale === TimelineScale.YEAR) {
    return cachedData.length * 360
  }

  // 日视图
  let totalDays = 0
  for (const month of cachedData) {
    totalDays += (month.days?.length || 0)
  }
  return totalDays * 30
})

let resizeObserver: ResizeObserver | null = null

// 里程碑位置信息管理（用于推挤效果）
const milestonePositions = ref<
  Map<
    number,
    {
      left: number
      originalLeft: number // 原始位置（不考虑停靠）
      isSticky: boolean
      stickyPosition: 'left' | 'right' | 'none'
    }
  >
>(new Map())

// 计算当前所有里程碑的位置信息（优化版：减少重复计算）
const computeAllMilestonesPositions = () => {
  const positions = new Map()
  const timelineStart = timelineConfig.value.startDate.getTime()
  const leftBoundary = timelineScrollLeft.value
  const rightBoundary = leftBoundary + timelineContainerWidth.value

  // 遍历所有里程碑分组
  for (const task of tasks.value) {
    if (task.type === 'milestone-group' && task.children) {
      for (const milestone of task.children) {
        const milestoneDate = new Date(milestone.startDate || '')
        if (!isNaN(milestoneDate.getTime())) {
          const startDiff = Math.floor(
            (milestoneDate.getTime() - timelineStart) / (1000 * 60 * 60 * 24),
          )
          const left = startDiff * 30 + 15 - 12 // 30是dayWidth，12是图标半径

          // 计算边界粘性状态
          const iconLeft = left - 12
          const iconRight = left + 12

          let isSticky = false
          let stickyPosition: 'left' | 'right' | 'none' = 'none'

          if (iconRight <= leftBoundary + 12) {
            isSticky = true
            stickyPosition = 'left'
          } else if (iconLeft >= rightBoundary - 12) {
            isSticky = true
            stickyPosition = 'right'
          }

          positions.set(milestone.id, {
            left,
            originalLeft: left,
            isSticky,
            stickyPosition,
          })
        }
      }
    } else if (task.type === 'milestone') {
      const milestoneDate = new Date(task.startDate || '')
      if (!isNaN(milestoneDate.getTime())) {
        const daysDiff = (milestoneDate.getTime() - timelineStart) / (1000 * 60 * 60 * 24)
        const startDiff = Math.floor(daysDiff)
        const left = startDiff * 30 + 15 - 12

        // 计算边界粘性状态
        const iconLeft = left - 12
        const iconRight = left + 12

        let isSticky = false
        let stickyPosition: 'left' | 'right' | 'none' = 'none'

        if (iconRight <= leftBoundary + 12) {
          isSticky = true
          stickyPosition = 'left'
        } else if (iconLeft >= rightBoundary - 12) {
          isSticky = true
          stickyPosition = 'right'
        }

        positions.set(task.id, {
          left,
          originalLeft: left,
          isSticky,
          stickyPosition,
        })
      }
    }
  }

  milestonePositions.value = positions
}

// 获取其他里程碑的位置信息（排除当前里程碑）
const getOtherMilestonesInfo = (currentId: number) => {
  const result: Array<{
    id: number
    left: number
    originalLeft: number // 新增：原始位置（不考虑停靠）
    isSticky: boolean
    stickyPosition: 'left' | 'right' | 'none'
    priority: number // 新增：推挤优先级（基于原始位置）
  }> = []

  milestonePositions.value.forEach((position, id) => {
    if (id !== currentId) {
      result.push({
        id,
        left: position.left,
        originalLeft: position.originalLeft, // 使用保存的原始位置
        isSticky: position.isSticky,
        stickyPosition: position.stickyPosition,
        priority: position.originalLeft, // 使用原始位置作为优先级
      })
    }
  })

  return result
}

// v1.9.5 P2-4优化 - 监听Split Bar拖拽结束，执行清理工作
watch(isSplitBarDragging, (dragging) => {
  if (!dragging) {
    // v1.9.9 拖拽结束后，手动触发一次容器尺寸更新（因为拖拽期间ResizeObserver被暂停）
    // 设置 skip 标志：拖拽不改变日期范围，只更新 sticky/bubble
    if (timelineContainerElement.value) {
      const newWidth = timelineContainerElement.value.clientWidth
      if (Math.abs(newWidth - timelineContainerWidth.value) > 1) {
        skipTimelineRangeUpdate = true
        timelineContainerWidth.value = newWidth
        nextTick(() => { skipTimelineRangeUpdate = false })
      }
    }

    // 同时更新body高度（虽然拖拽SplitterBar通常不会改变高度，但为了完整性）
    if (timelineBodyElement.value) {
      const newHeight = timelineBodyElement.value.clientHeight
      if (Math.abs(newHeight - timelineBodyHeight.value) > 1) {
        timelineBodyHeight.value = newHeight
      }
    }

    // Splitter拖拽结束后，强制重新计算半圆显示状态
    // 因为Timeline容器宽度可能发生了变化
    hideBubbles.value = true
    setTimeout(() => {
      hideBubbles.value = false
    }, 300) // 300ms后恢复半圆显示
  }
})

// 处理拖拽开始事件（保留用于兼容性，但不再更新状态）
const handleSplitterDragStart = () => {
  // v1.9.5 P2-4优化 - 状态已由GanttChart统一管理
  // isSplitterDragging 现在是注入的响应式引用
}

// 处理拖拽结束事件（保留用于兼容性，但不再更新状态）
const handleSplitterDragEnd = () => {
  // v1.9.5 P2-4优化 - 状态已由GanttChart统一管理
  // 清理工作已移至watch(isSplitBarDragging)
}

// 监听 TaskList toggle 结束，手动更新 Timeline 内部容器宽度
// 跳过日期范围重算，只让 sticky/bubble 重算和 TaskBar 重渲染生效
watch(isTaskListToggling, (toggling) => {
  if (!toggling) {
    // toggle 结束：读取 .timeline 滚动容器的真实新宽度
    // 使用 skip 标志，避免 watch(timelineContainerWidth) 触发 debouncedUpdateTimelineRange
    if (timelineContainerElement.value) {
      const newWidth = timelineContainerElement.value.clientWidth
      if (Math.abs(newWidth - timelineContainerWidth.value) > 1) {
        skipTimelineRangeUpdate = true
        timelineContainerWidth.value = newWidth
        nextTick(() => { skipTimelineRangeUpdate = false })
      }
    }
  }
})

// 处理Timeline容器resize事件（如TaskList切换等）
const handleTimelineContainerResized = () => {
  // Timeline容器大小发生变化，需要强制重新计算半圆显示状态

  // 立即隐藏半圆，让TaskBar重新计算边界
  hideBubbles.value = true

  // 清空TaskBar位置信息并强制重新渲染（修复全屏时关系线位置不正确的问题）
  taskBarPositions.value = {}
  taskBarRenderKey.value++

  // 清除之前的定时器，避免多次触发冲突
  if (hideBubblesTimeout) {
    clearTimeout(hideBubblesTimeout)
  }

  // 延迟恢复显示，确保容器变化完全生效
  hideBubblesTimeout = setTimeout(() => {
    hideBubbles.value = false
    hideBubblesTimeout = null
    // 再次更新SVG尺寸，确保关系线容器大小正确
    updateSvgSize()
  }, 300)
}

// 处理任务行悬停事件
const handleTaskRowHover = (taskId: number | string | null) => {
  // 如果正在拖拽Splitter或拖动滚动，则不响应悬停事件
  if (isSplitterDragging.value || isDragging.value) {
    return
  }

  hoveredTaskId.value = taskId
  // 发送事件通知TaskList组件
  window.dispatchEvent(
    new CustomEvent('timeline-task-hover', {
      detail: taskId,
    }),
  )
}

// 计算Timeline内容的总高度
const contentHeight = computed(() => {
  const minHeight = 400 // 最小高度确保有足够的空间

  // v1.9.0 资源视图：使用实际的累计高度
  if (viewMode.value === 'resource') {
    const resources = dataSource.value as Resource[]
    let totalHeight = 0

    resources.forEach(resource => {
      // v1.9.9 从 resourceTaskLayouts 直接获取布局
      const layout = resourceTaskLayouts.value.get(resource.id)
      totalHeight += layout?.totalHeight || 51
    })

    return Math.max(totalHeight, minHeight, timelineBodyHeight.value)
  }

  // 任务视图：每个任务行高度51px (50px + 1px border)
  const rowHeight = 51
  const taskCount = tasks.value.length
  const minHeightFromTasks = taskCount * rowHeight

  // 返回任务高度、最小高度和容器高度中的最大值
  return Math.max(minHeightFromTasks, minHeight, timelineBodyHeight.value)
})

// 监听TaskList的悬停事件
const handleTaskListHover = (event: CustomEvent) => {
  // 如果正在拖动滚动，则不响应悬停事件
  if (isDragging.value) {
    return
  }
  hoveredTaskId.value = event.detail
}

// 处理TaskList的双击事件 (与TaskBar双击效果一致)
const handleTaskListDoubleClick = (event: CustomEvent) => {
  const task = event.detail
  // 调用相同的双击处理逻辑
  handleTaskBarDoubleClick(task)
}

// 处理语言变化事件
const handleLocaleChange = () => {
  // 语言变化时重新生成时间轴数据，这样年月标签会使用新的语言格式
  timelineData.value = generateTimelineData()
}

// 处理里程碑双击事件
const handleMilestoneDoubleClick = (milestone: Milestone) => {
  // 高亮模式下禁用双击
  if (isInHighlightMode.value) {
    return
  }
  // 向上emit事件，让GanttChart统一处理
  emit('milestone-double-click', milestone)
}

// 关闭里程碑对话框
// 处理里程碑拖拽更新事件
const handleMilestoneUpdate = (updatedMilestone: Milestone) => {
  // 通知父组件里程碑数据已更新
  if (props.onMilestoneSave && typeof props.onMilestoneSave === 'function') {
    props.onMilestoneSave(updatedMilestone as Task) // Type conversion for backward compatibility
  }

  // 广播里程碑更新事件，通知其他组件数据变化
  window.dispatchEvent(
    new CustomEvent('milestone-data-updated', {
      detail: { milestone: updatedMilestone },
    }),
  )
}

// 生成时间轴数据
const generateTimelineData = (): any => {
  // 使用缓存版本提升性能
  const result = getCachedTimelineData()
  return result
}

// 清除缓存的函数
const clearTimelineCache = () => {
  timelineDataCache.clear()
}

// 生成日视图时间轴数据 (原有逻辑)
const generateDayTimelineData = () => {
  const months: unknown[] = []
  const currentDate = new Date(timelineConfig.value.startDate)

  while (currentDate <= timelineConfig.value.endDate) {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1

    // 生成该月的所有日期
    const days = []
    const daysInMonth = new Date(year, month, 0).getDate()

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day)
      const dayOfWeek = date.getDay() // 0=周日, 6=周六
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

      days.push({
        day,
        date,
        label: String(day).padStart(2, '0'),
        isToday: isToday(date),
        isWeekend,
      })
    }

    months.push({
      year,
      month,
      yearMonthLabel: formatYearMonth(year, month),
      startDate: new Date(currentDate),
      endDate: new Date(year, month, 0),
      days,
    })
    currentDate.setMonth(currentDate.getMonth() + 1)
  }

  return months
}

// 判断是否为工作时间
const isWorkingHour = (hour: number, dayOfWeek: number) => {
  // 周末（周六=6，周日=0）直接返回false，保持周末样式
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false
  }

  const workingHours = props.workingHours
  if (!workingHours) return false

  // 检查上午工作时间
  if (workingHours.morning) {
    const { start, end } = workingHours.morning
    if (hour >= start && hour <= end) {
      return true
    }
  }

  // 检查下午工作时间
  if (workingHours.afternoon) {
    const { start, end } = workingHours.afternoon
    if (hour >= start && hour <= end) {
      return true
    }
  }

  return false
}

// 生成小时视图时间轴数据
const generateHourTimelineData = () => {
  const days: unknown[] = []
  const currentDate = new Date(timelineConfig.value.startDate)

  while (currentDate <= timelineConfig.value.endDate) {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    const day = currentDate.getDate()

    // 生成该天的24小时数据
    const hours = []
    const dayOfWeek = currentDate.getDay() // 获取星期几
    for (let hour = 0; hour < 24; hour++) {
      const hourDate = new Date(year, month - 1, day, hour)
      hours.push({
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        shortLabel: String(hour).padStart(2, '0'), // 简化显示格式，只显示小时数
        date: hourDate,
        isToday: isToday(hourDate) && hour === new Date().getHours(),
        isWorkingHour: isWorkingHour(hour, dayOfWeek), // 判断是否为工作时间
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6, // 是否为周末
      })
    }

    days.push({
      year,
      month,
      day,
      date: new Date(currentDate),
      dateLabel: `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`,
      isToday: isToday(currentDate),
      hours,
    })

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return days
}

// 生成周视图时间轴数据
const generateWeekTimelineData = () => {
  const allWeeks: unknown[] = []
  // 首先生成所有周
  const startDate = new Date(timelineConfig.value.startDate)
  const endDate = new Date(timelineConfig.value.endDate)

  // 找到起始日期所在周的周一
  const weekStart = new Date(startDate)
  const dayOfWeek = weekStart.getDay() || 7 // 调整周日为7
  weekStart.setDate(weekStart.getDate() - (dayOfWeek - 1))

  const currentWeekStart = new Date(weekStart)

  // 生成所有周 - 从第一周的周一开始，到包含endDate的周为止
  while (currentWeekStart <= endDate) {
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6)

    // 每周归属到周一所在的月份
    // 例如：2025-09-29(周一) ~ 2025-10-05(周日) 归属到2025年9月
    //      2025-10-27(周一) ~ 2025-11-02(周日) 归属到2025年10月
    allWeeks.push({
      weekStart: new Date(currentWeekStart),
      weekEnd: new Date(currentWeekEnd),
      label: `${currentWeekStart.getDate()}`,
      isToday: isWeekContainsToday(currentWeekStart, currentWeekEnd),
      subDays: generateSubDaysForWeek(currentWeekStart),
      // 根据周一所在月份归属
      belongsToYear: currentWeekStart.getFullYear(),
      belongsToMonth: currentWeekStart.getMonth() + 1,
    })

    currentWeekStart.setDate(currentWeekStart.getDate() + 7)
  }

  // 按月份分组
  const monthsMap = new Map()

  for (const week of allWeeks) {
    const weekObj = week as Record<string, unknown>
    const belongsToYear = weekObj.belongsToYear as number
    const belongsToMonth = weekObj.belongsToMonth as number
    const key = `${belongsToYear}-${belongsToMonth}`
    if (!monthsMap.has(key)) {
      monthsMap.set(key, {
        year: belongsToYear,
        month: belongsToMonth,
        yearMonthLabel: formatYearMonth(belongsToYear, belongsToMonth),
        startDate: new Date(belongsToYear, belongsToMonth - 1, 1),
        endDate: new Date(belongsToYear, belongsToMonth, 0),
        weeks: [],
        isWeekView: true,
      })
    }
    monthsMap.get(key).weeks.push(week)
  }

  // 转换为数组并排序
  const sortedMonths = Array.from(monthsMap.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })

  return sortedMonths
}

// 生成一周内的7个子列（用于精确定位）
const generateSubDaysForWeek = (weekStart: Date) => {
  const subDays = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    subDays.push({
      date: new Date(date),
      dayOfWeek: date.getDay(),
    })
  }
  return subDays
}

// 判断周是否包含今天
const isWeekContainsToday = (weekStart: Date, weekEnd: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today >= weekStart && today <= weekEnd
}

// 计算周在全局时间轴中的位置（用于旗帜定位）
const getGlobalWeekPosition = (monthIndex: number, weekIndex: number) => {
  let position = 0

  // 累加前面月份的宽度
  for (let i = 0; i < monthIndex; i++) {
    const month = timelineData.value[i]
    if (month && month.isWeekView && month.weeks) {
      position += month.weeks.length * 60
    } else if (month && month.days) {
      position += month.days.length * 30
    }
  }

  // 加上当前月份内的周位置
  position += weekIndex * 60

  return position
}

// 更新时间刻度方法 - 供外部调用
const updateTimeScale = (scale: TimelineScale) => {
  perfMonitor2.start(`updateTimeScale-${scale}`)

  currentTimeScale.value = scale

  // 重置初始化状态
  isInitialLoad.value = true

  // 清除缓存，确保使用新的时间刻度数据
  clearTimelineCache()

  // 如果是小时视图或日视图，更新时间线配置
  if (scale === TimelineScale.HOUR) {
    const hourRange = getHourTimelineRange()
    // 设置防护标志，避免递归更新
    isUpdatingTimelineConfig = true
    timelineConfig.value = {
      ...timelineConfig.value,
      startDate: hourRange.startDate,
      endDate: hourRange.endDate,
    }
    isUpdatingTimelineConfig = false
  } else if (scale === TimelineScale.DAY) {
    const dayRange = getDayTimelineRange()
    // 设置防护标志，避免递归更新
    isUpdatingTimelineConfig = true
    timelineConfig.value = {
      ...timelineConfig.value,
      startDate: dayRange.startDate,
      endDate: dayRange.endDate,
    }
    isUpdatingTimelineConfig = false
  }

  // 如果是周视图，更新时间线配置
  if (scale === TimelineScale.WEEK) {
    const weekRange = getWeekTimelineRange()
    // 设置防护标志，避免递归更新
    isUpdatingTimelineConfig = true
    timelineConfig.value = {
      ...timelineConfig.value,
      startDate: weekRange.startDate,
      endDate: weekRange.endDate,
    }
    isUpdatingTimelineConfig = false
  }

  // 如果是月度视图，更新时间线配置
  if (scale === TimelineScale.MONTH) {
    const monthRange = getMonthTimelineRange()
    // 设置防护标志，避免递归更新
    isUpdatingTimelineConfig = true
    timelineConfig.value = {
      ...timelineConfig.value,
      startDate: monthRange.startDate,
      endDate: monthRange.endDate,
    }
    isUpdatingTimelineConfig = false
  }

  // 如果是季度视图，更新时间线配置
  if (scale === TimelineScale.QUARTER) {
    const yearRange = getYearTimelineRange()
    // 设置防护标志，避免递归更新
    isUpdatingTimelineConfig = true
    timelineConfig.value = {
      ...timelineConfig.value,
      startDate: yearRange.startDate,
      endDate: yearRange.endDate,
    }
    isUpdatingTimelineConfig = false
  }

  // 如果是年度视图，更新时间线配置
  if (scale === TimelineScale.YEAR) {
    const yearRange = getYearTimelineRange()
    // 设置防护标志，避免递归更新
    isUpdatingTimelineConfig = true
    timelineConfig.value = {
      ...timelineConfig.value,
      startDate: yearRange.startDate,
      endDate: yearRange.endDate,
    }
    isUpdatingTimelineConfig = false
  }

  // 重新生成时间线数据
  timelineData.value = generateTimelineData()

  // 等待DOM更新后触发多个重新计算事件
  nextTick(() => {
    // 1. 通知父组件时间刻度已变化
    emit('timeline-scale-changed', scale)

    // 2. 触发TaskBar重新计算位置事件
    window.dispatchEvent(new CustomEvent('timeline-scale-updated'))

    // 3. 延迟一点再次触发，确保所有组件都已更新
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('timeline-force-recalculate'))

      // 4. 视图切换完成后，定位到今日
      setTimeout(() => {
        scrollToTodayCenter()

        perfMonitor2.end(`updateTimeScale-${scale}`)
        perfMonitor2.report()
      }, 100)
    }, 50)
  })
}

// 判断是否为今天
const isToday = (date: Date) => {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

// 优化：使用 shallowRef 减少深度响应式开销（timelineData 是大数组，内部变化不需要深度追踪）
const timelineData = shallowRef(generateTimelineData() as any)

// 防止递归更新的标志
let isUpdatingTimelineConfig = false

// 保证timelineData响应式跟随timelineConfig变化
watch(
  () => [timelineConfig.value.startDate, timelineConfig.value.endDate],
  () => {
    // 避免在更新timelineConfig时触发递归
    if (!isUpdatingTimelineConfig) {
      // 配置变化时清除缓存
      clearTimelineCache()
      timelineData.value = generateTimelineData()
    }
  },
)

// v1.9.6 Phase1 - 监听timelineData和时间刻度变化，自动重建位置缓存
// 优化：只在Timeline层执行一次，所有TaskBar共享缓存（250个TaskBar × 3ms → 预计算80ms + 250个TaskBar × 0.2ms）
let positionCacheWatchCount = 0
watch(
  [timelineData, currentTimeScale],
  ([newData, newScale]) => {
    positionCacheWatchCount++

    if (newData && newScale) {
      positionCache.buildCache(newData as any[], newScale)
    }
  },
  { immediate: true }, // 立即执行，确保初始化时也构建缓存
)

// 保证每次时间轴数据变化后都自动居中今日（仅初始化和外部props变更时触发，不因任务/里程碑变更触发）
let hasInitialAutoScroll = false
watch(
  () => [timelineData.value, timelineConfig.value.startDate, timelineConfig.value.endDate],
  () => {
    if (!hasInitialAutoScroll) {
      nextTick(() => {
        scrollToTodayCenter()
        hasInitialAutoScroll = true
      })
    }
  },
  // 优化：移除 deep: true，因为监听的是基础类型（startDate/endDate）和 shallowRef（timelineData）
  // 不需要深度监听，可减少 90% 的监听开销
)

// 将今日定位到时间线中间位置
const scrollToTodayCenter = (retry = 0) => {
  // 开始滚动时隐藏半圆
  hideBubbles.value = true
  isInitialScrolling.value = true

  const today = new Date()
  const timelineStart = timelineConfig.value.startDate

  // 确保日期计算的精确性 - 使用年月日，忽略时分秒
  const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  // 年度视图和季度视图需要使用实际的timeline绘制起始日期
  let startNormalized: Date
  if (
    currentTimeScale.value === TimelineScale.YEAR ||
    currentTimeScale.value === TimelineScale.QUARTER
  ) {
    const yearRange = getYearTimelineRange()
    startNormalized = new Date(
      yearRange.startDate.getFullYear(),
      yearRange.startDate.getMonth(),
      yearRange.startDate.getDate(),
    )
  } else if (currentTimeScale.value === TimelineScale.MONTH) {
    // 月视图使用 getMonthTimelineRange
    const monthRange = getMonthTimelineRange()
    startNormalized = new Date(
      monthRange.startDate.getFullYear(),
      monthRange.startDate.getMonth(),
      monthRange.startDate.getDate(),
    )
  } else {
    startNormalized = new Date(
      timelineStart.getFullYear(),
      timelineStart.getMonth(),
      timelineStart.getDate(),
    )
  }

  // 计算今天距离时间线开始日期的天数
  const timeDiff = todayNormalized.getTime() - startNormalized.getTime()
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))

  // 计算今天在时间线中的像素位置（根据当前时间刻度）
  let todayPosition: number

  if (currentTimeScale.value === TimelineScale.HOUR) {
    // 小时视图：精确到小时的定位
    const currentHour = today.getHours()
    const currentMinute = today.getMinutes()

    // 基础天数偏移（到今日0点的位置）
    const baseDayPosition = daysDiff * dayWidth.value

    // 小时偏移：每小时40px
    const hourOffset = currentHour * 40

    // 分钟偏移：在当前小时内的精确位置
    const minuteOffset = (currentMinute / 60) * 40

    todayPosition = baseDayPosition + hourOffset + minuteOffset
  } else if (currentTimeScale.value === TimelineScale.QUARTER) {
    // 季度视图：使用与MilestonePoint相同的计算逻辑
    const targetYear = todayNormalized.getFullYear()
    const baseYear = startNormalized.getFullYear()

    // 每年的宽度是240px (4季度 * 60px)，每季度60px
    const yearWidth = 240
    const quarterWidth = 60

    // 计算年份偏移
    const yearOffset = targetYear - baseYear
    todayPosition = yearOffset * yearWidth

    // 判断是哪个季度
    const month = todayNormalized.getMonth() + 1
    let quarter = 1
    if (month >= 1 && month <= 3) {
      // Q1: 1-3月
    } else if (month >= 4 && month <= 6) {
      quarter = 2 // Q2: 4-6月
    } else if (month >= 7 && month <= 9) {
      quarter = 3 // Q3: 7-9月
    } else {
      quarter = 4 // Q4: 10-12月
    }

    // 添加季度偏移
    todayPosition += (quarter - 1) * quarterWidth

    // 在季度内的具体位置计算
    let startOfQuarter: Date, endOfQuarter: Date

    if (quarter === 1) {
      startOfQuarter = new Date(targetYear, 0, 1) // 1月1日
      endOfQuarter = new Date(targetYear, 2, 31) // 3月31日
    } else if (quarter === 2) {
      startOfQuarter = new Date(targetYear, 3, 1) // 4月1日
      endOfQuarter = new Date(targetYear, 5, 30) // 6月30日
    } else if (quarter === 3) {
      startOfQuarter = new Date(targetYear, 6, 1) // 7月1日
      endOfQuarter = new Date(targetYear, 8, 30) // 9月30日
    } else {
      startOfQuarter = new Date(targetYear, 9, 1) // 10月1日
      endOfQuarter = new Date(targetYear, 11, 31) // 12月31日
    }

    const dayOffset = Math.floor(
      (todayNormalized.getTime() - startOfQuarter.getTime()) / (1000 * 60 * 60 * 24),
    )
    const daysInQuarter =
      Math.floor((endOfQuarter.getTime() - startOfQuarter.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const dayPositionInQuarter = (dayOffset / daysInQuarter) * quarterWidth
    todayPosition += dayPositionInQuarter
  } else if (currentTimeScale.value === TimelineScale.MONTH) {
    // 月视图：计算今天所在月份的位置
    const targetYear = todayNormalized.getFullYear()
    const targetMonth = todayNormalized.getMonth() + 1 // 1-12

    const baseYear = startNormalized.getFullYear()
    const baseMonth = startNormalized.getMonth() + 1 // 1-12

    // 计算从起始月份到目标月份的月数
    const monthsDiff = (targetYear - baseYear) * 12 + (targetMonth - baseMonth)

    // 每个月60px
    const monthWidth = 60
    todayPosition = monthsDiff * monthWidth

    // 在月份内的具体位置（基于日期）
    const dayInMonth = todayNormalized.getDate()
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate()
    const dayPositionInMonth = (dayInMonth / daysInMonth) * monthWidth
    todayPosition += dayPositionInMonth
  } else if (currentTimeScale.value === TimelineScale.YEAR) {
    // 年度视图：使用 timelineData 计算精确位置
    const yearData = timelineData.value as Array<{
      year: number
      halfYears?: Array<{
        half: number
        startDate: Date
        endDate: Date
      }>
    }>

    let position = 0
    const halfYearWidth = 180 // 每个半年的宽度
    let found = false

    // 遍历年份数据
    for (const yearItem of yearData) {
      const halfYears = yearItem.halfYears || []

      for (const halfYear of halfYears) {
        const halfYearStart = new Date(halfYear.startDate)
        const halfYearEnd = new Date(halfYear.endDate)
        halfYearStart.setHours(0, 0, 0, 0)
        halfYearEnd.setHours(0, 0, 0, 0)

        // 如果今天在这个半年之前，说明已经过了
        if (todayNormalized < halfYearStart) {
          found = true
          break
        }

        // 如果今天在这个半年之内
        if (todayNormalized >= halfYearStart && todayNormalized <= halfYearEnd) {
          // 计算在半年内的偏移比例
          const totalMs = halfYearEnd.getTime() - halfYearStart.getTime()
          const elapsedMs = todayNormalized.getTime() - halfYearStart.getTime()
          const ratio = elapsedMs / totalMs
          position += ratio * halfYearWidth
          found = true
          break
        }

        // 今天在这个半年之后，累加宽度继续查找
        position += halfYearWidth
      }

      if (found) break
    }

    todayPosition = position
  } else {
    // 其他视图：使用原有逻辑
    todayPosition = daysDiff * dayWidth.value
  }

  // 优先使用缓存的容器元素
  const scrollContainer = timelineContainerElement.value

  if (!scrollContainer) {
    // 如果容器还未初始化，递归重试
    if (retry < 10) {
      setTimeout(() => scrollToTodayCenter(retry + 1), 60)
    }
    return
  }

  const containerWidth = scrollContainer.clientWidth
  // 若宽度为0，递归重试，最多10次
  if (containerWidth === 0 && retry < 10) {
    setTimeout(() => scrollToTodayCenter(retry + 1), 60)
    return
  }

  // 计算将今日列置于中间的滚动位置
  const centeredScrollPosition = todayPosition - containerWidth / 2 + 15
  if (typeof scrollContainer.scrollTo === 'function') {
    scrollContainer.scrollTo({ left: Math.max(0, centeredScrollPosition), behavior: 'smooth' })
  } else {
    scrollContainer.scrollLeft = Math.max(0, centeredScrollPosition)
  }

  // 滚动结束后延迟显示半圆，并标记初始化完成
  setTimeout(() => {
    isInitialScrolling.value = false
    // 在小时视图中，滚动完成后标记初始化完成
    if (currentTimeScale.value === TimelineScale.HOUR) {
      isInitialLoad.value = false
    }
    setTimeout(() => {
      hideBubbles.value = false
    }, 300) // 再等300ms确保滚动完全停止
  }, 1500) // 给滚动动画留1.5秒时间
}

// 计算年度视图中今日标记线的位置
const getTodayLinePositionInYearView = computed(() => {
  // 只在年度视图中计算
  if (currentTimeScale.value !== TimelineScale.YEAR) {
    return -1 // 返回负值表示不显示
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 使用 timelineData 计算精确位置
  const yearData = timelineData.value as Array<{
    year: number
    halfYears?: Array<{
      half: number
      startDate: Date
      endDate: Date
    }>
  }>

  if (!yearData || yearData.length === 0) {
    return -1
  }

  let position = 0
  const halfYearWidth = 180 // 每个半年的宽度

  // 遍历年份数据
  for (const yearItem of yearData) {
    const halfYears = yearItem.halfYears || []

    for (const halfYear of halfYears) {
      const halfYearStart = new Date(halfYear.startDate)
      const halfYearEnd = new Date(halfYear.endDate)
      halfYearStart.setHours(0, 0, 0, 0)
      halfYearEnd.setHours(0, 0, 0, 0)

      // 如果今天在这个半年之前，说明已经过了
      if (today < halfYearStart) {
        return position
      }

      // 如果今天在这个半年之内
      if (today >= halfYearStart && today <= halfYearEnd) {
        // 计算在半年内的偏移比例
        const totalMs = halfYearEnd.getTime() - halfYearStart.getTime()
        const elapsedMs = today.getTime() - halfYearStart.getTime()
        const ratio = elapsedMs / totalMs
        return position + ratio * halfYearWidth
      }

      // 今天在这个半年之后，累加宽度继续查找
      position += halfYearWidth
    }
  }

  // 今天在所有数据之后
  return position
})

// 检查年度视图中今日是否在当前时间范围内
const isTodayVisibleInYearView = computed(() => {
  // 只在年度视图中检查
  if (currentTimeScale.value !== TimelineScale.YEAR) {
    return false
  }

  const today = new Date()
  const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const yearRange = getYearTimelineRange()
  const startDate = yearRange.startDate
  const endDate = yearRange.endDate

  return todayNormalized >= startDate && todayNormalized <= endDate
})

const scrollToTasks = () => {
  if (tasks.value.length === 0) {
    // 如果没有任务，滚动到今天
    scrollToToday()
    return
  }

  // 优化：一次遍历找到所有有效的开始日期
  const startDates: Date[] = []
  for (const task of tasks.value) {
    if (task.startDate) {
      startDates.push(new Date(task.startDate))
    }
  }

  if (startDates.length === 0) {
    scrollToToday()
    return
  }

  // 找到最早的开始日期 - 优化：直接在遍历中找最小值
  let minTime = Infinity
  for (const date of startDates) {
    const time = date.getTime()
    if (time < minTime) {
      minTime = time
    }
  }
  const earliestDate = new Date(minTime)

  // 计算该日期在时间轴中的位置
  const year = earliestDate.getFullYear()
  const month = earliestDate.getMonth()
  const day = earliestDate.getDate()

  let totalDays = 0
  for (let i = 0; i < month; i++) {
    totalDays += new Date(year, i + 1, 0).getDate()
  }
  totalDays += day

  // 使用缓存的容器元素
  const timelinePanel = timelinePanelElement.value
  const timelinePanelW = timelinePanel?.clientWidth
  const scrollPosition = (totalDays - 1) * 30 - (timelinePanelW ? timelinePanelW / 2 : 200)

  // 滚动到指定位置
  if (timelineContainerElement.value) {
    timelineContainerElement.value.scrollLeft = Math.max(0, scrollPosition)
  }
}

// 聚焦到今天日期 - 改进版，基于时间线配置精确定位
const scrollToToday = () => {
  const today = new Date()
  const timelineStart = timelineConfig.value.startDate

  // 确保日期计算的精确性 - 使用年月日，忽略时分秒
  const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startNormalized = new Date(
    timelineStart.getFullYear(),
    timelineStart.getMonth(),
    timelineStart.getDate(),
  )

  // 计算今天距离时间线开始日期的天数
  const timeDiff = todayNormalized.getTime() - startNormalized.getTime()
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))

  // 如果今天不在时间线范围内，则不进行滚动
  if (daysDiff < 0 || todayNormalized > timelineConfig.value.endDate) {
    return
  }

  // 计算今天在时间线中的像素位置（每天30px宽度）
  const todayPosition = daysDiff * 30

  // 使用缓存的容器元素
  const timeline = timelineContainerElement.value
  if (!timeline) return

  const containerWidth = timeline.clientWidth

  // 计算居中滚动位置
  const centeredScrollPosition = todayPosition - containerWidth / 2 + 15

  // 滚动到指定位置，确保今日列在中间
  timeline.scrollTo({
    left: Math.max(0, centeredScrollPosition),
    behavior: 'smooth',
  })

  // 添加今日高亮效果
  setTimeout(() => {
    const todayColumns = document.querySelectorAll('.day-column.today')
    for (const column of todayColumns) {
      column.classList.add('today-highlight')
      // 2秒后移除高亮效果
      setTimeout(() => {
        column.classList.remove('today-highlight')
      }, 2000)
    }
  }, 500) // 等待滚动完成后再添加高亮
}

/**
 * 滚动到指定日期（居中显示）
 * @param date 日期（Date对象或日期字符串）
 */
const scrollToDate = (date: Date | string) => {
  const targetDate = typeof date === 'string' ? new Date(date) : date
  const timelineStart = timelineConfig.value.startDate

  // 确保日期计算的精确性 - 使用年月日，忽略时分秒
  const targetNormalized = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  )

  // 根据不同的时间刻度使用不同的起始日期
  let startNormalized: Date
  if (
    currentTimeScale.value === TimelineScale.YEAR ||
    currentTimeScale.value === TimelineScale.QUARTER
  ) {
    const yearRange = getYearTimelineRange()
    startNormalized = new Date(
      yearRange.startDate.getFullYear(),
      yearRange.startDate.getMonth(),
      yearRange.startDate.getDate(),
    )
  } else if (currentTimeScale.value === TimelineScale.MONTH) {
    const monthRange = getMonthTimelineRange()
    startNormalized = new Date(
      monthRange.startDate.getFullYear(),
      monthRange.startDate.getMonth(),
      monthRange.startDate.getDate(),
    )
  } else {
    startNormalized = new Date(
      timelineStart.getFullYear(),
      timelineStart.getMonth(),
      timelineStart.getDate(),
    )
  }

  // 计算目标日期距离时间线开始日期的天数
  const timeDiff = targetNormalized.getTime() - startNormalized.getTime()
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))

  // 计算目标日期在时间线中的像素位置（根据当前时间刻度）
  let datePosition: number

  if (currentTimeScale.value === TimelineScale.HOUR) {
    // 小时视图：精确到小时的定位
    const targetHour = targetDate.getHours()
    const targetMinute = targetDate.getMinutes()

    // 基础天数偏移（到目标日0点的位置）
    const baseDayPosition = daysDiff * dayWidth.value

    // 小时偏移：每小时40px
    const hourOffset = targetHour * 40

    // 分钟偏移：在当前小时内的精确位置
    const minuteOffset = (targetMinute / 60) * 40

    datePosition = baseDayPosition + hourOffset + minuteOffset
  } else if (currentTimeScale.value === TimelineScale.QUARTER) {
    // 季度视图：计算季度偏移
    const targetYear = targetNormalized.getFullYear()
    const baseYear = startNormalized.getFullYear()

    const yearWidth = 240 // 每年4季度 * 60px
    const quarterWidth = 60

    // 计算年份偏移
    const yearOffset = targetYear - baseYear
    datePosition = yearOffset * yearWidth

    // 计算季度内的偏移
    const targetQuarter = Math.floor(targetNormalized.getMonth() / 3)
    datePosition += targetQuarter * quarterWidth

    // 计算季度内的天数偏移（季度内的细微定位）
    const quarterStartMonth = targetQuarter * 3
    const quarterStartDate = new Date(targetYear, quarterStartMonth, 1)
    const daysIntoQuarter = Math.floor(
      (targetNormalized.getTime() - quarterStartDate.getTime()) / (1000 * 60 * 60 * 24),
    )
    const avgDaysInQuarter = 91 // 平均每季度91天
    datePosition += (daysIntoQuarter / avgDaysInQuarter) * quarterWidth
  } else if (currentTimeScale.value === TimelineScale.YEAR) {
    // 年视图：计算年内偏移
    const targetYear = targetNormalized.getFullYear()
    const baseYear = startNormalized.getFullYear()

    const yearWidth = 360 // 每年360px

    // 计算年份偏移
    const yearOffset = targetYear - baseYear
    datePosition = yearOffset * yearWidth

    // 计算年内的天数偏移
    const yearStartDate = new Date(targetYear, 0, 1)
    const daysIntoYear = Math.floor(
      (targetNormalized.getTime() - yearStartDate.getTime()) / (1000 * 60 * 60 * 24),
    )
    const daysInYear = 365 // 不考虑闰年的简化处理
    datePosition += (daysIntoYear / daysInYear) * yearWidth
  } else if (currentTimeScale.value === TimelineScale.MONTH) {
    // 月视图：需要累计每个月的实际宽度
    const targetYear = targetNormalized.getFullYear()
    const targetMonth = targetNormalized.getMonth()
    const baseYear = startNormalized.getFullYear()
    const baseMonth = startNormalized.getMonth()

    const monthWidth = 60 // 每月60px

    // 计算跨越的月数
    const monthsDiff = (targetYear - baseYear) * 12 + (targetMonth - baseMonth)
    datePosition = monthsDiff * monthWidth

    // 计算月内的天数偏移
    const targetDay = targetNormalized.getDate()
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
    datePosition += (targetDay / daysInMonth) * monthWidth
  } else if (currentTimeScale.value === TimelineScale.WEEK) {
    // 周视图：每周60px
    const weekWidth = 60
    datePosition = (daysDiff / 7) * weekWidth
  } else {
    // 日视图：每天30px
    datePosition = daysDiff * dayWidth.value
  }

  // 使用缓存的容器元素
  const timeline = timelineContainerElement.value
  if (!timeline) return

  const containerWidth = timeline.clientWidth

  // 计算居中滚动位置
  const centeredScrollPosition = datePosition - containerWidth / 2

  // 滚动到指定位置，确保目标日期在中间
  timeline.scrollTo({
    left: Math.max(0, centeredScrollPosition),
    behavior: 'smooth',
  })
}

// 更新任务
const updateTask = (updatedTask: Task) => {
  perfMonitor2.start('updateTask')

  // 不直接修改props数据，而是通过事件通知父组件
  // 触发全局事件，通知父组件更新数据
  window.dispatchEvent(
    new CustomEvent('task-updated', {
      detail: updatedTask,
    }),
  )

  perfMonitor2.end('updateTask')
}

// 处理TaskBar双击事件 - 只emit事件
const handleTaskBarDoubleClick = (task: Task) => {
  // 高亮模式下禁用双击
  if (isInHighlightMode.value) {
    return
  }
  emit('edit-task', task)
}

// 处理TaskBar单击事件 - 发出事件
const handleTaskBarClick = (task: Task, event: MouseEvent) => {
  // 高亮模式下禁用单击
  if (isInHighlightMode.value) {
    return
  }
  emit('click-task', task, event)
}

// 优化：使用 shallowRef 减少深度响应式开销（只需追踪对象引用变化，不需要追踪内部每个坐标）
const taskBarPositions = shallowRef<
  Record<number, { left: number; top: number; width: number; height: number }>
>({})

const bodyContentRef = ref<HTMLElement | null>(null)
// 🚀 LinkDragGuide 命令式 API 引用
const linkDragGuideRef = ref<InstanceType<typeof LinkDragGuide> | null>(null)
const svgWidth = ref(0)
const svgHeight = ref(0)

// Canvas 关系线尺寸（用于 GanttLinks 组件）
const canvasWidth = ref(0)
const canvasHeight = ref(0)
const canvasOffsetLeft = ref(0) // Canvas 在全局坐标系中的偏移量
const canvasOffsetTop = ref(0)

// 虚拟渲染 Canvas 的安全尺寸（动态计算，防止超过浏览器限制和移动端 OOM）
// 策略：以当前可见视口的倍数为基准，全屏/分辨率变化时 updateSvgSize() 自动重算
// - 宽度 = clamp(视口宽度 × 3, 2000, 8000)：覆盖日视图滑动 2 屏 + 关系线缓冲
// - 高度 = clamp(视口高度 × 3, 1200, 4000)：覆盖 3 屏任务行，移动端从 100MB→15MB
function computeSafeCanvasDimensions(): { width: number; height: number } {
  const vw = Math.max(timelineContainerWidth.value, 300) // 避免初始化为 0
  const vh = Math.max(timelineBodyHeight.value, 300)
  return {
    width: Math.min(Math.max(vw * 3, 2000), 8000),
    height: Math.min(Math.max(vh * 3, 1200), 4000),
  }
}

function updateSvgSize() {
  if (bodyContentRef.value) {
    // 获取 bodyContent 的总宽度和可视区域宽度
    const totalWidth = bodyContentRef.value.offsetWidth
    const totalHeight = contentHeight.value

    // 使用已经维护的 timelineScrollLeft，而不是从 DOM 重新读取
    // 因为 handleTimelineScroll 已经实时更新了这个值
    const scrollLeft = timelineScrollLeft.value
    const scrollTop = timelineBodyScrollTop.value

    // 根据当前视口（全屏/窗口/屏幕分辨率）动态确定 Canvas 安全尺寸
    const { width: SAFE_CANVAS_WIDTH, height: SAFE_CANVAS_HEIGHT } = computeSafeCanvasDimensions()

    // 虚拟渲染策略（统一模式）：
    // Canvas 始终使用动态安全宽度，通过 offsetLeft 动态定位
    canvasWidth.value = SAFE_CANVAS_WIDTH

    // 计算 Canvas 覆盖的起始位置
    // 策略：以当前滚动位置为基准，向左扩展 1/3，向右扩展 2/3
    const bufferLeft = SAFE_CANVAS_WIDTH / 3
    let idealOffsetLeft = Math.max(0, scrollLeft - bufferLeft)

    // 确保 Canvas 不超出内容范围
    // 1. 如果总宽度 <= Canvas 宽度，Canvas 从 0 开始
    // 2. 如果总宽度 > Canvas 宽度，Canvas 不能超过右边界
    if (totalWidth <= SAFE_CANVAS_WIDTH) {
      idealOffsetLeft = 0
    } else {
      const maxOffsetLeft = totalWidth - SAFE_CANVAS_WIDTH
      idealOffsetLeft = Math.min(idealOffsetLeft, maxOffsetLeft)
    }

    canvasOffsetLeft.value = idealOffsetLeft

    const clampedHeight = Math.min(totalHeight, SAFE_CANVAS_HEIGHT)
    canvasHeight.value = clampedHeight
    svgWidth.value = canvasWidth.value
    svgHeight.value = clampedHeight

    const bufferTop = clampedHeight / 3
    let idealOffsetTop = Math.max(0, scrollTop - bufferTop)

    if (totalHeight <= clampedHeight) {
      idealOffsetTop = 0
    } else {
      const maxOffsetTop = totalHeight - clampedHeight
      idealOffsetTop = Math.min(idealOffsetTop, maxOffsetTop)
    }

    canvasOffsetTop.value = idealOffsetTop
  }
}

// 原因2优化：批量合并 handleBarMounted 更新，避免每个 TaskBar 挂载都触发一次响应式变化
// 原来：N 个 TaskBar 挂载 → N 次 taskBarPositions spread 内存复制 + N 次 GanttLinks RAF
// 现在：N 个 TaskBar 挂载 → 1 次合并写入 + 1 次 GanttLinks 重绘
const _pendingBarUpdates: Record<number, { left: number; top: number; width: number; height: number }> = {}
let _barUpdateScheduled = false

function handleBarMounted(payload: {
  id: number
  left: number
  top: number
  width: number
  height: number
}) {
  if (!bodyContentRef.value) return
  // 使用已有的 cachedBodyRect，避免每次挂载都触发强制 reflow
  // bodyRectInvalidated 在滚动时被置为 true，确保坐标转换准确
  if (!cachedBodyRect || bodyRectInvalidated) {
    cachedBodyRect = bodyContentRef.value.getBoundingClientRect()
    bodyRectCacheTime = Date.now()
    bodyRectInvalidated = false
  }
  const baseRect = cachedBodyRect
  // 先缓存到 pending，不立即触发响应式
  _pendingBarUpdates[payload.id] = {
    left: payload.left - baseRect.left,
    top: payload.top - baseRect.top,
    width: payload.width,
    height: payload.height,
  }
  if (!_barUpdateScheduled) {
    // 滚动期间跳过 flush：_pendingBarUpdates 继续累积，等滚动停止后统一写入
    // GanttLinks 此时本就等待 isScrolling=false 才重绘，延迟不影响显示
    if (isTimelineScrolling.value) return

    _barUpdateScheduled = true
    // 微任务：将同一渲染批次内的多次调用合并为一次响应式引用变化
    Promise.resolve().then(() => {
      _barUpdateScheduled = false
      // 一次性合并，只触发一次 GanttLinks 重绘
      taskBarPositions.value = { ...taskBarPositions.value, ..._pendingBarUpdates }
      for (const key in _pendingBarUpdates) {
        delete _pendingBarUpdates[key as unknown as number]
      }
      setTimeout(() => updateSvgSize(), 200)
    })
  }
}

// 滚动停止时统一 flush 滚动期间积累的 bar 位置更新
watch(isTimelineScrolling, (scrolling) => {
  if (scrolling) return
  if (Object.keys(_pendingBarUpdates).length === 0) return
  _barUpdateScheduled = false
  taskBarPositions.value = { ...taskBarPositions.value, ..._pendingBarUpdates }
  for (const key in _pendingBarUpdates) {
    delete _pendingBarUpdates[key as unknown as number]
  }
  setTimeout(() => updateSvgSize(), 200)
})

// 向上传递 TaskBar 拖拽/拉伸事件
const handleTaskBarDragEnd = (updatedTask: Task) => {
  // 如果是资源视图，需要更新dataSource中的资源数据
  if (viewMode.value === 'resource' && dataSource.value) {
    for (const resource of dataSource.value as any[]) {
      if (resource.tasks) {
        const taskIndex = resource.tasks.findIndex((t: Task) => t.id === updatedTask.id)
        if (taskIndex !== -1) {
          // 更新资源中的任务数据
          resource.tasks[taskIndex] = { ...resource.tasks[taskIndex], ...updatedTask }
          break
        }
      }
    }

    // 🎯 关键修复：数据已经更新，GanttChart的watch会自动检测并刷新布局
    // v1.9.9 不需要手动调用invalidateLayout，props.resources的deep watch会自动触发
  }
  // 记录变化的TaskBar ID（用于增量冲突更新）
  lastChangedTaskId.value = updatedTask.id
  // 通过全局事件或 emit/props 回调传递给 GanttChart
  window.dispatchEvent(new CustomEvent('taskbar-drag-end', { detail: updatedTask }))
}
const handleTaskBarResizeEnd = (updatedTask: Task) => {
  // 如果是资源视图，需要更新dataSource中的资源数据
  if (viewMode.value === 'resource' && dataSource.value) {
    for (const resource of dataSource.value as any[]) {
      if (resource.tasks) {
        const taskIndex = resource.tasks.findIndex((t: Task) => t.id === updatedTask.id)
        if (taskIndex !== -1) {
          // 更新资源中的任务数据
          resource.tasks[taskIndex] = { ...resource.tasks[taskIndex], ...updatedTask }
          break
        }
      }
    }

    // 🎯 关键修复：数据已经更新，GanttChart的watch会自动检测并刷新布局
    // v1.9.9 不需要手动调用invalidateLayout，props.resources的deep watch会自动触发
  }
  // 记录变化的TaskBar ID（用于增量冲突更新）
  lastChangedTaskId.value = updatedTask.id
  window.dispatchEvent(new CustomEvent('taskbar-resize-end', { detail: updatedTask }))
}

// 处理TaskBar右键菜单事件 - 将事件转发给父组件
const handleTaskBarContextMenu = (event: { task: Task; position: { x: number; y: number } }) => {
  // 将事件转发为全局事件，让GanttChart组件处理
  window.dispatchEvent(
    new CustomEvent('context-menu', {
      detail: event,
    }),
  )
}

// 处理TaskBar的滚动定位请求
const handleScrollToPosition = (targetScrollLeft: number) => {
  if (timelineContainer.value) {
    // 开始自动滚动时隐藏半圆
    hideBubbles.value = true

    // 确保滚动位置在有效范围内
    const maxScrollLeft = timelineContainer.value.scrollWidth - timelineContainer.value.clientWidth
    const clampedScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft))

    // 平滑滚动到目标位置
    timelineContainer.value.scrollTo({
      left: clampedScrollLeft,
      behavior: 'smooth',
    })

    // 滚动结束后延迟显示半圆
    setTimeout(() => {
      hideBubbles.value = false
    }, 1000) // 给滚动动画留1秒时间
  }
}

// 向上传递 MilestonePoint 拖拽事件
const handleMilestoneDragEnd = (updatedMilestone: Milestone) => {
  window.dispatchEvent(new CustomEvent('milestone-drag-end', { detail: updatedMilestone }))
}

onMounted(() => {
  // 等待下一帧，确保DOM和数据都已渲染
  nextTick(() => {
    setTimeout(() => {
      scrollToTodayCenter()
    }, 60) // 增加延迟，确保宽度和数据都已渲染
  })
  // 监听TaskList的双击事件
  window.addEventListener('task-row-double-click', handleTaskListDoubleClick as EventListener)
  // 监听TaskList的悬停事件
  window.addEventListener('task-list-hover', handleTaskListHover as EventListener)
  // 监听TaskList的垂直滚动事件
  window.addEventListener(
    'task-list-vertical-scroll',
    handleTaskListVerticalScroll as EventListener,
  )
  // 监听语言变化
  window.addEventListener('locale-changed', handleLocaleChange as EventListener)
  // 监听Splitter拖拽事件
  window.addEventListener('splitter-drag-start', handleSplitterDragStart as EventListener)
  window.addEventListener('splitter-drag-end', handleSplitterDragEnd as EventListener)
  // 监听Timeline容器resize事件（TaskList切换等）
  window.addEventListener(
    'timeline-container-resized',
    handleTimelineContainerResized as EventListener,
  )

  // 监听里程碑点击定位事件
  window.addEventListener('milestone-click-locate', handleMilestoneClickLocate as EventListener)

  // 监听拖拽边界检测事件
  window.addEventListener('drag-boundary-check', handleDragBoundaryCheck as EventListener)

  // 监听TaskBar高亮事件
  window.addEventListener('taskbar-highlighted', handleTaskBarHighlighted as EventListener)

  // 监听资源视图垂直拖拽事件
  window.addEventListener('resource-taskbar-drop', handleResourceTaskBarDrop as EventListener)

  // 设置ResizeObserver监听timeline-body的尺寸变化
  nextTick(() => {
    // 初始化并缓存 DOM 元素引用
    const timelineBody = document.querySelector('.timeline-body') as HTMLElement
    const timelineContainer = document.querySelector('.timeline') as HTMLElement
    const timelinePanel = document.querySelector('.gantt-panel-right') as HTMLElement

    // 缓存到 ref 中
    timelineBodyElement.value = timelineBody
    timelineContainerElement.value = timelineContainer
    timelinePanelElement.value = timelinePanel

    if (timelineBody) {
      timelineBodyHeight.value = timelineBody.clientHeight

      resizeObserver = new ResizeObserver(entries => {
        // v1.9.9 优化：拖拽SplitterBar期间不处理高度变化，避免影响拖拽性能
        if (isSplitBarDragging.value) {
          return
        }

        for (const entry of entries) {
          timelineBodyHeight.value = entry.contentRect.height
        }
      })

      resizeObserver.observe(timelineBody)
    }

    // 初始化滚动位置信息，使用正确的滚动容器
    if (timelineContainer) {
      timelineScrollLeft.value = timelineContainer.scrollLeft
      timelineContainerWidth.value = timelineContainer.clientWidth

      // 为容器宽度变化创建独立的ResizeObserver
      const containerResizeObserver = new ResizeObserver(entries => {
        // v1.9.9 优化：拖拽SplitterBar期间不处理宽度变化，避免影响拖拽性能
        if (isSplitBarDragging.value) {
          return
        }
        // TaskList toggle 期间不处理宽度变化，外层 .gantt-body 已屏蔽日期范围重算
        // toggle 结束后由 watch(isTaskListToggling) 手动更新宽度
        if (isTaskListToggling.value) {
          return
        }

        for (const entry of entries) {
          const newWidth = entry.contentRect.width
          // 当容器宽度发生变化时，立即更新宽度并重新计算半圆显示
          if (Math.abs(newWidth - timelineContainerWidth.value) > 1) {
            timelineContainerWidth.value = newWidth

            // 对于容器宽度变化，我们需要立即重新计算半圆状态
            // 短时间隐藏后重新显示，让TaskBar重新计算边界
            hideBubbles.value = true

            // 清除之前的定时器，避免多次触发冲突
            if (hideBubblesTimeout) {
              clearTimeout(hideBubblesTimeout)
            }

            // 延迟恢复显示，确保宽度变化完全生效
            hideBubblesTimeout = setTimeout(() => {
              hideBubbles.value = false
              hideBubblesTimeout = null
            }, 300) // 增加到300ms，确保resize完全结束
          }
        }
      })
      containerResizeObserver.observe(timelineContainer)

      // 将容器ResizeObserver也存储起来，用于清理
      if (!resizeObserver) {
        resizeObserver = containerResizeObserver
      }
    }
  })

  // 页面加载后，直接将今日定位到中间
  // 增加延迟时间，确保DOM元素渲染完成
  setTimeout(() => {
    scrollToTodayCenter()
    updateSvgSize()
  }, 200)
  window.addEventListener('resize', updateSvgSize)
  // 注意：Timeline滚动事件已在模板中通过@scroll="handleTimelineScroll"绑定，无需重复监听
})

// 处理TaskList垂直滚动同步
const handleTaskListVerticalScroll = (event: CustomEvent) => {
  const { scrollTop } = event.detail

  // 立即更新纵向滚动位置（用于虚拟滚动计算）
  timelineBodyScrollTop.value = scrollTop

  debouncedUpdateCanvasPosition()

  if (timelineBodyElement.value && Math.abs(timelineBodyElement.value.scrollTop - scrollTop) > 1) {
    // 设置标志位：当前是由 TaskList 触发的同步写入
    // 防止 handleTimelineBodyScroll 被触发后反向再次派发事件（2跳链路）
    _isSyncingScrollFromTaskList = true
    timelineBodyElement.value.scrollTop = scrollTop
    // scroll 事件会同步触发，Promise.resolve 在其后执行，确保标志在返回相义务后重置
    Promise.resolve().then(() => { _isSyncingScrollFromTaskList = false })
  }
}

// 处理Timeline body的垂直滚动同步
const handleTimelineBodyScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target) return

  const scrollTop = target.scrollTop

  // 立即更新纵向滚动位置（用于虚拟滚动计算）
  timelineBodyScrollTop.value = scrollTop

  // 优化：滚动时失效 bodyRect 缓存（用于连接线拖拽）
  bodyRectInvalidated = true

  // GanttLinks 性能优化：设置滚动标志，暂停 canvas 重绘
  isTimelineScrolling.value = true
  if (_scrollIdleTimer !== null) clearTimeout(_scrollIdleTimer)
  _scrollIdleTimer = setTimeout(() => {
    _scrollIdleTimer = null
    isTimelineScrolling.value = false
  }, 150)

  debouncedUpdateCanvasPosition()

  // 拖拽时不同步滚动事件，避免性能问题
  if (isDragging.value) return

  // 由 TaskList → Timeline 同步写入触发时，不再反向派发，避免 2 跳循环
  if (_isSyncingScrollFromTaskList) return

  // 同步垂直滚动到TaskList
  if (scrollTop >= 0) {
    window.dispatchEvent(
      new CustomEvent('timeline-vertical-scroll', {
        detail: { scrollTop },
      }),
    )
  }
}

// 合并优化：整合三处 tasks.value.length watch，消除重复的 invalidateTaskDateRangeCache 调用
// 洵盖：缓存失效 / 里程碑位置更新 / 首次加载时间轴重算 / SVG 尺寸更新
watch(
  () => tasks.value?.length,
  (newLength, oldLength) => {
    // 原 ~4562：缓存失效 + 里程碑位置（无条件执行）
    invalidateTaskDateRangeCache()
    computeAllMilestonesPositions()

    // 原 ~4616：首次加载时重算时间轴
    // bugfix: 重置 hasInitialAutoScroll，确保首次加载真实数据后能重新定位今日
    // 场景：数据异步加载时，初始 updateTimelineRange() 以空任务计算范围并完成滚动，
    // 真实数据到来后范围扩展，若不重置则 scrollToTodayCenter 不会再次触发
    if (oldLength === 0 && newLength > 0) {
      hasInitialAutoScroll = false
      debouncedUpdateTimelineRange(50)
    }

    // 原 ~3854：更新 SVG 尺寸
    nextTick(() => {
      updateSvgSize()
    })
  },
  { immediate: true },
)

// 优化：监听任务变化，更新任务 ID Map 缓存
watch(
  tasks,
  newTasks => {
    taskIdMap.clear()
    const addTaskToMap = (task: Task) => {
      taskIdMap.set(task.id, task)
      if (task.children && task.children.length > 0) {
        task.children.forEach(addTaskToMap)
      }
    }
    newTasks.forEach(addTaskToMap)
  },
  { immediate: true },
)

// 拖拽滑动相关状态
const isDragging = ref(false)
provide('isDraggingTimeline', isDragging) // 提供给GanttConflicts使用
const startX = ref(0)
const startY = ref(0)
const startScrollLeft = ref(0)
const startScrollTop = ref(0)
const timelineContainer = ref<HTMLElement | null>(null)
const timelineBodyElement = ref<HTMLElement | null>(null) // 缓存timeline-body元素引用
let scrollRafId: number | null = null // 时间轴拖拽滚动的 RAF ID

// 边界滚动相关状态
const isAutoScrolling = ref(false)
let autoScrollTimer: number | null = null
const EDGE_SCROLL_ZONE = 50 // 边界滚动触发区域宽度
const EDGE_SCROLL_SPEED = 5 // 每次滚动的像素数

// 处理TaskBar高亮事件 - 如果用户仍在按住鼠标，启动拖拽滚动
const handleTaskBarHighlighted = () => {
  // 检查是否有鼠标按钮按下（buttons > 0 表示至少有一个按钮按下）
  // 注意：这里无法直接获取鼠标状态，所以我们添加一个全局监听器
  // 在下一次 mousemove 时启动拖拽滚动
  const handleNextMouseMove = (e: MouseEvent) => {
    // 🔧 修复：检查是否有 TaskBar 正在被拖拽或 resize
    // 如果有，不应该触发 Timeline 拖拽，避免与 TaskBar 交互冲突
    if (isDraggingTaskBar.value) {
      // TaskBar 正在被拖拽，取消 Timeline 拖拽启动
      document.removeEventListener('mousemove', handleNextMouseMove)
      return
    }

    // 🔧 修复：检查鼠标是否在 TaskBar、resize 手柄或其他交互元素上
    // 如果是，不应该触发 Timeline 拖拽
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement
    if (target) {
      const isOnTaskBar = target.closest('.task-bar')
      const isOnResizeHandle = target.closest('.resize-handle-left, .resize-handle-right')
      const isOnInteractive = target.closest('button, input, select, textarea, .custom-task-content')

      if (isOnTaskBar || isOnResizeHandle || isOnInteractive) {
        document.removeEventListener('mousemove', handleNextMouseMove)
        return
      }
    }

    // 检查鼠标左键是否按下
    if (e.buttons === 1) {
      // 启动拖拽滚动
      isDragging.value = true
      startX.value = e.pageX
      startScrollLeft.value = timelineContainer.value?.scrollLeft || 0

      if (timelineContainer.value) {
        timelineContainer.value.style.cursor = 'grabbing'
        timelineContainer.value.style.userSelect = 'none'
      }

      // 添加事件监听器
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    // 只监听一次
    document.removeEventListener('mousemove', handleNextMouseMove)
  }

  // 添加临时监听器，等待下一次鼠标移动
  document.addEventListener('mousemove', handleNextMouseMove)

  // 5秒后自动清理监听器（防止内存泄漏）
  setTimeout(() => {
    document.removeEventListener('mousemove', handleNextMouseMove)
  }, 5000)
}

// v1.9.0 资源视图垂直拖拽：处理TaskBar拖放到不同资源行
const handleResourceTaskBarDrop = (event: Event) => {
  const customEvent = event as CustomEvent
  // @ts-expect-error - taskId和mouseX预留但当前未使用
  const { taskId, task, sourceRowIndex, mouseY, mouseX } = customEvent.detail

  // 计算目标资源行索引
  const timelineBody = timelineBodyElement.value
  if (!timelineBody) return

  const bodyRect = timelineBody.getBoundingClientRect()
  const relativeY = mouseY - bodyRect.top + timelineBody.scrollTop

  // v1.9.0 使用动态的资源行位置来计算目标行索引
  const resources = dataSource.value as Resource[]
  let targetRowIndex = -1
  let minDistance = Infinity

  // 遍历资源，找到距离鼠标位置最近的资源行中心
  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i]
    const resourceId = String(resource.id)
    const rowTop = resourceRowPositions.value.get(resourceId) || 0
    // v1.9.9 从resoureTaskLayouts直接获取布局
    const layout = resourceTaskLayouts.value.get(resourceId)
    const rowHeight = layout?.totalHeight || 51
    const rowCenter = rowTop + rowHeight / 2
    const distance = Math.abs(relativeY - rowCenter)

    if (distance < minDistance) {
      minDistance = distance
      targetRowIndex = i
    }
  }

  // 如果没有找到目标行（不太可能），使用最近的边界
  if (targetRowIndex === -1 && resources.length > 0) {
    if (relativeY < 0) {
      targetRowIndex = 0
    } else {
      targetRowIndex = resources.length - 1
    }
  }

  // v1.9.0 直接使用TaskBar传递过来的精确日期，避免重复计算导致误差
  const newStartDate = customEvent.detail.calculatedStartDate
  const newEndDate = customEvent.detail.calculatedEndDate

  // 如果目标行与源行不同，发送事件给父组件（demo）处理
  if (targetRowIndex !== sourceRowIndex && targetRowIndex >= 0 && targetRowIndex < resources.length) {
    const targetResource = resources[targetRowIndex]

    // 发送事件给父组件，让demo显示确认对话框
    emit('resource-drag-end', {
      task,
      sourceResourceIndex: sourceRowIndex,
      targetResourceIndex: targetRowIndex,
      targetResource,
      newStartDate, // v1.9.0 新的开始日期
      newEndDate,   // v1.9.0 新的结束日期
    })
  }
}

// 鼠标按下开始拖拽（在时间轴表头和body区域）
const handleMouseDown = (event: MouseEvent) => {
  const target = event.target as HTMLElement

  // 检查是否点击的是允许拖拽的区域
  const isInHeader = target.closest('.timeline-header')
  const isInBody = target.closest('.timeline-body')

  // 如果不在header或body区域，直接返回
  if (!isInHeader && !isInBody) {
    return
  }

  // 如果在body区域，需要检查是否点击了交互元素
  if (isInBody) {
    // 🔧 修复：检查是否点击了 TaskBar 的 resize 手柄
    const resizeHandle = target.closest('.resize-handle-left, .resize-handle-right') as HTMLElement
    if (resizeHandle) {
      // 点击了 resize 手柄，不应该触发 Timeline 拖拽
      return
    }

    // 检查是否点击了TaskBar
    const taskBarElement = target.closest('.task-bar') as HTMLElement

    // 如果点击了TaskBar，检查是否为高亮状态
    if (taskBarElement) {
      const isHighlighted = taskBarElement.classList.contains('highlighted')
      const isPrimaryHighlight = taskBarElement.classList.contains('primary-highlight')

      // 如果是高亮状态的TaskBar，允许拖拽滚动
      // 否则返回，让TaskBar自己处理交互
      if (!isHighlighted && !isPrimaryHighlight) {
        return
      }
    } else {
      // 如果不是TaskBar，排除其他交互元素
      const interactiveElements = [
        '.milestone',
        'button',
        'input',
        'select',
        'textarea',
        '.custom-task-content',
        '.progress-bar',
        '.task-name',
        '.task-controls',
      ]

      const isInteractiveElement = interactiveElements.some(selector => target.closest(selector))

      if (isInteractiveElement) {
        return
      }
    }
  }

  isDragging.value = true
  startX.value = event.pageX
  startY.value = event.pageY
  startScrollLeft.value = timelineContainer.value?.scrollLeft || 0

  // 获取并缓存timeline-body元素的scrollTop（支持垂直滚动）
  if (!timelineBodyElement.value && timelineContainer.value) {
    timelineBodyElement.value = timelineContainer.value.querySelector('.timeline-body') as HTMLElement
  }
  startScrollTop.value = timelineBodyElement.value?.scrollTop || 0

  // 添加鼠标样式
  if (timelineContainer.value) {
    timelineContainer.value.style.cursor = 'grabbing'
    timelineContainer.value.style.userSelect = 'none'
  }

  // 阻止默认行为
  event.preventDefault()

  // 添加全局事件监听器
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// 鼠标移动时拖拽滑动（支持水平和垂直方向）
const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value || !timelineContainer.value) return

  event.preventDefault()

  // 取消之前的 RAF
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId)
  }

  // 使用 requestAnimationFrame 批处理滚动更新
  scrollRafId = requestAnimationFrame(() => {
    if (!timelineContainer.value) return

    // 计算水平和垂直移动距离
    const x = event.pageX
    const y = event.pageY
    const walkX = (x - startX.value) * 1.5 // 水平拖拽速度倍数
    const walkY = (y - startY.value) * 1.5 // 垂直拖拽速度倍数

    // 水平滚动（timeline容器）
    timelineContainer.value.scrollLeft = startScrollLeft.value - walkX

    // 垂直滚动（timeline-body元素）- 使用缓存的元素引用
    if (timelineBodyElement.value) {
      const newScrollTop = startScrollTop.value - walkY
      timelineBodyElement.value.scrollTop = newScrollTop

      // 直接同步 TaskList 的滚动位置，避免通过事件触发
      const taskListBody = document.querySelector('.task-list-body') as HTMLElement
      if (taskListBody) {
        taskListBody.scrollTop = newScrollTop
      }
    }

    scrollRafId = null
  })
}

// 鼠标抬起结束拖拽
const handleMouseUp = () => {
  // 🔧 修复：只有在真正处于拖拽状态时才执行清理
  // 避免 TaskBar 的 resize 事件误触发 Timeline 的拖拽结束逻辑
  if (!isDragging.value) {
    return
  }

  isDragging.value = false

  // 取消任何待处理的 RAF
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId)
    scrollRafId = null
  }

  if (timelineContainer.value) {
    timelineContainer.value.style.cursor = 'grab'
    timelineContainer.value.style.userSelect = 'auto'
  }

  // 清空 hover 状态，避免拖动结束后立即触发 hover 重绘
  hoveredTaskId.value = null

  // 移除全局事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// 检测滚动状态（优化版：减少计算和事件派发）
const handleTimelineScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target) return

  const scrollLeft = target.scrollLeft

  // 立即更新关键滚动位置信息（用于虚拟滚动）
  timelineScrollLeft.value = scrollLeft

  // 滚动时关闭所有右键菜单
  window.dispatchEvent(new CustomEvent('close-all-taskbar-menus'))

  // 优化：滚动时失效 bodyRect 缓存（用于连接线拖拽）
  bodyRectInvalidated = true

  // 只在容器宽度未初始化时更新
  if (timelineContainerWidth.value === 0) {
    timelineContainerWidth.value = target.clientWidth
  }

  // 标记初始化完成（第一次滚动后）
  if (isInitialLoad.value && scrollLeft > 0) {
    isInitialLoad.value = false
  }

  // 虚拟渲染：滚动时更新 Canvas 位置（防抖处理）
  debouncedUpdateCanvasPosition()

  // [nelson][2026-02-04]拖拽时不同步（避免性能问题）
  if (isDragging.value) return

  // 小时视图简化处理
  if (currentTimeScale.value === TimelineScale.HOUR) {
    isScrolling.value = true

    if (scrollTimeout) clearTimeout(scrollTimeout)

    scrollTimeout = setTimeout(() => {
      isScrolling.value = false
    }, 200)
    return
  }

  // 其他视图的完整处理（减少不必要的计算）
  const scrollWidth = target.scrollWidth
  const clientWidth = target.clientWidth
  const maxScroll = scrollWidth - clientWidth

  scrollProgress.value = maxScroll > 0 ? scrollLeft / maxScroll : 0
  isScrolledLeft.value = scrollLeft > 20
  isScrolledRight.value = scrollLeft < maxScroll - 20

  isScrolling.value = true
  target.classList?.add('scrolling')

  debouncedUpdatePositions()

  if (scrollTimeout) clearTimeout(scrollTimeout)

  scrollTimeout = setTimeout(() => {
    isScrolling.value = false
    target.classList?.remove('scrolling')
  }, 500)
}

// 边界自动滚动功能
const startAutoScroll = (direction: 'left' | 'right') => {
  if (isAutoScrolling.value || !timelineContainer.value) return

  isAutoScrolling.value = true

  const scroll = () => {
    if (!timelineContainer.value || !isAutoScrolling.value) return

    const currentScrollLeft = timelineContainer.value.scrollLeft
    const maxScrollLeft = timelineContainer.value.scrollWidth - timelineContainer.value.clientWidth

    let newScrollLeft
    if (direction === 'left') {
      newScrollLeft = Math.max(0, currentScrollLeft - EDGE_SCROLL_SPEED)
    } else {
      newScrollLeft = Math.min(maxScrollLeft, currentScrollLeft + EDGE_SCROLL_SPEED)
    }

    // 如果已经到达边界，停止滚动
    if (newScrollLeft === currentScrollLeft) {
      stopAutoScroll()
      return
    }

    timelineContainer.value.scrollLeft = newScrollLeft

    // 通知拖拽组件滚动已发生
    window.dispatchEvent(
      new CustomEvent('timeline-auto-scroll', {
        detail: { scrollDelta: newScrollLeft - currentScrollLeft },
      }),
    )

    autoScrollTimer = window.setTimeout(scroll, 16) // 约60fps
  }

  scroll()
}

const stopAutoScroll = () => {
  isAutoScrolling.value = false
  if (autoScrollTimer) {
    clearTimeout(autoScrollTimer)
    autoScrollTimer = null
  }
}

// 处理拖拽边界检测事件
const handleDragBoundaryCheck = (event: CustomEvent) => {
  const { mouseX, mouseY, isDragging: dragState, isResourceView, taskId, rowIndex } = event.detail

  if (!dragState || !timelineContainer.value) {
    stopAutoScroll()
    return
  }

  const containerRect = timelineContainer.value.getBoundingClientRect()
  const relativeX = mouseX - containerRect.left

  // v1.9.0 资源视图垂直拖拽检测
  if (isResourceView && mouseY && timelineBodyElement.value) {
    const bodyRect = timelineBodyElement.value.getBoundingClientRect()
    const relativeY = mouseY - bodyRect.top + timelineBodyElement.value.scrollTop

    // 使用动态的资源行位置来计算目标行索引（基于最近的行中心）
    const resources = dataSource.value as Resource[]
    let targetRowIndex = -1
    let minDistance = Infinity

    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i]
      const resourceId = String(resource.id)
      const rowTop = resourceRowPositions.value.get(resourceId) || 0
      // v1.9.9 从resoureTaskLayouts直接获取布局
      const layout = resourceTaskLayouts.value.get(resourceId)
      const rowHeight = layout?.totalHeight || 51
      const rowCenter = rowTop + rowHeight / 2
      const distance = Math.abs(relativeY - rowCenter)

      if (distance < minDistance) {
        minDistance = distance
        targetRowIndex = i
      }
    }

    // 如果移动到不同行，发送事件通知（可以用于显示拖拽指示器等）
    if (targetRowIndex !== -1 && targetRowIndex !== rowIndex) {
      window.dispatchEvent(
        new CustomEvent('resource-drag-over', {
          detail: {
            taskId,
            sourceRowIndex: rowIndex,
            targetRowIndex,
            mouseY: relativeY,
          },
        }),
      )
    }
  }

  // 检查是否在左边界滚动区域
  if (relativeX <= EDGE_SCROLL_ZONE && timelineContainer.value.scrollLeft > 0) {
    startAutoScroll('left')
  } else if (
    relativeX >= containerRect.width - EDGE_SCROLL_ZONE &&
    timelineContainer.value.scrollLeft <
      timelineContainer.value.scrollWidth - timelineContainer.value.clientWidth
  ) {
    // 检查是否在右边界滚动区域
    startAutoScroll('right')
  } else {
    // 不在边界区域，停止自动滚动
    stopAutoScroll()
  }
}

onUnmounted(() => {
  // 停止自动滚动
  stopAutoScroll()

  // 清理连接线拖拽状态
  cleanupLinkDrag()

  // 清理事件监听器
  window.removeEventListener('task-row-double-click', handleTaskListDoubleClick as EventListener)
  window.removeEventListener('task-list-hover', handleTaskListHover as EventListener)
  window.removeEventListener(
    'task-list-vertical-scroll',
    handleTaskListVerticalScroll as EventListener,
  )
  window.removeEventListener('locale-changed', handleLocaleChange as EventListener)
  window.removeEventListener('splitter-drag-start', handleSplitterDragStart as EventListener)
  window.removeEventListener('splitter-drag-end', handleSplitterDragEnd as EventListener)
  window.removeEventListener(
    'timeline-container-resized',
    handleTimelineContainerResized as EventListener,
  )
  window.removeEventListener('milestone-click-locate', handleMilestoneClickLocate as EventListener)
  window.removeEventListener('drag-boundary-check', handleDragBoundaryCheck as EventListener)
  window.removeEventListener('resource-taskbar-drop', handleResourceTaskBarDrop as EventListener)

  // 清理ResizeObserver
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  // 清理window事件监听器
  window.removeEventListener('resize', updateSvgSize)

  // 清理可能残留的鼠标事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})

const handleTaskDelete = (task: Task, deleteChildren?: boolean) => {
  emit('delete', task, deleteChildren)
}

// 处理删除链接事件
const handleDeleteLink = (event: { sourceTaskId: number; targetTaskId: number }) => {
  const targetTask = tasks.value.find(t => t.id === event.targetTaskId)
  if (!targetTask || !targetTask.predecessor) return

  const predecessorIds = getPredecessorIds(targetTask.predecessor)
  const newIds = predecessorIds.filter(id => id !== event.sourceTaskId)

  // 创建一个新的任务对象以触发响应式更新
  const updatedTask = {
    ...targetTask,
    predecessor: newIds.length > 0 ? (newIds as any) : undefined,
  }

  // 触发链接删除事件，让 GanttChart 更新 tasks 数组
  emit('link-deleted', {
    sourceTaskId: event.sourceTaskId,
    targetTaskId: event.targetTaskId,
    updatedTask,
  })

  // 同时触发任务更新事件（兼容现有逻辑）
  updateTask(updatedTask)

  // 强制清除缓存，确保时间轴数据重新计算
  clearTimelineCache()
}

// 月度视图中按年份分组的计算属性
const groupMonthsByYear = computed(() => {
  if (currentTimeScale.value !== TimelineScale.MONTH) {
    return {}
  }

  const groups: Record<number, unknown[]> = {}
  const timelineDataArray = timelineData.value as unknown[]

  // 使用 for...of 循环代替 forEach
  for (const month of timelineDataArray) {
    const monthObj = month as Record<string, unknown>
    const monthYear = monthObj.year as number
    if (!groups[monthYear]) {
      groups[monthYear] = []
    }
    groups[monthYear].push(month)
  }

  return groups
})

// 优化：预计算周视图中月份1号旗帜的位置，避免3层嵌套循环
const monthFirstFlags = computed(() => {
  if (currentTimeScale.value !== TimelineScale.WEEK) {
    return []
  }

  const flags: Array<{ left: number; date: number }> = []
  const timelineDataArray = timelineData.value as any[]

  for (let monthIndex = 0; monthIndex < timelineDataArray.length; monthIndex++) {
    const month = timelineDataArray[monthIndex]
    if (!month.isWeekView || !month.weeks) continue

    for (let weekIndex = 0; weekIndex < month.weeks.length; weekIndex++) {
      const week = month.weeks[weekIndex]
      const subDays = week.subDays || []

      for (let dayIndex = 0; dayIndex < subDays.length; dayIndex++) {
        const subDay = subDays[dayIndex]
        if (subDay.date && subDay.date.getDate() === 1) {
          flags.push({
            left: getGlobalWeekPosition(monthIndex, weekIndex) + dayIndex * (60 / 7),
            date: subDay.date.getDate(),
          })
        }
      }
    }
  }

  return flags
})

// 优化：预计算周视图中月份1号竖直线的位置
const monthFirstVerticalLines = computed(() => {
  if (currentTimeScale.value !== TimelineScale.WEEK) {
    return []
  }

  const lines: Array<{ left: number }> = []
  const timelineDataArray = timelineData.value as any[]

  for (let monthIndex = 0; monthIndex < timelineDataArray.length; monthIndex++) {
    const month = timelineDataArray[monthIndex]
    if (!month.isWeekView || !month.weeks) continue

    for (let weekIndex = 0; weekIndex < month.weeks.length; weekIndex++) {
      const week = month.weeks[weekIndex]
      const subDays = week.subDays || []

      for (let dayIndex = 0; dayIndex < subDays.length; dayIndex++) {
        const subDay = subDays[dayIndex]
        if (subDay.date && subDay.date.getDate() === 1) {
          lines.push({
            left: getGlobalWeekPosition(monthIndex, weekIndex) + dayIndex * (60 / 7),
          })
        }
      }
    }
  }

  return lines
})

// 年度视图时间轴数据的计算属性
const yearTimelineData = computed(() => {
  if (currentTimeScale.value !== TimelineScale.YEAR) {
    return []
  }

  try {
    const data = generateYearTimelineData() as any
    return Array.isArray(data) ? data : []
  } catch (error) {
    // 发生错误时返回空数组
    return []
  }
})

// 暴露公共API
defineExpose({
  // 基础滚动功能
  scrollToTasks,
  scrollToToday,
  scrollToTodayCenter,
  scrollToDate,
  // 时间线配置
  timelineConfig,
  // 时间刻度更新
  updateTimeScale,
  // 高亮相关
  highlightedTaskId,
  clearHighlight,
})

// 处理开始计时事件
const handleStartTimer = (task: Task) => {
  emit('start-timer', task)
}
// 处理停止计时事件
const handleStopTimer = (task: Task) => {
  emit('stop-timer', task)
}

// Task类型转换成Milestone类型, 需要返回一个Milestone对象
const convertTaskToMilestone = (task: Task): Milestone => {
  // 保证 startDate 一定为 string，避免 undefined
  const startDate = task.startDate || task.endDate || ''
  return {
    ...task,
    type: 'milestone',
    startDate,
    endDate: task.startDate || task.endDate,
  }
}

// 优化：统一的防抖函数，避免重复的 setTimeout 造成性能浪费
let timelineUpdateTimer: number | null = null

const debouncedUpdateTimelineRange = (delay = 50) => {
  if (timelineUpdateTimer) clearTimeout(timelineUpdateTimer)
  timelineUpdateTimer = setTimeout(() => {
    updateTimelineRange()
    timelineUpdateTimer = null
  }, delay)
}

// 监听tasks数据变化和容器宽度变化，合并处理以减少重复计算
const updateTimelineRange = () => {
  // 资源视图下不自动调整时间范围，保持Timeline背景层（header + 竖列）稳定
  // 避免滚动时重新生成timelineData导致header闪烁
  // 例外：任务视图 → 资源视图切换时，需要一次性重算以实现基于资源任务的日期范围
  if (viewMode.value === 'resource' && !forceTimelineRangeInResourceView) {
    return
  }
  forceTimelineRangeInResourceView = false

  let newRange: { startDate: Date; endDate: Date } | null = null

  if (currentTimeScale.value === TimelineScale.HOUR) {
    newRange = getHourTimelineRange()
  } else if (currentTimeScale.value === TimelineScale.DAY) {
    newRange = getDayTimelineRange()
  } else if (currentTimeScale.value === TimelineScale.WEEK) {
    newRange = getWeekTimelineRange()
  } else if (currentTimeScale.value === TimelineScale.MONTH) {
    newRange = getMonthTimelineRange()
  } else if (
    currentTimeScale.value === TimelineScale.QUARTER ||
    currentTimeScale.value === TimelineScale.YEAR
  ) {
    newRange = getYearTimelineRange()
  }

  if (newRange) {
    clearTimelineCache()
    isUpdatingTimelineConfig = true
    timelineConfig.value.startDate = newRange.startDate
    timelineConfig.value.endDate = newRange.endDate
    isUpdatingTimelineConfig = false
    timelineData.value = generateTimelineData()
  }
}

watch(
  timelineContainerWidth,
  (newWidth, oldWidth) => {
    // 拖拽 splitter 时跳过重新计算
    if (isSplitterDragging.value) return

    // drag-end / toggle-end 触发的宽度更新：只需要 sticky/bubble/TaskBar 重渲染，跳过日期范围重算
    if (skipTimelineRangeUpdate) return

    // 只在容器宽度从 0 变为有效值，或容器宽度发生显著变化时重新计算
    if (!oldWidth || oldWidth === 0 || Math.abs(newWidth - oldWidth) > 50) {
      if (newWidth > 0) {
        debouncedUpdateTimelineRange(100)
      }
    }
  },
  { immediate: true },
)

// 监听timelineData或容器宽度变化，强制TaskBar重新渲染（优化：使用防抖）
let taskBarRenderTimer: number | null = null
watch([timelineData, timelineContainerWidth], () => {
  // 拖拽 splitter 时跳过 TaskBar 重新渲染
  if (isSplitterDragging.value) return

  // 使用防抖避免频繁重新渲染
  if (taskBarRenderTimer) clearTimeout(taskBarRenderTimer)
  taskBarRenderTimer = setTimeout(() => {
    // 清空位置信息
    taskBarPositions.value = {}
    // 更新渲染key强制TaskBar重新渲染
    taskBarRenderKey.value++
    // 延迟更新SVG尺寸
    nextTick(() => {
      setTimeout(() => {
        updateSvgSize()
      }, 200)
    })
    taskBarRenderTimer = null
  }, 100)
})

// 监听viewMode和dataSource变化，刷新缓存和时间线
watch(
  [viewMode, dataSource],
  ([newViewMode], [oldViewMode]) => {
    invalidateTaskDateRangeCache()
    const viewModeChanged = newViewMode !== oldViewMode
    if (newViewMode === 'task') {
      // bugfix: 切换回任务视图时重置 hasInitialAutoScroll，确保 updateTimelineRange 完成后能重新定位今日
      // 场景：资源视图切换回任务视图时，updateTimelineRange 重新计算任务范围导致像素偏移，
      // 若不重置则 scrollToTodayCenter 不会被触发，今日标记将出现在视口之外
      hasInitialAutoScroll = false
      debouncedUpdateTimelineRange()
    } else if (newViewMode === 'resource') {
      if (viewModeChanged) {
        // 切换到资源视图：基于资源任务重算日期范围，重算完成后由 watch([timelineData,...]) 触发滚到今日
        // 重置 hasInitialAutoScroll，确保 watch([timelineData, timelineConfig...]) 在重算完成后能滚到今日
        // 不在此处直接调用 scrollToTodayCenter()，因为 debouncedUpdateTimelineRange 有 50ms 延迟，
        // nextTick 会在 50ms 之前就执行，导致用旧的 task 视图坐标滚到错误位置
        hasInitialAutoScroll = false
        forceTimelineRangeInResourceView = true
        debouncedUpdateTimelineRange()
      }
    }
  },
)

// 监听tasks变化，清理不再存在的任务的位置信息
watch(
  () => tasks.value,
  newTasks => {
    invalidateTaskDateRangeCache()
    // P2 修复：task.id 可为 number 或 string（资源视图），统一转为 string 比较
    // 原来使用 parseInt(taskIdStr) 会将 "res-1" → NaN，导致字符串 ID 永远无法匹配，位置信息堆积
    const currentTaskIdStrs = new Set<string>()
    for (const task of newTasks) {
      currentTaskIdStrs.add(String(task.id))
    }

    // 注意：shallowRef 需要创建新对象来触发响应式
    const newPositions: Record<number, any> = {}
    for (const taskIdStr in taskBarPositions.value) {
      // 对象键本身就是字符串，直接与 string Set 比较，避免 parseInt 对非数字 ID 返回 NaN
      if (currentTaskIdStrs.has(taskIdStr)) {
        newPositions[taskIdStr as unknown as number] = taskBarPositions.value[taskIdStr as unknown as number]
      }
    }
    taskBarPositions.value = newPositions
  },
)

// 处理里程碑点击定位事件
const handleMilestoneClickLocate = (event: CustomEvent) => {
  const { scrollLeft, smooth } = event.detail

  // 获取Timeline容器 - 尝试两个可能的滚动容器
  const timelineMain = document.querySelector('.timeline') as HTMLElement
  const timelineBody = document.querySelector('.timeline-body') as HTMLElement

  // 选择有滚动能力的容器
  let scrollContainer: HTMLElement | null = null
  if (timelineMain && timelineMain.scrollWidth > timelineMain.clientWidth) {
    scrollContainer = timelineMain
  } else if (timelineBody && timelineBody.scrollWidth > timelineBody.clientWidth) {
    scrollContainer = timelineBody
  }

  if (scrollContainer) {
    // 确保滚动位置在有效范围内
    const maxScrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth
    const targetScrollLeft = Math.min(Math.max(0, scrollLeft), maxScrollLeft)

    if (smooth) {
      // 平滑滚动
      scrollContainer.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth',
      })
    } else {
      // 立即滚动
      scrollContainer.scrollLeft = targetScrollLeft
    }
  }
}

// 生成月度视图时间轴数据
const generateMonthTimelineData = () => {
  // 根据时间刻度动态调整时间范围
  let startDate: Date, endDate: Date

  if (currentTimeScale.value === TimelineScale.MONTH) {
    // 月度视图使用任务范围+2年
    const monthRange = getMonthTimelineRange()
    startDate = monthRange.startDate
    endDate = monthRange.endDate
  } else {
    // 使用当前配置的范围
    startDate = new Date(timelineConfig.value.startDate)
    endDate = new Date(timelineConfig.value.endDate)
  }

  const years: Record<
    number,
    {
      year: number
      yearLabel: string
      months: {
        year: number
        month: number
        monthLabel: string
        startDate: Date
        endDate: Date
        isToday: boolean
        dayCount: number
      }[]
    }
  > = {}

  const currentDate = new Date(startDate)
  currentDate.setDate(1) // 从月初开始

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1

    // 获取当月天数
    const monthEndDate = new Date(year, month, 0)
    const dayCount = monthEndDate.getDate()

    // 检查是否包含今天
    const today = new Date()
    const isToday = year === today.getFullYear() && month === today.getMonth() + 1

    if (!years[year]) {
      years[year] = {
        year,
        yearLabel: `${year}年`,
        months: [],
      }
    }

    years[year].months.push({
      year,
      month,
      monthLabel: formatMonth(month),
      startDate: new Date(year, month - 1, 1),
      endDate: new Date(year, month, 0),
      isToday,
      dayCount,
    })

    // 移动到下一个月
    currentDate.setMonth(currentDate.getMonth() + 1)
  }

  // 转换为数组格式，保持与日/周视图兼容的结构
  const result = []

  let cumulativePosition = 0 // 用于跟踪累积位置

  for (const yearData of Object.values(years)) {
    for (const monthData of yearData.months) {
      // 为月度视图生成每一天的subDays数组
      const subDays = []
      for (let day = 1; day <= monthData.dayCount; day++) {
        const date = new Date(monthData.year, monthData.month - 1, day)
        subDays.push({
          day,
          date: new Date(date),
          dayOfWeek: date.getDay(),
          isToday: isToday(date),
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
        })
      }

      const monthWidth = 60 // 每个月的宽度
      const monthStartPosition = cumulativePosition
      const monthEndPosition = cumulativePosition + monthWidth

      result.push({
        year: monthData.year,
        month: monthData.month,
        yearMonthLabel: formatYearMonth(monthData.year, monthData.month),
        startDate: monthData.startDate,
        endDate: monthData.endDate,
        isMonthView: true,
        monthData: {
          monthLabel: monthData.monthLabel,
          isToday: monthData.isToday,
          dayCount: monthData.dayCount,
        },
        // 添加每一天的子列数据
        subDays,
        // 为了兼容性，保留days数组，映射subDays的数据
        days: subDays.map(subDay => ({
          day: subDay.day,
          date: subDay.date,
          label: String(subDay.day).padStart(2, '0'),
          isToday: subDay.isToday,
          isWeekend: subDay.isWeekend,
        })),
        // 添加位置调试信息
        _debugInfo: {
          monthStartPosition,
          monthEndPosition,
          monthWidth,
        },
      })

      cumulativePosition += monthWidth
    }
  }

  return result
}

// 生成季度视图时间轴数据
const generateQuarterTimelineData = () => {
  // 使用从 GanttChart 传入的日期范围（已包含正确的 buffer 和容器填充逻辑）
  const startDate = timelineConfig.value.startDate
  const endDate = timelineConfig.value.endDate

  const years: unknown[] = []

  // 确保从 startDate 所在年份的年初开始
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()

  for (let year = startYear; year <= endYear; year++) {
    // 生成该年的4个季度
    const quarters = []
    for (let quarter = 1; quarter <= 4; quarter++) {
      const quarterStartMonth = (quarter - 1) * 3 // Q1: 0, Q2: 3, Q3: 6, Q4: 9
      const quarterStartDate = new Date(year, quarterStartMonth, 1)
      // 修正：每季度结束日期应该是本季度最后一个月的最后一天
      const quarterEndMonth = quarterStartMonth + 2 // Q1: 2(3月), Q2: 5(6月), Q3: 8(9月), Q4: 11(12月)
      const quarterEndDate = new Date(year, quarterEndMonth + 1, 0) // 下一个月的第0天 = 本月最后一天

      quarters.push({
        quarter,
        label: `Q${quarter}`,
        fullLabel: `${year}年第${quarter}季度`,
        startDate: quarterStartDate,
        endDate: quarterEndDate,
        isToday: isQuarterContainsToday(quarterStartDate, quarterEndDate),
        year,
      })
    }

    years.push({
      year,
      yearLabel: String(year),
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31),
      quarters,
    })
  }

  return years
}

// 判断季度是否包含今天
const isQuarterContainsToday = (startDate: Date, endDate: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today >= startDate && today <= endDate
}

// 生成年度视图时间轴数据
const generateYearTimelineData = () => {
  // 使用从 GanttChart 传入的日期范围（已包含正确的 buffer 和容器填充逻辑）
  const startDate = timelineConfig.value.startDate
  const endDate = timelineConfig.value.endDate

  const years: unknown[] = []

  // 确保从 startDate 所在年份的年初开始到 endDate 所在年份的年末
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()

  for (let year = startYear; year <= endYear; year++) {
    // 生成上半年和下半年
    const halfYears = [
      {
        label: t('halfYearFirst'),
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 6, 0), // 6月的最后一天
        width: 180,
      },
      {
        label: t('halfYearSecond'),
        startDate: new Date(year, 6, 1),
        endDate: new Date(year, 11, 31),
        width: 180,
      },
    ]

    years.push({
      year,
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31),
      halfYears,
      width: 360,
    })
  }

  return years
}

// 添加前置任务事件
const handleAddPredecessor = (task: Task) => {
  emit('add-predecessor', task)
}

// 添加后置任务事件
const handleAddSuccessor = (task: Task) => {
  emit('add-successor', task)
}
</script>

<template>
  <div
    ref="timelineContainer"
    class="timeline"
    @mousedown="handleMouseDown"
    @scroll="handleTimelineScroll"
  >
    <!-- Timeline Header -->
    <div class="timeline-header">
      <!-- 年度视图的header：第一行=年份，第二行=上半年/下半年 -->
      <template
        v-if="
          currentTimeScale === TimelineScale.YEAR && yearTimelineData && yearTimelineData.length > 0
        "
      >
        <!-- 第一行：年份 -->
        <div class="timeline-header-row year-row">
          <div
            v-for="yearData in yearTimelineData"
            :key="`year-${(yearData as any).year}`"
            class="timeline-year"
            :style="{ width: '360px' }"
          >
            <div class="year-label">{{ (yearData as any).year }}</div>
          </div>
        </div>

        <!-- 第二行：上半年/下半年 -->
        <div class="timeline-header-row half-years-row">
          <template
            v-for="yearData in yearTimelineData"
            :key="`halfyear-${(yearData as any).year}`"
          >
            <div
              v-for="halfYear in (yearData as any).halfYears || []"
              :key="`halfyear-${(yearData as any).year}-${halfYear.label}`"
              class="timeline-half-year-item"
              :style="{ width: '180px' }"
            >
              <div class="half-year-label">{{ halfYear.label }}</div>
            </div>
          </template>
        </div>
      </template>

      <!-- 月度视图的header：第一行=年份，第二行=月份 -->
      <template v-else-if="currentTimeScale === TimelineScale.MONTH">
        <!-- 第一行：年份 -->
        <div class="timeline-header-row year-row">
          <div
            v-for="(_, yearValue) in groupMonthsByYear"
            :key="`year-${yearValue}`"
            class="timeline-year"
            :style="{ width: '720px' }"
          >
            <div class="year-label">{{ yearValue }}</div>
          </div>
        </div>

        <!-- 第二行：月份 -->
        <div class="timeline-header-row months-row">
          <div
            v-for="month in timelineData"
            :key="`month-${month.year}-${month.month}`"
            class="timeline-month-item"
            :class="{ today: month.monthData?.isToday }"
            :style="{ width: '59px' }"
          >
            <div class="month-label">{{ month.monthData?.monthLabel }}</div>
          </div>
        </div>
      </template>

      <!-- 季度视图的header：第一行=年份，第二行=季度 -->
      <template v-else-if="currentTimeScale === TimelineScale.QUARTER">
        <!-- 第一行：年份 -->
        <div class="timeline-header-row year-row">
          <div
            v-for="year in timelineData"
            :key="`year-${year.year}`"
            class="timeline-year"
            :style="{ width: '240px' }"
          >
            <div class="year-label">{{ year.yearLabel }}</div>
          </div>
        </div>

        <!-- 第二行：季度 -->
        <div class="timeline-header-row quarters-row">
          <template v-for="year in timelineData" :key="`quarters-${year.year}`">
            <div
              v-for="quarter in year.quarters"
              :key="`quarter-${year.year}-${quarter.quarter}`"
              class="timeline-quarter-item"
              :class="{ today: quarter.isToday }"
              :style="{ width: '60px' }"
            >
              <div class="quarter-label">{{ quarter.label }}</div>
            </div>
          </template>
        </div>
      </template>

      <!-- 小时视图的header：第一行=yyyy/MM/dd，第二行=00:00-23:00 -->
      <template v-else-if="currentTimeScale === TimelineScale.HOUR">
        <!-- 设置header容器总宽度以确保完整的滚动范围 -->
        <div class="hour-header-container" :style="{ width: `${totalTimelineWidth}px` }">
          <!-- 第一行：日期 (yyyy/MM/dd) -->
          <div class="timeline-header-row date-row">
            <div
              v-for="day in optimizedTimelineData"
              :key="`date-${day.year}-${day.month}-${day.day}`"
              class="timeline-day-item"
              :style="{
                position: 'absolute',
                width: `${day.hours.length * 40}px`,
                left: `${(day.hourOffset || 0) * 40}px`,
              }"
            >
              <div class="date-label">{{ day.dateLabel }}</div>
            </div>
          </div>

          <!-- 第二行：小时 (00:00-23:00) -->
          <div class="timeline-header-row hours-row">
            <template
              v-for="day in optimizedTimelineData"
              :key="`hours-${day.year}-${day.month}-${day.day}`"
            >
              <div
                v-for="(hour, index) in day.hours"
                :key="`hour-${day.year}-${day.month}-${day.day}-${hour.hour}`"
                class="timeline-hour-item"
                :class="{
                  today: hour.isToday,
                  'non-working-hour': !hour.isWorkingHour,
                }"
                :style="{
                  position: 'absolute',
                  width: '40px',
                  left: `${(day.hourOffset + index) * 40}px`,
                }"
              >
                <div class="hour-label">{{ hour.shortLabel }}</div>
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- 日视图和周视图的header（保持原有逻辑） -->
      <template v-else>
        <!-- 第一行：年月 -->
        <div class="timeline-header-row year-month-row">
          <div
            v-for="month in timelineData"
            :key="`year-month-${month.year}-${month.month}`"
            class="timeline-month"
            :style="{
              width: month.isWeekView
                ? `${(month.weeks || []).length * 60}px`
                : `${(month.days || []).length * 30}px`,
            }"
          >
            <div class="year-month-label">{{ month.yearMonthLabel }}</div>
          </div>

          <!-- 月份1号标记旗帜 - 优化：使用预计算的位置数组，避免3层嵌套循环 -->
          <div
            v-for="(flag, index) in monthFirstFlags"
            :key="`flag-${index}`"
            class="month-first-flag"
            :style="{
              left: `${flag.left}px`,
              transform: 'translateX(-50%)',
            }"
          >
            <div class="flag-pole"></div>
            <div class="flag-content">{{ flag.date }}</div>
          </div>
        </div>

        <!-- 第二行：周/日期 -->
        <div class="timeline-header-row days-row">
          <!-- 周视图和日视图渲染 -->
          <template v-for="month in timelineData" :key="`timeline-${month.year}-${month.month}`">
            <!-- 周视图 -->
            <div
              v-if="month.isWeekView && month.weeks"
              class="timeline-month-weeks"
              :style="{ width: `${(month.weeks || []).length * 60}px` }"
            >
              <div
                v-for="week in month.weeks || []"
                :key="`week-${month.year}-${month.month}-${week.label}`"
                class="timeline-week"
                :class="{
                  today: week.isToday,
                }"
              >
                <div class="week-label">{{ week.label }}</div>
                <!-- 优化：移除7个子div，使用CSS grid替代，大幅减少DOM节点 -->
                <div class="week-sub-days"></div>
              </div>
            </div>

            <!-- 日视图 -->
            <div
              v-else
              class="timeline-month-days"
              :style="{ width: `${month.days.length * 30}px` }"
            >
              <div
                v-for="day in month.days"
                :key="`day-${month.year}-${month.month}-${day.day}`"
                class="timeline-day"
                :class="{
                  today: day.isToday,
                  weekend: day.isWeekend && !day.isToday,
                }"
              >
                <div class="day-label">{{ day.label }}</div>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>

    <!-- Timeline Body (Task Bar Area) -->
    <div class="timeline-body" @scroll="handleTimelineBodyScroll">
      <div ref="bodyContentRef" class="timeline-body-content">
        <!-- 关系线组件（Canvas 渲染，支持虚拟渲染）- 仅在任务视图渲染 -->
        <GanttLinks
          v-if="viewMode === 'task'"
          :tasks="tasks"
          :task-bar-positions="taskBarPositions"
          :width="canvasWidth"
          :height="canvasHeight"
          :offset-left="canvasOffsetLeft"
          :offset-top="canvasOffsetTop"
          :highlighted-task-id="highlightedTaskId"
          :highlighted-task-ids="highlightedTaskIds"
          :hovered-task-id="hoveredTaskId"
          :vertical-lines="monthFirstVerticalLines"
          :show-vertical-lines="currentTimeScale === TimelineScale.WEEK"
          :is-scrolling="isTimelineScrolling"
        />

        <!-- 连接线拖拽引导线 - 🚀 优化：使用命令式 API，由 RAF 直接调用 draw() -->
        <LinkDragGuide
          ref="linkDragGuideRef"
          :active="!!dragLinkMode && !!linkDragSourceTask"
          :width="canvasWidth"
          :height="canvasHeight"
          :offset-left="canvasOffsetLeft"
          :offset-top="canvasOffsetTop"
        />

        <!-- 年度视图今日标记线 -->
        <div
          v-if="isTodayVisibleInYearView && getTodayLinePositionInYearView >= 0"
          class="today-line-year-view"
          :style="{
            left: `${getTodayLinePositionInYearView}px`,
            height: `${contentHeight}px`,
          }"
        ></div>

        <!-- 背景列 -->
        <div class="day-columns" :style="{ height: `${contentHeight}px` }">
          <!-- 小时视图背景列 -->
          <template v-if="currentTimeScale === TimelineScale.HOUR">
            <!-- 设置容器总宽度以确保完整的滚动范围 -->
            <div
              class="hour-columns-container"
              :style="{
                width: `${totalTimelineWidth}px`,
                height: `${contentHeight}px`,
                position: 'relative',
              }"
            >
              <template
                v-for="day in optimizedTimelineData"
                :key="`day-col-${day.year}-${day.month}-${day.day}`"
              >
                <div
                  v-for="(hour, index) in day.hours"
                  :key="`hour-col-${day.year}-${day.month}-${day.day}-${hour.hour}`"
                  class="hour-column"
                  :class="{
                    today: hour.isToday,
                    weekend: hour.isWeekend,
                    'working-hour': hour.isWorkingHour,
                    'rest-hour': !hour.isWorkingHour && !hour.isWeekend,
                  }"
                  :style="{
                    position: 'absolute',
                    width: '40px',
                    height: `${contentHeight}px`,
                    left: `${(day.hourOffset + index) * 40}px`,
                  }"
                >
                  <!-- 15分钟刻度分割线 -->
                  <div class="quarter-hour-lines">
                    <div class="quarter-line" style="left: 10px"></div>
                    <div class="quarter-line" style="left: 20px"></div>
                    <div class="quarter-line" style="left: 30px"></div>
                  </div>
                </div>
              </template>
            </div>
          </template>

          <!-- 年度视图背景列 -->
          <template v-if="currentTimeScale === TimelineScale.YEAR">
            <template
              v-for="yearData in yearTimelineData"
              :key="`year-col-${(yearData as any).year}`"
            >
              <div
                v-for="halfYear in (yearData as any).halfYears || []"
                :key="`halfyear-col-${(yearData as any).year}-${(halfYear as any).label}`"
                class="half-year-column"
                :style="{ width: '180px', height: `${contentHeight}px` }"
              ></div>
            </template>
          </template>

          <!-- 季度视图背景列 -->
          <template v-if="currentTimeScale === TimelineScale.QUARTER">
            <!-- 设置容器总宽度以确保完整的滚动范围 -->
            <div
              class="quarter-columns-container"
              :style="{
                width: `${totalTimelineWidth}px`,
                height: `${contentHeight}px`,
                position: 'relative',
              }"
            >
              <template v-for="(year, yearIndex) in timelineData" :key="`quarter-col-${year.year}`">
                <div
                  v-for="(quarter, quarterIndex) in year.quarters"
                  :key="`quarter-col-${year.year}-${quarter.quarter}`"
                  class="quarter-column"
                  :class="{ today: quarter.isToday }"
                  :style="{
                    position: 'absolute',
                    width: '60px',
                    height: `${contentHeight}px`,
                    left: `${yearIndex * 240 + quarterIndex * 60}px`,
                  }"
                ></div>
              </template>
            </div>
          </template>

          <!-- 其他视图背景列 -->
          <template
            v-else-if="
              currentTimeScale !== TimelineScale.HOUR &&
              currentTimeScale !== TimelineScale.YEAR &&
              currentTimeScale !== TimelineScale.QUARTER
            "
          >
            <template v-for="month in timelineData" :key="`day-col-${month.year}-${month.month}`">
              <!-- 月度视图背景列 -->
              <div
                v-if="month.isMonthView"
                class="month-column"
                :class="{ today: month.monthData?.isToday }"
                :style="{ width: '59px', height: `${contentHeight}px` }"
              ></div>

              <!-- 周视图背景列 - 优化：移除 subDay 子列，减少 364 个 DOM 节点 -->
              <div
                v-else-if="month.isWeekView && month.weeks"
                class="month-week-columns"
                :style="{
                  width: `${(month.weeks || []).length * 60}px`,
                  height: `${contentHeight}px`,
                }"
              >
                <div
                  v-for="week in month.weeks || []"
                  :key="`week-col-${month.year}-${month.month}-${week.label}`"
                  class="week-column"
                  :class="{
                    today: week.isToday,
                  }"
                  :style="{ height: `${contentHeight}px`, width: '60px' }"
                >
                  <!-- 周内的7个子列 -->
                  <div
                    v-for="(subDay, dayIndex) in week.subDays || []"
                    :key="`subday-col-${dayIndex}`"
                    class="sub-day-column"
                    :class="{
                      weekend: subDay.dayOfWeek === 0 || subDay.dayOfWeek === 6,
                      today: isToday(subDay.date),
                    }"
                    :style="{ height: `${contentHeight}px`, width: `${dayWidth}px` }"
                  ></div>
                </div>
              </div>

              <!-- 日视图背景列 -->
              <div
                v-else
                class="month-day-columns"
                :style="{
                  width: `${(month.days || []).length * 30}px`,
                  height: `${contentHeight}px`,
                }"
              >
                <div
                  v-for="day in month.days || []"
                  :key="`day-col-${month.year}-${month.month}-${day.day}`"
                  class="day-column"
                  :class="{
                    weekend: day.isWeekend,
                    today: day.isToday,
                  }"
                  :style="{ height: `${contentHeight}px` }"
                ></div>
              </div>
            </template>
          </template>
        </div>

        <!-- Task Bar 组件 -->
        <!-- top按照50px增加是为了保证和左侧TaskList中row的高度保持一致 -->
        <!-- 同时需要考虑左侧TaskList包含1px的bottom border -->
        <div class="task-bar-container" :style="{ height: `${contentHeight}px` }">
          <div class="task-rows" :style="{ height: `${contentHeight}px` }">
            <!-- 任务视图：使用虚拟滚动分批渲染可见任务（taskRenderedItems 每帧限流 3 行新增）-->
            <div
              v-for="{ task, originalIndex } in taskRenderedItems"
              v-if="viewMode === 'task'"
              :key="task.id"
              class="task-row"
              :class="{ 'task-row-hovered': hoveredTaskId === task.id }"
              :style="{ top: `${originalIndex * 51}px` }"
              @mouseenter="handleTaskRowHover(task.id)"
              @mouseleave="handleTaskRowHover(null)"
            >
              <!-- 里程碑分组行：显示所有里程碑在同一行的不同时间列中，不渲染父级TaskBar -->
              <template v-if="task.type === 'milestone-group' && task.children">
                <MilestonePoint
                  v-for="milestone in task.children"
                  :key="milestone.id"
                  :date="milestone.startDate || ''"
                  :row-height="50"
                  :day-width="dayWidth"
                  :start-date="
                    currentTimeScale === TimelineScale.YEAR
                      ? getYearTimelineRange().startDate
                      : currentTimeScale === TimelineScale.QUARTER
                        ? getYearTimelineRange().startDate
                        : currentTimeScale === TimelineScale.MONTH
                          ? getMonthTimelineRange().startDate
                          : timelineConfig.startDate
                  "
                  :timeline-start="timelineConfig.startDate"
                  :timeline-end="timelineConfig.endDate"
                  :period-width="dayWidth"
                  :name="milestone.name"
                  :milestone="convertTaskToMilestone(milestone)"
                  :scroll-left="timelineScrollLeft"
                  :container-width="timelineContainerWidth"
                  :milestone-id="milestone.id"
                  :other-milestones="getOtherMilestonesInfo(milestone.id)"
                  :timeline-data="timelineData"
                  :current-time-scale="currentTimeScale"
                  :allow-drag-and-resize="props.allowDragAndResize && !isInHighlightMode"
                  :is-in-highlight-mode="isInHighlightMode"
                  @milestone-double-click="handleMilestoneDoubleClick"
                  @update:milestone="handleMilestoneUpdate"
                  @drag-end="handleMilestoneDragEnd"
                />
              </template>
              <!-- 独立里程碑 -->
              <template v-else-if="task.type === 'milestone'">
                <MilestonePoint
                  :key="task.id"
                  :date="task.startDate || ''"
                  :row-height="50"
                  :day-width="dayWidth"
                  :start-date="
                    currentTimeScale === TimelineScale.YEAR
                      ? getYearTimelineRange().startDate
                      : currentTimeScale === TimelineScale.QUARTER
                        ? getYearTimelineRange().startDate
                        : currentTimeScale === TimelineScale.MONTH
                          ? getMonthTimelineRange().startDate
                          : timelineConfig.startDate
                  "
                  :timeline-start="timelineConfig.startDate"
                  :timeline-end="timelineConfig.endDate"
                  :period-width="dayWidth"
                  :name="task.name"
                  :milestone="convertTaskToMilestone(task)"
                  :scroll-left="timelineScrollLeft"
                  :container-width="timelineContainerWidth"
                  :milestone-id="task.id"
                  :other-milestones="getOtherMilestonesInfo(task.id)"
                  :timeline-data="timelineData"
                  :current-time-scale="currentTimeScale"
                  :allow-drag-and-resize="props.allowDragAndResize && !isInHighlightMode"
                  :is-in-highlight-mode="isInHighlightMode"
                  @milestone-double-click="handleMilestoneDoubleClick"
                  @update:milestone="handleMilestoneUpdate"
                  @drag-end="handleMilestoneDragEnd"
                />
              </template>
              <!-- 普通任务条 - 排除里程碑分组和普通里程碑 -->
              <TaskBar
                v-else-if="task.type !== 'milestone-group' && task.type !== 'milestone'"
                :key="`taskbar-${task.id}-${taskBarRenderKey}`"
                :task="task"
                :row-index="originalIndex"
                :row-height="50"
                :day-width="dayWidth"
                :start-date="
                  currentTimeScale === TimelineScale.YEAR
                    ? getYearTimelineRange().startDate
                    : currentTimeScale === TimelineScale.MONTH
                      ? getMonthTimelineRange().startDate
                      : timelineConfig.startDate
                "
                :is-parent="task.isParent"
                :scroll-left="timelineScrollLeft"
                :container-width="timelineContainerWidth"
                :hide-bubbles="hideBubbles"
                :timeline-data="
                  currentTimeScale === TimelineScale.HOUR ? optimizedTimelineData : timelineData
                "
                :current-time-scale="currentTimeScale"
                :task-bar-config="props.taskBarConfig"
                :allow-drag-and-resize="props.allowDragAndResize && !isInHighlightMode"
                :show-actual-taskbar="props.showActualTaskbar"
                :enable-task-bar-tooltip="props.enableTaskBarTooltip"
                :pending-task-background-color="props.pendingTaskBackgroundColor"
                :delay-task-background-color="props.delayTaskBackgroundColor"
                :complete-task-background-color="props.completeTaskBackgroundColor"
                :ongoing-task-background-color="props.ongoingTaskBackgroundColor"
                :is-highlighted="highlightedTaskIds.has(task.id)"
                :is-primary-highlight="highlightedTaskId === task.id"
                :is-in-highlight-mode="isInHighlightMode"
                :drag-link-mode="dragLinkMode"
                :is-link-drag-source="linkDragSourceTask?.id === task.id"
                :is-valid-link-target="
                  linkDragTargetTask?.id === task.id && isValidLinkTarget === true
                "
                :is-invalid-link-target="
                  linkDragTargetTask?.id === task.id && isValidLinkTarget === false
                "
                :all-tasks="tasks"
                @update:task="updateTask"
                @bar-mounted="handleBarMounted"
                @click="handleTaskBarClick(task, $event)"
                @dblclick="handleTaskBarDoubleClick(task)"
                @drag-end="handleTaskBarDragEnd"
                @resize-end="handleTaskBarResizeEnd"
                @scroll-to-position="handleScrollToPosition"
                @context-menu="handleTaskBarContextMenu"
                @start-timer="handleStartTimer"
                @stop-timer="handleStopTimer"
                @add-predecessor="handleAddPredecessor"
                @add-successor="handleAddSuccessor"
                @delete="handleTaskDelete"
                @delete-link="handleDeleteLink"
                @long-press="setHighlightTask"
                @link-drag-start="handleLinkDragStart"
                @link-drag-move="handleLinkDragMove"
                @link-drag-end="handleLinkDragEnd"
                @tooltip-show="handleTooltipShow"
                @tooltip-hide="handleTooltipHide"
              >
                <template v-if="$slots['custom-task-content']" #custom-task-content="barScope">
                  <slot name="custom-task-content" v-bind="barScope" />
                </template>
                <template
                  v-if="$slots['task-bar-context-menu']"
                  #task-bar-context-menu="contextMenuScope"
                >
                  <slot name="task-bar-context-menu" v-bind="contextMenuScope" />
                </template>
              </TaskBar>
            </div>

            <!-- 资源视图：一行渲染多个 TaskBar -->
            <div
              v-for="{ resource, originalIndex } in visibleResourcesWithFilteredTasks"
              v-else-if="viewMode === 'resource'"
              :key="resource.id"
              class="task-row resource-row"
              :class="{ 'task-row-hovered': hoveredTaskId === resource.id }"
              :style="{
                top: `${resourceRowPositions?.get(resource.id) || 0}px`,
                height: `${resourceTaskLayouts?.get(resource.id)?.totalHeight || 51}px`
              }"
              @mouseenter="handleTaskRowHover(resource.id)"
              @mouseleave="handleTaskRowHover(null)"
            >
              <!-- 为资源下的每个任务渲染 TaskBar -->
              <template v-if="(resource as any).tasks && (resource as any).tasks.length > 0">
                <TaskBar
                  v-for="(task) in (resource as any).tasks"
                  :key="`taskbar-${task.id}-${taskBarRenderKey}`"
                  :task="task"
                  :row-index="originalIndex"
                  :row-height="51"
                  :task-sub-row="resourceTaskLayouts?.get(resource.id)?.taskRowMap.get(task.id) || 0"
                  :row-heights="resourceTaskLayouts?.get(resource.id)?.rowHeights || [51]"
                  :day-width="dayWidth"
                  :start-date="
                    currentTimeScale === TimelineScale.YEAR
                      ? getYearTimelineRange().startDate
                      : currentTimeScale === TimelineScale.MONTH
                        ? getMonthTimelineRange().startDate
                        : timelineConfig.startDate
                  "
                  :scroll-left="timelineScrollLeft"
                  :container-width="timelineContainerWidth"
                  :hide-bubbles="hideBubbles"
                  :timeline-data="
                    currentTimeScale === TimelineScale.HOUR ? optimizedTimelineData : timelineData
                  "
                  :current-time-scale="currentTimeScale"
                  :task-bar-config="props.taskBarConfig"
                  :allow-drag-and-resize="props.allowDragAndResize && !isInHighlightMode"
                  :show-actual-taskbar="props.showActualTaskbar"
                  :enable-task-bar-tooltip="props.enableTaskBarTooltip"
                  :pending-task-background-color="props.pendingTaskBackgroundColor"
                  :delay-task-background-color="props.delayTaskBackgroundColor"
                  :complete-task-background-color="props.completeTaskBackgroundColor"
                  :ongoing-task-background-color="props.ongoingTaskBackgroundColor"
                  :is-highlighted="highlightedTaskIds.has(task.id)"
                  :is-primary-highlight="highlightedTaskId === task.id"
                  :is-in-highlight-mode="isInHighlightMode"
                  :drag-link-mode="dragLinkMode"
                  :is-link-drag-source="linkDragSourceTask?.id === task.id"
                  :is-valid-link-target="
                    linkDragTargetTask?.id === task.id && isValidLinkTarget === true
                  "
                  :is-invalid-link-target="
                    linkDragTargetTask?.id === task.id && isValidLinkTarget === false
                  "
                  :all-tasks="tasks"
                  :has-resource-conflict="resourceConflicts.get(String(resource.id))?.has(task.id) || false"
                  :conflict-tasks="getConflictTasksForTask(resource.id, task.id)"
                  :current-resource-id="resource.id"
                  :resources="dataSource"
                  @update:task="updateTask"
                  @bar-mounted="handleBarMounted"
                  @click="handleTaskBarClick(task, $event)"
                  @dblclick="handleTaskBarDoubleClick(task)"
                  @drag-end="handleTaskBarDragEnd"
                  @resize-end="handleTaskBarResizeEnd"
                  @scroll-to-position="handleScrollToPosition"
                  @context-menu="handleTaskBarContextMenu"
                  @start-timer="handleStartTimer"
                  @stop-timer="handleStopTimer"
                  @add-predecessor="handleAddPredecessor"
                  @add-successor="handleAddSuccessor"
                  @delete="handleTaskDelete"
                  @delete-link="handleDeleteLink"
                  @long-press="setHighlightTask"
                  @link-drag-start="handleLinkDragStart"
                  @link-drag-move="handleLinkDragMove"
                  @link-drag-end="handleLinkDragEnd"
                  @tooltip-show="handleTooltipShow"
                  @tooltip-hide="handleTooltipHide"
                >
                  <template v-if="$slots['custom-task-content']" #custom-task-content="barScope">
                    <slot name="custom-task-content" v-bind="barScope" />
                  </template>
                  <template
                    v-if="$slots['task-bar-context-menu']"
                    #task-bar-context-menu="contextMenuScope"
                  >
                    <slot name="task-bar-context-menu" v-bind="contextMenuScope" />
                  </template>
                </TaskBar>

                <!-- v1.9.2 资源冲突可视化层 -->
                <!-- v1.9.5 P2-1修复：使用原始完整的任务列表进行冲突检测 -->
                <!-- v1.9.5 修复：传递任务行号信息，正确计算冲突区域高度 -->
                <!-- v1.9.5 可通过 show-conflicts prop 控制是否显示 -->
                <!-- v1.9.6 修复：width使用totalTimelineWidth（用于坐标计算），containerWidth用于Canvas宽度 -->
                <!-- v1.9.7 Bug修复：使用渲染的tasks而不是allTasks，避免滚动后显示已消失TaskBar的冲突 -->
                <!-- v1.9.9 优化：传递renderLimit，只计算已渲染TaskBar的冲突 -->
                <GanttConflicts
                  v-if="showConflicts"
                  :tasks="(resource as any).tasks"
                  :resource-id="resource.id"
                  :day-width="dayWidth"
                  :start-date="
                    currentTimeScale === TimelineScale.YEAR
                      ? getYearTimelineRange().startDate
                      : currentTimeScale === TimelineScale.MONTH
                        ? getMonthTimelineRange().startDate
                        : timelineConfig.startDate
                  "
                  :top-offset="7.5"
                  :height="(resourceTaskLayouts.get(resource.id)?.totalHeight || 51) - 10"
                  :width="totalTimelineWidth"
                  :timeline-data="timelineData as any"
                  :current-time-scale="currentTimeScale"
                  :task-row-map="resourceTaskLayouts.get(resource.id)?.taskRowMap"
                  :row-heights="resourceTaskLayouts.get(resource.id)?.rowHeights"
                  :scroll-left="timelineScrollLeft"
                  :container-width="timelineContainerWidth"
                  :render-limit="resourceTaskRenderLimits.get(resource.id)"
                />
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Singleton Tooltip：单一 Teleport、所有 TaskBar 共享、应支持 #taskbar-tooltip slot -->
  <Teleport v-if="props.enableTaskBarTooltip !== false" to="body">
    <div
      v-if="tooltipState.visible"
      class="task-hover-tooltip"
      :class="{ 'tooltip-below': tooltipState.isBelow }"
      :style="{
        left: `${tooltipState.position.x}px`,
        top: `${tooltipState.position.y}px`,
        backgroundColor: tooltipState.taskStatus.color,
      }"
    >
      <!-- 有自定义 slot：消费方内容 -->
      <template v-if="$slots['taskbar-tooltip']">
        <slot
          name="taskbar-tooltip"
          :task="tooltipState.task"
          :task-status="tooltipState.taskStatus"
          :resource-percent="tooltipState.resourcePercent"
        />
      </template>
      <!-- 默认内容：向后兼容 -->
      <template v-else>
        <div
          class="hover-tooltip-arrow"
          :style="{
            borderTopColor: tooltipState.isBelow ? 'transparent' : tooltipState.taskStatus.color,
            borderBottomColor: tooltipState.isBelow ? tooltipState.taskStatus.color : 'transparent',
          }"
        />
        <div class="hover-tooltip-content">
          <div class="hover-tooltip-title">{{ tooltipState.task?.name }}</div>
          <div class="hover-tooltip-row">
            <span class="hover-tooltip-label">{{ t('plannedStartDate') }}:</span>
            <span class="hover-tooltip-value">{{ formatTooltipDate(tooltipState.task?.startDate) }}</span>
          </div>
          <div class="hover-tooltip-row">
            <span class="hover-tooltip-label">{{ t('plannedEndDate') }}:</span>
            <span class="hover-tooltip-value">{{ formatTooltipDate(tooltipState.task?.endDate) }}</span>
          </div>
          <div class="hover-tooltip-row">
            <span class="hover-tooltip-label">{{ t('actualStartDate') }}:</span>
            <span class="hover-tooltip-value">{{ tooltipState.task?.actualStartDate ? formatTooltipDate(tooltipState.task.actualStartDate) : '-' }}</span>
          </div>
          <div class="hover-tooltip-row">
            <span class="hover-tooltip-label">{{ t('actualEndDate') }}:</span>
            <span class="hover-tooltip-value">{{ tooltipState.task?.actualEndDate ? formatTooltipDate(tooltipState.task.actualEndDate) : '-' }}</span>
          </div>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
@import '../styles/theme-variables.css';

/* ─── Singleton Tooltip CSS（从 TaskBar.vue 迁移至此） ─────────────────────── */
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
  transform: translate(-50%, -100%);
  margin-top: -8px;
  min-width: 150px;
}

.task-hover-tooltip.tooltip-below {
  transform: translate(-50%, 0);
  margin-top: 0;
}

.hover-tooltip-arrow {
  position: absolute;
  left: 50%;
  bottom: -5px;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid rgba(0, 0, 0, 0.85);
  border-bottom: 0;
}

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

.timeline {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--gantt-bg-primary, #ffffff);
  overflow-x: auto; /* 横向滚动，显示滚动条 */
  overflow-y: auto; /* 纵向滚动，显示滚动条 */
  width: 100%;
  cursor: grab;
  transition: background-color 0.3s ease;
  position: relative; /* 为覆盖层定位 */

  /* Webkit浏览器滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: var(--gantt-scrollbar-thumb) transparent;
}

.timeline:active {
  cursor: grabbing;
}

.timeline::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.timeline::-webkit-scrollbar-track {
  background: transparent;
}

.timeline::-webkit-scrollbar-thumb {
  background-color: var(--gantt-scrollbar-thumb);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.timeline::-webkit-scrollbar-thumb:hover {
  background-color: var(--gantt-scrollbar-thumb-hover);
}

.timeline::-webkit-scrollbar-corner {
  background: transparent;
}

.timeline-header {
  height: 80px;
  background: var(--gantt-bg-secondary);
  width: fit-content;
  display: flex;
  flex-direction: column;
}

.timeline-header-row {
  display: flex;
  height: 50%;
  border-bottom: 1px solid var(--gantt-border-medium);
  min-width: fit-content;
}

.timeline-header-row:last-child {
  border-bottom: none;
}

.year-month-row {
  align-items: center;
  position: relative; /* 为旗帜提供定位上下文 */
}

.days-row {
  align-items: center;
}

.timeline-month {
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid var(--gantt-border-medium);
  box-sizing: border-box;
  height: 100%;
  min-width: 60px;
}

.timeline-month:last-child {
  border-right: none;
}

.year-month-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--gantt-text-header);
  text-align: center;
}

.timeline-month-days {
  display: flex;
  height: 100%;
  border-right: 1px solid var(--gantt-border-medium);
  box-sizing: border-box;
  min-width: 120px;
}

.timeline-month-days:last-child {
  border-right: none;
}

.timeline-day {
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid var(--gantt-border-light);
  width: 30px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--gantt-border-medium);
  transition: background-color 0.2s;
}

.timeline-day:last-child {
  border-right: none;
}

.timeline-day.today {
  background-color: var(--gantt-primary);
  color: var(--gantt-text-white);
}

.timeline-day.today .day-label {
  color: var(--gantt-text-white);
  font-weight: 600;
}

.timeline-day.weekend {
  background-color: var(--gantt-bg-secondary);
  opacity: 0.6;
}

.timeline-day.weekend .day-label {
  color: var(--gantt-border-dark);
}

.day-label {
  font-size: 12px;
  color: var(--gantt-text-header);
  text-align: center;
}

/* 周视图样式 */
.timeline-month-weeks {
  display: flex;
  height: 100%;
  border-right: 1px solid var(--gantt-border-medium);
  box-sizing: border-box;
  min-width: 60px;
}

.timeline-month-weeks:last-child {
  border-right: none;
}

.timeline-week {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-right: 1px solid var(--gantt-border-light);
  width: 60px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--gantt-border-medium);
  transition: background-color 0.2s;
  position: relative;
}

.timeline-week:last-child {
  border-right: none;
}

.timeline-week.today {
  background-color: var(--gantt-primary);
  color: var(--gantt-text-white);
}

.timeline-week.today .week-label {
  color: var(--gantt-text-white);
  font-weight: 600;
}

.week-label {
  font-size: 12px;
  color: var(--gantt-text-header);
  text-align: center;
  margin-bottom: 2px;
}

.week-sub-days {
  /* 优化：删除子节点后，这个容器仅作为占位符，无需复杂样式 */
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none; /* 不阻挡事件穿透 */
}

/* 优化：week-sub-day 样式已废弃，子节点已移除以减少 DOM 节点 */
/* .week-sub-day 不再使用 */

/* 月份1号标记旗帜样式 */
.month-first-flag {
  position: absolute;
  bottom: -40px;
  z-index: 1;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.flag-content {
  background-color: var(--gantt-primary, #409eff);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 2px;
  text-align: center;
  min-width: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  order: 1; /* 旗帜内容在上 */
}

.flag-pole {
  width: 1px;
  height: 50px;
  background-color: var(--gantt-primary, #409eff);
  order: 2; /* 旗杆在下 */
}

/* 暗色主题下的旗帜样式 */
:global(.gantt-root[data-theme='dark']) .flag-pole {
  background-color: var(--gantt-primary-light, #66b1ff);
}

:global(.gantt-root[data-theme='dark']) .flag-content {
  background-color: var(--gantt-primary-light, #66b1ff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

/* 周视图背景列样式 */
.month-week-columns {
  display: flex;
  position: relative;
}

.week-column {
  position: relative;
  border-right: 1px solid var(--gantt-border-light, #e4e7ed);
  box-sizing: border-box;

  /* 优化：使用 CSS Grid 代替 7 个 DOM 节点 */
  display: grid;
  grid-template-columns: repeat(7, 1fr); /* 7 列等宽 */
  gap: 0;
}

.week-column:last-child {
  border-right: none;
}

.week-column.today {
  background-color: rgba(64, 158, 255, 0.1);
}

/* 优化：sub-day-column 样式保留用于其他可能的用途，但背景列不再使用 */
.sub-day-column {
  position: relative;
  box-sizing: border-box;
}

.sub-day-column.weekend {
  background-color: var(--gantt-bg-secondary, #f5f7fa);
  opacity: 0.6;
}

.sub-day-column.today {
  background-color: var(--gantt-primary-light, rgba(64, 158, 255, 0.2));
}

.timeline-body {
  flex: 1;
  overflow-x: hidden; /* 禁用横向滚动，由父容器.timeline处理 */
  overflow-y: auto; /* 只保留纵向滚动 */
  position: relative;
  width: fit-content;
  background: var(--gantt-bg-primary, #ffffff);
  cursor: grab;
  transition: background-color 0.3s ease;

  /* 隐藏滚动条但保留滚动功能 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.timeline-body::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.timeline-body-content {
  width: 100%;
  height: 100%;
  position: relative;
  background: var(--gantt-bg-primary, #ffffff);
  transition: background-color 0.3s ease;
}

.task-bar-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  pointer-events: none;
  /* height由内联样式动态设置 */
}

.task-rows {
  position: relative;
  width: 100%;
  /* height由内联样式动态设置 */
}

.task-row {
  position: absolute;
  left: 0;
  width: 100%;
  min-height: 51px; /** 为了对齐左侧的Task List Row高度，同时需要包含List Row的Bottom Border 1px */
  pointer-events: auto;
  z-index: 11;
  transition: background-color 0.2s ease;
  padding-bottom: 2px;
}

/* 资源视图行样式 */
.resource-row {
  /* 不使用flex，保持TaskBar的绝对定位 */
  position: absolute !important;
  left: 0;
  width: 100%;
  /* height由内联样式动态设置，不使用固定值 */
  pointer-events: auto;
  z-index: 11;
  transition: background-color 0.2s ease;
}

.timeline-body .task-row-hovered {
  background-color: var(--gantt-bg-hover); /* 与TaskList保持一致的悬停背景色 */
  /* 降低层级，避免覆盖任务条等元素 */
  z-index: 11;
}

.timeline-body .task-row-hovered > * {
  pointer-events: auto;
}

.task-bar-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  pointer-events: auto;
}

.placeholder-text {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.placeholder-desc {
  font-size: 14px;
  color: #c0c4cc;
}

.day-columns {
  display: flex;
  border-right: 1px solid var(--gantt-border-light, #ebeef5);
  box-sizing: border-box;
  min-width: 120px;
  /* height由内联样式动态设置 */
}

.day-columns:last-child {
  border-right: none;
}

.month-day-columns {
  display: flex;
  border-right: 1px dashed var(--gantt-border-light, #ebeef5);
  box-sizing: border-box;
  min-width: 120px;
  /* height由内联样式动态设置 */
}

.month-day-columns:last-child {
  border-right: none;
}

.day-column {
  width: 30px;
  border-right: 1px dashed var(--gantt-border-light, #f0f0f0);
  box-sizing: border-box;
  transition: background-color 0.2s;
  position: relative;
  /* height由内联样式动态设置 */
}

.day-column:last-child {
  border-right: none;
}

.day-column.weekend {
  background-color: var(--gantt-bg-secondary, #f5f7fa);
  opacity: 0.6;
}

.day-column.today {
  border-left: 3px solid var(--gantt-primary-color, #409eff);
  background-color: var(--gantt-primary-color, #409eff);
  opacity: 0.15;
  position: relative;
}

.day-column.today::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    to bottom,
    rgba(64, 158, 255, 0.1) 0%,
    rgba(64, 158, 255, 0.05) 50%,
    rgba(64, 158, 255, 0.1) 100%
  );
  pointer-events: none;
}

.day-column.today.weekend {
  background-color: var(--gantt-primary-color, #409eff);
  opacity: 0.2;
}

/* 今日定位高亮效果 - 点击"今日"按钮后的强化效果 */
.day-column.today-highlight {
  background-color: var(--gantt-primary-color, #409eff) !important;
  opacity: 0.5 !important;
  animation: today-pulse 2s ease-in-out;
  border-left: 3px solid var(--gantt-primary-color, #409eff) !important;
  box-shadow: 0 0 8px rgba(64, 158, 255, 0.4);
}

.day-column.today-highlight::before {
  background: linear-gradient(
    to bottom,
    rgba(64, 158, 255, 0.3) 0%,
    rgba(64, 158, 255, 0.2) 50%,
    rgba(64, 158, 255, 0.3) 100%
  ) !important;
}

@keyframes today-pulse {
  0% {
    opacity: 0.8;
    transform: scale(1);
    box-shadow: 0 0 8px rgba(64, 158, 255, 0.6);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.02);
    box-shadow: 0 0 12px rgba(64, 158, 255, 0.8);
  }
  100% {
    opacity: 0.5;
    transform: scale(1);
    box-shadow: 0 0 8px rgba(64, 158, 255, 0.4);
  }
}

/* 暗色主题支持 */
:global(.gantt-root[data-theme='dark']) .timeline {
  background: var(--gantt-bg-primary, #3a3a3a) !important;
  color: var(--gantt-text-primary, #e5e5e5) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-header {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-header-row {
  border-bottom-color: var(--gantt-border-medium, #333333) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-month {
  border-right-color: var(--gantt-border-medium, #333333) !important;
}

:global(.gantt-root[data-theme='dark']) .year-month-label {
  color: var(--gantt-text-header, #ffffff) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-day {
  border-right-color: var(--gantt-border-light, #555555) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-day.today {
  background: #1a365d !important;
  color: #e3f2fd !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-day.weekend {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
  color: var(--gantt-text-muted, #b0b0b0) !important;
}

:global(.gantt-root[data-theme='dark']) .day-label {
  color: var(--gantt-text-header, #ffffff) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-body {
  background: var(--gantt-bg-primary, #6b6b6b) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-body-content {
  background: var(--gantt-bg-primary, #6b6b6b) !important;
}

:global(.gantt-root[data-theme='dark']) .day-columns {
  border-right-color: var(--gantt-border-light, #555555) !important;
}

:global(.gantt-root[data-theme='dark']) .month-day-columns {
  border-right-color: var(--gantt-border-light, #555555) !important;
}

:global(.gantt-root[data-theme='dark']) .day-column {
  border-right-color: var(--gantt-border-light, #555555) !important;
  /* 非周末列：透明背景，继承timeline-body的背景色 */
}

:global(.gantt-root[data-theme='dark']) .day-column.today {
  border-left-color: var(--gantt-primary, #409eff) !important;
  background-color: var(--gantt-primary, #409eff) !important;
}

:global(.gantt-root[data-theme='dark']) .day-column.today::before {
  background: linear-gradient(
    to bottom,
    rgba(64, 158, 255, 0.15) 0%,
    rgba(64, 158, 255, 0.08) 50%,
    rgba(64, 158, 255, 0.15) 100%
  ) !important;
}

:global(.gantt-root[data-theme='dark']) .day-column.today.weekend {
  background-color: var(--gantt-primary-color, #409eff) !important;
}

/* 暗色主题下的今日定位高亮效果 */
:global(.gantt-root[data-theme='dark']) .day-column.today-highlight {
  background-color: var(--gantt-primary-color, #409eff) !important;
  box-shadow: 0 0 8px rgba(64, 158, 255, 0.6) !important;
}

:global(.gantt-root[data-theme='dark']) .day-column.today-highlight::before {
  background: linear-gradient(
    to bottom,
    rgba(64, 158, 255, 0.4) 0%,
    rgba(64, 158, 255, 0.25) 50%,
    rgba(64, 158, 255, 0.4) 100%
  ) !important;
}

/* 暗黑模式下的任务行悬停效果 */
:global(.gantt-root[data-theme='dark']) .timeline-body .task-row-hovered {
  background-color: var(--gantt-bg-hover) !important; /* 与TaskList保持一致，使用透明背景 */
  /* 降低层级，避免覆盖任务条等元素 */
  z-index: 11 !important;
}

/* 确保暗黑模式下子元素能继续响应事件 */
:global(.gantt-root[data-theme='dark']) .timeline-body .task-row-hovered > * {
  pointer-events: auto !important;
}

/* 暗黑模式下的非工作时间样式 */
:global(.gantt-root[data-theme='dark']) .timeline-hour-item.non-working-hour {
  background-color: var(--gantt-bg-secondary, #1a1a1a) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-hour-item.non-working-hour .hour-label {
  color: var(--gantt-text-muted, #b0b0b0) !important;
}

/* 月度视图专用样式 */
.year-row {
  min-height: 36px;
  border-bottom: 1px solid var(--gantt-border-medium, #e1e4e8);
  position: relative; /* 为绝对定位的子元素提供基准 */
}

.timeline-year {
  border-right: 1px solid var(--gantt-border-medium, #e1e4e8);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  box-sizing: border-box; /* 确保border包含在width内 */
}

.year-label {
  color: var(--gantt-text-header, #24292e);
  font-weight: 600;
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
  white-space: nowrap; /* 防止年份文字换行 */
}

.months-row {
  min-height: 36px;
  border-bottom: 1px solid var(--gantt-border-light, #d1d5da);
}

.timeline-month-item {
  border-right: 1px solid var(--gantt-border-light, #d1d5da);
  border-bottom: 1px solid var(--gantt-border-light, #d1d5da);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  transition: background-color 0.2s ease;
}

.timeline-month-item.today {
  background-color: var(--gantt-primary);
}

.month-label {
  color: var(--gantt-text-primary, #24292e);
  font-weight: 500;
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.month-column {
  border-right: 1px solid var(--gantt-border-light, #d1d5da);
  position: relative;
  transition: background-color 0.2s ease;
}

.month-column.today {
  background-color: var(--gantt-primary-color, #409eff);
  opacity: 0.15;
}

/* 季度视图样式 */
.quarter-header-container {
  position: relative;
  overflow: hidden; /* 防止内容溢出 */
}

.quarters-row {
  min-height: 36px; /* 与其他视图的第二行保持一致 */
  background: var(--gantt-bg-secondary, #f6f8fa);
  border-bottom: 1px solid var(--gantt-border-light, #d1d5da); /* 与其他视图第二行保持一致 */
  position: relative; /* 为绝对定位的子元素提供基准 */
}

.timeline-quarter-item {
  border-right: 1px solid var(--gantt-border-light, #d1d5da);
  border-bottom: 1px solid var(--gantt-border-light, #d1d5da); /* 添加底边框，与月度视图保持一致 */
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px; /* 改为min-height并与其他视图第二行保持一致 */
  height: 100%; /* 占满父容器高度 */
  transition: background-color 0.2s ease;
  box-sizing: border-box; /* 确保border包含在width内 */
}

.timeline-quarter-item.today {
  background-color: var(--gantt-primary-color, #409eff);
  color: white;
}

.quarter-label {
  color: var(--gantt-text-primary, #24292e); /* 改为text-primary，与月度视图的month-label保持一致 */
  font-weight: 500; /* 与月度视图的month-label保持一致 */
  font-size: 13px; /* 与月度视图的month-label保持一致 */
  line-height: 1.5; /* 与月度视图的month-label保持一致 */
  text-align: center;
  white-space: nowrap; /* 防止文字换行 */
}

.timeline-quarter-item.today .quarter-label {
  color: white;
}

.quarter-columns-container {
  position: relative;
  overflow: hidden; /* 防止内容溢出 */
}

.quarter-column {
  border-right: 1px solid var(--gantt-border-light, #d1d5da);
  position: absolute; /* 改为绝对定位 */
  transition: background-color 0.2s ease;
  box-sizing: border-box; /* 确保border包含在width内 */
}

.quarter-column.today {
  background-color: var(--gantt-primary-color, #409eff);
  opacity: 0.15;
}

/* 年度视图样式 */
.half-years-row {
  min-height: 36px;
  border-bottom: 1px solid var(--gantt-border-light, #d1d5da);
}

.timeline-half-year-item {
  border-right: 1px solid var(--gantt-border-light, #d1d5da);
  border-bottom: 1px solid var(--gantt-border-light, #d1d5da);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  transition: background-color 0.2s ease;
  box-sizing: border-box; /* 确保border包含在width内 */
}

.half-year-label {
  color: var(--gantt-text-primary, #24292e);
  font-weight: 500;
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

/* 年度视图背景列样式 */
.half-year-column {
  border-right: 1px solid var(--gantt-border-light, #d1d5da);
  position: relative;
  transition: background-color 0.2s ease;
  background-color: var(--gantt-bg-primary, #ffffff);
  box-sizing: border-box; /* 确保border包含在width内 */
}

.half-year-column:hover {
  background-color: var(--gantt-bg-hover, rgba(64, 158, 255, 0.05));
}

/* 月度视图暗色主题样式 */
:global(.gantt-root[data-theme='dark']) .year-row {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
  border-bottom-color: var(--gantt-border-medium, #333333) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-year {
  border-right-color: var(--gantt-border-medium, #333333) !important;
}

:global(.gantt-root[data-theme='dark']) .year-label {
  color: var(--gantt-text-header, #ffffff) !important;
}

:global(.gantt-root[data-theme='dark']) .months-row {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
  border-bottom-color: var(--gantt-border-medium, #333333) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-month-item {
  border-right-color: var(--gantt-border-light, #555555) !important;
  border-bottom-color: var(--gantt-border-light, #555555) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-month-item.today {
  background-color: var(--gantt-primary);
  border-left-color: var(--gantt-primary, #409eff) !important;
}

:global(.gantt-root[data-theme='dark']) .month-label {
  color: var(--gantt-text-header, #ffffff) !important;
}

/* 季度视图暗色主题样式 */
:global(.gantt-root[data-theme='dark']) .quarters-row {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
  border-bottom-color: var(--gantt-border-medium, #333333) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-quarter-item {
  border-right-color: var(--gantt-border-light, #555555) !important;
  border-bottom-color: var(--gantt-border-light, #555555) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-quarter-item.today {
  background-color: var(--gantt-primary);
  border-left-color: var(--gantt-primary, #409eff) !important;
}

:global(.gantt-root[data-theme='dark']) .quarter-label {
  color: var(--gantt-text-header, #ffffff) !important;
}

:global(.gantt-root[data-theme='dark']) .quarter-column {
  border-right-color: var(--gantt-border-light, #555555) !important;
  background-color: var(--gantt-bg-primary, #6b6b6b) !important;
}

:global(.gantt-root[data-theme='dark']) .quarter-column.today {
  background-color: var(--gantt-primary, #409eff) !important;
}

:global(.gantt-root[data-theme='dark']) .month-column {
  border-right-color: var(--gantt-border-light, #555555) !important;
}

:global(.gantt-root[data-theme='dark']) .month-column.today {
  background-color: var(--gantt-primary-color, #409eff);
  border-left-color: var(--gantt-primary-color, #409eff) !important;
}

/* 年度视图暗色主题样式 */
:global(.gantt-root[data-theme='dark']) .half-years-row {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
  border-bottom-color: var(--gantt-border-medium, #333333) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-half-year-item {
  border-right-color: var(--gantt-border-light, #555555) !important;
  border-bottom-color: var(--gantt-border-light, #555555) !important;
}

:global(.gantt-root[data-theme='dark']) .half-year-label {
  color: var(--gantt-text-header, #ffffff) !important;
}

/* 年度视图背景列暗色主题样式 */
:global(.gantt-root[data-theme='dark']) .half-year-column {
  border-right-color: var(--gantt-border-light, #555555) !important;
  background-color: var(--gantt-bg-primary, #6b6b6b) !important;
}

:global(.gantt-root[data-theme='dark']) .half-year-column:hover {
  background-color: var(--gantt-bg-hover, rgba(64, 158, 255, 0.1)) !important;
}

/* 年度视图今日标记线样式 */
.today-line-year-view {
  position: absolute;
  top: 0;
  width: 2px;
  background-color: var(--gantt-primary, #409eff);
  z-index: 30;
  pointer-events: none;
  box-shadow: 0 0 4px rgba(64, 158, 255, 0.3);
}

/* 暗黑模式下的年度视图今日标记线 */
:global(.gantt-root[data-theme='dark']) .today-line-year-view {
  background-color: var(--gantt-primary, #66b1ff);
  box-shadow: 0 0 4px rgba(102, 177, 255, 0.4);
}

/* 小时视图header容器 */
.hour-header-container {
  position: relative;
  min-width: 100%;
}

.date-row {
  min-height: 40px;
  border-bottom: 1px solid var(--gantt-border-light, #d1d5da);
  position: relative;
  overflow: hidden;
}

/*---------------*/
.timeline-day-item {
  top: 0;
  height: 100%;
  border-right: 1px solid var(--gantt-border-medium, #e1e4e8);
  background-color: var(--gantt-bg-secondary, #f6f8fa);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  box-sizing: border-box;
}

/* 小时视图日期项专用样式 */
.timeline-day-item.hour-view-day {
  position: absolute;
  top: 0;
  height: 100%;
  border-right: 1px solid var(--gantt-border-medium, #e1e4e8);
  background-color: var(--gantt-bg-secondary, #f6f8fa);
}

.date-label {
  color: var(--gantt-text-header, #24292e);
  font-weight: 600;
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
}

.hours-row {
  min-height: 40px;
  border-bottom: 1px solid var(--gantt-border-light, #d1d5da);
  position: relative;
  overflow: hidden;
  display: flex;
}

.hour-label {
  color: var(--gantt-text-primary, #24292e);
  font-weight: 600;
  font-size: 13px;
  line-height: 1.3;
  text-align: center;
  letter-spacing: 0px;
}

/* 15分钟刻度线样式 */
.quarter-hour-lines {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.quarter-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: var(--gantt-border-light, #d1d5da);
  opacity: 0.5;
}
/**------------------------ */

.timeline-hour-item {
  top: 0;
  height: 100%;
  border-right: 1px solid var(--gantt-border-light, #d1d5da);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  transition: background-color 0.2s ease;
  box-sizing: border-box;
  flex-shrink: 0;
}

.timeline-hour-item.today {
  background-color: var(--gantt-primary);
  color: var(--gantt-text-white);
}

.timeline-hour-item.today .hour-label {
  color: var(--gantt-text-white);
}

/* 小时视图非工作时间样式 - 参考日视图周末样式 */
.timeline-hour-item.non-working-hour {
  background-color: var(--gantt-bg-secondary);
}

.timeline-hour-item.non-working-hour .hour-label {
  color: var(--gantt-border-dark);
}

/* 小时视图容器样式 */
.hour-columns-container {
  position: relative;
  min-width: 100%;
  min-height: 100px;
  display: flex;
}

.hour-column {
  position: absolute;
  top: 0;
  bottom: 0;
  border-right: 1px solid var(--gantt-border-light, #e0e6ed);
  background-color: var(--gantt-bg-primary, #ffffff);
  transition: background-color 0.2s ease;
  box-sizing: border-box;
  flex-shrink: 0;
  pointer-events: none;
  z-index: 1;
}

.hour-column.weekend {
  background-color: var(--gantt-bg-secondary, #f5f7fa);
  opacity: 0.6;
}

.hour-column.rest-hour {
  background-color: var(--gantt-bg-secondary, #f5f7fa);
  opacity: 0.6;
}

.hour-column.working-hour {
  background-color: var(--gantt-bg-primary, #ffffff);
}

.hour-column.today {
  background-color: var(--gantt-primary-color, #409eff);
  opacity: 0.2;
  border-left: 2px solid var(--gantt-primary-color, #409eff);
}

.hour-column:hover {
  background-color: var(--gantt-bg-hover, rgba(64, 158, 255, 0.05));
}

/* 小时视图暗色主题样式 */
:global(.gantt-root[data-theme='dark']) .date-row {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
  border-bottom-color: var(--gantt-border-medium, #333333) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-day-item {
  border-right-color: var(--gantt-border-medium, #333333) !important;
}

:global(.gantt-root[data-theme='dark']) .date-label {
  color: var(--gantt-text-header, #ffffff) !important;
}

:global(.gantt-root[data-theme='dark']) .hours-row {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
  border-bottom-color: var(--gantt-border-medium, #333333) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-hour-item {
  border-right-color: var(--gantt-border-light, #555555) !important;
  border-bottom-color: var(--gantt-border-light, #555555) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-hour-item.today {
  background-color: var(--gantt-primary, #1a365d) !important;
  color: var(--gantt-text-white, #e3f2fd) !important;
}

:global(.gantt-root[data-theme='dark']) .hour-label {
  color: var(--gantt-text-primary, #e5e5e5) !important;
}

:global(.gantt-root[data-theme='dark']) .timeline-hour-item.today .hour-label {
  color: var(--gantt-text-white, #e3f2fd) !important;
}

:global(.gantt-root[data-theme='dark']) .hour-column {
  border-right-color: var(--gantt-border-light, #555555) !important;
}

:global(.gantt-root[data-theme='dark']) .hour-column.weekend {
  background-color: var(--gantt-bg-secondary, #1a1a1a) !important;
}

:global(.gantt-root[data-theme='dark']) .hour-column.rest-hour {
  background-color: var(--gantt-bg-secondary, #1a1a1a) !important;
}

:global(.gantt-root[data-theme='dark']) .hour-column.working-hour {
  background-color: var(--gantt-bg-primary, #6b6b6b) !important;
}

:global(.gantt-root[data-theme='dark']) .hour-column.today {
  background-color: var(--gantt-primary-color, #409eff) !important;
  border-left-color: var(--gantt-primary-color, #409eff) !important;
}

/* 暗色主题：15分钟刻度线样式 */
:global(.gantt-root[data-theme='dark']) .quarter-line {
  background-color: var(--gantt-border-light, #555555) !important;
}
</style>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import TaskBar from './TaskBar.vue'
import MilestonePoint from './MilestonePoint.vue'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useI18n } from '../composables/useI18n'
import type { TaskBarConfig } from '../models/configs/TaskBarConfig'
import { getPredecessorIds } from '../utils/predecessorUtils'
import type { Task } from '../models/classes/Task'
import type { Milestone } from '../models/classes/Milestone'
import type { TimelineConfig } from '../models/configs/TimelineConfig'
import { TimelineScale } from '../models/types/TimelineScale'

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
  delete: [task: Task, deleteChildren?: boolean]
}>()

// 多语言
const { formatYearMonth, formatMonth, getTranslation } = useI18n()

// 翻译函数
const t = (key: string): string => {
  return getTranslation(key)
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
  // 所有视图都正常响应props变化
  if (props.startDate || props.endDate) {
    if (!isUpdatingTimelineConfig) {
      timelineConfig.value.startDate = newStart
      timelineConfig.value.endDate = newEnd
    }
  }
})

// 使用props传入的任务和里程碑数据
const tasks = computed(() => props.tasks || [])

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

// 获取任务数据的日期范围（用于月度视图时间轴范围计算）
const getTasksDateRange = () => {
  if (!tasks.value || tasks.value.length === 0) {
    return null
  }

  const dates: Date[] = []

  // 收集所有任务的开始和结束日期
  const collectDatesFromTask = (task: Task) => {
    if (task.startDate) {
      dates.push(new Date(task.startDate))
    }
    if (task.endDate) {
      dates.push(new Date(task.endDate))
    }

    // 递归处理子任务
    if (task.children && task.children.length > 0) {
      task.children.forEach(collectDatesFromTask)
    }
  }

  tasks.value.forEach(collectDatesFromTask)

  if (dates.length === 0) {
    return null
  }

  // 过滤有效日期
  const validDates = dates.filter(date => !isNaN(date.getTime()))

  if (validDates.length === 0) {
    return null
  }

  const minDate = new Date(Math.min(...validDates.map(date => date.getTime())))
  const maxDate = new Date(Math.max(...validDates.map(date => date.getTime())))

  return { minDate, maxDate }
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

  // 开始日期：任务最小开始日期-30天
  let startDate = new Date(minDate)
  startDate.setDate(startDate.getDate() - 30)

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
const hoveredTaskId = ref<number | null>(null)

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
    predecessorIds.forEach(id => {
      highlightedTaskIds.value.add(id)
    })
  }

  // 添加所有后置任务（找到所有把当前任务作为前置任务的任务）
  tasks.value.forEach(task => {
    if (task.predecessor) {
      const taskPredecessorIds = getPredecessorIds(task.predecessor)
      if (taskPredecessorIds.includes(taskId)) {
        highlightedTaskIds.value.add(task.id)
      }
    }
  })
}

// 拖拽状态管理
const isSplitterDragging = ref(false)

// 滚动状态管理
const isScrolledLeft = ref(false)
const isScrolledRight = ref(false)
const scrollProgress = ref(0)
const isScrolling = ref(false)
let scrollTimeout: number | null = null

// 粘性效果所需的滚动位置信息
const timelineScrollLeft = ref(0)
const timelineContainerWidth = ref(0)
const timelineScrollWidth = ref(0) // 缓存scrollWidth，避免在滚动事件中频繁读取造成强制重排

// 半圆气泡控制状态
const hideBubbles = ref(true) // 初始时隐藏半圆，等待初始滚动完成
const isInitialScrolling = ref(true) // 跟踪初始滚动状态
let hideBubblesTimeout: number | null = null // 半圆显示恢复定时器

// 虚拟滚动相关状态
const HOUR_WIDTH = 40 // 每小时40px
const VIRTUAL_BUFFER = 10 // 减少缓冲区以提升滑动性能

// 数据缓存
const timelineDataCache = new Map<string, unknown>()

// 初始化状态
const isInitialLoad = ref(true)

// 节流的容器宽度（用于虚拟滚动范围计算，避免每次微小变化都触发）
const throttledContainerWidth = ref(0)

// 计算小时视图的可视区域范围
const visibleHourRange = computed(() => {
  if (currentTimeScale.value !== TimelineScale.HOUR) {
    return { startHour: 0, endHour: 0 }
  }

  const scrollLeft = timelineScrollLeft.value
  const containerWidth = throttledContainerWidth.value || timelineContainerWidth.value

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

// 防抖处理滚动事件
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

// 优化的滚动处理器
const debouncedUpdatePositions = debounce(() => {
  computeAllMilestonesPositions()
}, 16) // 60fps

// 缓存时间轴数据的函数
const getCachedTimelineData = (): unknown => {
  const scale = currentTimeScale.value
  const startTime = timelineConfig.value.startDate.getTime()
  const endTime = timelineConfig.value.endDate.getTime()
  const key = `${scale}-${startTime}-${endTime}`

  if (!timelineDataCache.has(key)) {
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
    timelineDataCache.set(key, data)
  }

  return timelineDataCache.get(key) as unknown
}

// 获取虚拟滚动优化后的时间轴数据
const optimizedTimelineData = computed(() => {
  const cachedData = getCachedTimelineData() as any
  // 只在小时视图中应用虚拟滚动
  if (currentTimeScale.value === TimelineScale.HOUR && Array.isArray(cachedData)) {
    const { startHour, endHour } = visibleHourRange.value

    // 🚀 性能优化：只处理可见范围内的天数，而不是遍历全部365天
    const dayStart = new Date(timelineConfig.value.startDate)
    dayStart.setHours(0, 0, 0, 0)

    // 计算可见范围对应的起始和结束天数
    const startDay = Math.floor(startHour / 24)
    const endDay = Math.ceil(endHour / 24)

    // 只处理可见天数范围 + 少量缓冲
    const visibleDays = (cachedData as any[]).slice(
      Math.max(0, startDay - 1),
      Math.min(cachedData.length, endDay + 1),
    )

    return visibleDays
      .map((day: any, index: number) => {
        // 使用相对于切片起始的索引计算偏移
        const actualDayIndex = Math.max(0, startDay - 1) + index
        const totalHourOffset = actualDayIndex * 24

        // 计算当前天应该显示的小时范围
        const dayStartHour = Math.max(0, startHour - totalHourOffset)
        const dayEndHour = Math.min(day.hours.length, endHour - totalHourOffset)

        return {
          ...day,
          hours: dayStartHour < dayEndHour ? day.hours.slice(dayStartHour, dayEndHour) : [],
          // 全局小时偏移（相对于时间线开始的绝对位置）
          hourOffset: totalHourOffset + dayStartHour,
          // 当前天内的小时偏移
          visibleHourStart: dayStartHour,
          // 调试信息
          _debug: {
            totalHourOffset,
            dayStartHour,
            dayEndHour,
            visibleRange: { startHour, endHour },
            actualDayIndex,
          },
        }
      })
      .filter((day: any) => day.hours.length > 0)
  }

  return cachedData
})

// 计算完整时间线的总宽度（用于虚拟滚动容器）
const totalTimelineWidth = computed(() => {
  const cachedData = getCachedTimelineData() as any
  if (currentTimeScale.value === TimelineScale.HOUR) {
    if (Array.isArray(cachedData)) {
      // 计算总小时数
      const totalHours = (cachedData as any[]).reduce((total, day: any) => {
        return total + day.hours.length
      }, 0)
      return totalHours * HOUR_WIDTH
    }
  } else if (currentTimeScale.value === TimelineScale.QUARTER) {
    if (Array.isArray(cachedData)) {
      // 计算总季度数：每年4个季度，每个季度60px
      const totalQuarters = (cachedData as any[]).reduce((total, year: any) => {
        return total + year.quarters.length
      }, 0)
      return totalQuarters * 60
    }
  } else if (Array.isArray(cachedData)) {
    // 其他视图的宽度计算
    if (currentTimeScale.value === TimelineScale.WEEK) {
      const totalWeeks = cachedData.reduce((total, month: { weeks?: unknown[] }) => {
        return total + (month.weeks?.length || 0)
      }, 0)
      return totalWeeks * 60
    } else if (currentTimeScale.value === TimelineScale.MONTH) {
      return cachedData.length * 60
    } else if (currentTimeScale.value === TimelineScale.YEAR) {
      return cachedData.length * 360
    } else {
      // 日视图
      const totalDays = cachedData.reduce((total, month: { days?: unknown[] }) => {
        return total + (month.days?.length || 0)
      }, 0)
      return totalDays * 30
    }
  }
  return 0
})

// 使用 watch 同步计算出的时间轴宽度到 scrollWidth 缓存
// 避免读取 DOM 的 scrollWidth 属性
// 注意：不使用 immediate: true，避免在初始化时出现函数未定义的问题
// 会在 onMounted 中手动初始化一次
watch(totalTimelineWidth, (newWidth) => {
  timelineScrollWidth.value = newWidth
})

// 容器高度状态管理
const timelineBodyHeight = ref(0)
let resizeObserver: ResizeObserver | null = null
let containerResizeObserver: ResizeObserver | null = null

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

// 计算当前所有里程碑的位置信息
const computeAllMilestonesPositions = () => {
  const positions = new Map()

  // 遍历所有里程碑分组
  tasks.value.forEach(task => {
    if (task.type === 'milestone-group' && task.children) {
      task.children.forEach(milestone => {
        const milestoneDate = new Date(milestone.startDate || '')
        if (!isNaN(milestoneDate.getTime())) {
          const startDiff = Math.floor(
            (milestoneDate.getTime() - timelineConfig.value.startDate.getTime()) /
              (1000 * 60 * 60 * 24),
          )
          const left = startDiff * 30 + 30 / 2 - 12 // 30是dayWidth，12是图标半径

          // 计算边界粘性状态
          const iconLeft = left - 12
          const iconRight = left + 12
          const leftBoundary = timelineScrollLeft.value
          const rightBoundary = timelineScrollLeft.value + timelineContainerWidth.value

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
            originalLeft: left, // 保存原始位置
            isSticky,
            stickyPosition,
          })
        }
      })
    } else if (task.type === 'milestone') {
      const milestoneDate = new Date(task.startDate || '')
      if (!isNaN(milestoneDate.getTime())) {
        const startDiff = Math.floor(
          (milestoneDate.getTime() - timelineConfig.value.startDate.getTime()) /
            (1000 * 60 * 60 * 24),
        )
        const left = startDiff * 30 + 30 / 2 - 12

        // 计算边界粘性状态
        const iconLeft = left - 12
        const iconRight = left + 12
        const leftBoundary = timelineScrollLeft.value
        const rightBoundary = timelineScrollLeft.value + timelineContainerWidth.value

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
          originalLeft: left, // 保存原始位置
          isSticky,
          stickyPosition,
        })
      }
    }
  })

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

// 处理拖拽开始事件
const handleSplitterDragStart = () => {
  isSplitterDragging.value = true

  // ⚠️ 拖拽期间暂停ResizeObserver，避免高频触发
  // ResizeObserver已经在回调中检查isSplitterDragging，这里作为双重保护
}

// 处理拖拽结束事件
const handleSplitterDragEnd = () => {
  isSplitterDragging.value = false

  // Splitter拖拽结束后，强制重新计算半圆显示状态
  // 因为Timeline容器宽度可能发生了变化
  hideBubbles.value = true
  setTimeout(() => {
    hideBubbles.value = false
  }, 300) // 300ms后恢复半圆显示
}

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
const handleTaskRowHover = (taskId: number | null) => {
  // 如果正在拖拽Splitter，则不响应悬停事件
  if (isSplitterDragging.value) {
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
  // 每个任务行高度51px (50px + 1px border)
  const rowHeight = 51
  const taskCount = tasks.value.length
  const minHeightFromTasks = taskCount * rowHeight
  const minHeight = 400 // 最小高度确保有足够的空间

  // 返回任务高度、最小高度和容器高度中的最大值
  return Math.max(minHeightFromTasks, minHeight, timelineBodyHeight.value)
})

// 监听TaskList的悬停事件
const handleTaskListHover = (event: CustomEvent) => {
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
function generateTimelineData(): any {
  // 使用缓存版本提升性能
  return getCachedTimelineData()
}

// 清除缓存的函数
const clearTimelineCache = () => {
  timelineDataCache.clear()
}

// 生成日视图时间轴数据 (原有逻辑)
function generateDayTimelineData() {
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
function isWorkingHour(hour: number, dayOfWeek: number) {
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
function generateHourTimelineData() {
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
function generateWeekTimelineData() {
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

  allWeeks.forEach(week => {
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
  })

  // 转换为数组并排序
  const sortedMonths = Array.from(monthsMap.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })

  return sortedMonths
}

// 生成一周内的7个子列（用于精确定位）
function generateSubDaysForWeek(weekStart: Date) {
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
function isWeekContainsToday(weekStart: Date, weekEnd: Date) {
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
      }, 100)
    }, 50)
  })
}

// 判断是否为今天
function isToday(date: Date) {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

const timelineData = ref(generateTimelineData() as any)

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
  { deep: true },
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

  // 使用缓存的 timelineContainer 和 containerWidth，避免 querySelector 和 clientWidth 读取造成强制重排
  if (!timelineContainer.value) {
    // 容器未准备好，递归重试
    if (retry < 10) {
      setTimeout(() => scrollToTodayCenter(retry + 1), 60)
    }
    return
  }

  const containerWidth = timelineContainerWidth.value
  // 若宽度为0，说明 ResizeObserver 还未触发，递归重试，最多10次
  if (containerWidth === 0 && retry < 10) {
    setTimeout(() => scrollToTodayCenter(retry + 1), 60)
    return
  }

  // 计算将今日列置于中间的滚动位置
  const centeredScrollPosition = todayPosition - containerWidth / 2 + 15
  if (typeof timelineContainer.value.scrollTo === 'function') {
    timelineContainer.value.scrollTo({ left: Math.max(0, centeredScrollPosition), behavior: 'smooth' })
  } else {
    timelineContainer.value.scrollLeft = Math.max(0, centeredScrollPosition)
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

  // 找到所有任务的开始日期
  const startDates = tasks.value
    .map(task => task.startDate)
    .filter((date): date is string => Boolean(date))
    .map(date => new Date(date))

  if (startDates.length === 0) {
    scrollToToday()
    return
  }

  // 找到最早的开始日期
  const earliestDate = new Date(Math.min(...startDates.map(date => date.getTime())))

  // 计算该日期在时间轴中的位置
  const year = earliestDate.getFullYear()
  const month = earliestDate.getMonth()
  const day = earliestDate.getDate()

  let totalDays = 0
  for (let i = 0; i < month; i++) {
    totalDays += new Date(year, i + 1, 0).getDate()
  }
  totalDays += day

  // 使用缓存的容器宽度，避免强制重排
  const containerWidth = timelineContainerWidth.value || 400 // 默认值以防还未初始化
  const scrollPosition = (totalDays - 1) * 30 - containerWidth / 2

  // 使用缓存的 timelineContainer，避免 querySelector
  if (timelineContainer.value) {
    timelineContainer.value.scrollLeft = Math.max(0, scrollPosition)
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

  // 使用缓存的 timelineContainer 和 containerWidth，避免强制重排
  if (!timelineContainer.value) return

  const containerWidth = timelineContainerWidth.value

  // 计算居中滚动位置
  const centeredScrollPosition = todayPosition - containerWidth / 2 + 15

  // 滚动到指定位置，确保今日列在中间
  timelineContainer.value.scrollTo({
    left: Math.max(0, centeredScrollPosition),
    behavior: 'smooth',
  })

  // 添加今日高亮效果
  setTimeout(() => {
    const todayColumns = document.querySelectorAll('.day-column.today')
    todayColumns.forEach(column => {
      column.classList.add('today-highlight')
      // 2秒后移除高亮效果
      setTimeout(() => {
        column.classList.remove('today-highlight')
      }, 2000)
    })
  }, 500) // 等待滚动完成后再添加高亮
}

// 更新任务
const updateTask = (updatedTask: Task) => {
  // 不直接修改props数据，而是通过事件通知父组件
  // 触发全局事件，通知父组件更新数据
  window.dispatchEvent(
    new CustomEvent('task-updated', {
      detail: updatedTask,
    }),
  )
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

// 存储所有TaskBar的位置信息
const taskBarPositions = ref<
  Record<number, { left: number; top: number; width: number; height: number }>
>({})

// TaskBar渲染key，用于在容器变化时强制重新渲染
const taskBarRenderKey = ref(0)

const bodyContentRef = ref<HTMLElement | null>(null)
const svgWidth = ref(0)
const svgHeight = ref(0)

// ResizeObserver 用于监听 bodyContent 宽度变化
let bodyContentResizeObserver: ResizeObserver | null = null

// 缓存 bodyContent 的位置，避免频繁调用 getBoundingClientRect
const bodyContentPosition = ref({ left: 0, top: 0, timestamp: 0 })
const BODY_POSITION_CACHE_TTL = 100 // 100ms 缓存有效期

function updateSvgSize() {
  // 宽度已经通过 ResizeObserver 自动更新，这里只需要更新高度
  // 使用计算的内容高度，确保SVG覆盖所有任务行
  svgHeight.value = contentHeight.value
}

function handleBarMounted(payload: {
  id: number
  left: number
  top: number
  width: number
  height: number
}) {
  if (!bodyContentRef.value) return

  const now = Date.now()
  let baseLeft = 0
  let baseTop = 0

  // 检查缓存是否有效
  if (now - bodyContentPosition.value.timestamp < BODY_POSITION_CACHE_TTL) {
    // 使用缓存的位置
    baseLeft = bodyContentPosition.value.left
    baseTop = bodyContentPosition.value.top
  } else {
    // 缓存过期，读取 DOM 并更新缓存
    const baseRect = bodyContentRef.value.getBoundingClientRect()
    baseLeft = baseRect.left
    baseTop = baseRect.top

    bodyContentPosition.value = {
      left: baseLeft,
      top: baseTop,
      timestamp: now,
    }
  }

  // 统一坐标系：以bodyContent为基准
  taskBarPositions.value[payload.id] = {
    left: payload.left - baseLeft,
    top: payload.top - baseTop,
    width: payload.width,
    height: payload.height,
  }
  updateSvgSize()
}

// 向上传递 TaskBar 拖拽/拉伸事件
const handleTaskBarDragEnd = (updatedTask: Task) => {
  // 通过全局事件或 emit/props 回调传递给 GanttChart
  window.dispatchEvent(new CustomEvent('taskbar-drag-end', { detail: updatedTask }))
}
const handleTaskBarResizeEnd = (updatedTask: Task) => {
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

    // 使用缓存的值避免强制重排
    const maxScrollLeft = timelineScrollWidth.value - timelineContainerWidth.value
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

// 计算所有连线
const links = computed(() => {
  const result: { from: number; to: number; path: string }[] = []

  // 获取当前渲染的任务ID集合，用于过滤关系线
  const currentTaskIds = new Set(tasks.value.map(task => task.id))

  for (const task of tasks.value) {
    if (task.predecessor && taskBarPositions.value[task.id]) {
      // 获取所有前置任务ID
      const predecessorIds = getPredecessorIds(task.predecessor)

      // 为每个前置任务创建连线
      for (const predecessorId of predecessorIds) {
        // 只有当前置任务也在当前渲染列表中时，才绘制关系线
        if (taskBarPositions.value[predecessorId] && currentTaskIds.has(predecessorId)) {
          const fromBar = taskBarPositions.value[predecessorId]
          const toBar = taskBarPositions.value[task.id]

          // 计算高亮状态下的Y轴偏移
          const fromIsHighlighted = highlightedTaskIds.value.has(predecessorId)
          const fromIsPrimary = highlightedTaskId.value === predecessorId
          const toIsHighlighted = highlightedTaskIds.value.has(task.id)
          const toIsPrimary = highlightedTaskId.value === task.id

          // 高亮偏移量：primary-highlight -8px, highlighted -5px
          const fromYOffset = fromIsPrimary ? -8 : (fromIsHighlighted ? -5 : 0)
          const toYOffset = toIsPrimary ? -8 : (toIsHighlighted ? -5 : 0)

          // 起点为前置TaskBar右侧中点，终点为当前TaskBar左侧中点
          const x1 = fromBar.left + fromBar.width
          const y1 = fromBar.top + fromBar.height / 2 + fromYOffset
          const x2 = toBar.left
          const y2 = toBar.top + toBar.height / 2 + toYOffset
          // 控制点：横向中点，纵向分别为起点和终点
          const c1x = x1 + 40
          const c1y = y1
          const c2x = x2 - 40
          const c2y = y2
          // 三次贝塞尔曲线
          const path = `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`
          result.push({ from: predecessorId, to: task.id, path })
        }
      }
    }
  }
  return result
})

onMounted(() => {
  // 初始化 timelineScrollWidth
  timelineScrollWidth.value = totalTimelineWidth.value

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

  // 设置ResizeObserver监听timeline-body的尺寸变化
  nextTick(() => {
    const timelineBody = document.querySelector('.timeline-body') as HTMLElement
    const timelineContainer = document.querySelector('.timeline') as HTMLElement
    if (timelineBody) {
      // 使用ResizeObserver自动更新高度，避免直接读取clientHeight造成强制重排
      resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          timelineBodyHeight.value = entry.contentRect.height
        }
      })

      resizeObserver.observe(timelineBody)
    }

    // 初始化滚动位置信息，使用正确的滚动容器
    if (timelineContainer) {
      // 使用ResizeObserver自动更新容器宽度，避免直接读取clientWidth造成强制重排
      // scrollLeft在第一次scroll事件时会自动更新，这里不需要初始化

      // 为容器宽度变化创建独立的ResizeObserver
      containerResizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const newWidth = entry.contentRect.width

          // 当容器宽度发生变化时，立即更新宽度
          // ⚠️ 即使在拖拽期间也要更新，因为TaskBar需要实时响应containerWidth变化
          if (Math.abs(newWidth - timelineContainerWidth.value) > 1) {
            timelineContainerWidth.value = newWidth

            // scrollWidth 会在下一次滚动事件中自动更新
            // 不在这里读取，避免触发强制重排

            // ⚠️ 拖拽期间不触发半圆隐藏/显示动画，避免闪烁
            if (!isSplitterDragging.value) {
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
        }
      })
      containerResizeObserver.observe(timelineContainer)

      // 将容器ResizeObserver也存储起来，用于清理
      if (!resizeObserver) {
        resizeObserver = containerResizeObserver
      }

      // 监听bodyContent宽度变化，避免在updateSvgSize中读取offsetWidth造成强制重排
      if (bodyContentRef.value) {
        bodyContentResizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            svgWidth.value = entry.contentRect.width
          }
        })
        bodyContentResizeObserver.observe(bodyContentRef.value)
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
  const timelineBody = document.querySelector('.timeline-body') as HTMLElement
  if (timelineBody && Math.abs(timelineBody.scrollTop - scrollTop) > 1) {
    // 使用更精确的比较，避免1px以内的细微差异导致的循环触发
    timelineBody.scrollTop = scrollTop
  }
}

// 处理Timeline body的垂直滚动同步
const handleTimelineBodyScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target) return

  const scrollTop = target.scrollTop

  // 同步垂直滚动到TaskList
  if (scrollTop >= 0) {
    window.dispatchEvent(
      new CustomEvent('timeline-vertical-scroll', {
        detail: { scrollTop },
      }),
    )
  }
}

// 监听任务数量变化，更新SVG尺寸
watch(
  () => tasks.value.length,
  () => {
    nextTick(() => {
      updateSvgSize()
    })
  },
  { immediate: true },
)

// 拖拽滑动相关状态
const isDragging = ref(false)
const startX = ref(0)
const startScrollLeft = ref(0)
const timelineContainer = ref<HTMLElement | null>(null)

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
  startScrollLeft.value = timelineContainer.value?.scrollLeft || 0

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

// 鼠标移动时拖拽滑动
const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value || !timelineContainer.value) return

  event.preventDefault()
  const x = event.pageX
  const walk = (x - startX.value) * 1.5 // 拖拽速度倍数
  timelineContainer.value.scrollLeft = startScrollLeft.value - walk
}

// 鼠标抬起结束拖拽
const handleMouseUp = () => {
  isDragging.value = false

  if (timelineContainer.value) {
    timelineContainer.value.style.cursor = 'grab'
    timelineContainer.value.style.userSelect = 'auto'
  }

  // 移除全局事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// 检测滚动状态（主要处理水平滚动）
const handleTimelineScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target) return

  // 使用缓存的值避免强制重排，只读取scrollLeft（这是滚动事件必需的）
  const scrollLeft = target.scrollLeft
  const scrollWidth = timelineScrollWidth.value
  const clientWidth = timelineContainerWidth.value
  const maxScroll = scrollWidth - clientWidth

  // 立即更新关键滚动位置信息（用于虚拟滚动）
  timelineScrollLeft.value = scrollLeft
  // timelineContainerWidth 已经通过ResizeObserver更新，这里不需要再次赋值

  // 标记初始化完成（第一次滚动后）
  if (isInitialLoad.value && scrollLeft > 0) {
    isInitialLoad.value = false
  }

  // 小时视图简化处理
  if (currentTimeScale.value === TimelineScale.HOUR) {
    // 只设置滚动状态，跳过其他计算
    isScrolling.value = true

    // 清除之前的定时器
    if (scrollTimeout) {
      clearTimeout(scrollTimeout)
    }

    // 较短的滚动状态重置时间
    scrollTimeout = setTimeout(() => {
      isScrolling.value = false
    }, 200)
    return
  }

  // 其他视图的完整处理
  scrollProgress.value = maxScroll > 0 ? scrollLeft / maxScroll : 0
  isScrolledLeft.value = scrollLeft > 20
  isScrolledRight.value = scrollLeft < maxScroll - 20

  isScrolling.value = true
  if (target && 'classList' in target && typeof target.classList.add === 'function') {
    target.classList.add('scrolling')
  }

  debouncedUpdatePositions()

  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }

  scrollTimeout = setTimeout(() => {
    isScrolling.value = false
    if (target && 'classList' in target && typeof target.classList.remove === 'function') {
      target.classList.remove('scrolling')
    }
  }, 500)
}

// 边界自动滚动功能
const startAutoScroll = (direction: 'left' | 'right') => {
  if (isAutoScrolling.value || !timelineContainer.value) return

  isAutoScrolling.value = true

  const scroll = () => {
    if (!timelineContainer.value || !isAutoScrolling.value) return

    const currentScrollLeft = timelineContainer.value.scrollLeft
    // 使用缓存的值避免强制重排
    const maxScrollLeft = timelineScrollWidth.value - timelineContainerWidth.value

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
  const { mouseX, isDragging: dragState } = event.detail

  if (!dragState || !timelineContainer.value) {
    stopAutoScroll()
    return
  }

  const containerRect = timelineContainer.value.getBoundingClientRect()
  const relativeX = mouseX - containerRect.left

  // 检查是否在左边界滚动区域
  if (relativeX <= EDGE_SCROLL_ZONE && timelineContainer.value.scrollLeft > 0) {
    startAutoScroll('left')
  } else if (
    relativeX >= containerRect.width - EDGE_SCROLL_ZONE &&
    timelineContainer.value.scrollLeft < timelineScrollWidth.value - timelineContainerWidth.value
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

  // 清理ResizeObserver
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  // 清理bodyContentResizeObserver
  if (bodyContentResizeObserver) {
    bodyContentResizeObserver.disconnect()
    bodyContentResizeObserver = null
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

// 月度视图中按年份分组的计算属性
const groupMonthsByYear = computed(() => {
  if (currentTimeScale.value !== TimelineScale.MONTH) {
    return {}
  }

  const groups: Record<number, unknown[]> = {}

  ;(timelineData.value as unknown[]).forEach((month: unknown) => {
    const monthObj = month as Record<string, unknown>
    const monthYear = monthObj.year as number
    if (!groups[monthYear]) {
      groups[monthYear] = []
    }
    groups[monthYear].push(month)
  })

  return groups
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

// 监听tasks变化，重新计算里程碑位置
watch(tasks, computeAllMilestonesPositions, { immediate: true, deep: true })

// 监听tasks数据变化，当从空变为有数据时重新计算时间范围
watch(
  () => tasks.value?.length,
  (newLength, oldLength) => {
    // 当任务从无到有时，重新计算时间范围
    if (oldLength === 0 && newLength > 0) {
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
        // 清除缓存，确保使用新的日期范围
        clearTimelineCache()

        isUpdatingTimelineConfig = true
        timelineConfig.value.startDate = newRange.startDate
        timelineConfig.value.endDate = newRange.endDate
        isUpdatingTimelineConfig = false

        // 重新生成时间线数据
        timelineData.value = generateTimelineData()
      }
    }
  },
)

// 监听滚动变化，重新计算里程碑位置
watch([timelineScrollLeft, timelineContainerWidth], () => {
  // 拖拽 splitter 时跳过计算
  if (isSplitterDragging.value) return
  computeAllMilestonesPositions()
})

// 监听容器宽度变化，重新计算时间线范围以填充容器
watch(
  timelineContainerWidth,
  (newWidth, oldWidth) => {
    // ⚠️ 拖拽 splitter 时跳过重新计算，避免频繁生成 timelineData
    if (isSplitterDragging.value) return
    // 只在容器宽度从 0 变为有效值，或容器宽度发生显著变化时重新计算
    if (!oldWidth || oldWidth === 0 || Math.abs(newWidth - oldWidth) > 50) {
      if (newWidth > 0) {
        // 根据当前时间刻度重新计算范围
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
        // 如果计算出新范围，更新配置并重新生成数据
        if (newRange) {
          // 清除缓存，确保使用新的日期范围
          clearTimelineCache()

          isUpdatingTimelineConfig = true
          timelineConfig.value.startDate = newRange.startDate
          timelineConfig.value.endDate = newRange.endDate
          isUpdatingTimelineConfig = false

          // 重新生成时间线数据
          timelineData.value = generateTimelineData()
        }
      }
    }
  },
  { immediate: true },
)

// ⚠️ 监听timelineData变化，强制TaskBar重新渲染以更新关系线位置
// 注意：只监听timelineData，不监听timelineContainerWidth
// 因为TaskBar会通过computed自动响应containerWidth变化，不需要强制重新渲染
watch(timelineData, () => {
  // 拖拽 splitter 时跳过 TaskBar 重新渲染
  if (isSplitterDragging.value) return

  // 清空位置信息
  taskBarPositions.value = {}
  // 更新渲染key强制TaskBar重新渲染
  taskBarRenderKey.value++
  // 延迟更新SVG尺寸
  nextTick(() => {
    setTimeout(() => {
      updateSvgSize()
    }, 100)
  })
})

// 监听tasks变化，清理不再存在的任务的位置信息
watch(
  () => tasks.value,
  newTasks => {
    const currentTaskIds = new Set(newTasks.map(task => task.id))

    // 清理不再存在的任务的位置信息
    Object.keys(taskBarPositions.value).forEach(taskIdStr => {
      const taskId = parseInt(taskIdStr)
      if (!currentTaskIds.has(taskId)) {
        delete taskBarPositions.value[taskId]
      }
    })
  },
  { deep: true },
)

// 处理里程碑点击定位事件
const handleMilestoneClickLocate = (event: CustomEvent) => {
  const { scrollLeft, smooth } = event.detail

  // 使用缓存的timelineContainer，避免querySelector
  if (timelineContainer.value) {
    // 使用缓存的值避免强制重排
    const maxScrollLeft = timelineScrollWidth.value - timelineContainerWidth.value
    const targetScrollLeft = Math.min(Math.max(0, scrollLeft), maxScrollLeft)

    if (smooth) {
      // 平滑滚动
      timelineContainer.value.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth',
      })
    } else {
      // 立即滚动
      timelineContainer.value.scrollLeft = targetScrollLeft
    }
  }
}

// 生成月度视图时间轴数据
function generateMonthTimelineData() {
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
function generateQuarterTimelineData() {
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
function isQuarterContainsToday(startDate: Date, endDate: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today >= startDate && today <= endDate
}

// 生成年度视图时间轴数据
function generateYearTimelineData() {
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

          <!-- 月份1号标记旗帜 - 统一放在外层容器 -->
          <template
            v-for="(month, monthIndex) in timelineData"
            :key="`flags-${month.year}-${month.month}`"
          >
            <template v-if="month.isWeekView && month.weeks">
              <template
                v-for="(week, weekIndex) in month.weeks"
                :key="`flag-${month.year}-${month.month}-${weekIndex}`"
              >
                <template
                  v-for="(subDay, dayIndex) in week.subDays || []"
                  :key="`flagday-${monthIndex}-${weekIndex}-${dayIndex}`"
                >
                  <div
                    v-if="subDay.date && subDay.date.getDate() === 1"
                    class="month-first-flag"
                    :style="{
                      left: `${
                        getGlobalWeekPosition(monthIndex, weekIndex) + dayIndex * (60 / 7)
                      }px`,
                      transform: 'translateX(-50%)', // 使旗帜中心（杆子）对齐日期位置
                    }"
                  >
                    <div class="flag-pole"></div>
                    <div class="flag-content">{{ subDay.date.getDate() }}</div>
                  </div>
                </template>
              </template>
            </template>
          </template>
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
                <!-- 7个子列，用于精确定位，不显示边框 -->
                <div class="week-sub-days">
                  <div
                    v-for="(_, index) in week.subDays || []"
                    :key="`subday-${index}`"
                    class="week-sub-day"
                  ></div>
                </div>
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
        <!-- SVG关系线层 -->
        <svg
          class="gantt-links"
          :width="svgWidth"
          :height="svgHeight"
          :style="{
            position: 'absolute',
            left: 0,
            top: 0,
            zIndex: highlightedTaskId !== null ? 1001 : 25,
            pointerEvents: 'none',
          }"
        >
          <defs>
            <marker
              id="arrow"
              markerWidth="4"
              markerHeight="4"
              refX="4"
              refY="2"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0,0 4,2 0,4" fill="#c0c4cc" />
            </marker>
            <marker
              id="arrow-highlighted"
              markerWidth="4"
              markerHeight="4"
              refX="4"
              refY="2"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0,0 4,2 0,4" fill="#409eff" />
            </marker>
          </defs>
          <g>
            <path
              v-for="link in links"
              :key="link.from + '-' + link.to"
              :d="link.path"
              :stroke="
                highlightedTaskIds.has(link.from) && highlightedTaskIds.has(link.to)
                  ? '#409eff'
                  : '#c0c4cc'
              "
              :stroke-width="
                highlightedTaskIds.has(link.from) && highlightedTaskIds.has(link.to) ? 4 : 2
              "
              :stroke-opacity="
                highlightedTaskId !== null &&
                !(highlightedTaskIds.has(link.from) && highlightedTaskIds.has(link.to))
                  ? 0.2
                  : 1
              "
              stroke-dasharray="6,4"
              fill="none"
              :marker-end="
                highlightedTaskIds.has(link.from) && highlightedTaskIds.has(link.to)
                  ? 'url(#arrow-highlighted)'
                  : 'url(#arrow)'
              "
              :style="{
                filter:
                  highlightedTaskIds.has(link.from) && highlightedTaskIds.has(link.to)
                    ? 'drop-shadow(0 2px 4px rgba(64, 158, 255, 0.4))'
                    : 'none',
                transition: 'all 0.3s ease',
              }"
            />
          </g>
        </svg>

        <!-- 年度视图今日标记线 -->
        <div
          v-if="isTodayVisibleInYearView && getTodayLinePositionInYearView >= 0"
          class="today-line-year-view"
          :style="{
            left: `${getTodayLinePositionInYearView}px`,
            height: `${contentHeight}px`,
          }"
        ></div>

        <!-- 月份1号竖直线（周视图） -->
        <template v-if="currentTimeScale === TimelineScale.WEEK">
          <template
            v-for="(month, monthIndex) in timelineData"
            :key="`vlines-${month.year}-${month.month}`"
          >
            <template v-if="month.isWeekView && month.weeks">
              <template
                v-for="(week, weekIndex) in month.weeks"
                :key="`vline-${month.year}-${month.month}-${weekIndex}`"
              >
                <template
                  v-for="(subDay, dayIndex) in week.subDays || []"
                  :key="`vlineday-${monthIndex}-${weekIndex}-${dayIndex}`"
                >
                  <div
                    v-if="subDay.date && subDay.date.getDate() === 1"
                    class="month-first-vertical-line"
                    :style="{
                      left: `${
                        getGlobalWeekPosition(monthIndex, weekIndex) + dayIndex * (60 / 7)
                      }px`,
                      height: `${contentHeight}px`,
                    }"
                  ></div>
                </template>
              </template>
            </template>
          </template>
        </template>

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

              <!-- 周视图背景列 -->
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
                    :style="{ height: `${contentHeight}px`, width: '8.57px' }"
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
            <div
              v-for="(task, index) in tasks"
              :key="task.id"
              class="task-row"
              :class="{ 'task-row-hovered': hoveredTaskId === task.id }"
              :style="{ top: `${index * 51}px` }"
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
                  currentTimeScale === TimelineScale.HOUR ? [] : timelineData
                "
                :current-time-scale="currentTimeScale"
                :task-bar-config="props.taskBarConfig"
                :allow-drag-and-resize="props.allowDragAndResize && !isInHighlightMode"
                :is-highlighted="highlightedTaskIds.has(task.id)"
                :is-primary-highlight="highlightedTaskId === task.id"
                :is-in-highlight-mode="isInHighlightMode"
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
                @long-press="setHighlightTask"
              >
                <template v-if="$slots['custom-task-content']" #custom-task-content="barScope">
                  <slot name="custom-task-content" v-bind="barScope" />
                </template>
              </TaskBar>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../styles/theme-variables.css';

.timeline {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--gantt-bg-primary, #ffffff);
  overflow-x: auto;
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
  display: flex;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.week-sub-day {
  flex: 1;
  height: 100%;
  box-sizing: border-box;
  /* 每个子天的宽度为 60px / 7 ≈ 8.57px */
  width: 8.57px;
  /* 不显示边框，仅用于定位计算 */
}

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
:global(html[data-theme='dark']) .flag-pole {
  background-color: var(--gantt-primary-light, #66b1ff);
}

:global(html[data-theme='dark']) .flag-content {
  background-color: var(--gantt-primary-light, #66b1ff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

/* 月份1号竖直线样式 */
.month-first-vertical-line {
  position: absolute;
  top: 0;
  width: 1px;
  background-color: var(--gantt-primary, #409eff);
  opacity: 0.6;
  z-index: 5;
  pointer-events: none;
}

/* 暗色主题下的竖直线 */
:global(html[data-theme='dark']) .month-first-vertical-line {
  background-color: var(--gantt-primary-light, #66b1ff);
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
  display: flex;
  align-items: stretch;
}

.week-column:last-child {
  border-right: none;
}

.week-column.today {
  background-color: rgba(64, 158, 255, 0.1);
}

.sub-day-column {
  position: relative;
  box-sizing: border-box;
  /* 子列不显示边框，仅用于定位 */
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
  overflow: auto;
  position: relative;
  width: fit-content;
  background: var(--gantt-bg-primary, #ffffff);
  cursor: grab;
  transition: background-color 0.3s ease;

  /* Webkit浏览器滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: var(--gantt-scrollbar-thumb) transparent;
}

.timeline-body:active {
  cursor: grabbing;
}

.timeline-body::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.timeline-body::-webkit-scrollbar-track {
  background: transparent;
}

.timeline-body::-webkit-scrollbar-thumb {
  background-color: var(--gantt-scrollbar-thumb);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.timeline-body::-webkit-scrollbar-thumb:hover {
  background-color: var(--gantt-scrollbar-thumb-hover);
}

.timeline-body::-webkit-scrollbar-corner {
  background: transparent;
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
  height: 51px; /** 为了对齐左侧的Task List Row高度，同时需要包含List Row的Bottom Border 1px */
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
:global(html[data-theme='dark']) .timeline {
  background: var(--gantt-bg-primary, #3a3a3a) !important;
  color: var(--gantt-text-primary, #e5e5e5) !important;
}

:global(html[data-theme='dark']) .timeline-header {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
}

:global(html[data-theme='dark']) .timeline-header-row {
  border-bottom-color: var(--gantt-border-medium, #333333) !important;
}

:global(html[data-theme='dark']) .timeline-month {
  border-right-color: var(--gantt-border-medium, #333333) !important;
}

:global(html[data-theme='dark']) .year-month-label {
  color: var(--gantt-text-header, #ffffff) !important;
}

:global(html[data-theme='dark']) .timeline-day {
  border-right-color: var(--gantt-border-light, #555555) !important;
}

:global(html[data-theme='dark']) .timeline-day.today {
  background: #1a365d !important;
  color: #e3f2fd !important;
}

:global(html[data-theme='dark']) .timeline-day.weekend {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
  color: var(--gantt-text-muted, #b0b0b0) !important;
}

:global(html[data-theme='dark']) .day-label {
  color: var(--gantt-text-header, #ffffff) !important;
}

:global(html[data-theme='dark']) .timeline-body {
  background: var(--gantt-bg-primary, #6b6b6b) !important;
}

:global(html[data-theme='dark']) .timeline-body-content {
  background: var(--gantt-bg-primary, #6b6b6b) !important;
}

:global(html[data-theme='dark']) .day-columns {
  border-right-color: var(--gantt-border-light, #555555) !important;
}

:global(html[data-theme='dark']) .month-day-columns {
  border-right-color: var(--gantt-border-light, #555555) !important;
}

:global(html[data-theme='dark']) .day-column {
  border-right-color: var(--gantt-border-light, #555555) !important;
  /* 非周末列：透明背景，继承timeline-body的背景色 */
}

:global(html[data-theme='dark']) .day-column.today {
  border-left-color: var(--gantt-primary, #409eff) !important;
  background-color: var(--gantt-primary, #409eff) !important;
}

:global(html[data-theme='dark']) .day-column.today::before {
  background: linear-gradient(
    to bottom,
    rgba(64, 158, 255, 0.15) 0%,
    rgba(64, 158, 255, 0.08) 50%,
    rgba(64, 158, 255, 0.15) 100%
  ) !important;
}

:global(html[data-theme='dark']) .day-column.today.weekend {
  background-color: var(--gantt-primary-color, #409eff) !important;
}

/* 暗色主题下的今日定位高亮效果 */
:global(html[data-theme='dark']) .day-column.today-highlight {
  background-color: var(--gantt-primary-color, #409eff) !important;
  box-shadow: 0 0 8px rgba(64, 158, 255, 0.6) !important;
}

:global(html[data-theme='dark']) .day-column.today-highlight::before {
  background: linear-gradient(
    to bottom,
    rgba(64, 158, 255, 0.4) 0%,
    rgba(64, 158, 255, 0.25) 50%,
    rgba(64, 158, 255, 0.4) 100%
  ) !important;
}

/* 暗黑模式下的任务行悬停效果 */
:global(html[data-theme='dark']) .timeline-body .task-row-hovered {
  background-color: var(--gantt-bg-hover) !important; /* 与TaskList保持一致，使用透明背景 */
  /* 降低层级，避免覆盖任务条等元素 */
  z-index: 11 !important;
}

/* 确保暗黑模式下子元素能继续响应事件 */
:global(html[data-theme='dark']) .timeline-body .task-row-hovered > * {
  pointer-events: auto !important;
}

/* 暗黑模式下的非工作时间样式 */
:global(html[data-theme='dark']) .timeline-hour-item.non-working-hour {
  background-color: var(--gantt-bg-secondary, #1a1a1a) !important;
}

:global(html[data-theme='dark']) .timeline-hour-item.non-working-hour .hour-label {
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
:global(html[data-theme='dark']) .year-row {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
  border-bottom-color: var(--gantt-border-medium, #333333) !important;
}

:global(html[data-theme='dark']) .timeline-year {
  border-right-color: var(--gantt-border-medium, #333333) !important;
}

:global(html[data-theme='dark']) .year-label {
  color: var(--gantt-text-header, #ffffff) !important;
}

:global(html[data-theme='dark']) .months-row {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
  border-bottom-color: var(--gantt-border-medium, #333333) !important;
}

:global(html[data-theme='dark']) .timeline-month-item {
  border-right-color: var(--gantt-border-light, #555555) !important;
  border-bottom-color: var(--gantt-border-light, #555555) !important;
}

:global(html[data-theme='dark']) .timeline-month-item.today {
  background-color: var(--gantt-primary);
  border-left-color: var(--gantt-primary, #409eff) !important;
}

:global(html[data-theme='dark']) .month-label {
  color: var(--gantt-text-header, #ffffff) !important;
}

/* 季度视图暗色主题样式 */
:global(html[data-theme='dark']) .quarters-row {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
  border-bottom-color: var(--gantt-border-medium, #333333) !important;
}

:global(html[data-theme='dark']) .timeline-quarter-item {
  border-right-color: var(--gantt-border-light, #555555) !important;
  border-bottom-color: var(--gantt-border-light, #555555) !important;
}

:global(html[data-theme='dark']) .timeline-quarter-item.today {
  background-color: var(--gantt-primary);
  border-left-color: var(--gantt-primary, #409eff) !important;
}

:global(html[data-theme='dark']) .quarter-label {
  color: var(--gantt-text-header, #ffffff) !important;
}

:global(html[data-theme='dark']) .quarter-column {
  border-right-color: var(--gantt-border-light, #555555) !important;
  background-color: var(--gantt-bg-primary, #6b6b6b) !important;
}

:global(html[data-theme='dark']) .quarter-column.today {
  background-color: var(--gantt-primary, #409eff) !important;
}

:global(html[data-theme='dark']) .month-column {
  border-right-color: var(--gantt-border-light, #555555) !important;
}

:global(html[data-theme='dark']) .month-column.today {
  background-color: var(--gantt-primary-color, #409eff);
  border-left-color: var(--gantt-primary-color, #409eff) !important;
}

/* 年度视图暗色主题样式 */
:global(html[data-theme='dark']) .half-years-row {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
  border-bottom-color: var(--gantt-border-medium, #333333) !important;
}

:global(html[data-theme='dark']) .timeline-half-year-item {
  border-right-color: var(--gantt-border-light, #555555) !important;
  border-bottom-color: var(--gantt-border-light, #555555) !important;
}

:global(html[data-theme='dark']) .half-year-label {
  color: var(--gantt-text-header, #ffffff) !important;
}

/* 年度视图背景列暗色主题样式 */
:global(html[data-theme='dark']) .half-year-column {
  border-right-color: var(--gantt-border-light, #555555) !important;
  background-color: var(--gantt-bg-primary, #6b6b6b) !important;
}

:global(html[data-theme='dark']) .half-year-column:hover {
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
:global(html[data-theme='dark']) .today-line-year-view {
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
:global(html[data-theme='dark']) .date-row {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
  border-bottom-color: var(--gantt-border-medium, #333333) !important;
}

:global(html[data-theme='dark']) .timeline-day-item {
  border-right-color: var(--gantt-border-medium, #333333) !important;
}

:global(html[data-theme='dark']) .date-label {
  color: var(--gantt-text-header, #ffffff) !important;
}

:global(html[data-theme='dark']) .hours-row {
  background: var(--gantt-bg-secondary, #1a1a1a) !important;
  border-bottom-color: var(--gantt-border-medium, #333333) !important;
}

:global(html[data-theme='dark']) .timeline-hour-item {
  border-right-color: var(--gantt-border-light, #555555) !important;
  border-bottom-color: var(--gantt-border-light, #555555) !important;
}

:global(html[data-theme='dark']) .timeline-hour-item.today {
  background-color: var(--gantt-primary, #1a365d) !important;
  color: var(--gantt-text-white, #e3f2fd) !important;
}

:global(html[data-theme='dark']) .hour-label {
  color: var(--gantt-text-primary, #e5e5e5) !important;
}

:global(html[data-theme='dark']) .timeline-hour-item.today .hour-label {
  color: var(--gantt-text-white, #e3f2fd) !important;
}

:global(html[data-theme='dark']) .hour-column {
  border-right-color: var(--gantt-border-light, #555555) !important;
}

:global(html[data-theme='dark']) .hour-column.weekend {
  background-color: var(--gantt-bg-secondary, #1a1a1a) !important;
}

:global(html[data-theme='dark']) .hour-column.rest-hour {
  background-color: var(--gantt-bg-secondary, #1a1a1a) !important;
}

:global(html[data-theme='dark']) .hour-column.working-hour {
  background-color: var(--gantt-bg-primary, #6b6b6b) !important;
}

:global(html[data-theme='dark']) .hour-column.today {
  background-color: var(--gantt-primary-color, #409eff) !important;
  border-left-color: var(--gantt-primary-color, #409eff) !important;
}

/* 暗色主题：15分钟刻度线样式 */
:global(html[data-theme='dark']) .quarter-line {
  background-color: var(--gantt-border-light, #555555) !important;
}
</style>

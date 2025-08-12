<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import TaskBar from './TaskBar.vue'
import MilestonePoint from './MilestonePoint.vue'
import MilestoneDialog from './MilestoneDialog.vue'
import { useI18n } from '../composables/useI18n'
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
  milestones?: Task[]
  // TaskBar双击事件处理器API
  onTaskDoubleClick?: (task: Task) => void
  // 自定义编辑组件
  editComponent?: unknown
  // 是否使用默认的TaskDrawer
  useDefaultDrawer?: boolean
  // 自定义删除处理器
  onTaskDelete?: (task: Task, deleteChildren?: boolean) => void
  // 里程碑保存事件处理器
  onMilestoneSave?: (milestone: Task) => void
  // 新增：外部传入的时间轴起止
  startDate?: Date | string
  endDate?: Date | string
}

const props = withDefaults(defineProps<Props>(), {
  tasks: () => [],
  milestones: () => [],
  onTaskDoubleClick: undefined,
  editComponent: undefined,
  useDefaultDrawer: true,
  onTaskDelete: undefined,
  onMilestoneSave: undefined,
  startDate: undefined, // 明确给默认值
  endDate: undefined, // 明确给默认值
})

// 定义emits
const emit = defineEmits<{
  'timeline-scale-changed': [scale: TimelineScale]
  'edit-task': [task: Task]
  'start-timer': [task: Task]
  'stop-timer': [task: Task]
  'add-predecessor': [task: Task] // 新增：添加前置任务事件
  'add-successor': [task: Task] // 新增：添加后置任务事件
  delete: [task: Task, deleteChildren?: boolean]
}>()

// 多语言
const { formatYearMonth, formatMonth } = useI18n()

// 获取以今天为中心的时间线范围
const getTodayCenteredRange = () => {
  const today = new Date()

  // 计算开始日期：今天往前6个月的月初
  const startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1)

  // 计算结束日期：今天往后6个月的月末
  const endDate = new Date(today.getFullYear(), today.getMonth() + 6 + 1, 0) // +1后再设为0，得到当月最后一天

  return {
    startDate,
    endDate,
  }
}

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
  timelineConfig.value.startDate = newStart
  timelineConfig.value.endDate = newEnd
})

// 使用props传入的任务和里程碑数据
const tasks = computed(() => props.tasks || [])

// 根据时间刻度计算每日宽度
const dayWidth = computed(() => {
  if (currentTimeScale.value === TimelineScale.WEEK) {
    // 周视图：每周60px，分7天，每天约8.57px
    return 60 / 7
  } else if (currentTimeScale.value === TimelineScale.MONTH) {
    // 月视图：动态计算，基于当前月的实际天数
    // 这里返回一个平均值，具体定位时会根据每个月的实际天数重新计算
    return 2 // 月视图下每天约2px（60px/30天的平均值）
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

// 获取月度视图的时间范围（任务最小开始日期-2年 ~ 任务最大结束日期+2年）
const getMonthTimelineRange = () => {
  const taskRange = getTasksDateRange()

  if (!taskRange) {
    // 如果没有任务，使用当前日期为中心的范围
    const today = new Date()
    const startDate = new Date(today.getFullYear() - 2, 0, 1) // 当前年-2年的1月1日
    const endDate = new Date(today.getFullYear() + 2, 11, 31) // 当前年+2年的12月31日
    return { startDate, endDate }
  }

  const { minDate, maxDate } = taskRange

  // 开始日期：任务最小开始日期-2年，月初
  const startDate = new Date(minDate.getFullYear() - 2, 0, 1)

  // 结束日期：任务最大结束日期+2年，月末
  const endDate = new Date(maxDate.getFullYear() + 2, 11, 31)

  return { startDate, endDate }
}

// 里程碑对话框状态管理
const milestoneDialogVisible = ref(false)
const currentMilestone = ref<Milestone | null>(null)

// 悬停状态管理
const hoveredTaskId = ref<number | null>(null)

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

// 半圆气泡控制状态
const hideBubbles = ref(true) // 初始时隐藏半圆，等待初始滚动完成
const isInitialScrolling = ref(true) // 跟踪初始滚动状态

// 容器高度状态管理
const timelineBodyHeight = ref(0)
let resizeObserver: ResizeObserver | null = null

// 里程碑位置信息管理（用于推挤效果）
const milestonePositions = ref<
  Map<
    string | number,
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
              (1000 * 60 * 60 * 24)
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
            (1000 * 60 * 60 * 24)
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
const getOtherMilestonesInfo = (currentId: string | number) => {
  const result: Array<{
    id: string | number
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

  // 延迟恢复显示，确保容器变化完全生效
  setTimeout(() => {
    hideBubbles.value = false
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
    })
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
  currentMilestone.value = milestone
  milestoneDialogVisible.value = true
}

// 关闭里程碑对话框
const closeMilestoneDialog = () => {
  milestoneDialogVisible.value = false
  currentMilestone.value = null
}

// 处理里程碑图标变更
const handleMilestoneIconChange = (milestoneId: number, icon: string) => {
  // 不直接修改props数据，而是通过事件通知父组件更新
  window.dispatchEvent(
    new CustomEvent('milestone-icon-changed', {
      detail: { milestoneId, icon },
    })
  )
}

// 处理里程碑保存事件
const handleMilestoneSave = (updatedMilestone: Milestone) => {
  // 通知父组件里程碑数据已更新
  if (props.onMilestoneSave && typeof props.onMilestoneSave === 'function') {
    props.onMilestoneSave(updatedMilestone as Task) // Type conversion for backward compatibility
  }

  // 关闭对话框
  closeMilestoneDialog()

  // 广播里程碑更新事件，通知其他组件数据变化
  window.dispatchEvent(
    new CustomEvent('milestone-data-updated', {
      detail: { milestone: updatedMilestone },
    })
  )
}

// 处理里程碑删除事件
const handleMilestoneDelete = (milestoneId: number) => {
  // 关闭里程碑对话框
  closeMilestoneDialog()

  // 广播里程碑删除事件，通知其他组件数据变化
  window.dispatchEvent(
    new CustomEvent('milestone-deleted', {
      detail: { milestoneId },
    })
  )

  // 广播里程碑数据变化事件，确保Timeline重新渲染
  window.dispatchEvent(
    new CustomEvent('milestone-data-changed', {
      detail: { milestoneId },
    })
  )
}

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
    })
  )
}

// 生成时间轴数据
const generateTimelineData = () => {
  if (currentTimeScale.value === TimelineScale.WEEK) {
    return generateWeekTimelineData()
  } else if (currentTimeScale.value === TimelineScale.MONTH) {
    return generateMonthTimelineData()
  } else {
    // 默认日视图逻辑保持不变
    return generateDayTimelineData()
  }
}

// 生成日视图时间轴数据 (原有逻辑)
const generateDayTimelineData = () => {
  const months = []
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

// 生成周视图时间轴数据
const generateWeekTimelineData = () => {
  const allWeeks = []

  // 首先生成所有周
  const startDate = new Date(timelineConfig.value.startDate)
  const endDate = new Date(timelineConfig.value.endDate)

  // 找到起始日期所在周的周一
  const weekStart = new Date(startDate)
  const dayOfWeek = weekStart.getDay() || 7 // 调整周日为7
  weekStart.setDate(weekStart.getDate() - (dayOfWeek - 1))

  const currentWeekStart = new Date(weekStart)

  // 生成所有周
  while (currentWeekStart <= endDate) {
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6)

    // 只要周开始日期在范围内就添加
    if (currentWeekStart >= startDate || currentWeekEnd >= startDate) {
      allWeeks.push({
        weekStart: new Date(currentWeekStart),
        weekEnd: new Date(currentWeekEnd),
        label: `${currentWeekStart.getDate()}`,
        isToday: isWeekContainsToday(currentWeekStart, currentWeekEnd),
        subDays: generateSubDaysForWeek(currentWeekStart),
        // 根据周的第一天所在月份归属
        belongsToYear: currentWeekStart.getFullYear(),
        belongsToMonth: currentWeekStart.getMonth() + 1,
      })
    }

    currentWeekStart.setDate(currentWeekStart.getDate() + 7)
  }

  // 按月份分组
  const monthsMap = new Map()

  allWeeks.forEach(week => {
    const key = `${week.belongsToYear}-${week.belongsToMonth}`
    if (!monthsMap.has(key)) {
      monthsMap.set(key, {
        year: week.belongsToYear,
        month: week.belongsToMonth,
        yearMonthLabel: formatYearMonth(week.belongsToYear, week.belongsToMonth),
        startDate: new Date(week.belongsToYear, week.belongsToMonth - 1, 1),
        endDate: new Date(week.belongsToYear, week.belongsToMonth, 0),
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

// 更新时间刻度方法 - 供外部调用
const updateTimeScale = (scale: TimelineScale) => {
  currentTimeScale.value = scale

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
const isToday = (date: Date) => {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

const timelineData = ref(generateTimelineData())

// 防止递归更新的标志
let isUpdatingTimelineConfig = false

// 保证timelineData响应式跟随timelineConfig变化
watch(
  () => [timelineConfig.value.startDate, timelineConfig.value.endDate],
  () => {
    // 避免在更新timelineConfig时触发递归
    if (!isUpdatingTimelineConfig) {
      timelineData.value = generateTimelineData()
    }
  }
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
  { deep: true }
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
  const startNormalized = new Date(
    timelineStart.getFullYear(),
    timelineStart.getMonth(),
    timelineStart.getDate()
  )

  // 计算今天距离时间线开始日期的天数
  const timeDiff = todayNormalized.getTime() - startNormalized.getTime()
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))

  // 计算今天在时间线中的像素位置（根据当前时间刻度）
  const todayPosition = daysDiff * dayWidth.value

  // 优先查找 .timeline-body 作为滚动容器，否则回退到 .timeline
  const scrollContainer = document.querySelector('.timeline') as HTMLElement

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

  // 滚动结束后延迟显示半圆
  setTimeout(() => {
    isInitialScrolling.value = false
    setTimeout(() => {
      hideBubbles.value = false
    }, 300) // 再等300ms确保滚动完全停止
  }, 1500) // 给滚动动画留1.5秒时间
}

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

  // 计算滚动位置（每个日期30px宽度）
  const timelinePanel = document.querySelector('.gantt-panel-right')
  const timelinePanelW = timelinePanel?.clientWidth
  const scrollPosition = (totalDays - 1) * 30 - (timelinePanelW ? timelinePanelW / 2 : 200)

  // 滚动到指定位置
  const timeline = document.querySelector('.timeline')
  if (timeline) {
    timeline.scrollLeft = Math.max(0, scrollPosition)
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
    timelineStart.getDate()
  )

  // 计算今天距离时间线开始日期的天数
  const timeDiff = todayNormalized.getTime() - startNormalized.getTime()
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))

  // 如果今天不在时间线范围内，则不进行滚动
  if (daysDiff < 0 || todayNormalized > timelineConfig.value.endDate) {
    // console.warn('今天不在当前时间线范围内')
    return
  }

  // 计算今天在时间线中的像素位置（每天30px宽度）
  const todayPosition = daysDiff * 30

  // 获取时间线容器宽度
  const timeline = document.querySelector('.timeline') as HTMLElement
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
    })
  )
}

// 处理TaskBar双击事件 - 只emit事件
const handleTaskBarDoubleClick = (task: Task) => {
  emit('edit-task', task)
}

// 存储所有TaskBar的位置信息
const taskBarPositions = ref<
  Record<number, { left: number; top: number; width: number; height: number }>
>({})

const bodyContentRef = ref<HTMLElement | null>(null)
const svgWidth = ref(0)
const svgHeight = ref(0)

function updateSvgSize() {
  if (bodyContentRef.value) {
    svgWidth.value = bodyContentRef.value.offsetWidth
    // 使用计算的内容高度，确保SVG覆盖所有任务行
    svgHeight.value = contentHeight.value
  }
}

function handleBarMounted(payload: {
  id: number
  left: number
  top: number
  width: number
  height: number
}) {
  if (!bodyContentRef.value) return
  const baseRect = bodyContentRef.value.getBoundingClientRect()
  // 统一坐标系：以bodyContent为基准
  taskBarPositions.value[payload.id] = {
    left: payload.left - baseRect.left,
    top: payload.top - baseRect.top,
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
    })
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
          // 起点为前置TaskBar右侧中点，终点为当前TaskBar左侧中点
          const x1 = fromBar.left + fromBar.width
          const y1 = fromBar.top + fromBar.height / 2
          const x2 = toBar.left
          const y2 = toBar.top + toBar.height / 2
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
    handleTaskListVerticalScroll as EventListener
  )
  // 监听语言变化
  window.addEventListener('locale-changed', handleLocaleChange as EventListener)
  // 监听Splitter拖拽事件
  window.addEventListener('splitter-drag-start', handleSplitterDragStart as EventListener)
  window.addEventListener('splitter-drag-end', handleSplitterDragEnd as EventListener)
  // 监听Timeline容器resize事件（TaskList切换等）
  window.addEventListener(
    'timeline-container-resized',
    handleTimelineContainerResized as EventListener
  )

  // 监听里程碑点击定位事件
  window.addEventListener('milestone-click-locate', handleMilestoneClickLocate as EventListener)

  // 监听拖拽边界检测事件
  window.addEventListener('drag-boundary-check', handleDragBoundaryCheck as EventListener)

  // 设置ResizeObserver监听timeline-body的尺寸变化
  nextTick(() => {
    const timelineBody = document.querySelector('.timeline-body') as HTMLElement
    const timelineContainer = document.querySelector('.timeline') as HTMLElement
    if (timelineBody) {
      timelineBodyHeight.value = timelineBody.clientHeight

      resizeObserver = new ResizeObserver(entries => {
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
        for (const entry of entries) {
          const newWidth = entry.contentRect.width
          // 当容器宽度发生变化时，立即更新宽度并重新计算半圆显示
          if (Math.abs(newWidth - timelineContainerWidth.value) > 1) {
            timelineContainerWidth.value = newWidth

            // 对于容器宽度变化，我们需要立即重新计算半圆状态
            // 短时间隐藏后重新显示，让TaskBar重新计算边界
            hideBubbles.value = true

            // 延迟恢复显示，确保宽度变化完全生效
            setTimeout(() => {
              hideBubbles.value = false
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
  const timelineBody = document.querySelector('.timeline-body') as HTMLElement
  if (timelineBody && timelineBody.scrollTop !== scrollTop) {
    // 避免循环触发，只在scrollTop不同时才设置
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
      })
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
  { immediate: true }
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
    // 排除TaskBar组件、按钮、输入框等交互元素
    const interactiveElements = [
      '.task-bar',
      '.milestone',
      'button',
      'input',
      'select',
      'textarea',
      '.task-bar-content',
      '.progress-bar',
      '.task-name',
      '.task-controls',
    ]

    const isInteractiveElement = interactiveElements.some(selector => target.closest(selector))

    if (isInteractiveElement) {
      return
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

  const scrollLeft = target.scrollLeft
  const scrollWidth = target.scrollWidth
  const clientWidth = target.clientWidth
  const maxScroll = scrollWidth - clientWidth

  // 更新粘性效果所需的滚动位置信息
  timelineScrollLeft.value = scrollLeft
  timelineContainerWidth.value = clientWidth

  // 滚动时重新计算里程碑位置信息，支持推挤效果
  computeAllMilestonesPositions()

  // 计算滚动进度 (0-1)
  scrollProgress.value = maxScroll > 0 ? scrollLeft / maxScroll : 0

  // 判断是否滚动到边缘
  isScrolledLeft.value = scrollLeft > 20 // 距离左边超过20px
  isScrolledRight.value = scrollLeft < maxScroll - 20 // 距离右边超过20px

  // 设置滚动状态
  isScrolling.value = true
  if (target && 'classList' in target && typeof target.classList.add === 'function') {
    target.classList.add('scrolling')
  }

  // 清除之前的定时器
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }

  // 500ms后移除滚动状态
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
      })
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

  // 清理事件监听器
  window.removeEventListener('task-row-double-click', handleTaskListDoubleClick as EventListener)
  window.removeEventListener('task-list-hover', handleTaskListHover as EventListener)
  window.removeEventListener(
    'task-list-vertical-scroll',
    handleTaskListVerticalScroll as EventListener
  )
  window.removeEventListener('locale-changed', handleLocaleChange as EventListener)
  window.removeEventListener('splitter-drag-start', handleSplitterDragStart as EventListener)
  window.removeEventListener('splitter-drag-end', handleSplitterDragEnd as EventListener)
  window.removeEventListener(
    'timeline-container-resized',
    handleTimelineContainerResized as EventListener
  )
  window.removeEventListener('milestone-click-locate', handleMilestoneClickLocate as EventListener)
  window.removeEventListener('drag-boundary-check', handleDragBoundaryCheck as EventListener)

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

// 月度视图中按年份分组的计算属性
const groupMonthsByYear = computed(() => {
  if (currentTimeScale.value !== TimelineScale.MONTH) {
    return {}
  }

  const groups: Record<number, typeof timelineData.value> = {}

  timelineData.value.forEach(month => {
    if (!groups[month.year]) {
      groups[month.year] = []
    }
    groups[month.year].push(month)
  })

  return groups
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

// 监听滚动变化，重新计算里程碑位置
watch([timelineScrollLeft, timelineContainerWidth], computeAllMilestonesPositions)

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
  { deep: true }
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
      })
    }
  }

  return result
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
      <!-- 月度视图的header：第一行=年份，第二行=月份 -->
      <template v-if="currentTimeScale === TimelineScale.MONTH">
        <!-- 第一行：年份 -->
        <div class="timeline-header-row year-row">
          <div
            v-for="(_, yearValue) in groupMonthsByYear"
            :key="`year-${yearValue}`"
            class="timeline-year"
            :style="{ width: '719px' }"
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
          style="position: absolute; left: 0; top: 0; z-index: 25; pointer-events: none"
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
          </defs>
          <g>
            <path
              v-for="link in links"
              :key="link.from + '-' + link.to"
              :d="link.path"
              stroke="#c0c4cc"
              stroke-width="2"
              stroke-dasharray="6,4"
              fill="none"
              marker-end="url(#arrow)"
            />
          </g>
        </svg>
        <!-- 背景列 -->
        <div class="day-columns" :style="{ height: `${contentHeight}px` }">
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
              :style="{ width: `${month.days.length * 30}px`, height: `${contentHeight}px` }"
            >
              <div
                v-for="day in month.days"
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
                  :start-date="timelineConfig.startDate"
                  :name="milestone.name"
                  :milestone="convertTaskToMilestone(milestone)"
                  :scroll-left="timelineScrollLeft"
                  :container-width="timelineContainerWidth"
                  :milestone-id="milestone.id"
                  :other-milestones="getOtherMilestonesInfo(milestone.id)"
                  :timeline-data="timelineData"
                  :current-time-scale="currentTimeScale"
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
                  :start-date="timelineConfig.startDate"
                  :name="task.name"
                  :milestone="convertTaskToMilestone(task)"
                  :scroll-left="timelineScrollLeft"
                  :container-width="timelineContainerWidth"
                  :milestone-id="task.id"
                  :other-milestones="getOtherMilestonesInfo(task.id)"
                  :timeline-data="timelineData"
                  :current-time-scale="currentTimeScale"
                  @milestone-double-click="handleMilestoneDoubleClick"
                  @update:milestone="handleMilestoneUpdate"
                  @drag-end="handleMilestoneDragEnd"
                />
              </template>
              <!-- 普通任务条 - 排除里程碑分组和普通里程碑 -->
              <TaskBar
                v-else-if="task.type !== 'milestone-group' && task.type !== 'milestone'"
                :task="task"
                :row-height="50"
                :day-width="dayWidth"
                :start-date="timelineConfig.startDate"
                :is-parent="task.isParent"
                :on-double-click="props.onTaskDoubleClick"
                :scroll-left="timelineScrollLeft"
                :container-width="timelineContainerWidth"
                :hide-bubbles="hideBubbles"
                :timeline-data="timelineData"
                :current-time-scale="currentTimeScale"
                @update:task="updateTask"
                @bar-mounted="handleBarMounted"
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
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Milestone Dialog 里程碑对话框组件 -->
    <MilestoneDialog
      v-model:visible="milestoneDialogVisible"
      :milestone="currentMilestone"
      @close="closeMilestoneDialog"
      @save="handleMilestoneSave"
      @delete="handleMilestoneDelete"
      @icon-changed="handleMilestoneIconChange"
    />
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
  min-width: 120px;
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
  z-index: 10;
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

/* 月度视图专用样式 */
.year-row {
  min-height: 36px;
  border-bottom: 1px solid var(--gantt-border-medium, #e1e4e8);
}

.timeline-year {
  border-right: 1px solid var(--gantt-border-medium, #e1e4e8);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
}

.year-label {
  color: var(--gantt-text-header, #24292e);
  font-weight: 600;
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
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

:global(html[data-theme='dark']) .month-column {
  border-right-color: var(--gantt-border-light, #555555) !important;
}

:global(html[data-theme='dark']) .month-column.today {
  background-color: var(--gantt-primary-color, #409eff);
  border-left-color: var(--gantt-primary-color, #409eff) !important;
}
</style>

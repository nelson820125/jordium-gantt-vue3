<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import TaskBar from './TaskBar.vue'
import MilestonePoint from './MilestonePoint.vue'
import TaskDrawer from './TaskDrawer.vue'
import MilestoneDialog from './MilestoneDialog.vue'
import { useI18n } from '../composables/useI18n'
import type { Task } from '../models/classes/Task'
import type { TimelineConfig } from '../models/configs/TimelineConfig'
import type { Milestone } from '../models/classes/Milestone'

// 定义Props接口
interface Props {
  // 任务数据
  tasks?: Task[]
  // 里程碑数据
  milestones?: Task[]
  // TaskBar双击事件处理器API
  onTaskDoubleClick?: (task: Task) => void
  // 自定义编辑组件
  editComponent?: any
  // 是否使用默认的TaskDrawer
  useDefaultDrawer?: boolean
  // 自定义删除处理器
  onTaskDelete?: (task: Task) => void
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

// 多语言
const { formatYearMonth } = useI18n()

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

// 响应外部props变化，动态更新timelineConfig
watch([timelineStartDate, timelineEndDate], ([newStart, newEnd]) => {
  timelineConfig.value.startDate = newStart
  timelineConfig.value.endDate = newEnd
})

// 使用props传入的任务和里程碑数据
const tasks = computed(() => props.tasks || [])

// 抽屉状态管理
const drawerVisible = ref(false)
const currentTask = ref<Task | null>(null)
const isEditMode = ref(false)

// 里程碑对话框状态管理
const milestoneDialogVisible = ref(false)
const currentMilestone = ref(null)

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

// 容器高度状态管理
const timelineBodyHeight = ref(0)
let resizeObserver: ResizeObserver | null = null

// 处理拖拽开始事件
const handleSplitterDragStart = () => {
  isSplitterDragging.value = true
}

// 处理拖拽结束事件
const handleSplitterDragEnd = () => {
  isSplitterDragging.value = false
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
const handleMilestoneDoubleClick = (milestone: any) => {
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
    }),
  )
}

// 处理里程碑保存事件
const handleMilestoneSave = (updatedMilestone: any) => {
  // 通知父组件里程碑数据已更新
  if (props.onMilestoneSave && typeof props.onMilestoneSave === 'function') {
    props.onMilestoneSave(updatedMilestone)
  }

  // 关闭对话框
  closeMilestoneDialog()

  // 广播里程碑更新事件，通知其他组件数据变化
  window.dispatchEvent(
    new CustomEvent('milestone-data-updated', {
      detail: { milestone: updatedMilestone },
    }),
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
    }),
  )

  // 广播里程碑数据变化事件，确保Timeline重新渲染
  window.dispatchEvent(
    new CustomEvent('milestone-data-changed', {
      detail: { milestoneId },
    }),
  )
}

// 处理里程碑拖拽更新事件
const handleMilestoneUpdate = (updatedMilestone: any) => {
  console.log('Timeline 接收到里程碑拖拽更新事件：', updatedMilestone)

  // 通知父组件里程碑数据已更新
  if (props.onMilestoneSave && typeof props.onMilestoneSave === 'function') {
    props.onMilestoneSave(updatedMilestone)
  }

  // 广播里程碑更新事件，通知其他组件数据变化
  window.dispatchEvent(
    new CustomEvent('milestone-data-updated', {
      detail: { milestone: updatedMilestone },
    }),
  )
}

// 生成时间轴数据
const generateTimelineData = () => {
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

// 保证timelineData响应式跟随timelineConfig变化
watch(
  () => [timelineConfig.value.startDate, timelineConfig.value.endDate],
  () => {
    timelineData.value = generateTimelineData()
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

  // 计算今天在时间线中的像素位置（每天30px宽度）
  const todayPosition = daysDiff * 30

  // 优先查找 .timeline-body 作为滚动容器，否则回退到 .timeline
  const scrollContainer = document.querySelector('.timeline') as HTMLElement

  const containerWidth = scrollContainer.clientWidth
  console.log('[scrollToTodayCenter]', {
    retry,
    today: todayNormalized,
    timelineStart: startNormalized,
    daysDiff,
    todayPosition,
    containerWidth,
    containerClass: scrollContainer.className,
  })
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
  console.log(
    '[scrollToTodayCenter] scrollLeft set:',
    Math.max(0, centeredScrollPosition),
    'on',
    scrollContainer.className,
  )
  console.log(
    '[scrollToTodayCenter] scrollContainer.scrollLeft updated:',
    scrollContainer.scrollLeft,
  )
}

// 聚焦到任务所在位置
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
    timelineStart.getDate(),
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
    }),
  )
}

// 处理TaskBar双击事件 - 支持API和默认行为
const handleTaskBarDoubleClick = (task: Task) => {
  // 优先调用外部传入的双击处理器
  if (props.onTaskDoubleClick && typeof props.onTaskDoubleClick === 'function') {
    props.onTaskDoubleClick(task)
  } else if (props.useDefaultDrawer) {
    // 默认行为：打开内置的TaskDrawer
    currentTask.value = task
    isEditMode.value = true
    drawerVisible.value = true
  }

  // 如果有自定义编辑组件，也需要处理
  // 这里可以根据需要扩展
}

// 处理抽屉提交事件
const handleDrawerSubmit = (task: Task) => {
  if (isEditMode.value) {
    // 编辑模式 - 更新现有任务
    updateTask(task)
  } else {
    // 新增模式 - 添加新任务，通过事件通知父组件
    window.dispatchEvent(
      new CustomEvent('task-added', {
        detail: task,
      }),
    )
  }

  // 关闭抽屉
  drawerVisible.value = false
}

// 处理抽屉关闭事件
const handleDrawerClose = () => {
  currentTask.value = null
  isEditMode.value = false
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

// 计算所有连线
const links = computed(() => {
  const result: { from: number; to: number; path: string }[] = []
  for (const task of tasks.value) {
    if (
      task.predecessor &&
      taskBarPositions.value[task.id] &&
      taskBarPositions.value[Number(task.predecessor)]
    ) {
      const fromBar = taskBarPositions.value[Number(task.predecessor)]
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
      result.push({ from: Number(task.predecessor), to: task.id, path })
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
    handleTaskListVerticalScroll as EventListener,
  )
  // 监听语言变化
  window.addEventListener('locale-changed', handleLocaleChange as EventListener)
  // 监听Splitter拖拽事件
  window.addEventListener('splitter-drag-start', handleSplitterDragStart as EventListener)
  window.addEventListener('splitter-drag-end', handleSplitterDragEnd as EventListener)

  // 设置ResizeObserver监听timeline-body的尺寸变化
  nextTick(() => {
    const timelineBody = document.querySelector('.timeline-body') as HTMLElement
    if (timelineBody) {
      timelineBodyHeight.value = timelineBody.clientHeight

      resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          timelineBodyHeight.value = entry.contentRect.height
        }
      })

      resizeObserver.observe(timelineBody)
    }
  })

  // 页面加载后，直接将今日定位到中间
  // 增加延迟时间，确保DOM元素渲染完成
  setTimeout(() => {
    scrollToTodayCenter()
    updateSvgSize()
  }, 200)
  window.addEventListener('resize', updateSvgSize)
  // 监听时间轴滚动事件
  window.addEventListener('scroll', handleTimelineScroll as EventListener)
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

// 检测滚动状态
const handleTimelineScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target) return

  const scrollLeft = target.scrollLeft
  const scrollTop = target.scrollTop
  const scrollWidth = target.scrollWidth
  const clientWidth = target.clientWidth
  const maxScroll = scrollWidth - clientWidth

  // 计算滚动进度 (0-1)
  scrollProgress.value = maxScroll > 0 ? scrollLeft / maxScroll : 0

  // 判断是否滚动到边缘
  isScrolledLeft.value = scrollLeft > 20 // 距离左边超过20px
  isScrolledRight.value = scrollLeft < maxScroll - 20 // 距离右边超过20px

  // 同步垂直滚动到TaskList
  if (scrollTop >= 0) {
    window.dispatchEvent(
      new CustomEvent('timeline-vertical-scroll', {
        detail: { scrollTop },
      }),
    )
  }

  // 设置滚动状态
  isScrolling.value = true
  target.classList.add('scrolling')

  // 清除之前的定时器
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }

  // 500ms后移除滚动状态
  scrollTimeout = setTimeout(() => {
    isScrolling.value = false
    target.classList.remove('scrolling')
  }, 500)
}

onUnmounted(() => {
  // 清理事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  // window.removeEventListener('tasks-changed', handleTasksChanged as EventListener) // 不再需要
  window.removeEventListener('task-row-double-click', handleTaskListDoubleClick as EventListener)
  window.removeEventListener('task-list-hover', handleTaskListHover as EventListener)
  window.removeEventListener(
    'task-list-vertical-scroll',
    handleTaskListVerticalScroll as EventListener,
  )
  window.removeEventListener('locale-changed', handleLocaleChange as EventListener)
  window.removeEventListener('splitter-drag-start', handleSplitterDragStart as EventListener)
  window.removeEventListener('splitter-drag-end', handleSplitterDragEnd as EventListener)
  window.removeEventListener('resize', updateSvgSize)
  window.removeEventListener('scroll', handleTimelineScroll as EventListener)

  // 清理ResizeObserver
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

const handleTaskDelete = (taskId: number) => {
  // 调用父组件传入的删除处理器
  if (props.onTaskDelete && typeof props.onTaskDelete === 'function') {
    const taskToDelete = tasks.value.find(task => task.id === taskId)
    if (taskToDelete) {
      props.onTaskDelete(taskToDelete)
    }
  }

  // 触发全局事件，通知其他组件任务已删除
  window.dispatchEvent(
    new CustomEvent('task-deleted', {
      detail: taskId,
    }),
  )

  // 关闭抽屉
  drawerVisible.value = false
  currentTask.value = null
  isEditMode.value = false
}

// TaskDrawer删除事件适配器
const handleDrawerTaskDelete = (task: Task) => {
  handleTaskDelete(task.id)
}

// 暴露公共API
defineExpose({
  // 基础滚动功能
  scrollToTasks,
  scrollToToday,
  scrollToTodayCenter,
  // 时间线配置
  timelineConfig,
})
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
</script>

<template>
  <div ref="timelineContainer" class="timeline" @mousedown="handleMouseDown">
    <!-- Timeline Header -->
    <div class="timeline-header">
      <!-- 第一行：年月 -->
      <div class="timeline-header-row year-month-row">
        <div
          v-for="month in timelineData"
          :key="`year-month-${month.year}-${month.month}`"
          class="timeline-month"
          :style="{ width: `${month.days.length * 30}px` }"
        >
          <div class="year-month-label">{{ month.yearMonthLabel }}</div>
        </div>
      </div>

      <!-- 第二行：日期 -->
      <div class="timeline-header-row days-row">
        <div
          v-for="month in timelineData"
          :key="`days-${month.year}-${month.month}`"
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
      </div>
    </div>

    <!-- Timeline Body (Task Bar Area) -->
    <div class="timeline-body" @scroll="handleTimelineScroll">
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
        <!-- 周末背景列 -->
        <div class="day-columns" :style="{ height: `${contentHeight}px` }">
          <div
            v-for="month in timelineData"
            :key="`day-col-${month.year}-${month.month}`"
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
                  :day-width="30"
                  :start-date="timelineConfig.startDate"
                  :name="milestone.name"
                  :milestone="convertTaskToMilestone(milestone)"
                  @milestone-double-click="handleMilestoneDoubleClick"
                  @update:milestone="handleMilestoneUpdate"
                />
              </template>
              <!-- 普通任务条 - 排除里程碑分组和普通里程碑 -->
              <TaskBar
                v-else-if="task.type !== 'milestone-group' && task.type !== 'milestone'"
                :task="task"
                :row-height="50"
                :day-width="30"
                :start-date="timelineConfig.startDate"
                :is-parent="task.isParent"
                :on-double-click="props.onTaskDoubleClick"
                :edit-component="props.editComponent"
                @update:task="updateTask"
                @bar-mounted="handleBarMounted"
                @dblclick="handleTaskBarDoubleClick(task)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Task Drawer 抽屉组件 - 仅在使用默认Drawer时显示 -->
    <TaskDrawer
      v-if="props.useDefaultDrawer"
      v-model:visible="drawerVisible"
      :task="currentTask"
      :is-edit="isEditMode"
      @submit="handleDrawerSubmit"
      @close="handleDrawerClose"
      @delete="handleDrawerTaskDelete"
    />
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
  background: var(--gantt-bg-primary, #3a3a3a) !important;
}

:global(html[data-theme='dark']) .timeline-body-content {
  background: var(--gantt-bg-primary, #3a3a3a) !important;
}

:global(html[data-theme='dark']) .day-columns {
  border-right-color: var(--gantt-border-light, #555555) !important;
}

:global(html[data-theme='dark']) .month-day-columns {
  border-right-color: var(--gantt-border-light, #555555) !important;
}

:global(html[data-theme='dark']) .day-column {
  border-right-color: var(--gantt-border-light, #555555) !important;
}

:global(html[data-theme='dark']) .day-column.weekend {
  background-color: var(--gantt-bg-secondary, #1a1a1a) !important;
}

:global(html[data-theme='dark']) .day-column.today {
  border-left-color: var(--gantt-primary-color, #409eff) !important;
  background-color: var(--gantt-primary-color, #409eff) !important;
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
</style>

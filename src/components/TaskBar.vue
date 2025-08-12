<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted, nextTick, watch } from 'vue'
import type { Task } from '../models/classes/Task'
import { TimelineScale } from '../models/types/TimelineScale'
import TaskContextMenu from './TaskContextMenu.vue'

import { useI18n } from '../composables/useI18n'

interface Props {
  task: Task
  rowHeight: number
  dayWidth: number
  startDate: Date
  isParent?: boolean
  onDoubleClick?: (task: Task) => void
  // 新增：用于粘性文字显示的滚动位置信息
  scrollLeft?: number
  containerWidth?: number
  // 新增：外部控制半圆隐藏状态（用于Timeline初始化等场景）
  hideBubbles?: boolean
  // 新增：时间线数据，用于精确计算subDays定位
  timelineData?: Array<{
    year: number
    month: number
    startDate: Date
    endDate: Date
    subDays?: Array<{ date: Date; dayOfWeek?: number }>
    monthData?: { dayCount: number }
  }>
  // 新增：当前时间刻度
  currentTimeScale?: TimelineScale
}

const props = defineProps<Props>()

const { getTranslation } = useI18n()
const t = (key: string): string => {
  return getTranslation(key)
}

const emit = defineEmits([
  'update:task',
  'bar-mounted',
  'dblclick',
  'drag-end',
  'resize-end',
  'scroll-to-position',
  'start-timer',
  'stop-timer',
  'add-predecessor',
  'add-successor',
  'delete',
])

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
  return `${year}-${month}-${day}`
}

const addDaysToLocalDate = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// 拖拽状态
const isDragging = ref(false)
const isResizingLeft = ref(false)
const isResizingRight = ref(false)
const dragStartX = ref(0)
const dragStartLeft = ref(0)
const dragStartWidth = ref(0)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)
const resizeStartLeft = ref(0)

// 相对位置拖拽方案：记录鼠标相对于TaskBar的位置
const mouseOffsetX = ref(0) // 鼠标在TaskBar内的相对位置

// 缓存拖拽/拉伸过程中的临时数据，只在鼠标抬起时提交更新
const tempTaskData = ref<{
  startDate?: string
  endDate?: string
} | null>(null)

const barRef = ref<HTMLElement | null>(null)

// 计算任务条位置和宽度
const taskBarStyle = computed(() => {
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

  // 优先使用基于timelineData的精确定位（适用于周视图和月视图）
  if (
    props.timelineData &&
    props.currentTimeScale &&
    (props.currentTimeScale === TimelineScale.WEEK ||
      props.currentTimeScale === TimelineScale.MONTH)
  ) {
    // 计算开始位置
    const startPosition = calculatePositionFromTimelineData(
      startDate,
      props.timelineData,
      props.currentTimeScale,
    )
    // 计算结束位置：为结束日期添加一天来获取正确的结束位置
    const nextDay = new Date(endDate)
    nextDay.setDate(nextDay.getDate() + 1)
    let endPosition = calculatePositionFromTimelineData(
      nextDay,
      props.timelineData,
      props.currentTimeScale,
    )

    // 如果结束日期+1天超出范围，使用结束日期的位置+一天的宽度
    if (endPosition === startPosition) {
      const dayWidth = props.currentTimeScale === TimelineScale.WEEK ? 60 / 7 : 60 / 30
      endPosition =
        calculatePositionFromTimelineData(endDate, props.timelineData, props.currentTimeScale) +
        dayWidth
    }

    left = startPosition
    width = Math.max(endPosition - startPosition, 4) // 确保最小4px宽度
  } else {
    // 日视图：保持原有逻辑
    const startDiff = Math.floor(
      (startDate.getTime() - baseStart.getTime()) / (1000 * 60 * 60 * 24),
    )
    // 重新计算duration，确保包含结束日期当天
    const timeDiffMs = endDate.getTime() - startDate.getTime()
    const daysDiff = timeDiffMs / (1000 * 60 * 60 * 24)
    // 对于跨天的任务，需要包含开始和结束两天
    const duration = Math.floor(daysDiff) + 1

    left = startDiff * props.dayWidth
    width = duration * props.dayWidth
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

// 判断是否已完成
const isCompleted = computed(() => (props.task.progress || 0) >= 100)

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

// 鼠标事件处理 - 使用相对位置拖拽方案
const handleMouseDown = (e: MouseEvent, type: 'drag' | 'resize-left' | 'resize-right') => {
  // 如果已完成或是父级任务，禁用所有交互
  if (isCompleted.value || props.isParent) {
    return
  }

  e.preventDefault()
  e.stopPropagation()

  // 清空之前的临时数据
  tempTaskData.value = null

  // 获取TaskBar相对于Timeline容器的位置
  const timelineContainer = document.querySelector('.timeline') as HTMLElement
  if (!timelineContainer || !barRef.value) return

  const barRect = barRef.value.getBoundingClientRect()

  // 计算鼠标相对于TaskBar的位置
  mouseOffsetX.value = e.clientX - barRect.left

  if (type === 'drag') {
    isDragging.value = true
    dragStartX.value = e.clientX
    dragStartLeft.value = parseInt(taskBarStyle.value.left)
    dragStartWidth.value = parseInt(taskBarStyle.value.width)
  } else if (type === 'resize-left') {
    isResizingLeft.value = true
    resizeStartX.value = e.clientX
    resizeStartWidth.value = parseInt(taskBarStyle.value.width)
    resizeStartLeft.value = parseInt(taskBarStyle.value.left)
  } else if (type === 'resize-right') {
    isResizingRight.value = true
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

const handleMouseMove = (e: MouseEvent) => {
  // 发送边界检测事件给Timeline
  window.dispatchEvent(
    new CustomEvent('drag-boundary-check', {
      detail: {
        mouseX: e.clientX,
        isDragging: isDragging.value || isResizingLeft.value || isResizingRight.value,
      },
    }),
  )

  if (isDragging.value) {
    const deltaX = e.clientX - dragStartX.value
    const newLeft = Math.max(0, dragStartLeft.value + deltaX)
    const newStartDate = addDaysToLocalDate(props.startDate, newLeft / props.dayWidth)
    const duration = dragStartWidth.value / props.dayWidth
    const newEndDate = addDaysToLocalDate(newStartDate, duration - 1)

    // 只更新临时数据，不触发事件
    tempTaskData.value = {
      startDate: formatDateToLocalString(newStartDate),
      endDate: formatDateToLocalString(newEndDate),
    }
  } else if (isResizingLeft.value) {
    const deltaX = e.clientX - resizeStartX.value
    const newLeft = Math.max(0, resizeStartLeft.value + deltaX)
    const newStartDate = addDaysToLocalDate(props.startDate, newLeft / props.dayWidth)

    // 只更新临时数据，不触发事件
    tempTaskData.value = {
      startDate: formatDateToLocalString(newStartDate),
      endDate: props.task.endDate, // 保持原来的结束日期
    }
  } else if (isResizingRight.value) {
    const deltaX = e.clientX - resizeStartX.value
    const newWidth = Math.max(props.dayWidth, resizeStartWidth.value + deltaX)
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
  }
}

const handleMouseUp = () => {
  // 停止边界检测
  window.dispatchEvent(
    new CustomEvent('drag-boundary-check', {
      detail: {
        mouseX: 0,
        isDragging: false,
      },
    }),
  )

  // 如果有临时数据，说明发生了拖拽或拉伸，提交数据更新
  if (tempTaskData.value) {
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

  isDragging.value = false
  isResizingLeft.value = false
  isResizingRight.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

onMounted(() => {
  nextTick(() => {
    reportBarPosition()
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

// 处理TaskBar双击事件
const handleTaskBarDoubleClick = (e: MouseEvent) => {
  // 阻止事件冒泡，避免触发拖拽等其他事件
  e.stopPropagation()
  e.preventDefault()

  // 清理任何可能残留的拖拽状态和临时数据
  isDragging.value = false
  isResizingLeft.value = false
  isResizingRight.value = false
  tempTaskData.value = null

  // 移除可能残留的事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)

  // 优先调用外部传入的双击处理器
  if (props.onDoubleClick && typeof props.onDoubleClick === 'function') {
    props.onDoubleClick(props.task)
  } else {
    // 默认行为：发出双击事件给父组件
    emit('dblclick', props.task)
  }
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

  // 估算文字内容的实际位置
  const nameText = props.task.name || ''
  const nameWidth = Math.max(nameText.length * 7, 40)
  const progressWidth = 35

  // 计算名称和进度在默认居中状态下的位置
  const nameLeftPos = taskCenterX - nameWidth / 2
  const nameRightPos = taskCenterX + nameWidth / 2
  const progressLeftPos = taskCenterX - progressWidth / 2
  const progressRightPos = taskCenterX + progressWidth / 2

  // 左侧边界粘性逻辑
  const nameNeedsLeftSticky =
    nameLeftPos < leftBoundary && taskRight > leftBoundary && taskCenterX < leftBoundary

  // 右侧边界粘性逻辑
  const nameNeedsRightSticky =
    nameRightPos > rightBoundary && taskLeft < rightBoundary && taskCenterX > rightBoundary

  // 名称粘性处理
  if (nameNeedsLeftSticky) {
    const offset = leftBoundary - taskLeft
    nameLeft = `${offset + 8}px`
    namePosition = 'absolute'
    nameTop = '6px'
  } else if (nameNeedsRightSticky) {
    const offset = rightBoundary - taskLeft - nameWidth
    nameLeft = `${offset - 8}px`
    namePosition = 'absolute'
    nameTop = '6px'
  }

  // 进度左侧边界粘性逻辑
  const progressNeedsLeftSticky =
    progressLeftPos < leftBoundary && taskRight > leftBoundary && taskCenterX < leftBoundary

  // 进度右侧边界粘性逻辑
  const progressNeedsRightSticky =
    progressRightPos > rightBoundary && taskLeft < rightBoundary && taskCenterX > rightBoundary

  // 进度粘性处理
  if (progressNeedsLeftSticky) {
    const offset = leftBoundary - taskLeft
    progressLeft = `${offset + 8}px`
    progressPosition = 'absolute'
    progressTop = '24px'
  } else if (progressNeedsRightSticky) {
    const offset = rightBoundary - taskLeft - progressWidth
    progressLeft = `${offset - 8}px`
    progressPosition = 'absolute'
    progressTop = '24px'
  }

  return {
    nameLeft,
    namePosition,
    nameTop,
    progressLeft,
    progressPosition,
    progressTop,
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
const handleBubbleClick = () => {
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
  showTooltip.value = true

  // 智能定位：右侧气泡在左侧显示tooltip，左侧气泡在右侧显示
  const isRightBubble = bubbleIndicator.value.side === 'right'
  const offsetX = isRightBubble ? -180 : 15 // 右侧气泡向左偏移距离调整，与左侧距离一致

  tooltipPosition.value = {
    x: event.clientX + offsetX,
    y: event.clientY - 10,
  }
}

const handleBubbleMouseLeave = () => {
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

// 基于timelineData和subDays精确计算日期位置的函数
const calculatePositionFromTimelineData = (
  targetDate: Date,
  timelineData: Array<{
    year: number
    month: number
    startDate: Date
    endDate: Date
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
    if (timeScale === TimelineScale.WEEK) {
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
    }
  }

  return cumulativePosition // 如果没找到，返回累计位置
}

// 处理右键菜单
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuTask = computed(() => props.task)

function handleContextMenu(event: MouseEvent) {
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
    }"
    :class="{
      dragging: isDragging,
      resizing: isResizingLeft || isResizingRight,
      completed: isCompleted,
      'parent-task': isParent,
      'week-view': isWeekView,
      'short-task-bar': isShortTaskBar,
      'overflow-effect': needsOverflowEffect,
    }"
    @contextmenu="handleContextMenu"
    @dblclick="handleTaskBarDoubleClick"
  >
    <!-- 父级任务的标签 -->
    <div v-if="isParent" class="parent-label">{{ task.name }} ({{ task.progress || 0 }}%)</div>

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
      v-if="!isCompleted && !isParent"
      class="resize-handle resize-handle-left"
      @mousedown="e => handleMouseDown(e, 'resize-left')"
    ></div>

    <!-- 任务条主体（非父级任务） -->
    <div v-if="!isParent" class="task-bar-content" @mousedown="e => handleMouseDown(e, 'drag')">
      <!-- 任务名称 -->
      <div class="task-name" :style="getNameStyles()">
        {{ task.name }}
      </div>

      <!-- 进度百分比 -->
      <div v-if="shouldShowProgress" class="task-progress" :style="getProgressStyles()">
        {{ task.progress || 0 }}%
      </div>
    </div>

    <!-- 右侧调整把手 -->
    <div
      v-if="!isCompleted && !isParent"
      class="resize-handle resize-handle-right"
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
      @mouseenter="handleBubbleMouseEnter"
      @mouseleave="handleBubbleMouseLeave"
      @mousedown="handleBubbleMouseDown"
      @click="handleBubbleClick"
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
</template>

<style scoped>
.task-bar {
  position: absolute;
  border-radius: 4px;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.2s;
  min-width: 60px;
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
  width: 6px;
  height: 100%;
  cursor: ew-resize;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  transition: background 0.2s;
  z-index: 2;
}

.resize-handle:hover {
  background: rgba(0, 0, 0, 0.2);
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
  width: 8px; /* 悬停时稍微加宽 */
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
</style>

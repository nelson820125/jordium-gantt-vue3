/* eslint-disable @typescript-eslint/no-explicit-any */
<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import type { Milestone } from '../models/classes/Milestone'
import { TimelineScale } from '../models/types/TimelineScale'
import { useI18n } from '../composables/useI18n'
import { createLocalDate } from '../utils/predecessorUtils'
const props = defineProps<Props>()

// 添加事件定义
const emit = defineEmits<{
  'milestone-double-click': [milestone: Milestone]
  'update:milestone': [milestone: Milestone] // 新增里程碑更新事件
  'drag-end': [milestone: Milestone] // 新增
}>()

const { getTranslation } = useI18n()

const t = (key: string): string => {
  return getTranslation(key)
}

interface Props {
  date: string // 里程碑日期
  rowHeight: number
  dayWidth: number
  startDate: Date
  name?: string
  milestone?: Milestone // 完整的里程碑数据
  // 新增：用于边界粘性显示的滚动位置信息
  scrollLeft?: number
  containerWidth?: number
  // 新增：里程碑推挤效果所需的信息
  milestoneId?: string | number // 唯一标识符
  otherMilestones?: Array<{
    id: string | number
    left: number
    originalLeft: number // 原始位置（不考虑停靠）
    isSticky: boolean
    stickyPosition: 'left' | 'right' | 'none'
    priority: number // 推挤优先级
  }> // 其他里程碑的位置信息
  // 新增：时间线数据，用于精确计算subDays定位
  timelineData?: unknown[]
  // 新增：当前时间刻度
  currentTimeScale?: TimelineScale
}

// 拖拽相关状态
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartLeft = ref(0)
const tempMilestoneData = ref<{ startDate?: string } | null>(null)

// 双击事件处理
const handleDoubleClick = (e: MouseEvent) => {
  // 阻止事件冒泡和默认行为
  e.preventDefault()
  e.stopPropagation()

  // 如果是停靠状态或被推出边界，禁止双击编辑
  if (
    milestoneVisibility.value.isSticky ||
    milestoneVisibility.value.isPushedOut ||
    !milestoneVisibility.value.showIcon
  ) {
    return
  }

  // 清理任何可能残留的拖拽状态
  isDragging.value = false
  tempMilestoneData.value = null

  // 移除可能残留的事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)

  if (props.milestone) {
    emit('milestone-double-click', props.milestone)
  } else {
    // 如果没有完整数据，构造基本的里程碑对象
    const basicMilestone: Milestone = {
      name: props.name || '里程碑',
      startDate: props.date,
      type: 'milestone',
    }
    emit('milestone-double-click', basicMilestone)
  }
}

// 日期工具函数
const addDaysToLocalDate = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

const formatDateToLocalString = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 拖拽事件处理 - 使用相对位置拖拽方案
const handleMouseDown = (e: MouseEvent) => {
  // 如果是停靠状态或被推出边界，禁止拖拽
  if (
    milestoneVisibility.value.isSticky ||
    milestoneVisibility.value.isPushedOut ||
    !milestoneVisibility.value.showIcon
  ) {
    return
  }

  // 如果正在双击过程中，不启动拖拽
  e.preventDefault()
  e.stopPropagation()

  // 获取当前里程碑相对位置
  const timelineContainer = document.querySelector('.timeline') as HTMLElement
  if (!timelineContainer) return

  // 设置拖拽状态，但不立即开始拖拽
  dragStartX.value = e.clientX
  dragStartLeft.value = parseInt(milestoneStyle.value.left)
  tempMilestoneData.value = null

  // 监听自动滚动事件
  window.addEventListener('timeline-auto-scroll', handleAutoScroll as EventListener)

  // 添加全局事件监听器
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// 处理自动滚动事件
const handleAutoScroll = (event: CustomEvent) => {
  const { scrollDelta } = event.detail

  // 当Timeline滚动时，调整鼠标起始位置以保持相对位置
  if (isDragging.value) {
    dragStartX.value -= scrollDelta
  }
}

const handleMouseMove = (e: MouseEvent) => {
  // 发送边界检测事件给Timeline
  window.dispatchEvent(
    new CustomEvent('drag-boundary-check', {
      detail: {
        mouseX: e.clientX,
        isDragging: isDragging.value,
      },
    }),
  )

  const deltaX = e.clientX - dragStartX.value

  // 只有在真正移动了一定距离后才开始拖拽（避免意外触发）
  if (Math.abs(deltaX) > 3) {
    isDragging.value = true

    const newLeft = Math.max(0, dragStartLeft.value + deltaX)
    const newStartDate = addDaysToLocalDate(props.startDate, newLeft / props.dayWidth)

    // 只更新临时数据，不触发事件
    tempMilestoneData.value = {
      startDate: formatDateToLocalString(newStartDate),
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

  // 只有在真正拖拽了（有临时数据）且状态为拖拽中时才触发更新
  if (isDragging.value && tempMilestoneData.value && props.milestone) {
    const updatedMilestone = {
      ...props.milestone,
      ...tempMilestoneData.value,
    }
    emit('update:milestone', updatedMilestone)
    emit('drag-end', updatedMilestone)
  }

  // 清理自动滚动监听器
  window.removeEventListener('timeline-auto-scroll', handleAutoScroll as EventListener)

  // 重置所有拖拽状态
  isDragging.value = false
  tempMilestoneData.value = null

  // 移除事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// 单击事件处理 - 定位到里程碑位置（居中）
const handleMilestoneClick = (e: MouseEvent) => {
  // 阻止事件冒泡
  e.preventDefault()
  e.stopPropagation()

  // 如果正在拖拽，不响应单击
  if (isDragging.value) {
    return
  }

  // 如果里程碑被推出边界（完全隐藏），不响应点击
  if (milestoneVisibility.value.isPushedOut || !milestoneVisibility.value.showIcon) {
    return
  }

  // 如果里程碑完全在视野内，不需要定位
  if (milestoneVisibility.value.isFullyVisible) {
    return
  }

  const containerWidth = props.containerWidth || 0

  // 计算里程碑的原始位置（用户点击停靠里程碑是想定位到原始位置）
  const milestoneLeft = parseInt(milestoneStyle.value.left) + 12 // 图标中心位置

  if (containerWidth > 0) {
    // 计算需要滚动到的位置，让里程碑居中
    const targetScrollLeft = Math.max(0, milestoneLeft - containerWidth / 2)

    // 发送滚动定位事件
    window.dispatchEvent(
      new CustomEvent('milestone-click-locate', {
        detail: {
          scrollLeft: targetScrollLeft,
          smooth: true,
        },
      }),
    )
  }
}

// 计算菱形位置 - 考虑拖拽临时数据
const milestoneStyle = computed(() => {
  const currentMilestoneDate = tempMilestoneData.value?.startDate || props.date
  const milestoneDate = createLocalDate(currentMilestoneDate)

  // 修正：防御性处理日期和startDate
  if (!props.startDate || !milestoneDate || isNaN(milestoneDate.getTime())) {
    return {
      left: '0px',
      top: '0px',
      width: 'auto',
      height: 'auto',
    }
  }

  let left = 0
  // 修复：根据不同时间刻度使用合适的图标大小
  let size = 24 // 默认图标大小

  if (
    props.currentTimeScale === TimelineScale.YEAR ||
    props.currentTimeScale === TimelineScale.QUARTER
  ) {
    // 年度视图：使用固定大小，不依赖dayWidth
    size = Math.min(props.rowHeight, 24)
  } else if (props.currentTimeScale === TimelineScale.MONTH) {
    // 月度视图：使用固定大小，不依赖dayWidth（因为dayWidth太小）
    size = Math.min(props.rowHeight, 20)
  } else if (props.currentTimeScale === TimelineScale.WEEK) {
    // 周视图：可以稍微依赖dayWidth，但有合理范围
    size = Math.min(props.rowHeight, Math.max(props.dayWidth * 0.8, 16), 24)
  } else {
    // 日视图：保持原有逻辑
    size = Math.min(props.rowHeight, props.dayWidth * 1.2, 24)
  }

  // 年度视图：使用专门的年度位置计算
  if (props.currentTimeScale === TimelineScale.YEAR) {
    const centerPosition = calculateYearViewMilestonePosition(milestoneDate, props.startDate)
    left = centerPosition - size / 2 // 从中心位置偏移到图标左上角
  } else if (props.currentTimeScale === TimelineScale.QUARTER) {
    // 季度视图：使用类似年度视图的简单计算方法
    const centerPosition = calculateQuarterViewMilestonePosition(milestoneDate, props.startDate)
    left = centerPosition - size / 2 // 从中心位置偏移到图标左上角
  } else if (props.currentTimeScale === TimelineScale.HOUR) {
    // 小时视图：精确到小时和分钟的定位
    const centerPosition = calculateHourViewMilestonePosition(milestoneDate, props.startDate)
    left = centerPosition - size / 2 // 从中心位置偏移到图标左上角
  } else if (
    props.timelineData &&
    props.currentTimeScale &&
    (props.currentTimeScale === TimelineScale.WEEK ||
      props.currentTimeScale === TimelineScale.MONTH)
  ) {
    // 优先使用基于timelineData的精确定位（适用于周视图和月视图）
    const centerPosition = calculateMilestonePositionFromTimelineData(
      milestoneDate,
      props.timelineData,
      props.currentTimeScale,
    )

    left = centerPosition - size / 2 // 从中心位置偏移到图标左上角
  } else {
    // 日视图：保持原有逻辑
    const startDiff = Math.floor(
      (milestoneDate.getTime() - props.startDate.getTime()) / (1000 * 60 * 60 * 24),
    )
    left = startDiff * props.dayWidth + props.dayWidth / 2 - size / 2
  }

  return {
    left: `${left}px`,
    top: `${(props.rowHeight - size) / 2}px`,
    width: 'auto',
    height: 'auto',
  }
})

// 里程碑统一使用红色配色
const milestoneColor = computed(() => {
  // 使用危险色（红色）统一里程碑配色
  return 'var(--gantt-danger, #f56c6c)'
})
const milestoneBorder = computed(() => {
  // 稍浅的红色作为边框
  return 'var(--gantt-danger-light, #fab6b6)'
})

// 计算里程碑图标类型
const milestoneIcon = computed(() => {
  return props.milestone?.icon || 'diamond' // 默认为菱形
})

// 计算里程碑的边界粘性显示状态（包含推挤效果）
const milestoneVisibility = computed(() => {
  const scrollLeft = props.scrollLeft || 0
  const containerWidth = props.containerWidth || 0

  // 如果没有有效的滚动信息，正常显示
  if (!containerWidth || containerWidth <= 0) {
    return {
      showIcon: true,
      showLabel: true,
      isSticky: false,
      stickyPosition: 'none',
      iconLeft: '0px',
      isPushedOut: false,
      clipPath: 'none',
      isFullyVisible: true, // 无滚动信息时认为完全可见
    }
  }

  // 获取当前里程碑的位置
  const milestoneLeft = parseInt(milestoneStyle.value.left) + 12 // 图标中心位置
  const leftBoundary = scrollLeft
  const rightBoundary = scrollLeft + containerWidth
  const iconSize = 24 // 图标大小
  const iconLeft = milestoneLeft - iconSize / 2
  const iconRight = milestoneLeft + iconSize / 2
  const currentId = props.milestoneId

  // 判断里程碑是否完全在视野内（左右边界都不碰到）
  const isFullyVisible = iconLeft >= leftBoundary && iconRight <= rightBoundary

  // 检查是否被其他里程碑推挤
  const otherMilestones = props.otherMilestones || []

  // 左侧边界逻辑
  if (iconRight <= leftBoundary + iconSize / 2) {
    // 检查左侧是否有其他停靠的里程碑，需要判断推挤优先级
    const leftStickyMilestones = otherMilestones.filter(
      m => m.id !== currentId && m.stickyPosition === 'left' && m.isSticky,
    )

    // 如果有其他里程碑已经停靠在左侧，比较优先级决定推挤顺序
    if (leftStickyMilestones.length > 0) {
      // 获取当前里程碑的原始位置（不考虑停靠）
      const currentOriginalLeft = parseInt(milestoneStyle.value.left) + 12

      // 检查是否有里程碑的原始位置比当前里程碑更靠右（即后来者推挤先来者）
      const hasLaterMilestone = leftStickyMilestones.some(m => {
        // 后来的里程碑（原始位置更靠右，数值更大）会推挤先来的人
        return m.originalLeft > currentOriginalLeft
      })

      if (hasLaterMilestone) {
        // 被后来的里程碑推出边界，完全隐藏
        return {
          showIcon: false,
          showLabel: false,
          isSticky: false,
          stickyPosition: 'none',
          iconLeft: '0px',
          isPushedOut: true,
          clipPath: 'none',
          isFullyVisible: false,
        }
      }
    }

    // 停靠在左边界，显示右半部分
    return {
      showIcon: true,
      showLabel: false,
      isSticky: true,
      stickyPosition: 'left',
      iconLeft: `${leftBoundary - parseInt(milestoneStyle.value.left) - iconSize / 2}px`,
      isPushedOut: false,
      clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)', // 只显示右半部分
      isFullyVisible: false,
    }
  }

  // 右侧边界逻辑
  if (iconLeft >= rightBoundary - iconSize / 2) {
    // 检查右侧是否有其他停靠的里程碑，需要判断推挤优先级
    const rightStickyMilestones = otherMilestones.filter(
      m => m.id !== currentId && m.stickyPosition === 'right' && m.isSticky,
    )

    // 如果有其他里程碑已经停靠在右侧，比较优先级决定推挤顺序
    if (rightStickyMilestones.length > 0) {
      // 获取当前里程碑的原始位置（不考虑停靠）
      const currentOriginalLeft = parseInt(milestoneStyle.value.left) + 12

      // 检查是否有里程碑的原始位置比当前里程碑更靠左（即后来者推挤先来者）
      const hasLaterMilestone = rightStickyMilestones.some(m => {
        // 后来的里程碑（原始位置更靠左，数值更小）会推挤先来的人
        return m.originalLeft < currentOriginalLeft
      })

      if (hasLaterMilestone) {
        // 被后来的里程碑推出边界，完全隐藏
        return {
          showIcon: false,
          showLabel: false,
          isSticky: false,
          stickyPosition: 'none',
          iconLeft: '0px',
          isPushedOut: true,
          clipPath: 'none',
          isFullyVisible: false,
        }
      }
    }

    // 停靠在右边界，显示左半部分
    return {
      showIcon: true,
      showLabel: false,
      isSticky: true,
      stickyPosition: 'right',
      iconLeft: `${rightBoundary - parseInt(milestoneStyle.value.left) - iconSize / 2}px`,
      isPushedOut: false,
      clipPath: 'polygon(0% 0%, 50% 0%, 50% 100%, 0% 100%)', // 只显示左半部分
      isFullyVisible: false,
    }
  }

  // 图标在边界内，正常显示
  return {
    showIcon: true,
    showLabel: true,
    isSticky: false,
    stickyPosition: 'none',
    iconLeft: '0px',
    isPushedOut: false,
    clipPath: 'none',
    isFullyVisible,
  }
})

// Tooltip状态管理
const showTooltip = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })

// 处理里程碑悬停 - 只在停靠状态且显示图标时显示tooltip
const handleMilestoneMouseEnter = (event: MouseEvent) => {
  // 只有在停靠状态、显示图标且未被推出时才显示tooltip
  if (
    milestoneVisibility.value.isSticky &&
    milestoneVisibility.value.showIcon &&
    !milestoneVisibility.value.isPushedOut
  ) {
    showTooltip.value = true

    // 计算tooltip位置
    const rightOffset = !props.milestone || props.milestone?.icon === 'diamond' ? -300 : -270
    const offsetX = milestoneVisibility.value.stickyPosition === 'left' ? 10 : rightOffset // 左侧停靠在右侧显示，右侧停靠在左侧显示

    tooltipPosition.value = {
      x: event.clientX + offsetX,
      y: event.clientY - 10,
    }
  }
}

const handleMilestoneMouseLeave = () => {
  showTooltip.value = false
}

// 格式化日期显示
const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return t('dateNotSet') //Not Set

  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return t('dateNotSet')

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return t('dateNotSet')
  }
}

// Tooltip内容
const tooltipContent = computed(() => {
  const milestoneName = props.name || props.milestone?.name || t('milestone')
  const targetDate = formatDisplayDate(props.date || props.milestone?.startDate || '')
  return `${t('milestone')}：${milestoneName} - ${t('targetDate')}：${targetDate}`
})

// 组件销毁时清理事件监听器
onUnmounted(() => {
  // 清理拖拽状态
  isDragging.value = false
  tempMilestoneData.value = null

  // 移除事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})

// 年度视图里程碑位置计算函数
const calculateYearViewMilestonePosition = (targetDate: Date, baseStartDate: Date): number => {
  const targetYear = targetDate.getFullYear()
  const baseYear = baseStartDate.getFullYear()

  // 每年的宽度是360px，每半年180px
  const yearWidth = 360
  const halfYearWidth = 180

  // 计算目标年份相对于基准年份的偏移
  const yearOffset = targetYear - baseYear
  let position = yearOffset * yearWidth

  // 判断是上半年还是下半年
  const month = targetDate.getMonth() + 1 // getMonth()返回0-11，需要+1

  if (month > 6) {
    // 下半年，添加半年偏移
    position += halfYearWidth
  }

  // 在半年内的具体位置计算
  let dayOffset = 0
  let startOfHalfYear: Date

  if (month <= 6) {
    // 上半年：1-6月
    startOfHalfYear = new Date(targetYear, 0, 1) // 1月1日
  } else {
    // 下半年：7-12月
    startOfHalfYear = new Date(targetYear, 6, 1) // 7月1日
  }

  dayOffset = Math.floor((targetDate.getTime() - startOfHalfYear.getTime()) / (1000 * 60 * 60 * 24))

  // 半年大约181-184天，将天数映射到180px的宽度
  const daysInHalfYear =
    month <= 6
      ? Math.floor(
        (new Date(targetYear, 6, 1).getTime() - new Date(targetYear, 0, 1).getTime()) /
            (1000 * 60 * 60 * 24),
      )
      : Math.floor(
        (new Date(targetYear + 1, 0, 1).getTime() - new Date(targetYear, 6, 1).getTime()) /
            (1000 * 60 * 60 * 24),
      )

  const dayPositionInHalfYear = (dayOffset / daysInHalfYear) * halfYearWidth
  position += dayPositionInHalfYear

  return position
}

// 小时视图里程碑位置计算 - 精确到小时和分钟
const calculateHourViewMilestonePosition = (targetDate: Date, baseStartDate: Date): number => {
  // 计算基础天数差
  const targetNormalized = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  )
  const baseNormalized = new Date(
    baseStartDate.getFullYear(),
    baseStartDate.getMonth(),
    baseStartDate.getDate(),
  )
  const timeDiff = targetNormalized.getTime() - baseNormalized.getTime()
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))

  // 每天960px (24小时 * 40px)
  const dayWidth = 960
  const baseDayPosition = daysDiff * dayWidth

  // 小时偏移：每小时40px
  const currentHour = targetDate.getHours()
  const hourOffset = currentHour * 40

  // 分钟偏移：在当前小时内的精确位置
  const currentMinute = targetDate.getMinutes()
  const minuteOffset = (currentMinute / 60) * 40

  const totalPosition = baseDayPosition + hourOffset + minuteOffset

  return totalPosition
}

// 季度视图里程碑位置计算 - 参考年度视图的简单算法
const calculateQuarterViewMilestonePosition = (targetDate: Date, baseStartDate: Date): number => {
  const targetYear = targetDate.getFullYear()
  const baseYear = baseStartDate.getFullYear()

  // 每年的宽度是240px (4季度 * 60px)，每季度60px
  const yearWidth = 240
  const quarterWidth = 60

  // 计算目标年份相对于基准年份的偏移
  const yearOffset = targetYear - baseYear
  let position = yearOffset * yearWidth

  // 判断是哪个季度
  const month = targetDate.getMonth() + 1 // getMonth()返回0-11，需要+1
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

  // 添加季度偏移 (Q1=0px, Q2=60px, Q3=120px, Q4=180px)
  position += (quarter - 1) * quarterWidth

  // 在季度内的具体位置计算
  let dayOffset = 0
  let startOfQuarter: Date
  let endOfQuarter: Date

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

  dayOffset = Math.floor((targetDate.getTime() - startOfQuarter.getTime()) / (1000 * 60 * 60 * 24))

  // 计算季度内的天数，将天数映射到60px的宽度
  const endTime = endOfQuarter.getTime()
  const startTime = startOfQuarter.getTime()
  const daysInQuarter = Math.floor((endTime - startTime) / (1000 * 60 * 60 * 24)) + 1 // 包含结束日期

  const dayPositionInQuarter = (dayOffset / daysInQuarter) * quarterWidth

  position += dayPositionInQuarter

  return position
}

// 基于timelineData和subDays精确计算里程碑位置的函数
const calculateMilestonePositionFromTimelineData = (
  targetDate: Date,
  timelineData: any,
  timeScale: TimelineScale,
) => {
  // 回退到原来的逻辑用于其他时间刻度
  let cumulativePosition = 0

  for (const periodData of timelineData) {
    if (timeScale === TimelineScale.WEEK) {
      // 周视图：处理嵌套的weeks结构，返回中心位置
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
              return cumulativePosition + i * dayWidth + dayWidth / 2
            }
          }

          // 如果没找到精确匹配，回退到dayOfWeek计算
          // 注意：getDay()返回0=星期日，1=星期一...6=星期六
          // 但subDays数组是从星期一开始：索引0=星期一，索引1=星期二...索引6=星期日
          const dayOfWeek = targetDate.getDay()
          const adjustedDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 转换为subDays数组索引
          return cumulativePosition + adjustedDayIndex * dayWidth + dayWidth / 2
        }

        // 累加每周的宽度
        cumulativePosition += 60
      }
    } else if (timeScale === TimelineScale.MONTH) {
      // 月视图：处理扁平化的subDays结构，返回中心位置
      const periodStart = new Date(periodData.startDate)
      const periodEnd = new Date(periodData.endDate)

      if (targetDate >= periodStart && targetDate <= periodEnd) {
        // 找到目标日期所在的时间段
        const monthWidth = 60
        const daysInMonth = periodData.monthData?.dayCount || 30
        const dayWidth = monthWidth / daysInMonth
        const dayInMonth = targetDate.getDate()
        const finalPosition = cumulativePosition + (dayInMonth - 1) * dayWidth + dayWidth / 2

        return finalPosition
      }

      // 累加每月的宽度
      cumulativePosition += 60
    }
  }

  return cumulativePosition // 如果没找到，返回累计位置
}

// ...existing code...
</script>

<template>
  <div
    class="milestone"
    :style="milestoneStyle"
    :title="milestoneVisibility.isSticky ? '' : props.name || '里程碑'"
    :class="{
      dragging: isDragging,
      'milestone-sticky': milestoneVisibility.isSticky,
      'milestone-sticky-left': milestoneVisibility.stickyPosition === 'left',
      'milestone-sticky-right': milestoneVisibility.stickyPosition === 'right',
      'milestone-pushed-out': milestoneVisibility.isPushedOut,
    }"
    @click.stop="handleMilestoneClick"
  >
    <svg
      v-if="milestoneVisibility.showIcon"
      :width="24"
      :height="24"
      :viewBox="`0 0 24 24`"
      :style="{
        position: milestoneVisibility.isSticky ? 'relative' : 'static',
        left: milestoneVisibility.isSticky ? milestoneVisibility.iconLeft : '0px',
        clipPath: milestoneVisibility.clipPath,
        zIndex: milestoneVisibility.isSticky ? 200 : 120,
      }"
      style="cursor: pointer"
      @mouseenter="handleMilestoneMouseEnter"
      @mouseleave="handleMilestoneMouseLeave"
      @click.stop="handleMilestoneClick"
      @dblclick.stop="handleDoubleClick"
      @mousedown.stop="handleMouseDown"
    >
      <!-- 菱形图标 -->
      <g v-if="milestoneIcon === 'diamond'" transform="rotate(45 16 16)">
        <rect
          x="4"
          y="8"
          width="15"
          height="15"
          rx="6"
          ry="6"
          :fill="milestoneColor"
          :stroke="milestoneBorder"
          stroke-width="2"
        />
      </g>

      <!-- 火箭图标 -->
      <g v-else-if="milestoneIcon === 'rocket'">
        <foreignObject x="0" y="0" width="24" height="24">
          <div class="rocket-emoji">🚀</div>
        </foreignObject>
      </g>

      <!-- 默认菱形图标 -->
      <g v-else transform="rotate(45 16 16)">
        <rect
          x="4"
          y="8"
          width="15"
          height="15"
          rx="6"
          ry="6"
          :fill="milestoneColor"
          :stroke="milestoneBorder"
          stroke-width="2"
        />
      </g>
    </svg>
    <!-- 里程碑标签 - 只在非停靠状态显示 -->
    <span
      v-if="props.name && milestoneVisibility.showLabel"
      class="milestone-label milestone-label-right"
    >
      {{ props.name }}
    </span>
  </div>

  <!-- Tooltip 弹窗 - 只在停靠状态显示 -->
  <Teleport to="body">
    <div
      v-if="showTooltip && milestoneVisibility.isSticky"
      class="milestone-tooltip"
      :style="{
        left: `${tooltipPosition.x}px`,
        top: `${tooltipPosition.y}px`,
      }"
    >
      <div class="tooltip-content">
        {{ tooltipContent }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@import '../styles/theme-variables.css';

.milestone {
  position: absolute;
  z-index: 120;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
  user-select: none;
}

/* 里程碑SVG发光效果 */
.milestone svg {
  filter: drop-shadow(0 0 8px var(--gantt-danger, #f56c6c));
  animation: milestone-glow 2s ease-in-out infinite alternate;
}

/* 里程碑发光动画 */
@keyframes milestone-glow {
  from {
    filter: drop-shadow(0 0 4px var(--gantt-danger, #f56c6c));
  }
  to {
    filter: drop-shadow(0 0 12px var(--gantt-danger, #f56c6c))
      drop-shadow(0 0 20px rgba(245, 108, 108, 0.3));
  }
}

/* 悬停时增强发光效果 */
.milestone:hover svg {
  filter: drop-shadow(0 0 16px var(--gantt-danger, #f56c6c))
    drop-shadow(0 0 24px rgba(245, 108, 108, 0.4));
  animation: milestone-glow-intense 1.5s ease-in-out infinite alternate;
}

@keyframes milestone-glow-intense {
  from {
    filter: drop-shadow(0 0 12px var(--gantt-danger, #f56c6c))
      drop-shadow(0 0 20px rgba(245, 108, 108, 0.4));
  }
  to {
    filter: drop-shadow(0 0 20px var(--gantt-danger, #f56c6c))
      drop-shadow(0 0 32px rgba(245, 108, 108, 0.6));
  }
}

.milestone-label {
  font-size: 12px;
  font-weight: bold;
  color: var(--gantt-text-primary, #222);
  white-space: nowrap;
  z-index: 10; /* 确保标签在上层 */
}

.milestone-label-right {
  margin-left: 5px;
  align-self: center;
}

/* 粘性标签的特殊样式 */
.milestone-label[style*='position: absolute'] {
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 6px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(245, 108, 108, 0.2);
  backdrop-filter: blur(4px);
}

/* 火箭emoji样式 */
.rocket-emoji {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  transform: rotate(-45deg);
  transition: transform 0.3s ease;
}

/* 火箭emoji悬停效果 */
.milestone:hover .rocket-emoji {
  transform: rotate(-45deg) scale(1.1);
}

/* 暗黑模式下的适配 */
:global(html[data-theme='dark']) .milestone-label {
  color: var(--gantt-text-white, #ffffff) !important;
}

/* 暗黑模式下的粘性标签样式 */
:global(html[data-theme='dark']) .milestone-label[style*='position: absolute'] {
  background: rgba(30, 30, 30, 0.9) !important;
  border-color: rgba(246, 124, 124, 0.3) !important;
  color: #ffffff !important;
}

:global(html[data-theme='dark']) .milestone svg {
  filter: drop-shadow(0 0 8px var(--gantt-danger, #f67c7c));
  animation: milestone-glow-dark 2s ease-in-out infinite alternate;
}

:global(html[data-theme='dark']) .milestone:hover svg {
  filter: drop-shadow(0 0 16px var(--gantt-danger, #f67c7c))
    drop-shadow(0 0 24px rgba(246, 124, 124, 0.4));
  animation: milestone-glow-intense-dark 1.5s ease-in-out infinite alternate;
}

/* 暗黑模式发光动画 */
@keyframes milestone-glow-dark {
  from {
    filter: drop-shadow(0 0 4px var(--gantt-danger, #f67c7c));
  }
  to {
    filter: drop-shadow(0 0 12px var(--gantt-danger, #f67c7c))
      drop-shadow(0 0 20px rgba(246, 124, 124, 0.3));
  }
}

@keyframes milestone-glow-intense-dark {
  from {
    filter: drop-shadow(0 0 12px var(--gantt-danger, #f67c7c))
      drop-shadow(0 0 20px rgba(246, 124, 124, 0.4));
  }
  to {
    filter: drop-shadow(0 0 20px var(--gantt-danger, #f67c7c))
      drop-shadow(0 0 32px rgba(246, 124, 124, 0.6));
  }
}

/* 拖拽状态样式 */
.milestone.dragging {
  z-index: 1000;
  opacity: 0.8;
  transform: scale(1.1);
  cursor: grabbing;
}

.milestone.dragging svg {
  filter: drop-shadow(0 0 20px var(--gantt-danger, #f56c6c))
    drop-shadow(0 0 32px rgba(245, 108, 108, 0.6));
  animation: none;
}

:global(html[data-theme='dark']) .milestone.dragging svg {
  filter: drop-shadow(0 0 20px var(--gantt-danger, #f67c7c))
    drop-shadow(0 0 32px rgba(246, 124, 124, 0.6));
}

/* 停靠状态的特殊样式 */
.milestone-sticky svg {
  z-index: 150;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.milestone-sticky-left svg {
  animation: milestone-glow-sticky 3s ease-in-out infinite alternate;
}

.milestone-sticky-right svg {
  animation: milestone-glow-sticky 3s ease-in-out infinite alternate;
}

/* 半图标显示时取消发光效果 */
.milestone-sticky-left svg[style*='clip-path'],
.milestone-sticky-right svg[style*='clip-path'] {
  animation: none;
  filter: none;
}

@keyframes milestone-glow-sticky {
  from {
    filter: drop-shadow(0 0 6px var(--gantt-danger, #f56c6c))
      drop-shadow(0 0 12px rgba(245, 108, 108, 0.4));
  }
  to {
    filter: drop-shadow(0 0 10px var(--gantt-danger, #f56c6c))
      drop-shadow(0 0 20px rgba(245, 108, 108, 0.6));
  }
}

/* 暗黑模式下的停靠状态样式 */
:global(html[data-theme='dark']) .milestone-sticky-left svg,
:global(html[data-theme='dark']) .milestone-sticky-right svg {
  animation: milestone-glow-sticky-dark 3s ease-in-out infinite alternate;
}

/* 暗黑模式下半图标显示时取消发光效果 */
:global(html[data-theme='dark']) .milestone-sticky-left svg[style*='clip-path'],
:global(html[data-theme='dark']) .milestone-sticky-right svg[style*='clip-path'] {
  animation: none;
  filter: none;
}

@keyframes milestone-glow-sticky-dark {
  from {
    filter: drop-shadow(0 0 6px var(--gantt-danger, #f67c7c))
      drop-shadow(0 0 12px rgba(246, 124, 124, 0.4));
  }
  to {
    filter: drop-shadow(0 0 10px var(--gantt-danger, #f67c7c))
      drop-shadow(0 0 20px rgba(246, 124, 124, 0.6));
  }
}

/* 半图标显示效果 - 优化clip-path过渡 */
.milestone-sticky svg[style*='clip-path'] {
  transition:
    clip-path 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    filter 0.3s ease-in-out;
}

/* 左侧停靠的半图标效果增强 */
.milestone-sticky-left svg[style*='clip-path'] {
  transform-origin: 100% 50%; /* 右侧为缩放原点 */
}

/* 右侧停靠的半图标效果增强 */
.milestone-sticky-right svg[style*='clip-path'] {
  transform-origin: 0% 50%; /* 左侧为缩放原点 */
}

/* 半图标悬停效果 */
.milestone-sticky svg[style*='clip-path']:hover {
  transform: scale(1.15);
  filter: drop-shadow(0 0 18px var(--gantt-danger, #f56c6c))
    drop-shadow(0 0 30px rgba(245, 108, 108, 0.8));
}

.milestone-sticky.milestone-pushing svg {
  transform: scale(1.1);
  filter: drop-shadow(0 0 15px var(--gantt-danger, #f56c6c))
    drop-shadow(0 0 25px rgba(245, 108, 108, 0.7));
}

/* 停靠状态的增强发光效果 */
.milestone-sticky-left svg,
.milestone-sticky-right svg {
  animation: milestone-glow-sticky-enhanced 2s ease-in-out infinite alternate;
}

@keyframes milestone-glow-sticky-enhanced {
  from {
    filter: drop-shadow(0 0 8px var(--gantt-danger, #f56c6c))
      drop-shadow(0 0 16px rgba(245, 108, 108, 0.5));
  }
  to {
    filter: drop-shadow(0 0 12px var(--gantt-danger, #f56c6c))
      drop-shadow(0 0 24px rgba(245, 108, 108, 0.7)) drop-shadow(0 0 32px rgba(245, 108, 108, 0.3));
  }
}

/* === Milestone Tooltip 样式 === */
.milestone-tooltip {
  position: fixed;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  z-index: 10000; /* 确保在最上层 */
  max-width: 300px;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.3),
    0 2px 6px rgba(0, 0, 0, 0.2);
  pointer-events: none;
  backdrop-filter: blur(4px);
}

.milestone-tooltip .tooltip-content {
  font-weight: 600;
  color: #ffffff;
  line-height: 1.4;
}

/* 暗黑模式下的Tooltip样式 */
:global(html[data-theme='dark']) .milestone-tooltip {
  background: rgba(30, 30, 30, 0.95) !important;
  color: #ffffff !important;
}

/* 推挤状态的视觉增强 */
.milestone-pushing {
  animation: milestone-pushing-pulse 0.6s ease-in-out;
}

@keyframes milestone-pushing-pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
    filter: drop-shadow(0 0 12px var(--gantt-danger, #f56c6c))
      drop-shadow(0 0 20px rgba(245, 108, 108, 0.6));
  }
  100% {
    transform: scale(1);
  }
}

/* 推挤动画效果 - 被推出边界的里程碑 */
.milestone-pushed-out {
  opacity: 0;
  transform: scale(0.6) translateY(-10px);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

/* 停靠状态的交互提示 */
.milestone-sticky svg:hover {
  transform: scale(1.05);
  cursor: pointer;
}

/* 停靠状态下的点击提示 */
.milestone-sticky svg:active {
  transform: scale(0.95);
}
</style>

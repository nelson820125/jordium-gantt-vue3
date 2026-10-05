/* eslint-disable @typescript-eslint/no-explicit-any */
<script setup lang="ts">
import { computed, ref, onUnmounted, onUpdated, useSlots } from 'vue'
import type { Milestone } from '../models/classes/Milestone'
import type { Task } from '../models/classes/Task'
import { TimelineScale } from '../models/types/TimelineScale'
import type {
  TimelineMonth,
  TimelineYear,
  TimelineDay,
  MilestoneTooltipShowPayload,
  MilestoneSlotProps,
} from '../models/types/TimelineDataTypes'
import { createLocalDate } from '../utils/predecessorUtils'
const props = defineProps<Props>()

defineSlots<{
  'custom-milestone-content'(props: MilestoneSlotProps): unknown
}>()

// 添加事件定义
const emit = defineEmits<{
  'milestone-double-click': [milestone: Milestone]
  'update:milestone': [milestone: Milestone] // 新增里程碑更新事件
  'drag-end': [milestone: Milestone] // 新增
  // 磁吸气泡悬停 tooltip（用户设置了 #milestone-tooltip slot 时，由 Timeline 统一渲染）
  'milestone-tooltip-show': [payload: MilestoneTooltipShowPayload]
  'milestone-tooltip-hide': []
}>()

interface Props {
  date: string
  milestone: Milestone
  task?: Task
  name?: string
  rowHeight: number
  dayWidth: number
  startDate: Date
  timelineStart: Date
  timelineEnd: Date
  /** 标签展示位置，默认 'right'（与现状保持一致） */
  labelPosition?: 'left' | 'top' | 'right' | 'bottom'
  scrollLeft?: number
  containerWidth?: number
  milestoneId?: number
  otherMilestones?: Array<{
    id: number
    isSticky: boolean
    stickyPosition: string
    left: number
    originalLeft: number
    priority: number
  }>
  currentTimeScale?: TimelineScale | null
  timelineData?: TimelineMonth[] | TimelineYear[] | TimelineDay[]
  periodWidth: number
  isInHighlightMode?: boolean
  allowDragAndResize: boolean
}

// 拖拽相关状态
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartLeft = ref(0)
const tempMilestoneData = ref<{ startDate?: string } | null>(null)
// 默认图标（菱形/火箭等）的 <svg> 引用，用于 tooltip 定位取图标自身的包围盒，
// 避免因外层容器包含标签（labelPosition 不同时标签宽高各异）导致 tooltip 锚点偏离图标本身
const iconRef = ref<SVGElement | null>(null)
// custom-milestone-content 插槽内容的外层 wrapper 引用，用于 tooltip 定位——
// 该 wrapper 才是磁吸停靠时实际应用 position:relative + left 偏移/clipPath 裁剪的元素，
// 外层 .milestone 容器的包围盒不会随停靠偏移变化（偏移只加在 wrapper 上）。
const customContentRef = ref<HTMLElement | null>(null)

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

// 根据像素位置计算日期（支持月度、季度视图）
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
  timeScale: TimelineScale
): Date | null => {
  if (!timelineData) {
    return null
  }

  let cumulativePosition = 0

  if (timeScale === TimelineScale.DAY) {
    // 日视图：基于 days 数组
    for (const periodData of timelineData) {
      const days = periodData.days || []
      const periodWidth = days.length * props.dayWidth

      if (pixelPosition >= cumulativePosition && pixelPosition < cumulativePosition + periodWidth) {
        const relativePosition = pixelPosition - cumulativePosition
        const dayIndex = Math.floor(relativePosition / props.dayWidth)

        if (dayIndex >= 0 && dayIndex < days.length) {
          return new Date(days[dayIndex].date)
        }
      }

      cumulativePosition += periodWidth
    }
  } else if (timeScale === TimelineScale.MONTH) {
    // 月视图
    for (const periodData of timelineData) {
      const monthWidth = props.dayWidth * 30

      if (pixelPosition >= cumulativePosition && pixelPosition < cumulativePosition + monthWidth) {
        const relativePosition = pixelPosition - cumulativePosition
        const daysInMonth = periodData.monthData?.dayCount || 30
        const dayWidth = monthWidth / daysInMonth

        const dayIndex = Math.floor(relativePosition / dayWidth)
        const day = Math.min(dayIndex + 1, daysInMonth)

        return new Date(periodData.year, periodData.month - 1, day)
      }

      cumulativePosition += monthWidth
    }
  } else if (timeScale === TimelineScale.QUARTER) {
    // 季度视图：每个季度60px
    for (const periodData of timelineData) {
      const quarters =
        ((periodData as Record<string, unknown>).quarters as Array<{
          quarter: number
          startDate: Date
          endDate: Date
        }>) || []

      for (const quarter of quarters) {
        const quarterStart = new Date(quarter.startDate)
        const quarterEnd = new Date(quarter.endDate)
        const quarterWidth = props.dayWidth * 90

        if (
          pixelPosition >= cumulativePosition &&
          pixelPosition < cumulativePosition + quarterWidth
        ) {
          const relativePosition = pixelPosition - cumulativePosition
          const daysInQuarter = Math.ceil(
            (quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24)
          )
          const dayWidth = quarterWidth / daysInQuarter

          const dayIndex = Math.floor(relativePosition / dayWidth)

          const resultDate = new Date(quarterStart)
          resultDate.setDate(resultDate.getDate() + dayIndex)

          return resultDate
        }

        cumulativePosition += props.dayWidth * 90
      }
    }
  } else if (timeScale === TimelineScale.YEAR) {
    // 年度视图：每个年份包含 halfYears
    for (const periodData of timelineData) {
      const halfYears =
        ((periodData as Record<string, unknown>).halfYears as Array<{
          startDate: Date
          endDate: Date
        }>) || []

      for (const halfYear of halfYears) {
        const halfYearStart = new Date(halfYear.startDate)
        const halfYearEnd = new Date(halfYear.endDate)
        const halfYearWidth = props.dayWidth * (365 / 2)

        if (
          pixelPosition >= cumulativePosition &&
          pixelPosition < cumulativePosition + halfYearWidth
        ) {
          const relativePosition = pixelPosition - cumulativePosition
          const daysInHalfYear =
            Math.round((halfYearEnd.getTime() - halfYearStart.getTime()) / (1000 * 60 * 60 * 24)) +
            1
          const dayWidth = halfYearWidth / daysInHalfYear
          const dayIndex = Math.floor(relativePosition / dayWidth)

          const resultDate = new Date(halfYearStart)
          resultDate.setDate(resultDate.getDate() + dayIndex)
          return resultDate
        }

        cumulativePosition += halfYearWidth
      }
    }
  }

  return null
}

// 拖拽事件处理 - 使用相对位置拖拽方案
const handleMouseDown = (e: MouseEvent) => {
  // 如果禁用了拖拽和拉伸，直接返回
  if (props.allowDragAndResize === false) {
    return
  }

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
    })
  )

  const deltaX = e.clientX - dragStartX.value

  // 只有在真正移动了一定距离后才开始拖拽（避免意外触发）
  if (Math.abs(deltaX) > 3) {
    isDragging.value = true

    const newLeft = Math.max(0, dragStartLeft.value + deltaX)
    let newStartDate: Date

    // 根据当前时间刻度使用不同的日期计算方法
    if (
      props.currentTimeScale === TimelineScale.MONTH ||
      props.currentTimeScale === TimelineScale.QUARTER ||
      props.currentTimeScale === TimelineScale.DAY ||
      props.currentTimeScale === TimelineScale.YEAR
    ) {
      // 月度、季度、日视图：使用 timelineData 精确计算
      if (props.timelineData && props.currentTimeScale) {
        const calculatedDate = calculateDateFromPosition(
          newLeft,
          props.timelineData as Array<{
            year: number
            month: number
            startDate: Date
            endDate: Date
            days?: Array<{ date: Date; day: number }>
            monthData?: { dayCount: number }
          }>,
          props.currentTimeScale
        )
        if (calculatedDate) {
          newStartDate = calculatedDate
        } else {
          // 如果计算失败，回退到简单计算
          newStartDate = addDaysToLocalDate(props.startDate, newLeft / props.dayWidth)
        }
      } else {
        // 如果没有 timelineData，回退到简单计算
        newStartDate = addDaysToLocalDate(props.startDate, newLeft / props.dayWidth)
      }
    } else {
      // 其他视图（周视图、小时视图）：使用原有的简单计算
      newStartDate = addDaysToLocalDate(props.startDate, newLeft / props.dayWidth)
    }

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
    })
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
      })
    )
  }
}

// 判断是否应该显示为暗淡（处于高亮模式）
const isDimmed = computed(() => {
  return props.isInHighlightMode === true
})

// 图标水平锚点位置（left，数值 px）：只由时间轴数据/日期决定，与 labelPosition、是否
// 显示标签完全无关。单独抽出为独立 computed，供 milestoneVisibility（磁吸边界判定）读取
// ——若改为让 milestoneVisibility 直接依赖 milestoneStyle.value.left，而 milestoneStyle
// 的 top 计算又需要读取 milestoneVisibility.value.showLabel（见下方），会形成循环依赖。
// 日期无效时返回 null，milestoneStyle 据此走 0,0 兜底分支。
const milestoneAnchorLeft = computed<number | null>(() => {
  const currentMilestoneDate = tempMilestoneData.value?.startDate || props.date
  const milestoneDate = createLocalDate(currentMilestoneDate)

  // 修正：防御性处理日期和startDate
  if (!props.startDate || !milestoneDate || isNaN(milestoneDate.getTime())) {
    return null
  }

  // 小时视图：使用专门的小时位置计算
  // SVG图标固定24×24，菱形视觉中心在SVG坐标x=12处，因此偏移量固定为12
  const ICON_CENTER_OFFSET = 12

  if (props.currentTimeScale === TimelineScale.HOUR) {
    // 小时视图：精确到小时和分钟的定位
    const centerPosition = calculateHourViewMilestonePosition(milestoneDate, props.startDate)
    return centerPosition - ICON_CENTER_OFFSET
  }

  if (
    props.timelineData &&
    props.currentTimeScale &&
    (props.currentTimeScale === TimelineScale.WEEK ||
      props.currentTimeScale === TimelineScale.MONTH ||
      props.currentTimeScale === TimelineScale.DAY ||
      props.currentTimeScale === TimelineScale.QUARTER ||
      props.currentTimeScale === TimelineScale.YEAR)
  ) {
    // 优先使用基于timelineData的精确定位（适用于周视图、月视图、日视图、季度视图和年度视图）
    const centerPosition = calculateMilestonePositionFromTimelineData(
      milestoneDate,
      props.timelineData,
      props.currentTimeScale
    )

    return centerPosition - ICON_CENTER_OFFSET
  }

  // 其他情况（没有 timelineData）：保持原有逻辑
  const startDiff = Math.floor(
    (milestoneDate.getTime() - props.startDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  return startDiff * props.dayWidth + props.dayWidth / 2 - ICON_CENTER_OFFSET
})

// 图标纯居中尺寸：labelPosition='right'/'left'，或 top/bottom 磁吸停靠隐藏标签时，
// 回退为纯图标居中所使用的尺寸假设（不同时间刻度下的图标视觉大小近似值）。
const milestoneIconSize = computed<number>(() => {
  if (
    props.currentTimeScale === TimelineScale.YEAR ||
    props.currentTimeScale === TimelineScale.QUARTER
  ) {
    // 年度视图：使用固定大小，不依赖dayWidth
    return Math.min(props.rowHeight, 24)
  } else if (props.currentTimeScale === TimelineScale.MONTH) {
    // 月度视图：使用固定大小，不依赖dayWidth（因为dayWidth太小）
    return Math.min(props.rowHeight, 20)
  } else if (props.currentTimeScale === TimelineScale.WEEK) {
    // 周视图：可以稍微依赖dayWidth，但有合理范围
    return Math.min(props.rowHeight, Math.max(props.dayWidth * 0.8, 16), 24)
  }
  // 日视图：保持原有逻辑
  return Math.min(props.rowHeight, props.dayWidth * 1.2, 24)
})

// 计算菱形位置 - 考虑拖拽临时数据
const milestoneStyle = computed(() => {
  if (milestoneAnchorLeft.value === null) {
    return {
      left: '0px',
      top: '0px',
      width: 'auto',
      height: 'auto',
    }
  }

  // labelPosition 为 top/bottom 且存在需要展示的标签内容（内置文字标签非空，或使用了
  // custom-milestone-content 插槽——插槽与非插槽共用完全相同的判定条件与计算公式）时，
  // 把"图标+标签"视为一个纵向堆叠整体，让整个堆叠块在行内垂直居中，而不是只让图标本身
  // 按纯图标尺寸居中——否则行高不足以容纳堆叠块时，标签会朝行外单向溢出。
  // 磁吸停靠时标签被隐藏（milestoneVisibility.showLabel === false），此时不需要再为标签
  // 预留空间，图标回退为与 labelPosition='right'/'left' 完全相同的纯图标居中——这是磁吸
  // 交互本身带来的合理位置调整（不再需要显示标签，图标自然回到"无标签"时的居中位置），
  // 不是位置跳变 bug。
  const hasStackableLabel =
    (effectiveLabelPosition.value === 'top' || effectiveLabelPosition.value === 'bottom') &&
    (hasContentSlot.value || Boolean(props.name)) &&
    milestoneVisibility.value.showLabel

  // 图标固定渲染尺寸：与 <svg :width="24" :height="24"> 及 custom-milestone-content
  // 插槽磁吸时钳制的 24px 宽度保持一致。
  const RENDERED_ICON_SIZE = 24
  // 标签纵向堆叠额外占用高度的估算值：内置文字标签约为 12px 字号 × ~1.2 行高 + 2px
  // 外边距 ≈ 16px。custom-milestone-content 插槽内容实际渲染高度不可预知，为保证
  // "插槽和非插槽使用同一套算法"，采用与非插槽完全相同的估算值/公式（若插槽内容实际
  // 渲染高度显著更高，仍可能溢出，属于消费方自定义内容尺寸的固有限制，非本次修复范围）。
  const LABEL_STACK_EXTRA = 16

  let top: number
  if (hasStackableLabel) {
    const stackTop = (props.rowHeight - (RENDERED_ICON_SIZE + LABEL_STACK_EXTRA)) / 2
    // labelPosition==='top'：标签在上、图标在下，图标位置 = 堆叠块顶部 + 标签占用高度；
    // labelPosition==='bottom'：图标在上、标签在下，图标就位于堆叠块顶部，无需额外偏移。
    top = effectiveLabelPosition.value === 'top' ? stackTop + LABEL_STACK_EXTRA : stackTop
  } else {
    top = (props.rowHeight - milestoneIconSize.value) / 2
  }

  return {
    left: `${milestoneAnchorLeft.value}px`,
    top: `${top}px`,
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

// 标签展示位置，默认 'right'（与改造前唯一实现保持一致，向后兼容）
const effectiveLabelPosition = computed(() => props.labelPosition || 'right')

// custom-milestone-content 自定义内容 slot
// 注意：useSlots() 返回的 slots 对象不是响应式代理，`computed(() => Boolean(slots['x']))`
// 不会被 Vue 的依赖追踪系统识别，父组件切换该具名插槽是否传入时（如 demo 中勾选/取消勾选
// "自定义里程碑内容" 复选框）不会触发本组件重新求值，导致图标/标签渲染分支停留在旧状态，
// 必须切换数据源触发组件重新挂载才能生效（用户反馈的 UX 问题）。
// 修复：改为普通 ref，并在 onUpdated（每次本组件重渲染后都会执行，父级具名插槽是动态的
// v-if 场景不会被 stable slots 优化跳过）里同步刷新，确保是真正被追踪的响应式数据源。
const slots = useSlots()
const hasContentSlot = ref(Boolean(slots['custom-milestone-content']))
onUpdated(() => {
  const current = Boolean(slots['custom-milestone-content'])
  if (hasContentSlot.value !== current) {
    hasContentSlot.value = current
  }
})

// slot payload：字段裁剪结论见 .ai/.claude/requirments/v1.13.5.md 8.2.2
// labelPosition：透出当前生效的标签展示位置，便于自定义内容按需调整自身布局
// （例如 top/bottom 时改为纵向堆叠），否则消费方无法感知该配置，自定义内容会始终
// 保持固定布局，看起来像是 labelPosition 对插槽完全不生效。
const slotPayload = computed<MilestoneSlotProps>(() => ({
  milestone: props.milestone,
  task: props.task ?? (props.milestone as unknown as Task),
  rowHeight: props.rowHeight,
  dayWidth: props.dayWidth,
  currentTimeScale: props.currentTimeScale,
  labelPosition: effectiveLabelPosition.value,
}))

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

  // 获取当前里程碑的位置（读取 milestoneAnchorLeft 而非 milestoneStyle.value.left，
  // 避免与 milestoneStyle 之间出现循环依赖——milestoneStyle 的 top 计算需要读取
  // milestoneVisibility.value.showLabel）
  const milestoneLeft = (milestoneAnchorLeft.value ?? 0) + 12 // 图标中心位置
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
      m => m.id !== currentId && m.stickyPosition === 'left' && m.isSticky
    )

    // 如果有其他里程碑已经停靠在左侧，比较优先级决定推挤顺序
    if (leftStickyMilestones.length > 0) {
      // 获取当前里程碑的原始位置（不考虑停靠）
      const currentOriginalLeft = (milestoneAnchorLeft.value ?? 0) + 12

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
      iconLeft: `${leftBoundary - (milestoneAnchorLeft.value ?? 0) - iconSize / 2}px`,
      isPushedOut: false,
      clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)', // 只显示右半部分
      isFullyVisible: false,
    }
  }

  // 右侧边界逻辑
  if (iconLeft >= rightBoundary - iconSize / 2) {
    // 检查右侧是否有其他停靠的里程碑，需要判断推挤优先级
    const rightStickyMilestones = otherMilestones.filter(
      m => m.id !== currentId && m.stickyPosition === 'right' && m.isSticky
    )

    // 如果有其他里程碑已经停靠在右侧，比较优先级决定推挤顺序
    if (rightStickyMilestones.length > 0) {
      // 获取当前里程碑的原始位置（不考虑停靠）
      const currentOriginalLeft = (milestoneAnchorLeft.value ?? 0) + 12

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
      iconLeft: `${rightBoundary - (milestoneAnchorLeft.value ?? 0) - iconSize / 2}px`,
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

// 处理里程碑悬停——停靠和正常可见状态均显示 Tooltip
const handleMilestoneMouseEnter = (event: MouseEvent) => {
  // 图标不可见或已被推出时不显示
  if (!milestoneVisibility.value.showIcon || milestoneVisibility.value.isPushedOut) return

  const el = event.currentTarget as HTMLElement
  // 悬停响应区域为"图标+标签"整个外层容器，但 tooltip 应始终锚定在图标本身，
  // 而不是（可能因 labelPosition 不同、标签文本长短不一而宽高各异的）整个容器，
  // 否则 labelPosition='right' 且标签较长时，tooltip 会明显偏离图标（远离 SVG）。
  // 使用默认图标时优先取 <svg> 自身包围盒定位。
  let targetRect = iconRef.value?.getBoundingClientRect()
  if (!targetRect) {
    // custom-milestone-content 插槽场景：内容由消费方自行渲染，宽高不固定
    // （例如图标+较长自定义标签文本），若直接用整个外层容器包围盒定位，容器右边缘会随
    // 标签文本长度变化，导致 Tooltip 明显偏离视觉上的「图标」部分（用户反馈的偏远问题）。
    // 约定：与内置图标+标签的渲染顺序一致，自定义内容里的图标类元素默认放在最前面
    // （flex-direction: row 起始处），因此按内置图标同款尺寸（24px）从容器左边缘
    // 构造一个近似「图标」的虚拟矩形用于定位，不受标签文本实际宽度影响。
    // 注意：磁吸停靠时 position:relative + left 偏移是加在 customContentRef（内层 wrapper）
    // 上的，外层 .milestone 容器 el 的包围盒不会随之偏移；必须优先使用 wrapper 的包围盒，
    // 否则右侧停靠时 tooltip 会明显偏离实际显示出来的半个图标（用户反馈的定位错误问题）。
    const anchorEl = customContentRef.value ?? el
    const containerRect = anchorEl.getBoundingClientRect()
    const approxIconWidth = Math.min(24, containerRect.width)
    targetRect = new DOMRect(
      containerRect.left,
      containerRect.top,
      approxIconWidth,
      containerRect.height
    )
  }

  // 停靠状态：使用已计算的停靠方向
  // 正常可见：根据元素在视窗中的位置判断——偏右则 tooltip 在左侧，偏左则在右侧
  let stickyPosition: 'left' | 'right'
  if (milestoneVisibility.value.isSticky) {
    stickyPosition = milestoneVisibility.value.stickyPosition as 'left' | 'right'
  } else {
    stickyPosition =
      targetRect.left + targetRect.width / 2 > window.innerWidth * 0.6 ? 'right' : 'left'
  }

  emit('milestone-tooltip-show', {
    milestone: props.milestone ?? {
      name: props.name ?? '',
      startDate: props.date,
      type: 'milestone',
    },
    milestoneColor: milestoneColor.value,
    targetRect,
    stickyPosition,
  })
}

const handleMilestoneMouseLeave = () => {
  emit('milestone-tooltip-hide')
}

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
// 小时视图里程碑位置计算 - 精确到小时和分钟
const calculateHourViewMilestonePosition = (targetDate: Date, baseStartDate: Date): number => {
  // 计算基础天数差
  const targetNormalized = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate()
  )
  const baseNormalized = new Date(
    baseStartDate.getFullYear(),
    baseStartDate.getMonth(),
    baseStartDate.getDate()
  )
  const timeDiff = targetNormalized.getTime() - baseNormalized.getTime()
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))

  // 每小时像素数 = props.dayWidth / 24
  const hourCellWidth = props.dayWidth / 24
  const baseDayPosition = daysDiff * props.dayWidth

  // 小时偏移
  const currentHour = targetDate.getHours()
  const hourOffset = currentHour * hourCellWidth

  // 分钟偏移：在当前小时内的精确位置
  const currentMinute = targetDate.getMinutes()
  const minuteOffset = (currentMinute / 60) * hourCellWidth

  const totalPosition = baseDayPosition + hourOffset + minuteOffset

  return totalPosition
}

// 基于timelineData和subDays精确计算里程碑位置的函数
const calculateMilestonePositionFromTimelineData = (
  targetDate: Date,
  timelineData: TimelineMonth[] | TimelineYear[] | TimelineDay[],
  timeScale: TimelineScale
) => {
  // 回退到原来的逻辑用于其他时间刻度
  let cumulativePosition = 0

  for (const periodData of timelineData) {
    if (timeScale === TimelineScale.DAY) {
      // 日视图：处理days数组，返回中心位置
      // 类型保护：确保 periodData 是 TimelineMonth 并有 days 属性
      const days = 'days' in periodData && periodData.days ? periodData.days : []

      for (let i = 0; i < days.length; i++) {
        const dayData = days[i]
        const dayDate = new Date(dayData.date)

        // 比较日期（忽略时分秒）
        if (
          dayDate.getFullYear() === targetDate.getFullYear() &&
          dayDate.getMonth() === targetDate.getMonth() &&
          dayDate.getDate() === targetDate.getDate()
        ) {
          // 找到目标日期，返回累计位置 + 当前天数索引 * 日宽度 + 半个日宽度（中心）
          return cumulativePosition + i * props.dayWidth + props.dayWidth / 2
        }
      }

      // 累加当前月份所有天数的宽度
      cumulativePosition += days.length * props.dayWidth
    } else if (timeScale === TimelineScale.QUARTER) {
      // 季度视图：处理years数组，每个year包含quarters
      // 类型保护：确保 periodData 是 TimelineYear 并有 quarters 属性
      const quarters = 'quarters' in periodData && periodData.quarters ? periodData.quarters : []

      for (const quarter of quarters) {
        const quarterStart = new Date(quarter.startDate)
        const quarterEnd = new Date(quarter.endDate)

        if (targetDate >= quarterStart && targetDate <= quarterEnd) {
          // 找到目标日期所在的季度
          const quarterWidth = props.dayWidth * 90
          const daysInQuarter =
            Math.round((quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          const dayWidth = quarterWidth / daysInQuarter
          const dayInQuarter = Math.round(
            (targetDate.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24)
          )
          const finalPosition = cumulativePosition + dayInQuarter * dayWidth + dayWidth / 2

          return finalPosition
        }

        // 累加每季度的宽度
        cumulativePosition += props.dayWidth * 90
      }
    } else if (timeScale === TimelineScale.YEAR) {
      // 年度视图：处理years数组，每个year包含halfYears
      // 类型保护：确保 periodData 是 TimelineYear 并有 halfYears 属性
      const halfYears =
        'halfYears' in periodData && periodData.halfYears ? periodData.halfYears : []

      for (const halfYear of halfYears) {
        const halfYearStart = new Date(halfYear.startDate)
        const halfYearEnd = new Date(halfYear.endDate)

        if (targetDate >= halfYearStart && targetDate <= halfYearEnd) {
          // 找到目标日期所在的半年
          const halfYearWidth = props.dayWidth * (365 / 2)
          const daysInHalfYear =
            Math.round((halfYearEnd.getTime() - halfYearStart.getTime()) / (1000 * 60 * 60 * 24)) +
            1
          const dayWidth = halfYearWidth / daysInHalfYear
          const dayInHalfYear = Math.round(
            (targetDate.getTime() - halfYearStart.getTime()) / (1000 * 60 * 60 * 24)
          )
          return cumulativePosition + dayInHalfYear * dayWidth + dayWidth / 2
        }

        // 累加每半年的宽度
        cumulativePosition += props.dayWidth * (365 / 2)
      }
    } else if (timeScale === TimelineScale.WEEK) {
      // 周视图：处理嵌套的weeks结构，返回中心位置
      // 类型保护：确保 periodData 是 TimelineMonth 并有 weeks 属性
      const weeks = 'weeks' in periodData && periodData.weeks ? periodData.weeks : []

      for (const week of weeks) {
        const weekStart = new Date(week.weekStart)
        const weekEnd = new Date(week.weekEnd)

        if (targetDate >= weekStart && targetDate <= weekEnd) {
          // 找到目标日期所在的周
          const weekWidth = props.dayWidth * 7
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
        cumulativePosition += props.dayWidth * 7
      }
    } else if (timeScale === TimelineScale.MONTH) {
      // 月视图：处理扁平化的subDays结构，返回中心位置
      // 类型保护：确保 periodData 是 TimelineMonth
      if (!('startDate' in periodData) || !('endDate' in periodData)) {
        continue
      }
      const periodStart = new Date(periodData.startDate)
      const periodEnd = new Date(periodData.endDate)

      if (targetDate >= periodStart && targetDate <= periodEnd) {
        // 找到目标日期所在的时间段
        const monthWidth = props.dayWidth * 30
        const daysInMonth = ('monthData' in periodData && periodData.monthData?.dayCount) || 30
        const dayWidth = monthWidth / daysInMonth
        const dayInMonth = targetDate.getDate()
        const finalPosition = cumulativePosition + (dayInMonth - 1) * dayWidth + dayWidth / 2

        return finalPosition
      }

      // 累加每月的宽度
      cumulativePosition += props.dayWidth * 30
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
      dimmed: isDimmed,
      [`milestone-label-position-${effectiveLabelPosition}`]: true,
    }"
    @click.stop="handleMilestoneClick"
    @dblclick.stop="handleDoubleClick"
    @mousedown.stop="handleMouseDown"
    @mouseenter="handleMilestoneMouseEnter"
    @mouseleave="handleMilestoneMouseLeave"
  >
    <!-- 自定义内容 slot：完整替换默认图标+标签，交互事件统一在外层 div 上处理。
         套一层 wrapper div 应用与内置图标一致的磁吸停靠定位（position/left/clipPath/zIndex），
         使自定义内容在滚动到 timeline 两侧边缘时同样具备磁吸半显+跟随停靠效果，
         不会因为使用了插槽而丢失该交互能力。
         停靠时额外将 wrapper 宽度钳制为与内置图标一致的 24px 并裁掉溢出部分——自定义内容
         通常比 24px 宽得多（图标+文字），若不钳制宽度，clipPath 的 50% 分割线是相对于
         整个（远宽于图标的）内容盒计算的，会导致「半显图标」实际显示出来的是文字中段，
         图标本身完全被裁掉（用户反馈的图标消失问题），钳制后 50% 分割线才与内置图标一致，
         正确显示半个图标而不是半个内容块。 -->
    <div
      v-if="hasContentSlot && milestoneVisibility.showIcon"
      ref="customContentRef"
      class="milestone-custom-content-wrapper"
      :style="{
        position: milestoneVisibility.isSticky ? 'relative' : 'static',
        left: milestoneVisibility.isSticky ? milestoneVisibility.iconLeft : '0px',
        width: milestoneVisibility.isSticky ? '24px' : 'auto',
        overflow: milestoneVisibility.isSticky ? 'hidden' : 'visible',
        clipPath: milestoneVisibility.clipPath,
        zIndex: milestoneVisibility.isSticky
          ? 'var(--gantt-z-milestone-sticky)'
          : 'var(--gantt-z-milestone)',
      }"
    >
      <slot name="custom-milestone-content" v-bind="slotPayload" />
    </div>
    <template v-else>
      <svg
        v-if="milestoneVisibility.showIcon"
        ref="iconRef"
        :width="24"
        :height="24"
        :viewBox="`0 0 24 24`"
        :style="{
          position: milestoneVisibility.isSticky ? 'relative' : 'static',
          left: milestoneVisibility.isSticky ? milestoneVisibility.iconLeft : '0px',
          clipPath: milestoneVisibility.clipPath,
          zIndex: milestoneVisibility.isSticky
            ? 'var(--gantt-z-milestone-sticky)'
            : 'var(--gantt-z-milestone)',
        }"
        style="cursor: pointer"
      >
        <!-- 菱形图标 -->
        <g v-if="milestoneIcon === 'diamond'" transform="rotate(45 12 12)">
          <rect
            x="5"
            y="5"
            width="14"
            height="14"
            rx="3"
            ry="3"
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
        <g v-else transform="rotate(45 12 12)">
          <rect
            x="5"
            y="5"
            width="14"
            height="14"
            rx="3"
            ry="3"
            :fill="milestoneColor"
            :stroke="milestoneBorder"
            stroke-width="2"
          />
        </g>
      </svg>
      <!-- 里程碑标签 - 只在非停靠状态显示 -->
      <span
        v-if="props.name && milestoneVisibility.showLabel"
        :class="['milestone-label', `milestone-label-${effectiveLabelPosition}`]"
      >
        {{ props.name }}
      </span>
    </template>
  </div>
</template>

<style scoped>
@import '../styles/theme-variables.css';

.milestone {
  position: absolute;
  z-index: var(--gantt-z-milestone);
  /* 不再使用 flex 布局排列图标与标签：图标（或 custom-milestone-content 插槽内容）始终是
     容器内唯一参与正常文档流布局的元素，标签通过绝对定位相对图标锚点向外叠加展示（见
     .milestone-label-* 样式），二者互不影响，图标位置始终只由 left/top 决定，保持稳定。 */
  display: block;
  cursor: pointer;
  user-select: none;
}

/* 高亮模式下，非高亮的Milestone变暗淡 */
.milestone.dimmed {
  opacity: 0.35 !important;
  filter: grayscale(0.3) !important;
  transition: all 0.3s ease !important;
}

/* 里程碑SVG发光效果 */
.milestone svg {
  /* 显式声明为块级，避免 SVG 默认的 inline 基线对齐带来的几像素纵向偏差 */
  display: block;
  filter: drop-shadow(0 0 8px var(--gantt-danger, #f56c6c));
}

/* 悬停时增强发光效果 */
.milestone:hover svg {
  filter: drop-shadow(0 0 16px var(--gantt-danger, #f56c6c))
    drop-shadow(0 0 24px rgba(245, 108, 108, 0.4));
}

/* 标签始终使用绝对定位，相对 .milestone（position:absolute，天然构成定位上下文）向外
   叠加展示，不参与图标的布局计算——图标位置永远只由 .milestone 自身的 left/top 决定，
   不受标签是否显示、标签所在方向、标签实际宽高影响。 */
.milestone-label {
  position: absolute;
  font-size: 12px;
  font-weight: bold;
  color: var(--gantt-text-primary, #222);
  white-space: nowrap;
  z-index: var(--gantt-z-bar); /* 确保标签在上层 */
}

.milestone-label-right {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 5px;
}

.milestone-label-left {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-right: 5px;
}

.milestone-label-top {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 2px;
}

.milestone-label-bottom {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 2px;
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
:global(.gantt-root[data-theme='dark']) .milestone-label {
  color: var(--gantt-text-white, #ffffff) !important;
}

/* 暗黑模式下的粘性标签样式 */
:global(.gantt-root[data-theme='dark']) .milestone-label[style*='position: absolute'] {
  background: rgba(30, 30, 30, 0.9) !important;
  border-color: rgba(246, 124, 124, 0.3) !important;
  color: #ffffff !important;
}

:global(.gantt-root[data-theme='dark']) .milestone svg {
  filter: drop-shadow(0 0 8px var(--gantt-danger, #f67c7c));
}

:global(.gantt-root[data-theme='dark']) .milestone:hover svg {
  filter: drop-shadow(0 0 16px var(--gantt-danger, #f67c7c))
    drop-shadow(0 0 24px rgba(246, 124, 124, 0.4));
}

/* 拖拽状态样式 */
.milestone.dragging {
  z-index: var(--gantt-z-bar-drag);
  opacity: 0.8;
  transform: scale(1.1);
  cursor: grabbing;
}

.milestone.dragging svg {
  filter: drop-shadow(0 0 20px var(--gantt-danger, #f56c6c))
    drop-shadow(0 0 32px rgba(245, 108, 108, 0.6));
  animation: none;
}

:global(.gantt-root[data-theme='dark']) .milestone.dragging svg {
  filter: drop-shadow(0 0 20px var(--gantt-danger, #f67c7c))
    drop-shadow(0 0 32px rgba(246, 124, 124, 0.6));
}

/* 停靠状态的特殊样式 */
.milestone-sticky svg {
  z-index: var(--gantt-z-milestone-sticky);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.milestone-sticky-left svg {
  filter: drop-shadow(0 0 8px var(--gantt-danger, #f56c6c))
    drop-shadow(0 0 16px rgba(245, 108, 108, 0.5));
}

.milestone-sticky-right svg {
  filter: drop-shadow(0 0 8px var(--gantt-danger, #f56c6c))
    drop-shadow(0 0 16px rgba(245, 108, 108, 0.5));
}

/* 半图标显示时取消发光效果 */
.milestone-sticky-left svg[style*='clip-path'],
.milestone-sticky-right svg[style*='clip-path'] {
  filter: none;
}

/* 暗黑模式下的停靠状态样式 */
:global(.gantt-root[data-theme='dark']) .milestone-sticky-left svg,
:global(.gantt-root[data-theme='dark']) .milestone-sticky-right svg {
  filter: drop-shadow(0 0 8px var(--gantt-danger, #f67c7c))
    drop-shadow(0 0 16px rgba(246, 124, 124, 0.5));
}

/* 暗黑模式下半图标显示时取消发光效果 */
:global(.gantt-root[data-theme='dark']) .milestone-sticky-left svg[style*='clip-path'],
:global(.gantt-root[data-theme='dark']) .milestone-sticky-right svg[style*='clip-path'] {
  filter: none;
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
  filter: drop-shadow(0 0 10px var(--gantt-danger, #f56c6c))
    drop-shadow(0 0 20px rgba(245, 108, 108, 0.6)) drop-shadow(0 0 28px rgba(245, 108, 108, 0.3));
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

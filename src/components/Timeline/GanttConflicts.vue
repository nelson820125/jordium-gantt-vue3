<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, inject, type Ref } from 'vue'
import { detectConflicts, type ConflictZone } from '../../utils/conflictUtils'
import type { Task } from '../../models/classes/Task'
import { TimelineScale } from '../../models/types/TimelineScale'

interface Props {
  /** 当前资源的所有任务 */
  tasks: Task[]
  /** 资源ID */
  resourceId: string | number
  /** 每天的宽度（px） */
  dayWidth: number
  /** 时间轴起始日期 */
  startDate: Date
  /** Canvas高度（对应资源行高度） */
  height: number
  /** Canvas宽度（时间轴总宽度） */
  width: number
  /** 顶部偏移量（px），用于对齐第一行TaskBar上沿 */
  topOffset?: number
  /** 时间轴数据（用于精确定位） */
  timelineData?: Array<any>
  /** 当前时间刻度 */
  currentTimeScale?: TimelineScale
  /** v1.9.5 任务ID到行号的映射 */
  taskRowMap?: Map<string | number, number>
  /** v1.9.5 每行的高度数组 */
  rowHeights?: number[]
  /** 可视区域滚动位置 */
  scrollLeft?: number
  /** 可视区域宽度 */
  containerWidth?: number
}

const props = defineProps<Props>()

// 注入拖拽状态
const isDraggingTaskBar = inject<Ref<boolean>>('isDraggingTaskBar', ref(false))
// v1.9.5 P2-4优化 - 注入Split Bar拖拽状态
const isSplitBarDragging = inject<Ref<boolean>>('isSplitBarDragging', ref(false))
// 注入Timeline拖拽状态
const isDraggingTimeline = inject<Ref<boolean>>('isDraggingTimeline', ref(false))
// 注入最近变化的TaskBar ID（用于增量更新）
const lastChangedTaskId = inject<Ref<string | number | null>>('lastChangedTaskId', ref(null))

// Canvas引用
const canvasRef = ref<HTMLCanvasElement | null>(null)
// v1.9.6 使用可视区域宽度而非总宽度，避免Canvas尺寸过大
// containerWidth优先（约1900px），如果为0则使用1920作为默认值，绝不使用props.width（可能30万px）
const canvasWidth = computed(() => {
  const width = props.containerWidth || 1920
  if (import.meta.env.DEV) {
    console.log(`[GanttConflicts] canvasWidth: ${width}px (containerWidth: ${props.containerWidth}, totalWidth: ${props.width})`)
  }
  return width
})
const canvasHeight = computed(() => props.height)

// 冲突区域列表
const conflictZones = ref<ConflictZone[]>([])
const needsRecalculation = ref(false)

// v1.9.4 P1优化 - 坐标缓存，避免重复计算
const coordsCache = new Map<string, { left: number; width: number }>()

// v1.9.4 P1优化 - 上一次的冲突区域列表，用于增量重绘
const previousConflictZones = ref<ConflictZone[]>([])

// 纹理预生成（性能优化）
const texturePatterns = ref<{
  light: CanvasPattern | null
  medium: CanvasPattern | null
  severe: CanvasPattern | null
}>({
  light: null,
  medium: null,
  severe: null,
})

// Canvas样式（使用transform平移到可视区域）
const canvasStyle = computed(() => ({
  position: 'absolute' as const,
  top: `${props.topOffset || 0}px`,
  left: `${props.scrollLeft || 0}px`, // 平移到滚动位置
  pointerEvents: 'none' as const, // 始终穿透，让TaskBar可以响应鼠标事件
  transition: 'opacity 0.2s',
  zIndex: 250, // v1.9.2 高于TaskBar的最高z-index(200)，确保冲突层在最上层
  backgroundColor: 'transparent', // 确保Canvas背景透明
}))

// 监听任务列表变化
watch(() => props.tasks, () => {
  if (isDraggingTaskBar.value) {
    needsRecalculation.value = true
  } else {
    recalculateConflicts()
  }
}, { deep: true })

// 监听拖拽状态变化
watch(isDraggingTaskBar, (dragging) => {
  if (!dragging && needsRecalculation.value) {
    nextTick(() => {
      // 检查是否可以使用增量更新（单个TaskBar变化且有ID记录）
      if (lastChangedTaskId.value !== null) {
        recalculateConflictsIncremental(lastChangedTaskId.value)
        lastChangedTaskId.value = null // 清除记录
      } else {
        // 全量重新计算
        texturePatterns.value = { light: null, medium: null, severe: null }
        coordsCache.clear()
        recalculateConflicts()
      }
      needsRecalculation.value = false
    })
  }
})

// v1.9.5 P2-4优化 - 监听Split Bar拖拽状态变化
watch(isSplitBarDragging, (dragging) => {
  if (!dragging && needsRecalculation.value) {
    nextTick(() => {
      // 拖拽结束后清空缓存并重新计算，清空纹理缓存避免颜色问题
      texturePatterns.value = { light: null, medium: null, severe: null }
      coordsCache.clear()
      recalculateConflicts()
      needsRecalculation.value = false
    })
  }
})

// 监听Timeline拖拽状态变化 - 拖拽开始时立即清除Canvas
watch(isDraggingTimeline, (dragging) => {
  if (dragging) {
    // 拖拽开始时立即清除Canvas
    clearCanvas()
  } else {
    // 拖拽结束后重新计算并绘制
    nextTick(() => {
      recalculateConflicts()
    })
  }
})

// 监听Canvas尺寸变化
watch([canvasWidth, canvasHeight], () => {
  // v1.9.5 P2-4优化 - Split Bar拖拽时延迟重绘
  if (isSplitBarDragging.value) {
    needsRecalculation.value = true
    return
  }

  nextTick(() => {
    renderConflicts()
  })
})

// 监听timelineData和currentTimeScale变化
watch([() => props.timelineData, () => props.currentTimeScale], () => {
  if (import.meta.env.DEV) {}
  // v1.9.4 BUG修复 - 视图切换时清空坐标缓存
  coordsCache.clear()

  recalculateConflicts()
}, { deep: true })

// v1.9.6 监听scrollLeft变化，滚动停止后重新计算可视区域的冲突
let scrollTimer: ReturnType<typeof setTimeout> | null = null
watch(() => props.scrollLeft, () => {
  // 清除之前的定时器
  if (scrollTimer) {
    clearTimeout(scrollTimer)
  }

  // 滚动停止后100ms重新计算冲突区域（包含视口裁剪）
  scrollTimer = setTimeout(() => {
    nextTick(() => {
      // 先清除Canvas上的旧内容
      clearCanvas()
      // 重新计算conflictZones（会根据新的scrollLeft裁剪可见区域）
      recalculateConflicts()
    })
  }, 100)
})

// 增量重新计算冲突（仅计算与变化TaskBar相关的冲突）
function recalculateConflictsIncremental(changedTaskId: string | number) {
  const startTime = performance.now()

  // 找到变化的任务
  const changedTask = props.tasks.find(t => t.id === changedTaskId)
  if (!changedTask) {
    recalculateConflicts()
    return
  }

  // 找出与变化任务时间重叠的所有任务（包括自己）
  const affectedTasks = props.tasks.filter(task => {
    // 检查时间是否重叠
    const taskStart = new Date(task.startDate)
    const taskEnd = new Date(task.endDate)
    const changedStart = new Date(changedTask.startDate)
    const changedEnd = new Date(changedTask.endDate)

    return !(taskEnd < changedStart || taskStart > changedEnd)
  })

  // 只对受影响的任务进行冲突检测
  const newConflicts = detectConflicts(affectedTasks, props.resourceId)

  // 找出哪些旧的冲突区域需要被移除（不再涉及受影响的任务）
  const affectedTaskIds = new Set(affectedTasks.map(t => t.id))
  const unchangedConflicts = previousConflictZones.value.filter(zone => {
    // 如果冲突区域的所有任务都不在受影响列表中，则保留
    return !zone.tasks.some(task => affectedTaskIds.has(task.id))
  })

  // 合并未变化的冲突和新计算的冲突
  const allConflicts = [...unchangedConflicts.map(z => ({
    startDate: z.startDate,
    endDate: z.endDate,
    tasks: z.tasks,
    totalPercent: z.totalPercent,
    level: z.level,
  })), ...newConflicts]

  // 转换为Canvas坐标（与全量计算相同的逻辑）
  conflictZones.value = allConflicts.map((zone) => {
    const cacheKey = `${zone.startDate.getTime()}-${zone.endDate.getTime()}`
    let left: number, width: number

    if (coordsCache.has(cacheKey)) {
      const cached = coordsCache.get(cacheKey)!
      left = cached.left
      width = cached.width
    } else {
      const coords = calculatePosition(zone.startDate, zone.endDate)
      left = coords.left
      width = coords.width
      coordsCache.set(cacheKey, { left, width })
    }

    const scrollLeft = props.scrollLeft || 0
    const viewportWidth = props.containerWidth || 1920
    const viewportLeft = left - scrollLeft
    const viewportRight = viewportLeft + width

    if (viewportRight <= 0 || viewportLeft >= viewportWidth) {
      return null
    }

    const canvasLeft = Math.max(0, viewportLeft)
    const canvasRight = Math.min(viewportWidth, viewportRight)
    const canvasWidth = canvasRight - canvasLeft

    let top = 0
    let height = props.height

    if (props.taskRowMap && props.rowHeights && zone.tasks.length > 0) {
      const rowNumbers: number[] = []
      for (const task of zone.tasks) {
        const rowNum = props.taskRowMap.get(task.id)
        if (rowNum !== undefined) {
          rowNumbers.push(rowNum)
        }
      }

      if (rowNumbers.length > 0) {
        const minRow = Math.min(...rowNumbers)
        const maxRow = Math.max(...rowNumbers)
        top = 0
        for (let i = 0; i < minRow; i++) {
          top += props.rowHeights[i] || 51
        }
        height = 0
        for (let i = minRow; i <= maxRow; i++) {
          height += props.rowHeights[i] || 51
        }
        height = Math.max(1, height - 10)
      }
    }

    return {
      ...zone,
      left: canvasLeft,
      width: canvasWidth,
      top,
      height,
    }
  }).filter(Boolean)

  const endTime = performance.now()
  const elapsed = endTime - startTime

  // 使用增量重绘
  renderConflictsIncremental()
}

// 重新计算冲突
function recalculateConflicts() {
  const startTime = performance.now()

  // 调用冲突检测算法
  const conflicts = detectConflicts(props.tasks, props.resourceId)

  // 详细日志：显示每个任务的资源占比
  const tasksInfo = props.tasks.map(t => {
    const resource = (t as any).resources?.find((r: any) => String(r.id) === String(props.resourceId))
    const percent = resource?.percent || 0
    return `${t.name}(${percent}%)`
  }).join(', ')

  // v1.9.4 P1优化 - 使用坐标缓存
  conflictZones.value = conflicts.map((zone) => {
    // 生成缓存key（基于时间戳避免日期对象比较）
    const cacheKey = `${zone.startDate.getTime()}-${zone.endDate.getTime()}`

    let left: number, width: number

    // 尝试从缓存获取坐标
    if (coordsCache.has(cacheKey)) {
      const cached = coordsCache.get(cacheKey)!
      left = cached.left
      width = cached.width
    } else {
      // 缓存未命中，重新计算并缓存
      const coords = calculatePosition(zone.startDate, zone.endDate)
      left = coords.left
      width = coords.width
      coordsCache.set(cacheKey, { left, width })
    }

    // 转换为相对于可视区域的坐标
    const scrollLeft = props.scrollLeft || 0
    const viewportWidth = props.containerWidth || 1920

    // 计算冲突区域在可视区域中的位置
    const viewportLeft = left - scrollLeft
    const viewportRight = viewportLeft + width

    // 如果冲突区域完全在可视区域外，跳过
    if (viewportRight <= 0 || viewportLeft >= viewportWidth) {
      return null
    }

    // 计算在Canvas上的绘制坐标（相对于Canvas左边界）
    // Canvas通过CSS定位在scrollLeft位置，所以绘制时使用viewport相对坐标
    const canvasLeft = Math.max(0, viewportLeft)
    const canvasRight = Math.min(viewportWidth, viewportRight)
    const canvasWidth = canvasRight - canvasLeft

    // v1.9.5 修复：根据冲突任务所在的行号计算正确的top和height
    let top = 0
    let height = props.height

    if (props.taskRowMap && props.rowHeights && zone.tasks.length > 0) {
      // 找到所有冲突任务的行号
      const rowNumbers: number[] = []
      for (const task of zone.tasks) {
        const rowNum = props.taskRowMap.get(task.id)
        if (rowNum !== undefined) {
          rowNumbers.push(rowNum)
        }
      }

      if (rowNumbers.length > 0) {
        // 找到最小和最大行号
        const minRow = Math.min(...rowNumbers)
        const maxRow = Math.max(...rowNumbers)

        // 计算top：从第一行的顶部开始（相对于Canvas内部坐标）
        // Canvas本身已有topOffset，所以这里直接累加行高即可
        top = 0
        for (let i = 0; i < minRow; i++) {
          top += props.rowHeights[i] || 51
        }

        // 计算height：从minRow到maxRow所有行的高度之和
        height = 0
        for (let i = minRow; i <= maxRow; i++) {
          height += props.rowHeights[i] || 51
        }
        // 减去底部边距（约2.5px），让冲突区域不超出TaskBar底部边界
        height = Math.max(1, height - 10)
      }
    }

    // 开发环境调试日志
    if (import.meta.env.DEV) {}

    return {
      ...zone,
      left: canvasLeft,
      width: canvasWidth,
      top,
      height,
    }
  }).filter(Boolean) // 过滤掉完全不可见的冲突区域

  const endTime = performance.now()
  const elapsed = endTime - startTime

  // v1.9.6 调试日志：输出每个冲突区域的坐标
  if (import.meta.env.DEV) {
    console.log(`[GanttConflicts] ${conflictZones.value.length} conflict zones after viewport clipping:`)
    conflictZones.value.forEach((zone, index) => {
      console.log(`  Zone ${index}: left=${zone.left}, width=${zone.width}, top=${zone.top}, height=${zone.height}, level=${zone.level}`)
    })
  }

  // 开发环境性能监控
  if (import.meta.env.DEV && elapsed > 50) {}

  // v1.9.4 P1优化 - 增量重绘
  // v1.9.5 修复：如果纹理缓存被清空，使用全量重绘避免颜色变淡
  if (!texturePatterns.value.light && !texturePatterns.value.medium && !texturePatterns.value.severe) {
    renderConflicts()
  } else {
    renderConflictsIncremental()
  }
}

// 计算冲突区域在Canvas上的位置（与TaskBar使用相同逻辑）
function calculatePosition(startDate: Date, endDate: Date): { left: number; width: number } {
  let left = 0
  let width = 0

  // 小时视图：使用分钟精度计算
  if (props.currentTimeScale === TimelineScale.HOUR) {
    // 计算时间线开始日期的00:00:00作为全局基准
    const timelineStartOfDay = new Date(props.startDate)
    timelineStartOfDay.setHours(0, 0, 0, 0)

    // 计算开始和结束时间相对于时间线开始的总分钟数
    const startMinutesTotal = Math.floor((startDate.getTime() - timelineStartOfDay.getTime()) / (1000 * 60))
    const endMinutesTotal = Math.floor((endDate.getTime() - timelineStartOfDay.getTime()) / (1000 * 60))

    // 每小时40px，每分钟40/60 = 2/3 px
    const pixelPerMinute = 40 / 60

    left = Math.max(0, startMinutesTotal * pixelPerMinute)
    width = Math.max(4, (endMinutesTotal - startMinutesTotal) * pixelPerMinute)

    return { left, width }
  }

  // 创建只包含日期的Date对象（忽略时分秒）
  const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())

  if (
    props.timelineData &&
    props.currentTimeScale &&
    (props.currentTimeScale === TimelineScale.WEEK ||
      props.currentTimeScale === TimelineScale.MONTH ||
      props.currentTimeScale === TimelineScale.QUARTER ||
      props.currentTimeScale === TimelineScale.YEAR)
  ) {
    // 使用timelineData精确定位
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
        dayWidth = 60 / 90
      } else if (props.currentTimeScale === TimelineScale.YEAR) {
        dayWidth = 180 / 182
      }
      endPosition =
        calculatePositionFromTimelineData(
          endDateOnly,
          props.timelineData,
          props.currentTimeScale,
        ) + dayWidth
    }

    left = startPosition
    width = Math.max(endPosition - startPosition, 4)
  } else if (
    props.timelineData &&
    props.currentTimeScale === TimelineScale.DAY
  ) {
    // 日视图：使用timelineData精确定位
    const startPosition = calculatePositionFromTimelineData(
      startDateOnly,
      props.timelineData,
      props.currentTimeScale,
    )

    const nextDay = new Date(endDateOnly)
    nextDay.setDate(nextDay.getDate() + 1)
    let endPosition = calculatePositionFromTimelineData(
      nextDay,
      props.timelineData,
      props.currentTimeScale,
    )

    if (endPosition === startPosition) {
      endPosition = calculatePositionFromTimelineData(
        endDateOnly,
        props.timelineData,
        props.currentTimeScale,
      ) + 30 // 日视图每天30px
    }

    left = startPosition
    width = Math.max(endPosition - startPosition, 4)
  } else {
    // 其他情况：基于日期的简单计算
    const startDiff = Math.floor(
      (startDateOnly.getTime() - props.startDate.getTime()) / (1000 * 60 * 60 * 24),
    )

    const timeDiffMs = endDateOnly.getTime() - startDateOnly.getTime()
    const daysDiff = Math.round(timeDiffMs / (1000 * 60 * 60 * 24))
    const duration = daysDiff === 0 ? 1 : daysDiff + 1

    left = startDiff * props.dayWidth
    width = duration * props.dayWidth
  }

  return { left: Math.max(0, left), width: Math.max(4, width) }
}

// 辅助函数：将日期转换为只包含年月日的本地Date对象
function toLocalDateOnly(date: Date | string): Date {
  if (typeof date === 'string') {
    // 解析字符串日期
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number)
      return new Date(year, month - 1, day)
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(date)) {
      // ISO格式
      const d = new Date(date)
      return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    }
  }

  if (date instanceof Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  // 兜底
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// 从timelineData计算日期位置（与TaskBar使用相同的函数）
function calculatePositionFromTimelineData(
  targetDate: Date,
  timelineData: Array<any>,
  timeScale: TimelineScale,
): number {
  let cumulativePosition = 0

  for (const periodData of timelineData) {
    if (timeScale === TimelineScale.DAY) {
      const days = periodData.days || []

      for (let i = 0; i < days.length; i++) {
        const dayData = days[i]
        const dayDate = toLocalDateOnly(dayData.date)

        if (
          dayDate.getFullYear() === targetDate.getFullYear() &&
          dayDate.getMonth() === targetDate.getMonth() &&
          dayDate.getDate() === targetDate.getDate()
        ) {
          return cumulativePosition + i * 30
        }
      }

      cumulativePosition += days.length * 30
    } else if (timeScale === TimelineScale.QUARTER) {
      const quarters = periodData.quarters || []

      for (const quarter of quarters) {
        const quarterStart = toLocalDateOnly(quarter.startDate)
        const quarterEnd = toLocalDateOnly(quarter.endDate)

        if (targetDate >= quarterStart && targetDate <= quarterEnd) {
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

        cumulativePosition += 60
      }
    } else if (timeScale === TimelineScale.WEEK) {
      const weeks = periodData.weeks || []

      for (const week of weeks) {
        const weekStart = toLocalDateOnly(week.weekStart)
        const weekEnd = toLocalDateOnly(week.weekEnd)

        if (targetDate >= weekStart && targetDate <= weekEnd) {
          const weekWidth = 60
          const daysInWeek = Math.ceil(
            (weekEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24),
          ) + 1
          const dayWidth = weekWidth / daysInWeek
          const dayInWeek = Math.ceil(
            (targetDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24),
          )
          return cumulativePosition + dayInWeek * dayWidth
        }

        cumulativePosition += 60
      }
    } else if (timeScale === TimelineScale.MONTH) {
      const monthStart = new Date(periodData.year, periodData.month - 1, 1)
      const monthEnd = new Date(periodData.year, periodData.month, 0)

      if (targetDate >= monthStart && targetDate <= monthEnd) {
        const monthWidth = 60
        const daysInMonth = periodData.monthData?.dayCount || 30
        const dayWidth = monthWidth / daysInMonth
        const dayInMonth = targetDate.getDate()
        return cumulativePosition + (dayInMonth - 1) * dayWidth
      }

      cumulativePosition += 60
    } else if (timeScale === TimelineScale.YEAR) {
      const halfYears = periodData.halfYears || []

      for (const halfYear of halfYears) {
        const halfYearStart = toLocalDateOnly(halfYear.startDate)
        const halfYearEnd = toLocalDateOnly(halfYear.endDate)

        if (targetDate >= halfYearStart && targetDate <= halfYearEnd) {
          const halfYearWidth = 180
          const daysInHalfYear = Math.ceil(
            (halfYearEnd.getTime() - halfYearStart.getTime()) / (1000 * 60 * 60 * 24),
          ) + 1
          const dayWidth = halfYearWidth / daysInHalfYear
          const dayInHalfYear = Math.ceil(
            (targetDate.getTime() - halfYearStart.getTime()) / (1000 * 60 * 60 * 24),
          )
          return cumulativePosition + dayInHalfYear * dayWidth
        }

        cumulativePosition += 180
      }
    }
  }

  return cumulativePosition
}

// v1.9.4 P1优化 - 增量重绘：只重绘发生变化的冲突区域
function renderConflictsIncremental() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 检测变化的区域
  const { added, removed, changed } = detectChangedZones(
    previousConflictZones.value,
    conflictZones.value,
  )

  // 如果变化区域很多（> 50%），直接全量重绘更高效
  const totalZones = conflictZones.value.length
  const changedCount = added.length + removed.length + changed.length

  if (totalZones === 0 || changedCount > totalZones * 0.5) {
    renderConflicts()
    previousConflictZones.value = [...conflictZones.value]
    return
  }

  // 增量重绘：只处理变化的区域

  // 1. 清除被移除的区域
  for (const zone of removed) {
    if (zone.left !== undefined && zone.width !== undefined) {
      ctx.clearRect(zone.left - 2, 0, zone.width + 4, canvas.height)
    }
  }

  // 2. 重绘新增的区域
  for (const zone of added) {
    drawConflictZone(ctx, zone)
  }

  // 3. 重绘变化的区域（先清除再绘制）
  for (const zone of changed) {
    if (zone.left !== undefined && zone.width !== undefined) {
      ctx.clearRect(zone.left - 2, 0, zone.width + 4, canvas.height)
      drawConflictZone(ctx, zone)
    }
  }

  previousConflictZones.value = [...conflictZones.value]
}

// v1.9.4 检测发生变化的冲突区域
function detectChangedZones(
  oldZones: ConflictZone[],
  newZones: ConflictZone[],
): {
  added: ConflictZone[]
  removed: ConflictZone[]
  changed: ConflictZone[]
} {
  const added: ConflictZone[] = []
  const removed: ConflictZone[] = []
  const changed: ConflictZone[] = []

  // 为快速查找创建 Map
  const oldZonesMap = new Map(
    oldZones.map(z => [`${z.startDate.getTime()}-${z.endDate.getTime()}`, z]),
  )
  const newZonesMap = new Map(
    newZones.map(z => [`${z.startDate.getTime()}-${z.endDate.getTime()}`, z]),
  )

  // 查找新增和变化的区域
  for (const [key, newZone] of newZonesMap) {
    const oldZone = oldZonesMap.get(key)
    if (!oldZone) {
      added.push(newZone)
    } else if (
      oldZone.totalPercent !== newZone.totalPercent ||
      oldZone.level !== newZone.level ||
      oldZone.tasks.length !== newZone.tasks.length
    ) {
      changed.push(newZone)
    }
  }

  // 查找被移除的区域
  for (const [key, oldZone] of oldZonesMap) {
    if (!newZonesMap.has(key)) {
      removed.push(oldZone)
    }
  }

  return { added, removed, changed }
}

// v1.9.4 绘制单个冲突区域（从 renderConflicts 提取）
function drawConflictZone(ctx: CanvasRenderingContext2D, zone: ConflictZone) {
  // v1.9.6 修复：使用 === undefined 检查，避免 left=0 时被错误跳过
  if (zone.left === undefined || zone.width === undefined || zone.width <= 0) {
    return
  }

  // 视口裁剪优化
  const canvas = canvasRef.value
  if (!canvas || zone.left + zone.width < 0 || zone.left > canvas.width) {
    return
  }

  // 绘制纹理背景
  drawTextureBackground(ctx, zone)

  // 绘制左右边界线
  drawBorders(ctx, zone)

  // 绘制顶部警告标识
  drawTopWarning(ctx, zone)
}

// 渲染冲突纹理（全量重绘）
function renderConflicts() {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  // 清空Canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 绘制所有冲突区域
  for (const zone of conflictZones.value) {
    drawConflictZone(ctx, zone)
  }

  previousConflictZones.value = [...conflictZones.value]
}

// 清除Canvas内容（用于滚动时清除旧的冲突区域）
function clearCanvas() {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  // 清空整个Canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 重置冲突区域列表，强制全量重绘（不清空纹理缓存，可以复用）
  previousConflictZones.value = []
}

// 绘制纹理背景
function drawTextureBackground(ctx: CanvasRenderingContext2D, zone: ConflictZone) {
  const { left = 0, width = 0, top = 0, height = props.height } = zone

  // 根据冲突等级选择颜色（降低透明度使其更淡）
  let color: string
  let alpha: number

  switch (zone.level) {
  case 'light':
    color = 'rgba(255,220,0,' // 浅黄
    alpha = 0.12  // 降低透明度
    break
  case 'medium':
    color = 'rgba(255,165,0,' // 橙色
    alpha = 0.15  // 降低透明度
    break
  case 'severe':
    color = 'rgba(255,69,0,' // 红色
    alpha = 0.18  // 降低透明度
    break
  }

  // 绘制斜线纹理
  ctx.save()
  ctx.fillStyle = getTexturePattern(ctx, zone.level) || `${color}${alpha})`
  ctx.fillRect(left, top, width, height)
  ctx.restore()
}

// 获取或创建纹理pattern（性能优化）
function getTexturePattern(ctx: CanvasRenderingContext2D, level: 'light' | 'medium' | 'severe'): CanvasPattern | null {
  // 如果已有缓存，直接返回
  if (texturePatterns.value[level]) {
    return texturePatterns.value[level]
  }

  // 创建临时Canvas绘制纹理
  const patternCanvas = document.createElement('canvas')
  patternCanvas.width = 10
  patternCanvas.height = 10
  const patternCtx = patternCanvas.getContext('2d')
  if (!patternCtx) return null

  // 根据等级选择颜色（降低透明度使斜线更淡）
  let color: string
  switch (level) {
  case 'light':
    color = 'rgba(255,220,0,0.25)'  // 降低透明度
    break
  case 'medium':
    color = 'rgba(255,165,0,0.3)'   // 降低透明度
    break
  case 'severe':
    color = 'rgba(255,69,0,0.35)'   // 降低透明度
    break
  }

  // 绘制45度斜线
  patternCtx.strokeStyle = color
  patternCtx.lineWidth = 1  // 使用细线条
  patternCtx.beginPath()
  patternCtx.moveTo(0, 10)
  patternCtx.lineTo(10, 0)
  patternCtx.stroke()

  // 创建pattern并缓存
  const pattern = ctx.createPattern(patternCanvas, 'repeat')
  texturePatterns.value[level] = pattern

  return pattern
}

// 绘制边界线
function drawBorders(ctx: CanvasRenderingContext2D, zone: ConflictZone) {
  const { left = 0, width = 0, top = 0, height = props.height } = zone

  ctx.save()
  ctx.strokeStyle = '#f56c6c' // 红色边界
  ctx.lineWidth = 2

  // 左边界
  ctx.beginPath()
  ctx.moveTo(left, top)
  ctx.lineTo(left, top + height)
  ctx.stroke()

  // 右边界
  ctx.beginPath()
  ctx.moveTo(left + width, top)
  ctx.lineTo(left + width, top + height)
  ctx.stroke()

  ctx.restore()
}

// 绘制顶部警告标识（只显示三角形icon）
function drawTopWarning(ctx: CanvasRenderingContext2D, zone: ConflictZone) {
  const { left = 0, top = 0 } = zone

  const triangleSize = 16
  const padding = 4
  const x = left + padding
  const y = top + padding

  ctx.save()

  // 绘制三角形警告图标
  ctx.fillStyle = '#faad14' // 黄色
  ctx.beginPath()
  ctx.moveTo(x + triangleSize / 2, y) // 顶点
  ctx.lineTo(x, y + triangleSize) // 左下角
  ctx.lineTo(x + triangleSize, y + triangleSize) // 右下角
  ctx.closePath()
  ctx.fill()

  // 绘制白色感叹号
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 12px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('!', x + triangleSize / 2, y + triangleSize * 0.6)

  ctx.restore()
}

// 组件挂载
onMounted(() => {
  // v1.9.6 修复：资源视图使用虚拟滚动，可见的资源行必然在视口内
  // 直接计算冲突，不需要IntersectionObserver延迟渲染
  nextTick(() => {
    recalculateConflicts()
  })
})

// 组件卸载
onUnmounted(() => {
  if (scrollTimer) {
    clearTimeout(scrollTimer)
  }

  // v1.9.4 清理坐标缓存
  coordsCache.clear()

  // 清理资源
  texturePatterns.value = {
    light: null,
    medium: null,
    severe: null,
  }
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="gantt-conflicts-canvas"
    :width="canvasWidth"
    :height="canvasHeight"
    :style="canvasStyle"
  ></canvas>
</template>

<style scoped>
.gantt-conflicts-canvas {
  display: block;
  background-color: transparent;
}
</style>

<template>
  <canvas
    ref="canvasRef"
    class="gantt-conflicts-canvas"
    :width="canvasWidth"
    :height="canvasHeight"
    :style="canvasStyle"
  ></canvas>
</template>

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
}

const props = defineProps<Props>()

// 注入拖拽状态
const isDraggingTaskBar = inject<Ref<boolean>>('isDraggingTaskBar', ref(false))

// Canvas引用
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWidth = computed(() => props.width)
const canvasHeight = computed(() => props.height)

// 冲突区域列表
const conflictZones = ref<ConflictZone[]>([])
const needsRecalculation = ref(false)

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

// Canvas样式
const canvasStyle = computed(() => ({
  position: 'absolute' as const,
  top: `${props.topOffset || 0}px`,
  left: 0,
  pointerEvents: 'none' as const, // 始终穿透，让TaskBar可以响应鼠标事件
  opacity: isDraggingTaskBar.value ? 0.3 : 1,
  transition: 'opacity 0.2s',
  zIndex: 250, // v1.9.2 高于TaskBar的最高z-index(200)，确保冲突层在最上层
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
      recalculateConflicts()
      needsRecalculation.value = false
    })
  }
})

// 监听Canvas尺寸变化
watch([canvasWidth, canvasHeight], () => {
  nextTick(() => {
    renderConflicts()
  })
})

// 监听timelineData和currentTimeScale变化
watch([() => props.timelineData, () => props.currentTimeScale], () => {
  if (import.meta.env.DEV) {}
  recalculateConflicts()
}, { deep: true })

// 重新计算冲突
function recalculateConflicts() {
  const startTime = performance.now()

  // 调用冲突检测算法
  const conflicts = detectConflicts(props.tasks, props.resourceId)

  // 计算Canvas坐标
  conflictZones.value = conflicts.map((zone) => {
    const { left, width } = calculatePosition(zone.startDate, zone.endDate)

    // 开发环境调试日志
    if (import.meta.env.DEV) {}

    return {
      ...zone,
      left,
      width,
      top: 0,
      height: props.height,
    }
  })

  const endTime = performance.now()
  const elapsed = endTime - startTime

  // 开发环境性能监控
  if (import.meta.env.DEV && elapsed > 50) {}

  // 重新渲染
  renderConflicts()
}

// 计算冲突区域在Canvas上的位置（与TaskBar使用相同逻辑）
function calculatePosition(startDate: Date, endDate: Date): { left: number; width: number } {
  let left = 0
  let width = 0

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

// 渲染冲突纹理
function renderConflicts() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 清空Canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 绘制所有冲突区域
  for (const zone of conflictZones.value) {
    if (!zone.left || !zone.width) continue

    // 视口裁剪优化（仅绘制可见区域）
    if (zone.left + zone.width < 0 || zone.left > canvas.width) {
      continue
    }

    // 绘制纹理背景
    drawTextureBackground(ctx, zone)

    // 绘制左右边界线
    drawBorders(ctx, zone)

    // 绘制顶部警告标识
    drawTopWarning(ctx, zone)
  }
}

// 绘制纹理背景
function drawTextureBackground(ctx: CanvasRenderingContext2D, zone: ConflictZone) {
  const { left = 0, width = 0, top = 0, height = props.height } = zone

  // 根据冲突等级选择颜色
  let color: string
  let alpha: number

  switch (zone.level) {
    case 'light':
      color = 'rgba(255,220,0,' // 浅黄
      alpha = 0.15
      break
    case 'medium':
      color = 'rgba(255,165,0,' // 橙色
      alpha = 0.15
      break
    case 'severe':
      color = 'rgba(255,69,0,' // 红色
      alpha = 0.2
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

  // 根据等级选择颜色
  let color: string
  switch (level) {
    case 'light':
      color = 'rgba(255,220,0,0.3)'
      break
    case 'medium':
      color = 'rgba(255,165,0,0.3)'
      break
    case 'severe':
      color = 'rgba(255,69,0,0.4)'
      break
  }

  // 绘制45度斜线
  patternCtx.strokeStyle = color
  patternCtx.lineWidth = 1
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
  nextTick(() => {
    recalculateConflicts()
  })
})

// 组件卸载
onUnmounted(() => {
  // 清理资源
  texturePatterns.value = {
    light: null,
    medium: null,
    severe: null,
  }
})
</script>

<style scoped>
.gantt-conflicts-canvas {
  display: block;
}
</style>

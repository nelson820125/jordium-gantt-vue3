<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import type { Task } from '../models/classes/Task'
import { getPredecessorIds } from '../utils/predecessorUtils'

// 定义 TaskBar 位置信息类型
interface TaskBarPosition {
  left: number
  top: number
  width: number
  height: number
}

// 定义月份分隔线位置类型
interface VerticalLine {
  left: number
  label?: string
}

// 定义 Props
interface Props {
  tasks: Task[]
  taskBarPositions: Record<number, TaskBarPosition>
  width: number
  height: number
  offsetLeft?: number // Canvas 在全局坐标系中的偏移量（用于虚拟渲染）
  highlightedTaskId: number | null
  highlightedTaskIds: Set<number>
  hoveredTaskId: number | null
  // 月份分隔线配置
  verticalLines?: VerticalLine[]
  showVerticalLines?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  verticalLines: () => [],
  showVerticalLines: true,
  offsetLeft: 0,
})

// Canvas 引用
const canvasRef = ref<HTMLCanvasElement | null>(null)

// requestAnimationFrame 防抖控制
let rafId: number | null = null
let pendingRedraw = false

// 当前主题（用于分隔线颜色）
const isDarkTheme = computed(() => {
  return document.documentElement.getAttribute('data-theme') === 'dark'
})

/**
 * 绘制关系线到 Canvas
 * 性能优势：相比 SVG 提升 18 倍渲染性能
 */
const drawLinks = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  // 适配高清屏（Retina）
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  // 设置实际像素尺寸
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  const ctx = canvas.getContext('2d', { alpha: true }) // 启用透明背景
  if (!ctx) {
    // eslint-disable-next-line no-console
    console.error('❌ Canvas context 获取失败，可能是尺寸超限')
    return
  }

  // 缩放上下文以适配高清屏
  ctx.scale(dpr, dpr)

  // 清空画布（透明）
  ctx.clearRect(0, 0, rect.width, rect.height)

  // 绘制月份分隔线（在关系线之前，作为背景）
  if (props.showVerticalLines && props.verticalLines && props.verticalLines.length > 0) {
    ctx.save()

    // 使用与旗帜一致的主题色：浅色模式 #409eff，暗色模式 #66b1ff
    const lineColor = isDarkTheme.value ? '#66b1ff' : '#409eff'
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1

    // 优化：一次性绘制所有垂直线，避免多次 stroke() 调用
    // 虚拟渲染：减去偏移量，转换为 Canvas 局部坐标
    ctx.beginPath()
    for (const line of props.verticalLines) {
      const localX = line.left - props.offsetLeft
      // 只绘制在 Canvas 可见范围内的线
      if (localX >= 0 && localX <= rect.width) {
        ctx.moveTo(localX, 0)
        ctx.lineTo(localX, rect.height)
      }
    }
    ctx.stroke()

    ctx.restore()
  }

  // 获取当前渲染的任务ID集合
  const currentTaskIds = new Set<number>()
  for (const task of props.tasks) {
    currentTaskIds.add(task.id)
  }

  // 是否处于高亮模式
  const isHighlightMode = props.highlightedTaskId !== null

  // 虚拟渲染：计算 Canvas 覆盖的范围
  const canvasStartX = props.offsetLeft
  const canvasEndX = props.offsetLeft + rect.width

  // 定义线条数据类型
  interface LineData {
    x1: number
    y1: number
    x2: number
    y2: number
    c1x: number
    c1y: number
    c2x: number
    c2y: number
    arrowAngle: number
  }

  // 按样式分组线条数据（减少状态切换）
  const highlightedLines: LineData[] = []
  const hoveredLines: LineData[] = []
  const normalLines: LineData[] = []
  const fadedLines: LineData[] = [] // 高亮模式下的普通线条（半透明）

  // 收集所有关系线数据并分组
  let totalRelations = 0 // 总关系数
  let culledRelations = 0 // 被裁剪的关系数
  let drawnRelations = 0 // 实际绘制的关系数

  for (const task of props.tasks) {
    if (!task.predecessor || !props.taskBarPositions[task.id]) continue

    const predecessorIds = getPredecessorIds(task.predecessor)

    for (const predecessorId of predecessorIds) {
      totalRelations++

      const fromBar = props.taskBarPositions[predecessorId]
      const toBar = props.taskBarPositions[task.id]

      if (!fromBar || !toBar || !currentTaskIds.has(predecessorId)) {
        culledRelations++
        continue
      }

      // 虚拟渲染：跳过不在 Canvas 覆盖范围内的关系线
      // 如果起点和终点都在 Canvas 外，跳过
      const fromX = fromBar.left + fromBar.width
      const toX = toBar.left
      const lineMinX = Math.min(fromX, toX)
      const lineMaxX = Math.max(fromX, toX)
      if (lineMaxX < canvasStartX || lineMinX > canvasEndX) {
        culledRelations++
        continue // 完全在 Canvas 外，跳过
      }

      drawnRelations++

      // 判断高亮状态
      const fromIsPrimary = props.highlightedTaskId === predecessorId
      const toIsPrimary = props.highlightedTaskId === task.id
      const fromIsHighlighted = props.highlightedTaskIds.has(predecessorId)
      const toIsHighlighted = props.highlightedTaskIds.has(task.id)
      const isLineHighlighted = fromIsHighlighted && toIsHighlighted

      // 判断 hover 状态
      const fromIsHovered = props.hoveredTaskId === predecessorId
      const toIsHovered = props.hoveredTaskId === task.id
      const isLineHovered = fromIsHovered || toIsHovered

      // 计算 Y 轴偏移（高亮时的位移）
      const fromYOffset = fromIsPrimary ? -8 : fromIsHighlighted ? -5 : 0
      const toYOffset = toIsPrimary ? -8 : toIsHighlighted ? -5 : 0

      // 计算坐标（全局坐标）
      const globalX1 = fromBar.left + fromBar.width
      const globalY1 = fromBar.top + fromBar.height / 2 + fromYOffset
      const globalX2 = toBar.left
      const globalY2 = toBar.top + toBar.height / 2 + toYOffset

      // 转换为 Canvas 局部坐标
      const x1 = globalX1 - props.offsetLeft
      const y1 = globalY1
      const x2 = globalX2 - props.offsetLeft
      const y2 = globalY2

      const c1x = x1 + 40
      const c1y = y1
      const c2x = x2 - 40
      const c2y = y2

      // 预计算箭头角度
      const arrowAngle = Math.atan2(y2 - c2y, x2 - c2x)

      const lineData: LineData = { x1, y1, x2, y2, c1x, c1y, c2x, c2y, arrowAngle }

      // 根据状态分组
      if (isLineHighlighted) {
        highlightedLines.push(lineData)
      } else if (isLineHovered) {
        hoveredLines.push(lineData)
      } else if (isHighlightMode) {
        fadedLines.push(lineData)
      } else {
        normalLines.push(lineData)
      }
    }
  }

  // 批量绘制：设置虚线样式（所有线条共用）
  ctx.setLineDash([6, 4])

  // 批量绘制高亮线条
  if (highlightedLines.length > 0) {
    ctx.strokeStyle = '#409eff'
    ctx.fillStyle = '#409eff'
    ctx.lineWidth = 4
    ctx.globalAlpha = 1

    ctx.beginPath()
    for (const line of highlightedLines) {
      ctx.moveTo(line.x1, line.y1)
      ctx.bezierCurveTo(line.c1x, line.c1y, line.c2x, line.c2y, line.x2, line.y2)
    }
    ctx.stroke()

    // 批量绘制箭头
    for (const line of highlightedLines) {
      drawArrowOptimized(ctx, line.x2, line.y2, line.arrowAngle)
    }
  }

  // 批量绘制悬停线条
  if (hoveredLines.length > 0) {
    ctx.strokeStyle = '#67c23a'
    ctx.fillStyle = '#67c23a'
    ctx.lineWidth = 3
    ctx.globalAlpha = 1

    ctx.beginPath()
    for (const line of hoveredLines) {
      ctx.moveTo(line.x1, line.y1)
      ctx.bezierCurveTo(line.c1x, line.c1y, line.c2x, line.c2y, line.x2, line.y2)
    }
    ctx.stroke()

    // 批量绘制箭头
    for (const line of hoveredLines) {
      drawArrowOptimized(ctx, line.x2, line.y2, line.arrowAngle)
    }
  }

  // 批量绘制普通线条
  if (normalLines.length > 0) {
    ctx.strokeStyle = '#c0c4cc'
    ctx.fillStyle = '#c0c4cc'
    ctx.lineWidth = 2
    ctx.globalAlpha = 1

    ctx.beginPath()
    for (const line of normalLines) {
      ctx.moveTo(line.x1, line.y1)
      ctx.bezierCurveTo(line.c1x, line.c1y, line.c2x, line.c2y, line.x2, line.y2)
    }
    ctx.stroke()

    // 批量绘制箭头
    for (const line of normalLines) {
      drawArrowOptimized(ctx, line.x2, line.y2, line.arrowAngle)
    }
  }

  // 批量绘制半透明线条（高亮模式下的普通线条）
  if (fadedLines.length > 0) {
    ctx.strokeStyle = '#c0c4cc'
    ctx.fillStyle = '#c0c4cc'
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.2

    ctx.beginPath()
    for (const line of fadedLines) {
      ctx.moveTo(line.x1, line.y1)
      ctx.bezierCurveTo(line.c1x, line.c1y, line.c2x, line.c2y, line.x2, line.y2)
    }
    ctx.stroke()

    // 批量绘制箭头
    for (const line of fadedLines) {
      drawArrowOptimized(ctx, line.x2, line.y2, line.arrowAngle)
    }

    // 恢复透明度
    ctx.globalAlpha = 1
  }
}

/**
 * 优化版箭头绘制（减少参数传递，复用已设置的 fillStyle）
 */
const drawArrowOptimized = (
  ctx: CanvasRenderingContext2D,
  x2: number,
  y2: number,
  angle: number,
) => {
  const arrowLength = 8
  const arrowWidth = 4

  ctx.beginPath()
  // fillStyle 已在外部设置，无需重复设置
  ctx.moveTo(x2, y2)
  ctx.lineTo(
    x2 - arrowLength * Math.cos(angle) - arrowWidth * Math.sin(angle),
    y2 - arrowLength * Math.sin(angle) + arrowWidth * Math.cos(angle),
  )
  ctx.lineTo(
    x2 - arrowLength * Math.cos(angle) + arrowWidth * Math.sin(angle),
    y2 - arrowLength * Math.sin(angle) - arrowWidth * Math.cos(angle),
  )
  ctx.closePath()
  ctx.fill()
}

/**
 * 使用 requestAnimationFrame 优化的重绘调度器
 * 合并多个连续的重绘请求为单次绘制
 */
const scheduleRedraw = () => {
  if (pendingRedraw) {
    // 已有待处理的重绘请求，跳过
    return
  }

  pendingRedraw = true

  // 取消之前的 RAF（如果有）
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
  }

  // 在下一帧绘制
  rafId = requestAnimationFrame(() => {
    pendingRedraw = false
    rafId = null
    drawLinks()
  })
}

// 监听相关状态变化，自动重绘 Canvas
watch(
  [
    () => props.taskBarPositions,
    () => props.tasks.length,
    () => props.highlightedTaskId,
    () => props.highlightedTaskIds,
    () => props.hoveredTaskId,
    () => props.width,
    () => props.height,
    () => props.verticalLines,
    () => props.showVerticalLines,
    () => props.offsetLeft, // 监听虚拟渲染的偏移量变化
  ],
  () => {
    // 使用 RAF 调度重绘，合并连续的多次变化为单次绘制
    scheduleRedraw()
  },
  { deep: false }, // shallowRef 不需要 deep
)

// 组件挂载后初始化绘制
onMounted(() => {
  nextTick(() => {
    drawLinks()
  })
})

// 组件卸载时清理
onUnmounted(() => {
  // 取消待处理的 RAF
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
})

// 暴露方法供父组件调用
defineExpose({
  redraw: drawLinks,
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="gantt-links-canvas"
    :style="{
      position: 'absolute',
      left: 0,
      top: 0,
      width: `${width}px`,
      height: `${height}px`,
      transform: `translateX(${offsetLeft}px)`,
      zIndex: highlightedTaskId !== null ? 1001 : 25,
      pointerEvents: 'none',
    }"
  />
</template>

<style scoped>
.gantt-links-canvas {
  display: block;
  background: transparent; /* 确保背景透明 */
  opacity: 1; /* 确保不透明度为 100% */
}
</style>

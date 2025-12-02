<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

interface Props {
  active: boolean
  startX: number
  startY: number
  endX: number
  endY: number
  width: number
  height: number
  offsetLeft?: number
  offsetTop?: number
  isValidTarget?: boolean // 是否是合法的连接目标
  errorMessage?: string // 错误提示消息
}

const props = withDefaults(defineProps<Props>(), {
  offsetLeft: 0,
  offsetTop: 0,
  isValidTarget: true,
  errorMessage: '',
})

const canvasRef = ref<HTMLCanvasElement | null>(null)

// 性能监控
const ENABLE_PERF_MONITOR = true
const SKIP_ACTUAL_DRAW = false // 调试开关：跳过实际绘制，只打印日志
let drawCount = 0
let drawTotalTime = 0
let lastReportTime = 0
let lastCallTime = 0 // 上次调用时间，用于计算间隔

// 缓存 canvas 上下文和尺寸信息，避免重复初始化
let cachedCtx: CanvasRenderingContext2D | null = null
let cachedWidth = 0
let cachedHeight = 0
let cachedDpr = 0

/**
 * 初始化或更新 canvas 尺寸
 */
const initCanvas = () => {
  const canvas = canvasRef.value
  if (!canvas) return null

  const displayWidth = props.width
  const displayHeight = props.height
  const dpr = window.devicePixelRatio || 1

  // 只在尺寸或 DPR 变化时重新初始化
  if (
    !cachedCtx ||
    cachedWidth !== displayWidth ||
    cachedHeight !== displayHeight ||
    cachedDpr !== dpr
  ) {
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false })
    if (!ctx) return null

    const pixelWidth = displayWidth * dpr
    const pixelHeight = displayHeight * dpr

    canvas.width = pixelWidth
    canvas.height = pixelHeight
    ctx.scale(dpr, dpr)

    cachedCtx = ctx
    cachedWidth = displayWidth
    cachedHeight = displayHeight
    cachedDpr = dpr
  }

  return cachedCtx
}

/**
 * 绘制拖拽引导线
 * 使用贝塞尔曲线，与 GanttLinks 保持一致的视觉风格
 * 立即绘制，不使用RAF节流，确保跟随鼠标
 */
const drawGuideLine = () => {
  performDraw()
}

const performDraw = () => {
  if (!props.active) return

  // 调试模式：跳过实际绘制
  if (SKIP_ACTUAL_DRAW) {
    return
  }

  const startTime = ENABLE_PERF_MONITOR ? performance.now() : 0

  const ctx = initCanvas()
  if (!ctx) return

  const displayWidth = cachedWidth
  const displayHeight = cachedHeight

  // 清空画布（使用缓存的尺寸）
  ctx.clearRect(0, 0, displayWidth, displayHeight)

  // 转换为 Canvas 局部坐标
  const localX1 = props.startX - props.offsetLeft
  const localY1 = props.startY - props.offsetTop
  const localX2 = props.endX - props.offsetLeft
  const localY2 = props.endY - props.offsetTop

  // 检查坐标是否在 Canvas 范围内（增加缓冲区以允许部分可见）
  const buffer = 100
  const isInBounds =
    (localX1 >= -buffer || localX2 >= -buffer) &&
    (localX1 <= displayWidth + buffer || localX2 <= displayWidth + buffer) &&
    (localY1 >= -buffer || localY2 >= -buffer) &&
    (localY1 <= displayHeight + buffer || localY2 <= displayHeight + buffer)

  if (!isInBounds) return

  // 贝塞尔曲线控制点（与 GanttLinks 一致）
  const c1x = localX1 + 40
  const c1y = localY1
  const c2x = localX2 - 40
  const c2y = localY2

  ctx.save()

  // 根据是否是合法目标设置颜色
  const color = props.isValidTarget ? '#67c23a' : '#f56c6c'
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.setLineDash([8, 4])
  ctx.globalAlpha = 0.8

  // 绘制贝塞尔曲线
  ctx.beginPath()
  ctx.moveTo(localX1, localY1)
  ctx.bezierCurveTo(c1x, c1y, c2x, c2y, localX2, localY2)
  ctx.stroke()

  // 绘制箭头
  const arrowAngle = Math.atan2(localY2 - c2y, localX2 - c2x)
  const arrowLength = 8
  const arrowWidth = 4

  ctx.fillStyle = color
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.moveTo(localX2, localY2)
  ctx.lineTo(
    localX2 - arrowLength * Math.cos(arrowAngle) - arrowWidth * Math.sin(arrowAngle),
    localY2 - arrowLength * Math.sin(arrowAngle) + arrowWidth * Math.cos(arrowAngle),
  )
  ctx.lineTo(
    localX2 - arrowLength * Math.cos(arrowAngle) + arrowWidth * Math.sin(arrowAngle),
    localY2 - arrowLength * Math.sin(arrowAngle) - arrowWidth * Math.cos(arrowAngle),
  )
  ctx.closePath()
  ctx.fill()

  // 绘制错误提示文字（当连接无效且有错误消息时）
  if (!props.isValidTarget && props.errorMessage) {
    const textX = (localX1 + localX2) / 2
    const textY = (localY1 + localY2) / 2 - 10

    // 文字背景
    ctx.font = '12px Arial, sans-serif'
    const textMetrics = ctx.measureText(props.errorMessage)
    const textWidth = textMetrics.width
    const padding = 8

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.fillRect(textX - textWidth / 2 - padding, textY - 12, textWidth + padding * 2, 24)

    // 文字内容
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(props.errorMessage, textX, textY)
  }

  ctx.restore()

  if (ENABLE_PERF_MONITOR) {
    drawCount++
    drawTotalTime += performance.now() - startTime

    const now = Date.now()
    if (now - lastReportTime > 1000) {
      const avgTime = drawCount > 0 ? (drawTotalTime / drawCount).toFixed(3) : 0
      // eslint-disable-next-line no-console
      console.log(`[LinkDragGuide Perf] 绘制次数: ${drawCount}/秒, 平均耗时: ${avgTime}ms`)

      drawCount = 0
      drawTotalTime = 0
      lastReportTime = now
    }
  }
}

/**
 * 清空画布
 */
const clearCanvas = () => {
  const ctx = cachedCtx
  if (!ctx) return

  ctx.clearRect(0, 0, cachedWidth, cachedHeight)
}

// 组件卸载时清除缓存
onUnmounted(() => {
  cachedCtx = null
})

watch(
  [
    () => props.active,
    () => props.startX,
    () => props.startY,
    () => props.endX,
    () => props.endY,
    () => props.isValidTarget,
    () => props.errorMessage,
  ],
  () => {
    if (props.active) {
      drawGuideLine()
    } else {
      clearCanvas()
    }
  },
  { flush: 'sync' }, // 同步执行，立即响应坐标变化
)

// 监听尺寸变化，需要重新初始化 canvas（尺寸变化频率低）
watch(
  [() => props.width, () => props.height],
  () => {
    // 清除缓存，强制重新初始化
    cachedCtx = null
    if (props.active) {
      drawGuideLine()
    }
  },
)

onMounted(() => {
  if (props.active) {
    drawGuideLine()
  }
})
</script>

<template>
  <canvas
    v-if="active"
    ref="canvasRef"
    class="link-drag-guide-canvas"
    :style="{
      position: 'absolute',
      left: `${offsetLeft}px`,
      top: `${offsetTop}px`,
      width: `${width}px`,
      height: `${height}px`,
      zIndex: 1002,
      pointerEvents: 'none',
    }"
  />
</template>

<style scoped>
.link-drag-guide-canvas {
  display: block;
  background: transparent;
  opacity: 1;
}
</style>

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
}

const props = withDefaults(defineProps<Props>(), {
  offsetLeft: 0,
  offsetTop: 0,
  isValidTarget: true,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)

// 使用 requestAnimationFrame 节流重绘
let rafId: number | null = null
let pendingDraw = false

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
 */
const drawGuideLine = () => {
  // 如果已经有待处理的绘制请求，取消标记
  if (rafId !== null) {
    pendingDraw = true
    return
  }

  // 使用 requestAnimationFrame 确保在下一帧绘制
  rafId = requestAnimationFrame(() => {
    rafId = null
    performDraw()

    // 如果在绘制期间又有新的请求，再次绘制
    if (pendingDraw) {
      pendingDraw = false
      drawGuideLine()
    }
  })
}

const performDraw = () => {
  if (!props.active) return

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

  ctx.restore()
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
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
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
  ],
  () => {
    if (props.active) {
      drawGuideLine()
    } else {
      clearCanvas()
    }
  },
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

// 组件卸载时取消待处理的动画帧
onUnmounted(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
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

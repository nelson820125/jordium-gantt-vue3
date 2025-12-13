<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { CanvasContextManager } from '../utils/canvasUtils'

interface Props {
  active: boolean
  // 尺寸和位置（变化频率低）
  width: number
  height: number
  offsetLeft?: number
  offsetTop?: number
}

const props = withDefaults(defineProps<Props>(), {
  offsetLeft: 0,
  offsetTop: 0,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)

// Canvas 上下文管理器
const canvasManager = new CanvasContextManager()

/**
 * 初始化或更新 canvas 尺寸
 */
const initCanvas = () => {
  return canvasManager.getContext({
    canvas: canvasRef.value,
    canvasId: 'link-drag-guide-canvas',
    width: props.width,
    height: props.height,
    contextOptions: { alpha: true, willReadFrequently: false },
  })
}

/**
 * 🚀 命令式绘制方法 - 由父组件直接调用，避免 Vue 响应式开销
 * @param startX 起始点X坐标
 * @param startY 起始点Y坐标
 * @param endX 结束点X坐标
 * @param endY 结束点Y坐标
 * @param isValidTarget 是否是合法的连接目标
 * @param errorMessage 错误提示消息
 */
const USE_SIMPLE_LINE = true  // true = 使用简单直线替代贝塞尔曲线（性能更好）

const draw = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  isValidTarget = true,
  errorMessage = '',
) => {
  const ctx = initCanvas()
  if (!ctx) {
    // eslint-disable-next-line no-console
    console.error('[LinkDragGuide] initCanvas returned null')
    return
  }

  const displayWidth = props.width
  const displayHeight = props.height

  // 清空画布
  ctx.clearRect(0, 0, displayWidth, displayHeight)

  // 转换为 Canvas 局部坐标
  const localX1 = startX - props.offsetLeft
  const localY1 = startY - props.offsetTop
  const localX2 = endX - props.offsetLeft
  const localY2 = endY - props.offsetTop

  // 检查坐标是否在 Canvas 范围内
  const buffer = 100
  const isInBounds =
    (localX1 >= -buffer || localX2 >= -buffer) &&
    (localX1 <= displayWidth + buffer || localX2 <= displayWidth + buffer) &&
    (localY1 >= -buffer || localY2 >= -buffer) &&
    (localY1 <= displayHeight + buffer || localY2 <= displayHeight + buffer)

  if (!isInBounds) return

  // 贝塞尔曲线控制点
  const c1x = localX1 + 40
  const c1y = localY1
  const c2x = localX2 - 40
  const c2y = localY2

  ctx.save()

  // 根据是否是合法目标设置颜色
  const color = isValidTarget ? '#67c23a' : '#f56c6c'
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  // 虚线绘制也会导致巨大的性能开销，慎用
  if (!USE_SIMPLE_LINE) {
    ctx.setLineDash([8, 4])
  }
  ctx.globalAlpha = 0.8

  // 绘制直线
  ctx.beginPath()
  ctx.moveTo(localX1, localY1)

  if (USE_SIMPLE_LINE) {
    // 🚀 性能优化：使用简单直线（性能最佳）
    ctx.lineTo(localX2, localY2)
  } else {
    // 使用贝塞尔曲线（视觉效果好但性能较差）
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, localX2, localY2)
  }

  ctx.stroke()

  // 绘制箭头
  const arrowAngle = Math.atan2(localY2 - localY1, localX2 - localX1)
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

  // 绘制错误提示文字
  if (!isValidTarget && errorMessage) {
    const textX = (localX1 + localX2) / 2
    const textY = (localY1 + localY2) / 2 - 10

    ctx.font = '12px Arial, sans-serif'
    const textMetrics = ctx.measureText(errorMessage)
    const textWidth = textMetrics.width
    const padding = 8

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.fillRect(textX - textWidth / 2 - padding, textY - 12, textWidth + padding * 2, 24)

    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(errorMessage, textX, textY)
  }

  ctx.restore()

  // uni-app 环境需要调用 draw() 方法将绘制内容渲染到画布
  canvasManager.draw()
}

/**
 * 清空画布
 */
const clear = () => {
  canvasManager.clear(props.width, props.height)
}

// 监听尺寸变化，需要重新初始化 canvas
watch(
  [() => props.width, () => props.height],
  () => {
    canvasManager.reset() // 清除缓存，下次绘制时重新初始化
  },
)

// 监听 active 变化，清除缓存（因为 v-if 会移除/重建 canvas 元素）
watch(
  () => props.active,
  (newActive) => {
    if (!newActive) {
      // canvas 即将被移除，清除缓存
      canvasManager.reset()
    }
  },
)

// 组件卸载时清除缓存
onUnmounted(() => {
  canvasManager.reset()
})

// 🚀 暴露命令式 API 给父组件
defineExpose({
  draw,
  clear,
})
</script>

<template>
  <canvas
    v-if="active"
    ref="canvasRef"
    canvas-id="link-drag-guide-canvas"
    class="link-drag-guide-canvas"
    type="2d"
    :hidpi="true"
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

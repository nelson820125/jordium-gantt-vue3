<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'

interface Props {
  // 触点类型
  type: 'predecessor' | 'successor' // left触点=前置, right触点=后置
  taskId: number
  // 显示控制
  visible?: boolean // 是否显示（默认在 hover 时显示）
  // 拖拽状态
  isDragSource?: boolean // 是否是拖拽源
  isDragTarget?: boolean // 是否是拖拽目标
  isValidTarget?: boolean // 是否是合法目标
  // 功能开关
  enabled?: boolean // 是否启用连接功能（默认 true）
  // 全局拖拽状态（用于优化显示逻辑）
  globalDragging?: boolean // 是否有全局拖拽进行中
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  isDragSource: false,
  isDragTarget: false,
  isValidTarget: true,
  enabled: true,
  globalDragging: false,
})

const emit = defineEmits<{
  'drag-start': [{ taskId: number; type: 'predecessor' | 'successor'; x: number; y: number }]
  'drag-move': [{ x: number; y: number }]
  'drag-end': [{ taskId: number; type: 'predecessor' | 'successor' }]
}>()

// 触点自身悬停状态
const isHoveredAnchor = ref(false)

// 优化的显示逻辑
const shouldShow = computed(() => {
  // 在以下情况显示触点：
  // 1. TaskBar 被悬停
  // 2. 全局有拖拽操作进行中（其他任务正在拖拽连接线）
  // 3. 当前是拖拽的源任务
  // 4. 当前是拖拽的目标任务
  // 5. 触点本身被悬停
  return (
    props.visible || // TaskBar 悬停
    props.globalDragging || // 全局拖拽进行中
    props.isDragSource || // 是拖拽的源任务
    props.isDragTarget || // 是拖拽的目标任务
    isHoveredAnchor.value // 触点本身被悬停
  )
})

// 全局拖拽监听器管理（组件自治）
let globalMouseMoveListener: ((e: MouseEvent) => void) | null = null
let globalMouseUpListener: ((e: MouseEvent) => void) | null = null
let isDragging = false

// 开始拖拽
function handleMouseDown(event: MouseEvent) {
  if (!props.enabled) return
  event.stopPropagation()
  event.preventDefault()

  isDragging = true

  // 发射拖拽开始事件
  emit('drag-start', {
    taskId: props.taskId,
    type: props.type,
    x: event.clientX,
    y: event.clientY,
  })

  // 添加全局监听器（组件自治）
  globalMouseMoveListener = (e: MouseEvent) => {
    if (!isDragging) return
    // 发射拖拽移动事件
    emit('drag-move', {
      x: e.clientX,
      y: e.clientY,
    })
  }

  globalMouseUpListener = () => {
    if (!isDragging) return
    // 发射拖拽结束事件
    emit('drag-end', {
      taskId: props.taskId,
      type: props.type,
    })
    cleanup()
  }

  document.addEventListener('mousemove', globalMouseMoveListener)
  document.addEventListener('mouseup', globalMouseUpListener)
}

function handleMouseEnter() {
  if (!props.enabled) return
  isHoveredAnchor.value = true
}

function handleMouseLeave() {
  if (!props.enabled) return
  isHoveredAnchor.value = false
}

// 清理全局监听器
function cleanup() {
  isDragging = false
  if (globalMouseMoveListener) {
    document.removeEventListener('mousemove', globalMouseMoveListener)
    globalMouseMoveListener = null
  }
  if (globalMouseUpListener) {
    document.removeEventListener('mouseup', globalMouseUpListener)
    globalMouseUpListener = null
  }
}

// 组件卸载时清理
onUnmounted(() => {
  cleanup()
})
</script>

<template>
  <div
    v-if="enabled && shouldShow"
    class="link-anchor"
    :class="{
      'anchor-predecessor': type === 'predecessor',
      'anchor-successor': type === 'successor',
      'drag-source': isDragSource,
      'drag-target': isDragTarget,
      'valid-target': isDragTarget && isValidTarget,
      'invalid-target': isDragTarget && !isValidTarget,
      'visible': shouldShow,
    }"
    @mousedown="handleMouseDown"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- Tooltip -->
    <div v-if="!isDragSource && !isDragTarget && !globalDragging" class="anchor-tooltip">
      {{ type === 'predecessor' ? '添加前置任务' : '添加后置任务' }}
    </div>
  </div>
</template>

<style scoped>
.link-anchor {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #409eff;
  border: 2px solid #fff;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.2s,
    transform 0.2s;
  z-index: 200;
  /* 默认状态：垂直居中 */
  transform: translateY(-50%) scale(1);
}

/* 前置任务触点（左侧） */
.link-anchor.anchor-predecessor {
  left: -4px;
}

/* 后置任务触点（右侧） */
.link-anchor.anchor-successor {
  right: -4px;
}

/* 当应该显示时，设置可见 */
.link-anchor.visible {
  opacity: 1;
}

.link-anchor:hover {
  /* 保持垂直居中的同时放大 */
  transform: translateY(-50%) scale(1.3);
  box-shadow: 0 0 8px rgba(64, 158, 255, 0.6);
  opacity: 1 !important;
}

.link-anchor.drag-source {
  opacity: 1;
  /* 拖拽源也保持垂直居中 */
  transform: translateY(-50%) scale(1);
}

.link-anchor.drag-target {
  opacity: 1;
  /* 拖拽目标：保持垂直居中并放大 */
  transform: translateY(-50%) scale(1.5);
  animation: pulse 0.8s infinite;
}

.link-anchor.valid-target {
  background: #67c23a;
  border-color: #fff;
}

.link-anchor.invalid-target {
  background: #f56c6c;
  border-color: #fff;
}

.anchor-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  font-size: 12px;
  white-space: nowrap;
  border-radius: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.link-anchor:hover .anchor-tooltip {
  opacity: 1;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 8px rgba(64, 158, 255, 0.6);
  }
  50% {
    box-shadow: 0 0 16px rgba(64, 158, 255, 1);
  }
}

/* 暗色主题支持 */
:global(.gantt-root[data-theme='dark']) .link-anchor {
  border-color: #1a1a1a;
}

:global(.gantt-root[data-theme='dark']) .link-anchor.valid-target,
:global(.gantt-root[data-theme='dark']) .link-anchor.invalid-target {
  border-color: #1a1a1a;
}

:global(.gantt-root[data-theme='dark']) .anchor-tooltip {
  background: rgba(255, 255, 255, 0.9);
  color: #1a1a1a;
}
</style>

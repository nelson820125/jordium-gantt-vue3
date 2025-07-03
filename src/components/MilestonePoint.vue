<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import type { Milestone } from '../models/classes/Milestone'

interface Props {
  date: string // 里程碑日期
  rowHeight: number
  dayWidth: number
  startDate: Date
  name?: string
  milestone?: Milestone // 完整的里程碑数据
}

const props = defineProps<Props>()

// 添加事件定义
const emit = defineEmits<{
  'milestone-double-click': [milestone: Milestone]
  'update:milestone': [milestone: Milestone] // 新增里程碑更新事件
  'drag-end': [milestone: Milestone] // 新增
}>()

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

// 拖拽事件处理
const handleMouseDown = (e: MouseEvent) => {
  // 如果正在双击过程中，不启动拖拽
  e.preventDefault()
  e.stopPropagation()

  // 设置拖拽状态，但不立即开始拖拽
  dragStartX.value = e.clientX
  dragStartLeft.value = parseInt(milestoneStyle.value.left)
  tempMilestoneData.value = null

  // 添加全局事件监听器
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleMouseMove = (e: MouseEvent) => {
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
  // 只有在真正拖拽了（有临时数据）且状态为拖拽中时才触发更新
  if (isDragging.value && tempMilestoneData.value && props.milestone) {
    const updatedMilestone = {
      ...props.milestone,
      ...tempMilestoneData.value,
    }
    emit('update:milestone', updatedMilestone)
    emit('drag-end', updatedMilestone)
  }

  // 重置所有拖拽状态
  isDragging.value = false
  tempMilestoneData.value = null

  // 移除事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// 计算菱形位置 - 考虑拖拽临时数据
const milestoneStyle = computed(() => {
  const milestoneDate = tempMilestoneData.value?.startDate
    ? new Date(tempMilestoneData.value.startDate)
    : new Date(props.date)

  // 修正：props.startDate 可能为 undefined，需防御性处理
  if (!props.startDate || isNaN(new Date(props.date).getTime())) {
    return {
      left: '0px',
      top: '0px',
      width: 'auto',
      height: 'auto',
    }
  }

  const startDiff = Math.floor(
    (milestoneDate.getTime() - props.startDate.getTime()) / (1000 * 60 * 60 * 24),
  )
  const size = Math.min(props.rowHeight, props.dayWidth * 1.2, 24)
  return {
    left: `${startDiff * props.dayWidth + props.dayWidth / 2 - size / 2}px`,
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

// 组件销毁时清理事件监听器
onUnmounted(() => {
  // 清理拖拽状态
  isDragging.value = false
  tempMilestoneData.value = null

  // 移除事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<template>
  <div
    class="milestone"
    :style="milestoneStyle"
    :title="props.name || '里程碑'"
    :class="{ dragging: isDragging }"
    @dblclick="handleDoubleClick"
    @mousedown="handleMouseDown"
  >
    <svg :width="24" :height="24" :viewBox="`0 0 24 24`">
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
    <span v-if="props.name" class="milestone-label milestone-label-right">{{ props.name }}</span>
  </div>
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
}

.milestone-label-right {
  margin-left: 5px;
  align-self: center;
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
</style>

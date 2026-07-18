<template>
  <div
    class="gantt-resource-usage-cell"
    :class="levelClass"
    :style="cellStyle"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <template v-if="cell">
      <span class="gantt-resource-usage-hours">{{ formattedHours }}h</span>
      <span class="gantt-resource-usage-percent">{{ Math.round(cell.totalPercent) }}%</span>
    </template>
    <span v-else class="gantt-resource-usage-empty">-</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type {
  ResourceUsageCellData,
  ResourceUsageCellPayload,
} from '../../models/types/ResourceUsageTypes'

interface Props {
  cell: ResourceUsageCellData | null
  resourceId: string | number
  overloadThreshold?: number
  underloadThreshold?: number
  /** 超载背景色，未提供时使用主题默认色 */
  overloadColor?: string
  /** 正常区间背景色，未提供时使用主题默认色 */
  normalColor?: string
  /** 欠载背景色，未提供时使用主题默认色 */
  underloadColor?: string
  /** 周末背景色，未提供时使用主题默认色（仅 cell.isWeekend 为 true 时生效） */
  weekendColor?: string
  /** 单元格固定高度（px），用于与左侧资源列表行高保持一致 */
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  overloadThreshold: 100,
  underloadThreshold: 60,
})

const emit = defineEmits<{
  click: [payload: ResourceUsageCellPayload]
  hover: [payload: ResourceUsageCellPayload | null]
}>()

const formattedHours = computed(() =>
  props.cell ? Math.round(props.cell.totalHours * 10) / 10 : 0
)

/** 颜色分级：周末优先于负载状态；<underloadThreshold 黄色（欠载），>overloadThreshold 红色（超载），其余绿色（正常） */
const levelClass = computed(() => {
  if (props.cell?.isWeekend) return 'is-weekend'
  if (!props.cell) return 'is-empty'
  const percent = props.cell.totalPercent
  if (percent > props.overloadThreshold) return 'is-overloaded'
  if (percent < props.underloadThreshold) return 'is-underloaded'
  return 'is-normal'
})

/** 自定义颜色优先级高于主题默认色（class 选择器），通过内联样式覆盖 */
const cellStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.height !== undefined) style.height = `${props.height}px`

  const customColor = (() => {
    switch (levelClass.value) {
      case 'is-weekend':
        return props.weekendColor
      case 'is-overloaded':
        return props.overloadColor
      case 'is-underloaded':
        return props.underloadColor
      case 'is-normal':
        return props.normalColor
      default:
        return undefined
    }
  })()
  if (customColor) style.backgroundColor = customColor

  return style
})

const handleClick = () => {
  emit('click', { resourceId: props.resourceId, cell: props.cell })
}

const handleMouseEnter = () => {
  emit('hover', props.cell ? { resourceId: props.resourceId, cell: props.cell } : null)
}

const handleMouseLeave = () => {
  emit('hover', null)
}
</script>

<style scoped>
.gantt-resource-usage-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  cursor: pointer;
  font-size: 12px;
  gap: 1px;
  box-sizing: border-box;
  border-right: 1px solid var(--gantt-border-light);
  border-bottom: 1px solid var(--gantt-border-light);
}

.gantt-resource-usage-hours {
  font-weight: 600;
  color: var(--gantt-text-primary);
}

.gantt-resource-usage-percent {
  font-size: 11px;
  color: var(--gantt-text-secondary);
}

.gantt-resource-usage-cell.is-underloaded {
  background-color: var(--gantt-warning-light);
}
.gantt-resource-usage-cell.is-underloaded .gantt-resource-usage-hours {
  color: var(--gantt-warning);
}

.gantt-resource-usage-cell.is-normal {
  background-color: color-mix(in srgb, var(--gantt-success) 15%, transparent);
}

.gantt-resource-usage-cell.is-overloaded {
  background-color: var(--gantt-danger-light);
}
.gantt-resource-usage-cell.is-overloaded .gantt-resource-usage-hours {
  color: var(--gantt-danger);
}

.gantt-resource-usage-cell.is-empty {
  color: var(--gantt-text-muted);
  cursor: default;
}

/* 周末列：灰色背景，弱化文字，优先级高于负载配色 */
.gantt-resource-usage-cell.is-weekend {
  background-color: var(--gantt-bg-tertiary);
  cursor: default;
}
.gantt-resource-usage-cell.is-weekend .gantt-resource-usage-hours,
.gantt-resource-usage-cell.is-weekend .gantt-resource-usage-percent {
  color: var(--gantt-text-muted);
}
</style>

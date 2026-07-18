<template>
  <div
    class="gantt-resource-usage-cell"
    :class="levelClass"
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

/** 颜色分级：<underloadThreshold 黄色（欠载），>overloadThreshold 红色（超载），其余绿色（正常） */
const levelClass = computed(() => {
  if (!props.cell) return 'is-empty'
  const percent = props.cell.totalPercent
  if (percent > props.overloadThreshold) return 'is-overloaded'
  if (percent < props.underloadThreshold) return 'is-underloaded'
  return 'is-normal'
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
  min-height: 44px;
  cursor: pointer;
  font-size: 12px;
  border-radius: 3px;
  gap: 1px;
  box-sizing: border-box;
  border: 1px solid transparent;
}

.gantt-resource-usage-cell:hover {
  border-color: var(--gantt-border-medium);
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
  background-color: var(--gantt-success);
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
</style>

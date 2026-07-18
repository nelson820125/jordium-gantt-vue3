<template>
  <div class="gantt-resource-usage-view" :class="{ 'is-disabled': disabled }">
    <div class="gantt-resource-usage-toolbar">
      <div class="gantt-resource-usage-scale-switch">
        <button
          v-for="s in scales"
          :key="s"
          type="button"
          class="gantt-resource-usage-scale-btn"
          :class="{ 'is-active': scaleInternal === s }"
          @click="handleScaleChange(s)"
        >
          {{ scaleLabels[s] }}
        </button>
      </div>
    </div>

    <div class="gantt-resource-usage-body">
      <div class="gantt-resource-usage-list" :style="{ width: listWidth }">
        <div class="gantt-resource-usage-list-header">
          <div
            v-for="col in visibleColumns"
            :key="col.key"
            class="gantt-resource-usage-list-cell is-header"
          >
            {{ col.label }}
          </div>
        </div>
        <div v-for="resource in resources" :key="resource.id" class="gantt-resource-usage-list-row">
          <div v-for="col in visibleColumns" :key="col.key" class="gantt-resource-usage-list-cell">
            {{ formatColumn(resource, col) }}
          </div>
        </div>
      </div>

      <div class="gantt-resource-usage-grid">
        <div class="gantt-resource-usage-grid-header">
          <div
            v-for="period in periods"
            :key="period.periodStart.toISOString()"
            class="gantt-resource-usage-grid-header-cell"
          >
            {{ formatPeriodLabel(period.periodStart) }}
          </div>
        </div>
        <div v-for="resource in resources" :key="resource.id" class="gantt-resource-usage-grid-row">
          <ResourceUsageCell
            v-for="cell in cellsByResource.get(resource.id) ?? []"
            :key="cell.periodStart.toISOString()"
            :cell="cell"
            :resource-id="resource.id"
            :overload-threshold="overloadThreshold"
            :underload-threshold="underloadThreshold"
            @click="handleCellClick"
            @hover="handleCellHover"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ResourceUsageView - MS-Project 风格资源工时分配表（v1.12.5 新增）
 * 独立顶层组件：仅依赖自身 props（resources），不依赖 GanttChart 的 provide/inject 机制。
 */
import { computed, ref, watch } from 'vue'
import ResourceUsageCell from './ResourceUsageCell.vue'
import { useResourceUsageAggregation } from '../../composables/useResourceUsageAggregation'
import type {
  ResourceUsageScale,
  ResourceUsageCellPayload,
  ResourceUsageCellData,
} from '../../models/types/ResourceUsageTypes'
import type { Resource } from '../../models/classes/Resource'
import type {
  ResourceListConfig,
  ResourceListColumnConfig,
} from '../../models/configs/ResourceListConfig'
import { DEFAULT_RESOURCE_LIST_COLUMNS } from '../../models/configs/ResourceListConfig'

interface Props {
  resources: Resource[]
  scale?: ResourceUsageScale
  defaultScale?: ResourceUsageScale
  dateRange?: { start: Date; end: Date }
  resourceListConfig?: ResourceListConfig
  overloadThreshold?: number
  underloadThreshold?: number
  disabled?: boolean
  onBeforeScaleChange?: (
    next: ResourceUsageScale,
    prev: ResourceUsageScale
  ) => boolean | Promise<boolean>
  onCellClick?: (payload: ResourceUsageCellPayload) => void
}

const props = withDefaults(defineProps<Props>(), {
  defaultScale: 'week',
  overloadThreshold: 100,
  underloadThreshold: 60,
  disabled: false,
})

const emit = defineEmits<{
  'scale-change': [payload: { next: ResourceUsageScale; prev: ResourceUsageScale }]
  'cell-click': [payload: ResourceUsageCellPayload]
  'cell-hover': [payload: ResourceUsageCellPayload | null]
  'overload-detected': [payload: { resourceId: string | number; periods: ResourceUsageCellData[] }]
}>()

const scales: ResourceUsageScale[] = ['day', 'week', 'month']
const scaleLabels: Record<ResourceUsageScale, string> = { day: '日', week: '周', month: '月' }

const uncontrolledScale = ref<ResourceUsageScale>(props.defaultScale)
const scaleInternal = computed(() => props.scale ?? uncontrolledScale.value)

const defaultDateRange = () => {
  const start = new Date()
  start.setDate(1)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  end.setDate(0)
  return { start, end }
}
const dateRangeInternal = computed(() => props.dateRange ?? defaultDateRange())

const overloadThresholdRef = computed(() => props.overloadThreshold)
const scaleRef = computed(() => scaleInternal.value)

const { cellsByResource } = useResourceUsageAggregation({
  resources: computed(() => props.resources),
  scale: scaleRef,
  dateRange: dateRangeInternal,
  overloadThreshold: overloadThresholdRef,
})

const periods = computed(() => {
  const firstResource = props.resources[0]
  return firstResource ? (cellsByResource.value.get(firstResource.id) ?? []) : []
})

const formatPeriodLabel = (date: Date) => {
  if (scaleInternal.value === 'month') return `${date.getFullYear()}/${date.getMonth() + 1}`
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// ------ 列配置（复用 ResourceListConfig，不新增类型） ------
const visibleColumns = computed<ResourceListColumnConfig[]>(() => {
  const columns = props.resourceListConfig?.columns ?? DEFAULT_RESOURCE_LIST_COLUMNS
  return columns.filter(col => col.visible !== false)
})

const listWidth = computed(() => {
  const w = props.resourceListConfig?.defaultWidth
  return typeof w === 'number' ? `${w}px` : (w ?? '320px')
})

const formatColumn = (resource: Resource, col: ResourceListColumnConfig): string => {
  if (col.formatter) return col.formatter(resource, col)
  switch (col.type) {
    case 'name':
      return resource.name
    case 'type':
      return resource.type ?? '-'
    case 'department':
      return resource.department ?? '-'
    case 'capacity':
      return resource.capacity !== undefined ? `${resource.capacity}%` : '-'
    case 'taskCount':
      return String(resource.tasks?.length ?? 0)
    default:
      return String((resource as unknown as Record<string, unknown>)[col.key] ?? '-')
  }
}

// ------ 刻度切换（含前置钩子） ------
const handleScaleChange = async (next: ResourceUsageScale) => {
  const prev = scaleInternal.value
  if (next === prev || props.disabled) return
  if (props.onBeforeScaleChange) {
    const allowed = await props.onBeforeScaleChange(next, prev)
    if (!allowed) return
  }
  if (props.scale === undefined) {
    uncontrolledScale.value = next
  }
  emit('scale-change', { next, prev })
}

const setScale = (scale: ResourceUsageScale) => {
  void handleScaleChange(scale)
}

const refreshAggregation = () => {
  // computed 会自动响应 props.resources 变化；此方法保留用于宿主强制触发场景（当前为空操作占位）
}

// ------ 单元格交互 ------
const handleCellClick = (payload: ResourceUsageCellPayload) => {
  props.onCellClick?.(payload)
  emit('cell-click', payload)
}

const handleCellHover = (payload: ResourceUsageCellPayload | null) => {
  emit('cell-hover', payload)
}

// ------ 超载检测通知 ------
watch(
  cellsByResource,
  map => {
    for (const [resourceId, cells] of map) {
      const overloaded = cells.filter(c => c.isOverloaded)
      if (overloaded.length > 0) {
        emit('overload-detected', { resourceId, periods: overloaded })
      }
    }
  },
  { immediate: true }
)

defineExpose({ refreshAggregation, setScale })
</script>

<style scoped>
.gantt-resource-usage-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: var(--gantt-bg-primary);
  color: var(--gantt-text-primary);
}

.gantt-resource-usage-view.is-disabled {
  opacity: 0.7;
  pointer-events: none;
}

.gantt-resource-usage-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px;
  border-bottom: 1px solid var(--gantt-border-medium);
  background-color: var(--gantt-bg-toolbar);
  flex-shrink: 0;
}

.gantt-resource-usage-scale-switch {
  display: flex;
  border: 1px solid var(--gantt-border-medium);
  border-radius: 4px;
  overflow: hidden;
}

.gantt-resource-usage-scale-btn {
  border: none;
  background-color: var(--gantt-bg-primary);
  color: var(--gantt-text-secondary);
  padding: 4px 12px;
  cursor: pointer;
  font-size: 12px;
}

.gantt-resource-usage-scale-btn.is-active {
  background-color: var(--gantt-primary);
  color: var(--gantt-text-white);
}

.gantt-resource-usage-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: auto;
}

.gantt-resource-usage-list {
  flex-shrink: 0;
  border-right: 1px solid var(--gantt-border-medium);
}

.gantt-resource-usage-list-header,
.gantt-resource-usage-list-row {
  display: flex;
}

.gantt-resource-usage-list-cell {
  flex: 1;
  padding: 6px 8px;
  font-size: 12px;
  border-bottom: 1px solid var(--gantt-border-light);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gantt-resource-usage-list-cell.is-header {
  font-weight: 600;
  color: var(--gantt-text-header);
  background-color: var(--gantt-bg-secondary);
}

.gantt-resource-usage-grid {
  flex: 1;
  min-width: 0;
}

.gantt-resource-usage-grid-header,
.gantt-resource-usage-grid-row {
  display: flex;
}

.gantt-resource-usage-grid-header-cell {
  flex: 1;
  min-width: 56px;
  text-align: center;
  padding: 6px 4px;
  font-size: 12px;
  color: var(--gantt-text-header);
  background-color: var(--gantt-bg-secondary);
  border-bottom: 1px solid var(--gantt-border-light);
}

.gantt-resource-usage-grid-row {
  border-bottom: 1px solid var(--gantt-border-light);
}

.gantt-resource-usage-grid-row > * {
  flex: 1;
  min-width: 56px;
}
</style>

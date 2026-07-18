<template>
  <div ref="rootRef" class="gantt-resource-usage-view" :class="{ 'is-disabled': disabled }">
    <div class="gantt-resource-usage-body">
      <!-- 左侧资源列表面板：完全复用资源计划视图 TaskList 的 .col/.col-name 结构与固定列宽体系 -->
      <div class="gantt-resource-usage-list-panel" :style="{ width: listWidth + 'px' }">
        <div class="gantt-resource-usage-list-header">
          <div
            v-for="col in visibleColumns"
            :key="col.key"
            class="col"
            :class="col.cssClass"
            :style="getColumnWidthStyle(col)"
          >
            {{ col.label }}
          </div>
        </div>
        <div ref="listScrollRef" class="gantt-resource-usage-list-scroll" @scroll="onListScroll">
          <div class="gantt-resource-usage-list-rows" :style="{ height: totalRowsHeight + 'px' }">
            <div
              v-for="row in visibleRows"
              :key="row.resource.id"
              class="gantt-resource-usage-list-row"
              :class="{ 'is-hover': hoveredResourceId === row.resource.id }"
              :style="{ top: row.top + 'px', height: rowHeight + 'px' }"
              @mouseenter="hoveredResourceId = row.resource.id"
              @mouseleave="hoveredResourceId = null"
            >
              <div
                v-for="col in visibleColumns"
                :key="col.key"
                class="col"
                :class="col.cssClass"
                :style="getColumnWidthStyle(col)"
              >
                {{ formatColumn(row.resource, col) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分隔条：可拖拽调整左右面板宽度 -->
      <div class="gantt-resource-usage-splitter" @mousedown="onSplitterMouseDown" />

      <!-- 右侧工时网格面板 -->
      <div class="gantt-resource-usage-grid-panel">
        <!-- 表头两行结构，对齐 Timeline：第一行年/月分组，第二行日/周/月具体刻度 -->
        <div class="gantt-resource-usage-grid-header">
          <div
            class="gantt-resource-usage-grid-header-track"
            :style="{ width: totalColsWidth + 'px', transform: `translateX(${-gridScrollLeft}px)` }"
          >
            <!-- 第一行：年/月（月刻度下为年）分组 -->
            <div class="gantt-resource-usage-grid-header-row major-row">
              <div
                v-for="group in majorHeaderGroups"
                :key="group.key"
                class="gantt-resource-usage-grid-major-cell"
                :style="{ left: group.left + 'px', width: group.width + 'px' }"
              >
                {{ group.label }}
              </div>
            </div>
            <!-- 第二行：具体周期刻度，虚拟滚动仅渲染可视区域 -->
            <div class="gantt-resource-usage-grid-header-row minor-row">
              <div
                v-for="col in visiblePeriodCells"
                :key="col.index"
                class="gantt-resource-usage-grid-header-cell"
                :class="{ 'is-weekend': col.isWeekend }"
                :style="{ left: col.left + 'px', width: columnWidthPx + 'px' }"
              >
                {{ formatPeriodLabel(col.period.periodStart) }}
              </div>
            </div>
          </div>
        </div>
        <div ref="gridScrollRef" class="gantt-resource-usage-grid-scroll" @scroll="onGridScroll">
          <div
            class="gantt-resource-usage-grid-inner"
            :style="{ width: totalColsWidth + 'px', height: totalRowsHeight + 'px' }"
          >
            <div
              v-for="row in visibleRows"
              :key="row.resource.id"
              class="gantt-resource-usage-grid-row"
              :class="{ 'is-hover': hoveredResourceId === row.resource.id }"
              :style="{
                top: row.top + 'px',
                height: rowHeight + 'px',
                width: totalColsWidth + 'px',
              }"
              @mouseenter="hoveredResourceId = row.resource.id"
              @mouseleave="hoveredResourceId = null"
            >
              <ResourceUsageCell
                v-for="col in visiblePeriodCells"
                :key="col.index"
                class="gantt-resource-usage-grid-cell"
                :style="{ left: col.left + 'px', width: columnWidthPx + 'px' }"
                :cell="getCell(row.resource.id, col.index)"
                :resource-id="row.resource.id"
                :overload-threshold="overloadThreshold"
                :underload-threshold="underloadThreshold"
                :overload-color="overloadColor"
                :normal-color="normalColor"
                :underload-color="underloadColor"
                :weekend-color="weekendColor"
                :height="rowHeight"
                @click="handleCellClick"
                @hover="handleCellHover"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ResourceUsageView - MS-Project 风格资源工时分配表（v1.12.5 新增）
 * 独立顶层组件：仅依赖自身 props（resources），不依赖 GanttChart 的 provide/inject 机制。
 *
 * 布局：左侧资源列表 + 右侧工时网格双 Panel（参考资源计划视图 TaskList/Timeline 的 splitter 形式），
 * 两侧行高、悬停高亮联动一致；纵向/横向均采用虚拟滚动，仅渲染可视区域 + 缓冲区的行/列，
 * 因此可支撑较大的资源数量与较长的时间跨度（如整年的“日”刻度）而不影响滚动流畅度。
 *
 * 刻度切换不内置 UI：由外部（如 GanttChart 工具栏的 时/日/周/月 按钮）驱动 `scale` 受控 prop；
 * 独立使用时也可通过 `defaultScale` 设置初始值，或调用 `setScale()` 编程式切换。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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
  /** 超载单元格背景色，未提供时使用主题默认色 */
  overloadColor?: string
  /** 正常单元格背景色，未提供时使用主题默认色 */
  normalColor?: string
  /** 欠载单元格背景色，未提供时使用主题默认色 */
  underloadColor?: string
  /** 周末列背景色，未提供时使用主题默认色（仅 scale === 'day' 生效） */
  weekendColor?: string
  /** 行高（px），左右两侧面板共用，默认 40 */
  rowHeight?: number
  /** 单元格列宽（px），未提供时按 scale 使用默认值（day: 56 / week: 80 / month: 100） */
  columnWidth?: number
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
  rowHeight: 51, // 对齐资源计划视图 TaskRow 行高（ROW_HEIGHT）
  disabled: false,
})

const emit = defineEmits<{
  'scale-change': [payload: { next: ResourceUsageScale; prev: ResourceUsageScale }]
  'cell-click': [payload: ResourceUsageCellPayload]
  'cell-hover': [payload: ResourceUsageCellPayload | null]
  'overload-detected': [payload: { resourceId: string | number; periods: ResourceUsageCellData[] }]
}>()

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

// 全量周期列表（用于表头与横向虚拟滚动索引），取任意资源的桶结果即可（各资源桶数量一致）
const periods = computed(() => {
  const firstResource = props.resources[0]
  return firstResource ? (cellsByResource.value.get(firstResource.id) ?? []) : []
})

const getCell = (
  resourceId: string | number,
  periodIndex: number
): ResourceUsageCellData | null => {
  return cellsByResource.value.get(resourceId)?.[periodIndex] ?? null
}

const formatPeriodLabel = (date: Date) => {
  if (scaleInternal.value === 'month') return `${date.getFullYear()}/${date.getMonth() + 1}`
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// ------ 列配置（复用 ResourceListConfig，不新增类型） ------
const visibleColumns = computed<ResourceListColumnConfig[]>(() => {
  const columns = props.resourceListConfig?.columns ?? DEFAULT_RESOURCE_LIST_COLUMNS
  return columns.filter(col => col.visible !== false)
})

/**
 * 列宽样式（完全对齐 TaskList useTaskListColumns 的 getColumnWidthStyle 逻辑）：
 * 未配置 width 时返回空对象，交由 list.css 中 .col/.col-name 等类名提供固定宽度，
 * 从而保证拖拽分隔条调整左侧面板宽度时列宽保持不变（不随面板宽度拉伸缩放）。
 */
const getColumnWidthStyle = (col: ResourceListColumnConfig): Record<string, string> => {
  if (!col.width) return {}
  let widthPx: string
  if (typeof col.width === 'string' && col.width.trim().endsWith('%')) {
    const percent = parseFloat(col.width) / 100
    widthPx = `${Math.floor(listWidth.value * percent)}px`
  } else if (typeof col.width === 'number') {
    widthPx = `${col.width}px`
  } else {
    widthPx = /\d+(px|rem|em)/.test(col.width) ? col.width : `${col.width}px`
  }
  return { flex: `0 0 ${widthPx}`, minWidth: widthPx, maxWidth: widthPx }
}

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

// ------ 刻度切换（无内置 UI，供外部驱动或编程式调用） ------
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

// 受控 scale prop 变化时同步内部状态（保证 emit('scale-change') 语义一致）
watch(
  () => props.scale,
  (next, prev) => {
    if (next !== undefined && prev !== undefined && next !== prev) {
      emit('scale-change', { next, prev })
    }
  }
)

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

// =====================================================================================
// 布局尺寸：左右面板行高一致 + 悬停联动
// =====================================================================================
const rowHeight = computed(() => props.rowHeight)
const hoveredResourceId = ref<string | number | null>(null)

const totalRowsHeight = computed(() => props.resources.length * rowHeight.value)

const columnWidthPx = computed(() => {
  if (props.columnWidth) return props.columnWidth
  if (scaleInternal.value === 'month') return 100
  if (scaleInternal.value === 'week') return 80
  return 56
})
const totalColsWidth = computed(() => periods.value.length * columnWidthPx.value)

/**
 * 表头第一行分组（年/月，月刻度下为年），对齐 Timeline 的 year-month-row。
 * 仅按周期数组做一次线性分组（周期数通常至多几百，开销可忽略），不参与虚拟滚动裁剪，
 * 因为分组数量远小于周期数量，直接全量渲染即可。
 */
interface MajorHeaderGroup {
  key: string
  label: string
  left: number
  width: number
}

const majorHeaderGroups = computed<MajorHeaderGroup[]>(() => {
  const groups: MajorHeaderGroup[] = []
  const scale = scaleInternal.value
  let left = 0
  for (const period of periods.value) {
    const d = period.periodStart
    const key = scale === 'month' ? `${d.getFullYear()}` : `${d.getFullYear()}-${d.getMonth()}`
    const label =
      scale === 'month' ? `${d.getFullYear()}年` : `${d.getFullYear()}年${d.getMonth() + 1}月`
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.width += columnWidthPx.value
    } else {
      groups.push({ key, label, left, width: columnWidthPx.value })
    }
    left += columnWidthPx.value
  }
  return groups
})

// =====================================================================================
// 左右分隔条：拖拽调整资源列表面板宽度（独立实现，不依赖 GanttChart 的 splitter）
// =====================================================================================
const rootRef = ref<HTMLDivElement | null>(null)

const parseWidthValue = (value: number | string | undefined, fallback: number): number => {
  if (value === undefined) return fallback
  if (typeof value === 'number') return value
  if (value.endsWith('%')) {
    const percent = parseFloat(value) / 100
    const containerWidth = rootRef.value?.clientWidth ?? 0
    return containerWidth > 0 ? containerWidth * percent : fallback
  }
  const parsed = parseFloat(value)
  return Number.isNaN(parsed) ? fallback : parsed
}

const minListWidth = computed(() => parseWidthValue(props.resourceListConfig?.minWidth, 200))
const maxListWidth = computed(() => parseWidthValue(props.resourceListConfig?.maxWidth, 600))
const listWidth = ref(parseWidthValue(props.resourceListConfig?.defaultWidth, 320))

let dragStartX = 0
let dragStartWidth = 0

const onSplitterMouseMove = (e: MouseEvent) => {
  const delta = e.clientX - dragStartX
  const next = Math.max(minListWidth.value, Math.min(maxListWidth.value, dragStartWidth + delta))
  listWidth.value = next
}

const onSplitterMouseUp = () => {
  document.removeEventListener('mousemove', onSplitterMouseMove)
  document.removeEventListener('mouseup', onSplitterMouseUp)
}

const onSplitterMouseDown = (e: MouseEvent) => {
  dragStartX = e.clientX
  dragStartWidth = listWidth.value
  document.addEventListener('mousemove', onSplitterMouseMove)
  document.addEventListener('mouseup', onSplitterMouseUp)
  e.preventDefault()
}

// =====================================================================================
// 虚拟滚动：纵向（资源行）+ 横向（工时周期列），仅渲染可视区域 + 缓冲区
// =====================================================================================
const VIRTUAL_BUFFER_ROWS = 5
const VIRTUAL_BUFFER_COLS = 5

const listScrollRef = ref<HTMLDivElement | null>(null)
const gridScrollRef = ref<HTMLDivElement | null>(null)

const rowScrollTop = ref(0)
const gridScrollLeft = ref(0)
const viewportWidth = ref(0)
const viewportHeight = ref(0)

const visibleRowRange = computed(() => {
  const total = props.resources.length
  if (total === 0 || rowHeight.value <= 0) return { start: 0, end: -1 }
  const start = Math.max(0, Math.floor(rowScrollTop.value / rowHeight.value) - VIRTUAL_BUFFER_ROWS)
  const visibleCount = Math.ceil((viewportHeight.value || 0) / rowHeight.value)
  const end = Math.min(total - 1, start + visibleCount + VIRTUAL_BUFFER_ROWS * 2)
  return { start, end }
})

const visibleColRange = computed(() => {
  const total = periods.value.length
  if (total === 0 || columnWidthPx.value <= 0) return { start: 0, end: -1 }
  const start = Math.max(
    0,
    Math.floor(gridScrollLeft.value / columnWidthPx.value) - VIRTUAL_BUFFER_COLS
  )
  const visibleCount = Math.ceil((viewportWidth.value || 0) / columnWidthPx.value)
  const end = Math.min(total - 1, start + visibleCount + VIRTUAL_BUFFER_COLS * 2)
  return { start, end }
})

const visibleRows = computed(() => {
  const { start, end } = visibleRowRange.value
  const rows: Array<{ resource: Resource; top: number }> = []
  for (let i = start; i <= end; i++) {
    const resource = props.resources[i]
    if (!resource) continue
    rows.push({ resource, top: i * rowHeight.value })
  }
  return rows
})

const visiblePeriodCells = computed(() => {
  const { start, end } = visibleColRange.value
  const cells: Array<{
    index: number
    period: { periodStart: Date; periodEnd: Date }
    left: number
    isWeekend: boolean
  }> = []
  for (let i = start; i <= end; i++) {
    const period = periods.value[i]
    if (!period) continue
    cells.push({
      index: i,
      period,
      left: i * columnWidthPx.value,
      isWeekend: Boolean(period.isWeekend),
    })
  }
  return cells
})

const onListScroll = (e: Event) => {
  const target = e.target as HTMLDivElement
  rowScrollTop.value = target.scrollTop
  if (gridScrollRef.value && gridScrollRef.value.scrollTop !== target.scrollTop) {
    gridScrollRef.value.scrollTop = target.scrollTop
  }
}

const onGridScroll = (e: Event) => {
  const target = e.target as HTMLDivElement
  rowScrollTop.value = target.scrollTop
  gridScrollLeft.value = target.scrollLeft
  if (listScrollRef.value && listScrollRef.value.scrollTop !== target.scrollTop) {
    listScrollRef.value.scrollTop = target.scrollTop
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  nextTick(() => {
    if (gridScrollRef.value) {
      viewportWidth.value = gridScrollRef.value.clientWidth
      viewportHeight.value = gridScrollRef.value.clientHeight
      resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          viewportWidth.value = entry.contentRect.width
          viewportHeight.value = entry.contentRect.height
        }
      })
      resizeObserver.observe(gridScrollRef.value)
    }
  })
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  document.removeEventListener('mousemove', onSplitterMouseMove)
  document.removeEventListener('mouseup', onSplitterMouseUp)
})

defineExpose({ refreshAggregation, setScale })
</script>

<style scoped>
/* 复用资源计划视图 TaskList 的 .col/.col-name 固定列宽体系与主题变量 */
@import '../../styles/list.css';
@import '../../styles/theme-variables.css';

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

.gantt-resource-usage-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* ------ 左侧资源列表面板：结构/样式对齐 TaskList ------ */
.gantt-resource-usage-list-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-right: 1px solid var(--gantt-border-medium);
}

/* 高度 80px，与右侧网格两行表头总高对齐（参考 .task-list-header / .timeline-header） */
.gantt-resource-usage-list-header {
  display: flex;
  flex-shrink: 0;
  height: 80px;
  align-items: center;
  background-color: var(--gantt-bg-secondary);
  border-bottom: 1px solid var(--gantt-border-medium);
}

.gantt-resource-usage-list-header .col {
  font-weight: 700;
  color: var(--gantt-text-header);
  background-color: var(--gantt-bg-secondary);
}

.gantt-resource-usage-list-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;

  /* 细滚动条，对齐 .task-list-body */
  scrollbar-width: thin;
  scrollbar-color: var(--gantt-scrollbar-thumb) transparent;
}

.gantt-resource-usage-list-scroll::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.gantt-resource-usage-list-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.gantt-resource-usage-list-scroll::-webkit-scrollbar-thumb {
  background-color: var(--gantt-scrollbar-thumb);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.gantt-resource-usage-list-scroll::-webkit-scrollbar-thumb:hover {
  background-color: var(--gantt-scrollbar-thumb-hover);
}

.gantt-resource-usage-list-scroll::-webkit-scrollbar-corner {
  background: transparent;
}

.gantt-resource-usage-list-rows {
  position: relative;
}

.gantt-resource-usage-list-row {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
}

.gantt-resource-usage-list-row.is-hover {
  background-color: var(--gantt-bg-hover);
}

.gantt-resource-usage-list-row .col {
  font-size: 13px;
}

/* ------ 分隔条 ------ */
.gantt-resource-usage-splitter {
  flex-shrink: 0;
  width: 6px;
  cursor: col-resize;
  background-color: var(--gantt-border-light);
  transition: background-color 0.15s;
}

.gantt-resource-usage-splitter:hover {
  background-color: var(--gantt-primary);
}

/* ------ 右侧工时网格面板 ------ */
.gantt-resource-usage-grid-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* 高度 80px，两行结构，对齐 Timeline 的 .timeline-header */
.gantt-resource-usage-grid-header {
  flex-shrink: 0;
  height: 80px;
  overflow: hidden;
  position: relative;
  background-color: var(--gantt-bg-secondary);
  border-bottom: 1px solid var(--gantt-border-medium);
}

.gantt-resource-usage-grid-header-track {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.gantt-resource-usage-grid-header-row {
  position: relative;
  height: 50%;
  border-bottom: 1px solid var(--gantt-border-medium);
}

.gantt-resource-usage-grid-header-row.minor-row {
  border-bottom: none;
}

.gantt-resource-usage-grid-major-cell {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--gantt-text-header);
  box-sizing: border-box;
  border-right: 1px solid var(--gantt-border-medium);
}

.gantt-resource-usage-grid-header-cell {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--gantt-text-header);
  box-sizing: border-box;
  border-right: 1px solid var(--gantt-border-light);
}

.gantt-resource-usage-grid-header-cell.is-weekend {
  background-color: var(--gantt-bg-tertiary);
  color: var(--gantt-text-muted);
}

.gantt-resource-usage-grid-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;

  /* 细滚动条，对齐 .timeline 容器 */
  scrollbar-width: thin;
  scrollbar-color: var(--gantt-scrollbar-thumb) transparent;
}

.gantt-resource-usage-grid-scroll::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.gantt-resource-usage-grid-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.gantt-resource-usage-grid-scroll::-webkit-scrollbar-thumb {
  background-color: var(--gantt-scrollbar-thumb);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.gantt-resource-usage-grid-scroll::-webkit-scrollbar-thumb:hover {
  background-color: var(--gantt-scrollbar-thumb-hover);
}

.gantt-resource-usage-grid-scroll::-webkit-scrollbar-corner {
  background: transparent;
}

.gantt-resource-usage-grid-inner {
  position: relative;
}

.gantt-resource-usage-grid-row {
  position: absolute;
  top: 0;
  left: 0;
}

.gantt-resource-usage-grid-row.is-hover {
  filter: brightness(0.94);
}

.gantt-resource-usage-grid-cell {
  position: absolute;
  top: 0;
  box-sizing: border-box;
}
</style>

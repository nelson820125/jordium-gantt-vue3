<template>
  <div ref="rootRef" class="gantt-resource-usage-view" :class="{ 'is-disabled': disabled }">
    <div class="gantt-resource-usage-body">
      <!-- 左侧资源列表面板：直接内嵌资源计划视图的 TaskList 组件本体（而非样式/结构模仿），
           通过局部 provide 使其运行在 'resource' 视图模式，天然获得粘性表头/首列固定、
           声明式列（TaskListColumn）、列级/表头 slot、头像与超载提示等全部既有能力 -->
      <div class="gantt-resource-usage-list-panel" :style="{ width: listWidth + 'px' }">
        <TaskList
          ref="taskListRef"
          class="gantt-resource-usage-embedded-list"
          :task-list-column-render-mode="columnRenderMode"
        >
          <template v-if="slots.default" #default><slot /></template>
        </TaskList>
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
              @mouseenter="handleGridRowMouseEnter(row.resource.id)"
              @mouseleave="handleGridRowMouseLeave"
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
                @task-detail-click="handleTaskDetailClick"
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
 * 左侧资源列表直接内嵌复用资源计划视图的 TaskList 组件本体（v1.13 起），
 * 通过局部 provide('gantt-view-mode'|'gantt-data-source'|'gantt-list-config'|'gantt-row-height')
 * 使其运行于 'resource' 视图模式，天然获得粘性表头/首列固定、声明式列、slot 等全部既有能力；
 * 与右侧工时网格面板之间的滚动/悬停联动通过 TaskList 既有的全局 window 事件协议桥接
 * （由本组件在网格侧“扮演”一个 Timeline 的角色）。
 *
 * 布局：左侧资源列表 + 右侧工时网格双 Panel（参考资源计划视图 TaskList/Timeline 的 splitter 形式），
 * 两侧行高、悬停高亮联动一致；纵向/横向均采用虚拟滚动，仅渲染可视区域 + 缓冲区的行/列，
 * 因此可支撑较大的资源数量与较长的时间跨度（如整年的“日”刻度）而不影响滚动流畅度。
 *
 * 刻度切换不内置 UI：由外部（如 GanttChart 工具栏的 时/日/周/月 按钮）驱动 `scale` 受控 prop；
 * 独立使用时也可通过 `defaultScale` 设置初始值，或调用 `setScale()` 编程式切换。
 */
import { computed, nextTick, onMounted, onUnmounted, provide, ref, useSlots, watch } from 'vue'
import TaskList from '../TaskList/TaskList.vue'
import ResourceUsageCell from './ResourceUsageCell.vue'
import { useResourceUsageAggregation } from '../../composables/useResourceUsageAggregation'
import type {
  ResourceUsageScale,
  ResourceUsageCellPayload,
  ResourceUsageCellData,
  ResourceUsageTaskDetailClickPayload,
} from '../../models/types/ResourceUsageTypes'
import type { Resource } from '../../models/classes/Resource'
import type {
  ResourceListConfig,
  ResourceListColumnConfig,
} from '../../models/configs/ResourceListConfig'
import {
  DEFAULT_RESOURCE_LIST_COLUMNS,
  DEFAULT_RESOURCE_LIST_WIDTH,
  DEFAULT_RESOURCE_LIST_MIN_WIDTH,
  DEFAULT_RESOURCE_LIST_MAX_WIDTH,
} from '../../models/configs/ResourceListConfig'
import { parseWidthValue } from '../../models/configs/TaskListConfig'
import { SCALE_CONFIGS } from '../../models/types/TimelineScale'
import type { TimelineScale, TimelineScaleConfig } from '../../models/types/TimelineScale'
import { applyTimelineFormat } from '../../utils/timelineFormat'

interface Props {
  resources: Resource[]
  scale?: ResourceUsageScale
  defaultScale?: ResourceUsageScale
  dateRange?: { start: Date; end: Date }
  resourceListConfig?: ResourceListConfig
  /** TaskList 列渲染模式：'default' 使用 resourceListConfig.columns 配置，'declarative' 使用默认插槽中的 TaskListColumn 声明式列 */
  columnRenderMode?: 'default' | 'declarative'
  /**
   * 表头格式配置（v1.13.0），与 GanttChart 传给 Timeline 的 scaleConfigs 同构（Record<TimelineScale, TimelineScaleConfig>），
   * 未提供时回退到与 Timeline 一致的内置默认值 SCALE_CONFIGS，确保任务/资源/资源利用率视图的表头格式逻辑保持一致。
   * 仅使用 day/week/month 三个刻度的 formatters（primary 用于第一行年/月分组，secondary 用于第二行具体周期标签）。
   */
  scaleConfigs?: Record<TimelineScale, TimelineScaleConfig>
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
  /** v1.13.0 点击工时单元格 Tooltip 明细中的某个任务时触发（P1 待办 T7.4） */
  onTaskDetailClick?: (payload: ResourceUsageTaskDetailClickPayload) => void
}

const props = withDefaults(defineProps<Props>(), {
  defaultScale: 'week',
  columnRenderMode: 'default',
  overloadThreshold: 100,
  underloadThreshold: 60,
  rowHeight: 51, // 对齐资源计划视图 TaskRow 行高（ROW_HEIGHT）
  disabled: false,
})

const slots = useSlots()

// ------ 向内嵌的 TaskList 提供资源视图运行所需的上下文（局部 provide，仅作用于本组件子树） ------
// 视图模式固定为 'resource'：TaskList 内部据此选择资源列默认列配置与资源行渲染分支
provide('gantt-view-mode', ref<'task' | 'resource'>('resource'))
// 数据源：资源数组
provide(
  'gantt-data-source',
  computed(() => props.resources)
)
// 列表配置：不提供时 TaskList 落回内置的 DEFAULT_RESOURCE_LIST_COLUMNS
provide(
  'gantt-list-config',
  computed(() => props.resourceListConfig ?? null)
)
// TaskRow 资源行高度 = ganttRowHeight + 5（内置底部 padding），此处减 5 使最终行高精确等于 props.rowHeight
provide(
  'gantt-row-height',
  computed(() => Math.max(0, props.rowHeight - 5))
)

const emit = defineEmits<{
  'scale-change': [payload: { next: ResourceUsageScale; prev: ResourceUsageScale }]
  'cell-click': [payload: ResourceUsageCellPayload]
  'cell-hover': [payload: ResourceUsageCellPayload | null]
  'overload-detected': [payload: { resourceId: string | number; periods: ResourceUsageCellData[] }]
  'task-detail-click': [payload: ResourceUsageTaskDetailClickPayload]
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

/** 当前刻度对应的表头格式配置：未提供 scaleConfigs 时回退到与 Timeline 一致的内置默认值 */
const effectiveScaleConfig = computed<TimelineScaleConfig>(() => {
  const configs =
    props.scaleConfigs ?? (SCALE_CONFIGS as Record<TimelineScale, TimelineScaleConfig>)
  return (
    configs[scaleInternal.value as TimelineScale] ??
    SCALE_CONFIGS[scaleInternal.value as TimelineScale]
  )
})

/** 第二行具体周期标签：复用 Timeline 的 formatters.secondary + applyTimelineFormat，保持格式逻辑与任务/资源视图一致 */
const formatPeriodLabel = (date: Date) => {
  const secondary = effectiveScaleConfig.value.formatters.secondary
  if (secondary) return applyTimelineFormat(secondary, date)
  if (scaleInternal.value === 'month') return `${date.getFullYear()}/${date.getMonth() + 1}`
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// ------ 列配置：仅用于左侧面板 min/max 宽度算法的估算，实际列渲染完全交由内嵌的 TaskList 处理 ------
// 注：DEFAULT_RESOURCE_LIST_COLUMNS 不含 name 列（TaskList 会始终额外硬编码渲染一个独立的名称列），
// 因此这里的估算与 GanttChart 的 getEffectiveColumnTotal 一样不将名称列宽度计入总和，
// 精确总宽以下方 getHeaderScrollWidth() 的 DOM 测量结果为准（TaskList 挂载后即可获取）。
const visibleColumns = computed<ResourceListColumnConfig[]>(() => {
  const columns = props.resourceListConfig?.columns ?? DEFAULT_RESOURCE_LIST_COLUMNS
  return columns.filter(col => col.visible !== false)
})

/**
 * 解析列的像素宽度（对齐 TaskList 的 resolveColWidthPx 逻辑）：
 * 未配置 width 时按 list.css 的类名默认值兜底（通用列 120px）。
 */
const resolveColumnWidthPx = (col: ResourceListColumnConfig, containerWidth: number): number => {
  if (!col.width) return 120
  if (typeof col.width === 'number') return col.width
  const trimmed = col.width.trim()
  if (trimmed.endsWith('%')) {
    return Math.floor((containerWidth * parseFloat(trimmed)) / 100)
  }
  return parseFloat(trimmed) || 120
}

/** 可见列（不含名称列）解析后的总像素宽度，用于左侧面板 min/max 宽度算法的兜底估算 */
const totalColumnsWidth = computed(() =>
  visibleColumns.value.reduce((sum, col) => sum + resolveColumnWidthPx(col, listWidth.value), 0)
)

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

// ------ Tooltip 明细任务点击（v1.13.0，P1 待办 T7.4） ------
const handleTaskDetailClick = (payload: ResourceUsageTaskDetailClickPayload) => {
  props.onTaskDetailClick?.(payload)
  emit('task-detail-click', payload)
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
  const primaryFormat = effectiveScaleConfig.value.formatters.primary
  let left = 0
  for (const period of periods.value) {
    const d = period.periodStart
    const key = scale === 'month' ? `${d.getFullYear()}` : `${d.getFullYear()}-${d.getMonth()}`
    const label = applyTimelineFormat(primaryFormat, d)
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
// 最小/最大/默认宽度算法完全对齐 GanttChart 的 getTaskListMinWidth/MaxWidth/DefaultWidth。
// =====================================================================================
const rootRef = ref<HTMLDivElement | null>(null)
/** 根容器宽度（ResizeObserver 实时更新），用于解析 minWidth/maxWidth/defaultWidth 的百分比配置 */
const rootWidth = ref(0)
/** 内嵌 TaskList 实例引用，用于 DOM 测量表头实际宽度（对齐 GanttChart 的 getTaskListMaxWidth） */
const taskListRef = ref<InstanceType<typeof TaskList> | null>(null)

/**
 * 列表面板最小宽度：max(配置值, 默认最小值 280)。
 * 当该值已 ≥ 列总宽时，锁定为列总宽，避免出现 min > max 的矛盾。
 */
const minListWidth = computed(() => {
  const configuredMin = parseWidthValue(
    props.resourceListConfig?.minWidth,
    rootWidth.value,
    DEFAULT_RESOURCE_LIST_MIN_WIDTH
  )
  const hardMin = Math.max(configuredMin, DEFAULT_RESOURCE_LIST_MIN_WIDTH)
  const total = totalColumnsWidth.value
  if (total > 0 && hardMin >= total) return total
  return hardMin
})

/**
 * 列表面板最大宽度：优先取内嵌 TaskList 表头的 DOM 实际 scrollWidth（完全对齐 GanttChart 的
 * getTaskListMaxWidth 逻辑），未挂载/测量失败时退化为按列配置估算的总宽度。
 */
const maxListWidth = computed(() => {
  const configuredMax = parseWidthValue(
    props.resourceListConfig?.maxWidth,
    rootWidth.value,
    DEFAULT_RESOURCE_LIST_MAX_WIDTH
  )
  const domTotal = taskListRef.value?.getHeaderScrollWidth?.() ?? null
  if (domTotal && domTotal > 0) {
    return Math.min(configuredMax, Math.max(domTotal, minListWidth.value))
  }
  const total = totalColumnsWidth.value
  if (total > 0) return Math.min(configuredMax, Math.max(total, minListWidth.value))
  return configuredMax
})

/** 列表面板默认宽度 */
const getListDefaultWidth = () =>
  parseWidthValue(
    props.resourceListConfig?.defaultWidth,
    rootWidth.value,
    DEFAULT_RESOURCE_LIST_WIDTH
  )

const listWidth = ref(getListDefaultWidth())

/** 拖拽宽度裁剪：结果落在 [minListWidth, maxListWidth] 区间内（对齐 GanttChart 的 checkWidthLimits） */
const checkWidthLimits = (proposedWidth: number): number => {
  if (proposedWidth < minListWidth.value) return minListWidth.value
  if (proposedWidth > maxListWidth.value) return maxListWidth.value
  return Math.max(minListWidth.value, proposedWidth)
}

let dragStartX = 0
let dragStartWidth = 0

const onSplitterMouseMove = (e: MouseEvent) => {
  const delta = e.clientX - dragStartX
  listWidth.value = checkWidthLimits(dragStartWidth + delta)
}

const onSplitterMouseUp = () => {
  document.removeEventListener('mousemove', onSplitterMouseMove)
  document.removeEventListener('mouseup', onSplitterMouseUp)
  // 通知内嵌 TaskList 拖拽结束，触发其容器宽度重新测量（对齐 GanttChart 的 splitter 行为）
  window.dispatchEvent(new CustomEvent('splitter-drag-end'))
}

const onSplitterMouseDown = (e: MouseEvent) => {
  dragStartX = e.clientX
  dragStartWidth = listWidth.value
  document.addEventListener('mousemove', onSplitterMouseMove)
  document.addEventListener('mouseup', onSplitterMouseUp)
  // 通知内嵌 TaskList 拖拽开始，暂停其悬停高亮等交互（对齐 GanttChart 的 splitter 行为）
  window.dispatchEvent(new CustomEvent('splitter-drag-start'))
  e.preventDefault()
}

// =====================================================================================
// 虚拟滚动：纵向（资源行）+ 横向（工时周期列），仅渲染可视区域 + 缓冲区
// =====================================================================================
const VIRTUAL_BUFFER_ROWS = 5
const VIRTUAL_BUFFER_COLS = 5

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

/**
 * 与内嵌 TaskList 的滚动/悬停联动：TaskList 内部通过全局 window 事件与其“搭档” Timeline
 * 双向同步（详见 useTaskListEventHandlers），此处让网格面板在这套既有协议中扮演 Timeline 的角色：
 * - 监听 TaskList 派发的 'task-list-vertical-scroll' / 'task-list-hover'，同步到网格滚动位置/悬停行；
 * - 网格自身滚动/悬停时，派发 TaskList 监听的 'timeline-vertical-scroll' / 'timeline-task-hover'。
 */
// 同步锁：由 TaskList → 网格 写入触发时不再反向派发，避免 2 跳循环（对齐 TaskList 自身的同名机制）
let isSyncingScrollFromTaskList = false

const handleTaskListVerticalScroll = (e: Event) => {
  const { scrollTop } = (e as CustomEvent<{ scrollTop: number }>).detail
  rowScrollTop.value = scrollTop
  if (gridScrollRef.value && Math.abs(gridScrollRef.value.scrollTop - scrollTop) > 1) {
    isSyncingScrollFromTaskList = true
    gridScrollRef.value.scrollTop = scrollTop
    Promise.resolve().then(() => {
      isSyncingScrollFromTaskList = false
    })
  }
}

const handleTaskListHoverEvent = (e: Event) => {
  hoveredResourceId.value = (e as CustomEvent<string | number | null>).detail
}

const handleGridRowMouseEnter = (resourceId: string | number) => {
  hoveredResourceId.value = resourceId
  window.dispatchEvent(new CustomEvent('timeline-task-hover', { detail: resourceId }))
}

const handleGridRowMouseLeave = () => {
  hoveredResourceId.value = null
  window.dispatchEvent(new CustomEvent('timeline-task-hover', { detail: null }))
}

const onGridScroll = (e: Event) => {
  const target = e.target as HTMLDivElement
  rowScrollTop.value = target.scrollTop
  gridScrollLeft.value = target.scrollLeft
  if (isSyncingScrollFromTaskList) return
  window.dispatchEvent(
    new CustomEvent('timeline-vertical-scroll', { detail: { scrollTop: target.scrollTop } })
  )
}

let resizeObserver: ResizeObserver | null = null
let rootResizeObserver: ResizeObserver | null = null

onMounted(() => {
  window.addEventListener(
    'task-list-vertical-scroll',
    handleTaskListVerticalScroll as EventListener
  )
  window.addEventListener('task-list-hover', handleTaskListHoverEvent as EventListener)

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
    if (rootRef.value) {
      rootWidth.value = rootRef.value.clientWidth
      rootResizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          rootWidth.value = entry.contentRect.width
        }
      })
      rootResizeObserver.observe(rootRef.value)
    }
  })
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  rootResizeObserver?.disconnect()
  document.removeEventListener('mousemove', onSplitterMouseMove)
  document.removeEventListener('mouseup', onSplitterMouseUp)
  window.removeEventListener(
    'task-list-vertical-scroll',
    handleTaskListVerticalScroll as EventListener
  )
  window.removeEventListener('task-list-hover', handleTaskListHoverEvent as EventListener)
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

/* ------ 左侧资源列表面板：直接内嵌 TaskList 组件本体 ------ */
.gantt-resource-usage-list-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-right: 1px solid var(--gantt-border-medium);
}

/* TaskList 根元素撑满面板高度，使其内部 .task-list-body 的 overflow:auto 滚动容器生效 */
.gantt-resource-usage-embedded-list {
  flex: 1;
  min-height: 0;
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

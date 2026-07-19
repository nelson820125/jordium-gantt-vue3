<template>
  <div
    ref="cellRef"
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

    <Teleport to="body">
      <div
        v-if="cell && showTooltip && cell.taskBreakdown.length"
        class="gantt-resource-usage-tooltip"
        :data-theme="ganttTheme"
        :style="tooltipStyle"
        @click.stop
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <div
          class="gantt-resource-usage-tooltip-arrow"
          :class="arrowSide === 'top' ? 'is-arrow-top' : 'is-arrow-bottom'"
          :style="arrowStyle"
        ></div>
        <div class="gantt-resource-usage-tooltip-title">
          {{ formattedHours }}h · {{ Math.round(cell.totalPercent) }}%
        </div>
        <ul class="gantt-resource-usage-tooltip-list">
          <li
            v-for="item in cell.taskBreakdown"
            :key="item.taskId"
            class="gantt-resource-usage-tooltip-item"
            @click="handleTaskDetailClick(item)"
          >
            <span class="gantt-resource-usage-tooltip-task-name">{{ item.taskName }}</span>
            <span class="gantt-resource-usage-tooltip-task-hours"
              >{{ Math.round(item.hours * 10) / 10 }}h</span
            >
          </li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import type {
  ResourceUsageCellData,
  ResourceUsageCellPayload,
  ResourceUsageTaskBreakdown,
  ResourceUsageTaskDetailClickPayload,
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
  /** v1.13.0 点击 Tooltip 明细中的某个任务时触发（P1 待办 T7.4） */
  'task-detail-click': [payload: ResourceUsageTaskDetailClickPayload]
}>()

/** 是否显示 Tooltip 明细（悬停在单元格或 Tooltip 本体上时均保持显示） */
const showTooltip = ref(false)
/** 单元格根元素引用，用于计算 Teleport 到 body 后的 Tooltip 定位（避免被网格滚动容器的 overflow 裁剪） */
const cellRef = ref<HTMLElement | null>(null)
const tooltipStyle = ref<Record<string, string>>({})
/** Tooltip 箭头样式：水平偏移量随单元格宽度/位置计算，垂直朝向随 arrowSide 切换 */
const arrowStyle = ref<Record<string, string>>({})
/** 箭头所在边：'top' 表示 Tooltip 位于单元格下方（箭头朝上，贴在 Tooltip 顶部）；
 *  'bottom' 表示 Tooltip 位于单元格上方（箭头朝下，贴在 Tooltip 底部） */
const arrowSide = ref<'top' | 'bottom'>('top')
/** 主题：Teleport 到 body 后脱离 .gantt-root 的 DOM 子树，需显式绑定 data-theme 才能应用暗黑主题变量 */
const ganttTheme = inject<Ref<'light' | 'dark'>>('gantt-theme', ref('light'))

const TOOLTIP_MAX_WIDTH = 260
const TOOLTIP_ITEM_HEIGHT = 30
const TOOLTIP_TITLE_HEIGHT = 30
const TOOLTIP_MAX_LIST_HEIGHT = 200

/** 依据单元格在视口中的实际位置计算 Tooltip 的 fixed 定位，靠近视口边界时自动翻转方向 */
const updateTooltipPosition = () => {
  const el = cellRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const itemCount = props.cell?.taskBreakdown.length ?? 0
  const estimatedHeight =
    TOOLTIP_TITLE_HEIGHT + Math.min(itemCount * TOOLTIP_ITEM_HEIGHT, TOOLTIP_MAX_LIST_HEIGHT)

  const style: Record<string, string> = {
    position: 'fixed',
    minWidth: '160px',
    maxWidth: `${TOOLTIP_MAX_WIDTH}px`,
  }
  // 箭头水平偏移：Tooltip 与单元格共享同一条对齐边（left 或 right），偏移量取单元格宽度的一半即可
  // 精确指向单元格中心，无需等待 Tooltip 实际渲染宽度
  const halfCellWidth = Math.max(rect.width / 2, 10)
  const arrow: Record<string, string> = {}

  if (rect.left + TOOLTIP_MAX_WIDTH > window.innerWidth) {
    style.right = `${Math.max(window.innerWidth - rect.right, 0)}px`
    arrow.right = `${halfCellWidth}px`
    arrow.transform = 'translateX(50%)'
  } else {
    style.left = `${rect.left}px`
    arrow.left = `${halfCellWidth}px`
    arrow.transform = 'translateX(-50%)'
  }

  if (rect.bottom + estimatedHeight > window.innerHeight) {
    style.bottom = `${Math.max(window.innerHeight - rect.top, 0)}px`
    arrowSide.value = 'bottom'
  } else {
    style.top = `${rect.bottom}px`
    arrowSide.value = 'top'
  }

  tooltipStyle.value = style
  arrowStyle.value = arrow
}

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
  showTooltip.value = true
  updateTooltipPosition()
  emit('hover', props.cell ? { resourceId: props.resourceId, cell: props.cell } : null)
}

const handleMouseLeave = () => {
  showTooltip.value = false
  emit('hover', null)
}

const handleTaskDetailClick = (item: ResourceUsageTaskBreakdown) => {
  emit('task-detail-click', {
    resourceId: props.resourceId,
    taskId: item.taskId,
    taskName: item.taskName,
  })
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

/* 工时明细 Tooltip（v1.13.0，P1 待办 T7.4）：悬停单元格时展示任务明细，点击某项可跳转对应任务
   Teleport 到 body + position:fixed，定位由 tooltipStyle 按视口边界动态计算（避免被网格滚动容器裁剪） */
.gantt-resource-usage-tooltip {
  position: fixed;
  z-index: var(--gantt-z-overlay);
  padding: 6px 0;
  background: var(--gantt-bg-primary);
  border: 1px solid var(--gantt-border-color);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: default;
  white-space: normal;
}

/* 气泡箭头：指向触发它的单元格，颜色跟随 Tooltip 背景自动适配明暗主题 */
.gantt-resource-usage-tooltip-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  pointer-events: none;
}

.gantt-resource-usage-tooltip-arrow.is-arrow-top {
  top: -6px;
  border-bottom: 6px solid var(--gantt-bg-primary);
  filter: drop-shadow(0 -1px 1px rgba(0, 0, 0, 0.1));
}

.gantt-resource-usage-tooltip-arrow.is-arrow-bottom {
  bottom: -6px;
  border-top: 6px solid var(--gantt-bg-primary);
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
}

.gantt-resource-usage-tooltip-title {
  padding: 2px 10px 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--gantt-text-primary);
  border-bottom: 1px solid var(--gantt-border-light);
}

.gantt-resource-usage-tooltip-list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 200px;
  overflow-y: auto;

  /* 细滚动条，对齐 .timeline/.task-list-body 容器 */
  scrollbar-width: thin;
  scrollbar-color: var(--gantt-scrollbar-thumb) transparent;
}

.gantt-resource-usage-tooltip-list::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.gantt-resource-usage-tooltip-list::-webkit-scrollbar-track {
  background: transparent;
}

.gantt-resource-usage-tooltip-list::-webkit-scrollbar-thumb {
  background-color: var(--gantt-scrollbar-thumb);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.gantt-resource-usage-tooltip-list::-webkit-scrollbar-thumb:hover {
  background-color: var(--gantt-scrollbar-thumb-hover);
}

.gantt-resource-usage-tooltip-list::-webkit-scrollbar-corner {
  background: transparent;
}

.gantt-resource-usage-tooltip-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--gantt-text-primary);
  cursor: pointer;
}

.gantt-resource-usage-tooltip-item:hover {
  background: var(--gantt-bg-hover);
  color: var(--gantt-primary);
}

.gantt-resource-usage-tooltip-task-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gantt-resource-usage-tooltip-task-hours {
  flex: 0 0 auto;
  color: var(--gantt-text-secondary);
}
</style>

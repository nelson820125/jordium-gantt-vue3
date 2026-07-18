<template>
  <template v-if="segments && segments.length">
    <div
      v-for="(seg, i) in segments"
      :key="'slot-' + i"
      class="gantt-calendar-selection-slot"
      :class="stateClass"
      :style="{
        top: `${seg.top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${seg.height}px`,
      }"
    />
    <div
      v-for="(seg, i) in segments"
      :key="'indicator-' + i"
      class="gantt-calendar-selection-indicator"
      :class="stateClass"
      :style="indicatorStyle(seg, i)"
    />
  </template>
  <div v-if="rect" class="gantt-calendar-selection-layer" :class="stateClass" :style="layerStyle">
    <span v-if="state === 'rejected'" class="gantt-calendar-selection-hint">
      {{ rejectedText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StyleValue } from 'vue'

/**
 * CalendarSelectionLayer - 拖拽选区高亮渲染层
 * 无状态展示组件，不含任何业务判定逻辑，坐标与状态完全由父级（CalendarDayView 等）计算传入
 *
 * 两种渲染模式：
 * - rect：整块高亮矩形（月视图等天粒度选区使用）
 * - segments：Outlook 风格分段渲染（日/周视图使用），每个槽位渲染"整槽浅色底 + 左侧比例指示条"
 */

interface SelectionRect {
  top: number
  left: number
  width: number
  height: number
}

/** 分段渲染的单个槽位数据（仅含纵向坐标，横向 left/width 由 props 统一提供） */
interface SelectionSegment {
  top: number
  height: number
  indicatorTop: number
  indicatorHeight: number
}

interface Props {
  rect?: SelectionRect | null
  segments?: SelectionSegment[]
  /** segments 模式下的统一横向偏移 */
  left?: number
  /** segments 模式下槽位底色的统一宽度 */
  width?: number
  /** segments 模式下左侧比例指示条的宽度 */
  indicatorWidth?: number
  state?: 'active' | 'rejected' | 'pending'
  rejectedText?: string
}

const props = withDefaults(defineProps<Props>(), {
  rect: null,
  segments: () => [],
  left: 0,
  width: 0,
  indicatorWidth: 4,
  state: 'active',
  rejectedText: '该时段不可选择',
})

const stateClass = computed(() => ({
  'is-rejected': props.state === 'rejected',
  'is-pending': props.state === 'pending',
}))

const layerStyle = computed<StyleValue>(() => {
  if (!props.rect) return {}
  return {
    top: `${props.rect.top}px`,
    left: `${props.rect.left}px`,
    width: `${props.rect.width}px`,
    height: `${props.rect.height}px`,
  }
})

/**
 * 计算单个比例指示条的样式：相邻槽位的指示条首尾像素相接，不设置圆角以保证视觉上
 * 连成一条连续的竖条（避免每个槽位单独带圆角导致"一节一节"的分段观感）；
 * 仅整条选区的最顶部/最底部（第一个/最后一个槽位）保留圆角，形成胶囊状端点。
 */
const indicatorStyle = (seg: SelectionSegment, index: number): StyleValue => {
  const isFirst = index === 0
  const isLast = index === props.segments.length - 1
  const radius = `${props.indicatorWidth / 2}px`
  return {
    top: `${seg.indicatorTop}px`,
    left: `${props.left}px`,
    width: `${props.indicatorWidth}px`,
    height: `${seg.indicatorHeight}px`,
    borderTopLeftRadius: isFirst ? radius : '0',
    borderTopRightRadius: isFirst ? radius : '0',
    borderBottomLeftRadius: isLast ? radius : '0',
    borderBottomRightRadius: isLast ? radius : '0',
  }
}
</script>

<style scoped>
.gantt-calendar-selection-layer {
  position: absolute;
  z-index: var(--gantt-z-bar-hl, 26);
  background-color: var(--gantt-primary-light);
  border: 1px solid var(--gantt-primary);
  border-radius: var(--gantt-radius-sm, 2px);
  opacity: 0.6;
  pointer-events: none;
  transition: opacity var(--gantt-transition-base, 0.2s) ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.gantt-calendar-selection-layer.is-rejected {
  background-color: var(--gantt-danger-light);
  border-color: var(--gantt-danger);
  cursor: not-allowed;
}

.gantt-calendar-selection-layer.is-pending {
  opacity: 0.4;
}

.gantt-calendar-selection-hint {
  font-size: var(--gantt-font-size-sm, 12px);
  color: var(--gantt-danger);
  background-color: var(--gantt-bg-primary);
  padding: 2px 6px;
  border-radius: var(--gantt-radius-sm, 2px);
  white-space: nowrap;
  pointer-events: none;
}

/* Outlook 风格分段渲染：整槽浅色底 */
.gantt-calendar-selection-slot {
  position: absolute;
  z-index: var(--gantt-z-bar-hl, 26);
  background-color: var(--gantt-primary-light);
  opacity: 0.35;
  pointer-events: none;
  box-sizing: border-box;
}

.gantt-calendar-selection-slot.is-rejected {
  background-color: var(--gantt-danger-light);
}

/* Outlook 风格分段渲染：左侧比例指示条，代表选区在该槽位内的实际覆盖比例
   相邻槽位首尾像素相接、无圆角，视觉上合并为一条连续竖条；圆角由 indicatorStyle() 仅在首尾槽位内联设置 */
.gantt-calendar-selection-indicator {
  position: absolute;
  z-index: var(--gantt-z-bar-hl, 27);
  background-color: var(--gantt-primary);
  opacity: 0.9;
  pointer-events: none;
  box-sizing: border-box;
}

.gantt-calendar-selection-indicator.is-rejected {
  background-color: var(--gantt-danger);
}
</style>

<template>
  <teleport to="body">
    <div class="gantt-calendar-more-popover-mask" @click="$emit('close')">
      <div class="gantt-calendar-more-popover" :style="popoverStyle" @click.stop>
        <div class="gantt-calendar-more-popover-header">
          <span>{{ formattedDate }}</span>
          <button type="button" class="gantt-calendar-more-popover-close" @click="$emit('close')">
            ×
          </button>
        </div>
        <div class="gantt-calendar-more-popover-body">
          <div
            v-for="task in tasks"
            :key="task.id"
            class="gantt-calendar-more-popover-item"
            :style="{ borderLeftColor: task.barColor || 'var(--gantt-primary)' }"
            @click="$emit('task-click', task, $event)"
          >
            {{ task.name }}
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '../../models/classes/Task'

/**
 * CalendarMoreTasksPopover - 月视图"+N更多"展开层
 * 封装为独立子组件，未来若展开形态调整（抽屉/内联展开等），改动范围收敛在本组件内
 * （对应 ui-v1.12.5.md 待确认事项1、architect-v1.12.5.md 风险 R5）
 */
interface Props {
  date: Date
  tasks: Task[]
  anchor?: HTMLElement
}

const props = defineProps<Props>()
defineEmits<{ close: []; 'task-click': [task: Task, event: MouseEvent] }>()

const formattedDate = computed(
  () => `${props.date.getFullYear()}/${props.date.getMonth() + 1}/${props.date.getDate()}`
)

const popoverStyle = computed(() => {
  if (!props.anchor) return {}
  const rect = props.anchor.getBoundingClientRect()
  return {
    position: 'fixed' as const,
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
  }
})
</script>

<style scoped>
.gantt-calendar-more-popover-mask {
  position: fixed;
  inset: 0;
  z-index: var(--gantt-z-overlay, 9999);
  background: transparent;
}

.gantt-calendar-more-popover {
  min-width: 200px;
  max-width: 280px;
  max-height: 320px;
  overflow-y: auto;
  background-color: var(--gantt-bg-primary);
  border: 1px solid var(--gantt-border-medium);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);

  /* 细滚动条，对齐 .timeline/.task-list-body 容器 */
  scrollbar-width: thin;
  scrollbar-color: var(--gantt-scrollbar-thumb) transparent;
}

.gantt-calendar-more-popover::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.gantt-calendar-more-popover::-webkit-scrollbar-track {
  background: transparent;
}

.gantt-calendar-more-popover::-webkit-scrollbar-thumb {
  background-color: var(--gantt-scrollbar-thumb);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.gantt-calendar-more-popover::-webkit-scrollbar-thumb:hover {
  background-color: var(--gantt-scrollbar-thumb-hover);
}

.gantt-calendar-more-popover::-webkit-scrollbar-corner {
  background: transparent;
}

.gantt-calendar-more-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--gantt-text-secondary);
  border-bottom: 1px solid var(--gantt-border-light);
}

.gantt-calendar-more-popover-close {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--gantt-text-muted);
  line-height: 1;
}

.gantt-calendar-more-popover-body {
  padding: 4px 0;
}

.gantt-calendar-more-popover-item {
  font-size: 13px;
  color: var(--gantt-text-primary);
  padding: 4px 10px;
  border-left: 3px solid var(--gantt-primary);
  cursor: pointer;
}

.gantt-calendar-more-popover-item:hover {
  background-color: var(--gantt-bg-hover);
}
</style>

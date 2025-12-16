<script setup lang="ts">
interface Props {
  isMilestoneGroup: boolean
  isParentTask: boolean
  hasChildren: boolean
  isStoryTask: boolean
  showIcon?: boolean
}

withDefaults(defineProps<Props>(), {
  showIcon: true,
})
</script>

<template>
  <span v-if="showIcon" class="task-icon">
    <!-- 里程碑分组图标 - 使用菱形图标 -->
    <svg
      v-if="isMilestoneGroup"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      class="milestone-group-icon"
    >
      <polygon points="12,2 22,12 12,22 2,12" />
    </svg>
    <!-- 父级任务图标 -->
    <svg
      v-else-if="isStoryTask || hasChildren"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
    </svg>
    <!-- 普通任务图标 -->
    <svg
      v-else
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10,9 9,9 8,9" />
    </svg>
  </span>
</template>

<style scoped>
.task-icon {
  margin-right: 4px;
  color: var(--gantt-text-muted);
}

.task-icon svg {
  vertical-align: middle;
}

/* 里程碑分组图标样式 - 统一使用红色 */
.milestone-group-icon {
  color: var(--gantt-danger, #f56c6c);
  fill: var(--gantt-danger, #f56c6c);
}

/* 暗黑模式下的里程碑图标 */
:global(html[data-theme='dark']) .milestone-group-icon {
  color: var(--gantt-danger, #f67c7c);
  fill: var(--gantt-danger, #f67c7c);
}
</style>

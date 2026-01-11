<script setup lang="ts">
import type { Task } from '../../../models/classes/Task'
import TaskRowIcon from './TaskRowIcon.vue'
import TaskRowBadges from './TaskRowBadges.vue'

interface Props {
  task: Task
  isParentTask: boolean
  hasChildren: boolean
  isStoryTask: boolean
  isMilestoneGroup: boolean
  isMilestoneTask: boolean
  showTaskIcon: boolean
  formattedTimer: string
  isOvertime: boolean
  overdueDays: number
  overtimeText: string
  overdueText: string
  daysText: string
  hasContentSlot: boolean
  renderColumnSlot?: (key: string, payload: any) => any
  hasColumnSlot?: (key: string) => boolean
}

const props = defineProps<Props>()

defineSlots<{
  'custom-task-content'(props: any): unknown
  'column-name'(props: any): unknown
}>()
</script>

<template>
  <!-- 优先级1: 列级自定义 Slot (#column-name) - 覆盖整列内容（图标+文本+徽章） -->
  <component
    :is="() => renderColumnSlot?.('name', {
      task: props.task,
      column: { key: 'name' },
      value: props.task.name,
      isParentTask,
      hasChildren,
      isStoryTask,
      isMilestoneGroup,
      isMilestoneTask,
      showTaskIcon,
      formattedTimer,
      isOvertime,
      overdueDays,
      overtimeText,
      overdueText,
      daysText,
    })"
    v-if="hasColumnSlot?.('name')"
  />

  <!-- 优先级2: custom-task-content Slot (向后兼容) - 仅替换文本部分 -->
  <template v-else-if="hasContentSlot">
    <TaskRowIcon
      :is-milestone-group="isMilestoneGroup"
      :is-parent-task="isParentTask"
      :has-children="hasChildren"
      :is-story-task="isStoryTask"
      :show-icon="showTaskIcon"
    />

    <span
      class="task-name-text"
      :class="{ 'parent-task': isParentTask }"
      :title="task.name"
    >
      <slot name="custom-task-content" />
      <TaskRowBadges
        :formatted-timer="formattedTimer"
        :is-timer-running="!!task.isTimerRunning"
        :timer-elapsed-time="task.timerElapsedTime"
        :is-overtime="isOvertime"
        :overdue-days="overdueDays"
        :overtime-text="overtimeText"
        :overdue-text="overdueText"
        :days-text="daysText"
      />
    </span>
  </template>

  <!-- 优先级3: 默认渲染 -->
  <template v-else>
    <TaskRowIcon
      :is-milestone-group="isMilestoneGroup"
      :is-parent-task="isParentTask"
      :has-children="hasChildren"
      :is-story-task="isStoryTask"
      :show-icon="showTaskIcon"
    />

    <span
      class="task-name-text"
      :class="{ 'parent-task': isParentTask }"
      :title="task.name"
    >
      {{ task.name }}
      <TaskRowBadges
        :formatted-timer="formattedTimer"
        :is-timer-running="!!task.isTimerRunning"
        :timer-elapsed-time="task.timerElapsedTime"
        :is-overtime="isOvertime"
        :overdue-days="overdueDays"
        :overtime-text="overtimeText"
        :overdue-text="overdueText"
        :days-text="daysText"
      />
    </span>
  </template>
</template>

<style scoped>
.task-name-text {
  display: inline-block;
  max-width: calc(100% - 24px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.task-name-text.parent-task {
  font-weight: bold;
  color: var(--gantt-text-parent, var(--gantt-text-primary));
}
</style>

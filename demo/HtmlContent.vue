<script setup lang="ts">
import type { Task } from '../src/models/Task'

interface Props {
  task: Task,
  type: string, // 'task-row' | 'task-bar'
}
const props = withDefaults(defineProps<Props>(), {
})
// console.error('props', props)
</script>

<template>
  <div class="html-content-card">
    <div v-if="type==='task-row'" class="task-row" v-html="task.name" />
    <div v-else-if="type==='task-bar'" class="task-bar" v-html="task.name" />
  </div>
</template>

<style scoped>
.html-content-card {
  display: inline-block;
}

.task-row {
  flex: 1;
  padding: 0 4px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-bar {
  flex: 1;
  padding: 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn {
  height: 20px;
  margin-left: 20px;
}
</style>

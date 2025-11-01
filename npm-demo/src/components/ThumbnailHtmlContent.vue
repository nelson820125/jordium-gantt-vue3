<script setup lang="ts">
interface Props {
  task: any
  type: string // 'task-row' | 'task-bar'
}
const props = withDefaults(defineProps<Props>(), {})
// console.error('props', props)
</script>

<template>
  <div class="html-content-card">
    <div v-if="props.type === 'task-row'" class="task-row" v-html="props.task.thumbnail" />
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn {
  height: 20px;
  margin-left: 20px;
}
</style>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Task } from '../models/classes/Task'

interface Props {
  modelValue?: number[]
  tasks: Task[]
  currentTaskId?: number
  label?: string
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  currentTaskId: undefined,
  label: '前置任务',
  placeholder: '请选择前置任务',
})

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const selectedValue = ref('')

// 当前选中的前置任务ID数组
const selectedPredecessorIds = computed(() => {
  return props.modelValue || []
})

// 已选择的前置任务对象
const selectedPredecessors = computed(() => {
  return selectedPredecessorIds.value
    .map(id => props.tasks.find(task => task.id === id))
    .filter(task => task) as Task[]
})

// 可选择的任务列表（排除当前任务和已选择的任务）
const availableTasks = computed(() => {
  return props.tasks.filter(
    task =>
      task.type === 'task' &&
      task.id !== props.currentTaskId &&
      !selectedPredecessorIds.value.includes(task.id)
  )
})

// 添加前置任务
const addPredecessor = () => {
  if (selectedValue.value) {
    const newId = Number(selectedValue.value)
    if (!selectedPredecessorIds.value.includes(newId)) {
      const newIds = [...selectedPredecessorIds.value, newId]
      emit('update:modelValue', newIds)
    }
    selectedValue.value = ''
  }
}

// 移除前置任务
const removePredecessor = (taskId: number) => {
  const newIds = selectedPredecessorIds.value.filter(id => id !== taskId)
  emit('update:modelValue', newIds)
}

// 监听modelValue变化，更新内部状态
watch(
  () => props.modelValue,
  () => {
    selectedValue.value = ''
  },
  { immediate: true }
)
</script>

<template>
  <div class="multi-select-predecessor">
    <label class="form-label" for="predecessor-select">{{ label }}</label>
    <div class="predecessor-selector">
      <!-- 已选择的前置任务标签 -->
      <div v-if="selectedPredecessors.length > 0" class="selected-tags">
        <span v-for="pred in selectedPredecessors" :key="pred.id" class="predecessor-tag">
          {{ pred.name }} ({{ pred.id }})
          <button type="button" class="remove-tag-btn" @click="removePredecessor(pred.id)">
            ×
          </button>
        </span>
      </div>

      <!-- 下拉选择器 -->
      <div class="select-wrapper">
        <select
          id="predecessor-select"
          v-model="selectedValue"
          class="form-select"
          @change="addPredecessor"
        >
          <option value="">{{ placeholder }}</option>
          <option v-for="task in availableTasks" :key="task.id" :value="task.id">
            {{ task.name }} (ID: {{ task.id }})
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.multi-select-predecessor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--gantt-text-secondary, #606266);
  line-height: 1.4;
}

.predecessor-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.predecessor-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: var(--gantt-primary, #409eff);
  color: white;
  font-size: 12px;
  border-radius: 14px;
  gap: 6px;
}

.remove-tag-btn {
  background: none;
  border: none;
  color: white;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  padding: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.remove-tag-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.select-wrapper {
  width: 100%;
}

.form-select {
  padding: 12px 16px;
  border: 1px solid var(--gantt-border-medium, #dcdfe6);
  border-radius: 4px;
  font-size: 14px;
  color: var(--gantt-text-primary, #303133);
  background: var(--gantt-bg-primary, white);
  transition: border-color 0.2s;
  outline: none;
  width: 100%;
}

.form-select:focus {
  border-color: var(--gantt-primary, #409eff);
}

/* 暗黑模式 */
:global(html[data-theme='dark']) .predecessor-tag {
  background: var(--gantt-primary-dark, #337ecc);
}

:global(html[data-theme='dark']) .form-select {
  background: var(--gantt-bg-primary, #2b2b2b);
  border-color: var(--gantt-border-medium, #4c4d4f);
  color: var(--gantt-text-primary, #e5eaf3);
}

:global(html[data-theme='dark']) .form-select:focus {
  border-color: var(--gantt-primary, #409eff);
}
</style>

<script setup lang="ts">
// v1.13.5 TaskDrawer 资源分配行使用的可筛选资源名称下拉组件
import { ref, computed, nextTick, watch } from 'vue'

interface AssigneeOption {
  key?: string | number
  value: string | number
  label: string
  avatar?: string
  type?: string
}

interface Props {
  modelValue?: string | number
  options?: AssigneeOption[]
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  options: () => [],
  placeholder: '选择资源',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const isOpen = ref(false)
const searchText = ref('')
const wrapperRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const selectedOption = computed(() =>
  props.options.find(option => option.value === props.modelValue)
)

const filteredOptions = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return props.options
  return props.options.filter(option => option.label.toLowerCase().includes(keyword))
})

const openDropdown = () => {
  if (isOpen.value) return
  isOpen.value = true
  searchText.value = ''
  nextTick(() => searchInputRef.value?.focus())
}

const closeDropdown = () => {
  isOpen.value = false
  searchText.value = ''
}

const toggleDropdown = () => {
  if (isOpen.value) {
    closeDropdown()
  } else {
    openDropdown()
  }
}

const selectOption = (option: AssigneeOption) => {
  emit('update:modelValue', option.value)
  closeDropdown()
}

const clearSelection = () => {
  emit('update:modelValue', '')
  closeDropdown()
}

const handleClickOutside = (event: MouseEvent) => {
  if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

watch(isOpen, open => {
  if (open) {
    document.addEventListener('mousedown', handleClickOutside)
  } else {
    document.removeEventListener('mousedown', handleClickOutside)
  }
})

// options 变化（如切换类别过滤）时，若当前选中项已不在候选列表内，交由父组件的业务逻辑处理，这里仅关闭下拉
watch(
  () => props.options,
  () => {
    closeDropdown()
  }
)
</script>

<template>
  <div ref="wrapperRef" class="resource-assignee-select" :class="{ 'is-open': isOpen }">
    <div class="ras-control" @click="toggleDropdown">
      <input
        v-if="isOpen"
        ref="searchInputRef"
        v-model="searchText"
        type="text"
        class="ras-search-input"
        :placeholder="placeholder"
        @click.stop
        @keydown.esc="closeDropdown"
      />
      <span v-else class="ras-value" :class="{ 'ras-placeholder': !selectedOption }">
        {{ selectedOption ? selectedOption.label : placeholder }}
      </span>
      <svg class="ras-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none">
        <path
          d="M6 9l6 6 6-6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></path>
      </svg>
    </div>
    <ul v-if="isOpen" class="ras-dropdown">
      <li class="ras-option ras-option-empty" @click="clearSelection">{{ placeholder }}</li>
      <li
        v-for="option in filteredOptions"
        :key="option.key ?? option.value"
        class="ras-option"
        :class="{ active: option.value === modelValue }"
        @click="selectOption(option)"
      >
        {{ option.label }}
      </li>
      <li v-if="filteredOptions.length === 0" class="ras-option ras-empty">无匹配资源</li>
    </ul>
  </div>
</template>

<style scoped>
.resource-assignee-select {
  position: relative;
  flex: 1;
  min-width: 140px;
  max-width: 200px;
}

.ras-control {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 8px;
  border: 1px solid var(--gantt-border-base, #dcdfe6);
  border-radius: 4px;
  background: var(--gantt-bg-primary, #fff);
  cursor: pointer;
  box-sizing: border-box;
}

.resource-assignee-select.is-open .ras-control {
  border-color: var(--gantt-primary, #409eff);
}

.ras-value {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: var(--gantt-text-primary, #303133);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ras-value.ras-placeholder {
  color: var(--gantt-text-muted, #a8abb2);
}

.ras-search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: var(--gantt-text-primary, #303133);
}

.ras-arrow {
  flex-shrink: 0;
  color: var(--gantt-text-muted, #a8abb2);
}

.ras-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  max-height: 220px;
  overflow-y: auto;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  background: var(--gantt-bg-primary, #fff);
  border: 1px solid var(--gantt-border-light, #ebeef5);
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.ras-option {
  padding: 6px 12px;
  font-size: 14px;
  color: var(--gantt-text-primary, #303133);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.ras-option:hover {
  background: var(--gantt-bg-toolbar, #f5f7fa);
}

.ras-option.active {
  color: var(--gantt-primary, #409eff);
  font-weight: 600;
}

.ras-option-empty {
  color: var(--gantt-text-muted, #a8abb2);
}

.ras-option.ras-empty {
  color: var(--gantt-text-muted, #a8abb2);
  cursor: default;
}

.ras-option.ras-empty:hover {
  background: transparent;
}

/* 暗黑模式 */
.drawer-overlay[data-theme='dark'] .ras-control {
  background: var(--gantt-bg-secondary, rgba(255, 255, 255, 0.05)) !important;
  border-color: var(--gantt-border-light, rgba(255, 255, 255, 0.1)) !important;
}

.drawer-overlay[data-theme='dark'] .ras-dropdown {
  background: var(--gantt-bg-secondary, #2b2b2b) !important;
  border-color: var(--gantt-border-light, rgba(255, 255, 255, 0.1)) !important;
}

.drawer-overlay[data-theme='dark'] .ras-option:hover {
  background: var(--gantt-bg-toolbar, rgba(255, 255, 255, 0.08)) !important;
}
</style>

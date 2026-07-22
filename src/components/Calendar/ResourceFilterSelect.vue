<template>
  <div
    ref="rootRef"
    class="gantt-resource-filter-select"
    :class="{ 'is-disabled': disabled, 'is-open': isOpen }"
  >
    <button
      type="button"
      class="gantt-resource-filter-trigger"
      :disabled="disabled"
      @click="toggleOpen"
    >
      <span v-if="selectedResource" class="gantt-resource-filter-avatar">
        <img
          v-if="selectedResource.avatar"
          :src="selectedResource.avatar"
          :alt="selectedResource.name"
        />
        <span v-else class="gantt-resource-filter-avatar-fallback">{{
          initials(selectedResource.name)
        }}</span>
      </span>
      <span class="gantt-resource-filter-label">{{
        selectedResource ? selectedResource.name : placeholder
      }}</span>
      <span class="gantt-resource-filter-arrow">▾</span>
    </button>

    <ul
      v-if="isOpen"
      ref="menuRef"
      class="gantt-resource-filter-menu"
      :class="{ 'align-right': alignRight }"
    >
      <li
        class="gantt-resource-filter-option"
        :class="{ 'is-active': modelValue === null || modelValue === undefined }"
        @click="selectOption(null)"
      >
        {{ placeholder }}
      </li>
      <li
        v-for="res in resources"
        :key="res.id"
        class="gantt-resource-filter-option"
        :class="{ 'is-active': isSameId(res.id, modelValue) }"
        @click="selectOption(res.id)"
      >
        <span class="gantt-resource-filter-avatar">
          <img v-if="res.avatar" :src="res.avatar" :alt="res.name" />
          <span v-else class="gantt-resource-filter-avatar-fallback">{{ initials(res.name) }}</span>
        </span>
        <span class="gantt-resource-filter-option-name">{{ res.name }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * ResourceFilterSelect - 资源筛选下拉组件（v1.13.0 新增，P1 待办 T7.1）
 * 展示"头像 + 名称"形式的资源筛选下拉，供日历视图/工时分配视图共用；
 * 支持 v-model（modelValue）双向绑定，未选择任何资源时占位文案为"请选择资源"，
 * 此时不应展示任何任务数据（由使用方按此语义过滤）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Resource } from '../../models/classes/Resource'

interface Props {
  resources: Resource[]
  modelValue?: string | number | null
  /** 未选择任何资源时的占位文案 */
  placeholder?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  resources: () => [],
  modelValue: null,
  placeholder: '请选择资源',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
  change: [payload: { next: string | number | null; prev: string | number | null }]
}>()

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
/** 下拉菜单是否右对齐展开（触发按钮靠近视口右边界时自动切换，避免菜单溢出被裁剪） */
const alignRight = ref(false)

const isSameId = (a: string | number, b: string | number | null | undefined) =>
  b !== null && b !== undefined && String(a) === String(b)

const selectedResource = computed(
  () => props.resources.find(res => isSameId(res.id, props.modelValue)) ?? null
)

const initials = (name: string) => (name ? name.trim().slice(0, 1).toUpperCase() : '?')

/** 打开菜单后测量触发按钮与菜单在视口中的位置，超出右边界时切换为右对齐展开 */
const updateAlignment = async () => {
  await nextTick()
  const rootEl = rootRef.value
  const menuEl = menuRef.value
  if (!rootEl || !menuEl) return
  const rootRect = rootEl.getBoundingClientRect()
  const menuWidth = menuEl.offsetWidth
  alignRight.value = rootRect.left + menuWidth > window.innerWidth
}

const toggleOpen = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) updateAlignment()
}

const selectOption = (id: string | number | null) => {
  const prev = props.modelValue ?? null
  isOpen.value = false
  if (String(id ?? '') === String(prev ?? '')) return
  emit('update:modelValue', id)
  emit('change', { next: id, prev })
}

const handleDocumentClick = (event: MouseEvent) => {
  if (!isOpen.value) return
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', handleDocumentClick))
</script>

<style scoped>
.gantt-resource-filter-select {
  position: relative;
  display: inline-block;
  font-size: 13px;
}

.gantt-resource-filter-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  background: var(--gantt-bg-primary);
  border: 1px solid var(--gantt-border-color);
  border-radius: 4px;
  color: var(--gantt-text-primary);
  cursor: pointer;
  min-width: 120px;
  max-width: 200px;
}

.gantt-resource-filter-select.is-disabled .gantt-resource-filter-trigger {
  cursor: not-allowed;
  opacity: 0.6;
}

.gantt-resource-filter-select.is-open .gantt-resource-filter-trigger {
  border-color: var(--gantt-primary);
}

.gantt-resource-filter-avatar {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gantt-primary-light);
  color: var(--gantt-primary);
  font-size: 11px;
  font-weight: 600;
}

.gantt-resource-filter-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gantt-resource-filter-label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.gantt-resource-filter-arrow {
  flex: 0 0 auto;
  font-size: 10px;
  color: var(--gantt-text-secondary);
}

.gantt-resource-filter-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: var(--gantt-z-overlay);
  min-width: 160px;
  max-width: 240px;
  max-height: 260px;
  overflow-y: auto;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  background: var(--gantt-bg-primary);
  border: 1px solid var(--gantt-border-color);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

  /* 细滚动条，对齐 .timeline/.task-list-body 容器 */
  scrollbar-width: thin;
  scrollbar-color: var(--gantt-scrollbar-thumb) transparent;
}

.gantt-resource-filter-menu::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.gantt-resource-filter-menu::-webkit-scrollbar-track {
  background: transparent;
}

.gantt-resource-filter-menu::-webkit-scrollbar-thumb {
  background-color: var(--gantt-scrollbar-thumb);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.gantt-resource-filter-menu::-webkit-scrollbar-thumb:hover {
  background-color: var(--gantt-scrollbar-thumb-hover);
}

.gantt-resource-filter-menu::-webkit-scrollbar-corner {
  background: transparent;
}

/* 触发按钮靠近视口右边界时右对齐展开，避免菜单溢出被裁剪 */
.gantt-resource-filter-menu.align-right {
  left: auto;
  right: 0;
}

.gantt-resource-filter-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  color: var(--gantt-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gantt-resource-filter-option:hover {
  background: var(--gantt-bg-hover);
}

.gantt-resource-filter-option.is-active {
  color: var(--gantt-primary);
  background: var(--gantt-primary-light);
}

.gantt-resource-filter-option-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

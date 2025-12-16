<script setup lang="ts">
interface Props {
  collapsed: boolean
  visible: boolean
}

defineProps<Props>()
defineEmits<{
  toggle: []
}>()
</script>

<template>
  <span
    v-if="visible"
    class="collapse-btn"
    @click.stop="$emit('toggle')"
  >
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <polyline v-if="collapsed" points="9,18 15,12 9,6" />
      <polyline v-else points="18,15 12,9 6,15" />
    </svg>
  </span>
</template>

<style scoped>
.collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  cursor: pointer;
  margin-right: 4px;
  color: var(--gantt-primary);
  border-radius: 2px;
  transition: background-color 0.2s ease;
}

.collapse-btn:hover {
  background-color: var(--gantt-primary-light);
}

.collapse-btn svg {
  transition: transform 0.2s ease;
}
</style>

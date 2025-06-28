<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import '../styles/app.css'
const props = defineProps({
  visible: Boolean,
  title: { type: String, default: '确认' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '确认' },
  cancelText: { type: String, default: '取消' },
})
const emit = defineEmits(['confirm', 'cancel'])
const onConfirm = () => emit('confirm')
const onCancel = () => emit('cancel')
</script>

<template>
  <div v-if="visible" class="gantt-confirm-overlay" @click="onCancel">
    <div class="gantt-confirm-dialog" @click.stop>
      <div class="gantt-confirm-header">
        <h4 class="gantt-confirm-title">{{ props.title }}</h4>
      </div>
      <div class="gantt-confirm-content">
        <p>{{ props.message }}</p>
      </div>
      <div class="gantt-confirm-footer">
        <button type="button" class="btn btn-default" @click="onCancel">
          {{ props.cancelText }}
        </button>
        <button type="button" class="btn btn-danger" @click="onConfirm">
          {{ props.confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gantt-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.25);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gantt-confirm-dialog {
  background: var(--gantt-bg-primary, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
  min-width: 320px;
  max-width: 90vw;
  padding: 24px 28px 18px 28px;
  display: flex;
  flex-direction: column;
}
.gantt-confirm-header {
  margin-bottom: 12px;
}
.gantt-confirm-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--gantt-text-primary, #303133);
  margin: 0;
}
.gantt-confirm-content {
  font-size: 15px;
  color: var(--gantt-text-secondary, #606266);
  margin-bottom: 18px;
}
.gantt-confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

:global(html[data-theme='dark']) .gantt-confirm-dialog {
  background: var(--gantt-bg-secondary, #f8f9fa) !important;
  border-color: var(--gantt-border-dark, #999999) !important;
}
</style>

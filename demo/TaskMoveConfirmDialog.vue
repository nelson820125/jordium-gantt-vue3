<script setup lang="ts">
interface Props {
  visible?: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
}

withDefaults(defineProps<Props>(), {
  visible: false,
  title: '确认操作',
  message: '',
  confirmText: '确认',
  cancelText: '取消',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<template>
  <div v-if="visible" class="confirm-overlay" @click="handleCancel">
    <div class="confirm-dialog" @click.stop>
      <div class="confirm-header">
        <h3>{{ title }}</h3>
        <button class="close-btn" @click="handleCancel">×</button>
      </div>
      <div class="confirm-body">
        <div class="confirm-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#409eff" stroke-width="2" />
            <path d="M12 8v5M12 16h.01" stroke="#409eff" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <p class="confirm-message">{{ message }}</p>
      </div>
      <div class="confirm-footer">
        <button class="btn btn-cancel" @click="handleCancel">{{ cancelText }}</button>
        <button class="btn btn-confirm" @click="handleConfirm">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.confirm-dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  min-width: 420px;
  max-width: 90vw;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.confirm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e8e8e8;
}

.confirm-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #909399;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f5f7fa;
  color: #606266;
}

.confirm-body {
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.confirm-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-message {
  font-size: 15px;
  color: #606266;
  line-height: 1.6;
  text-align: center;
  margin: 0;
  white-space: pre-line;
}

.confirm-footer {
  padding: 16px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid #e8e8e8;
}

.btn {
  padding: 10px 24px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  min-width: 80px;
}

.btn-cancel {
  background: #f5f7fa;
  color: #606266;
}

.btn-cancel:hover {
  background: #e8eaed;
}

.btn-confirm {
  background: #409eff;
  color: white;
}

.btn-confirm:hover {
  background: #66b1ff;
}

.btn-confirm:active {
  background: #3a8ee6;
}

</style>

<style>
/* 暗色主题支持 - 非scoped样式以便访问html元素 */
html[data-theme='dark'] .confirm-dialog {
  background: #1d1e1f;
}

html[data-theme='dark'] .confirm-header {
  border-bottom-color: #414243;
}

html[data-theme='dark'] .confirm-header h3 {
  color: #e5e7eb;
}

html[data-theme='dark'] .confirm-message {
  color: #b4b6b9;
}

html[data-theme='dark'] .confirm-footer {
  border-top-color: #414243;
}

html[data-theme='dark'] .btn-cancel {
  background: #2c2d2e;
  color: #b4b6b9;
}

html[data-theme='dark'] .btn-cancel:hover {
  background: #363738;
}

html[data-theme='dark'] .close-btn {
  color: #909399;
}

html[data-theme='dark'] .close-btn:hover {
  background: #2c2d2e;
  color: #b4b6b9;
}
</style>

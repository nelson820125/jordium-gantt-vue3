<script setup lang="ts">
import { ref, watch, defineProps, defineEmits, computed } from 'vue'
import { useI18n } from '../composables/useI18n'
const props = defineProps({
  visible: Boolean,
  title: { type: String, default: '确认开始计时' },
  message: { type: String, default: '' },
  defaultDesc: { type: String, default: '' },
  placeholder: { type: String, default: '请输入计时说明' },
})

const emit = defineEmits(['confirm', 'cancel'])

const { getTranslation: t } = useI18n()

const desc = ref(props.defaultDesc)
watch(
  () => props.visible,
  v => {
    if (v) desc.value = props.defaultDesc
  },
)
const onConfirm = () => emit('confirm', desc.value)
const messageTaskName = computed(() => {
  if (props.message) {
    // 支持多语言下的任务名提取
    const match = props.message.match(/任务([\S\s]+?)计时|Task ([\S\s]+?) timing/)
    if (match && (match[1] || match[2])) return match[1] || match[2]
  }
  return props.defaultDesc
})
</script>

<template>
  <div class="confirm-timer-dialog-overlay">
    <div class="confirm-timer-dialog">
      <div class="dialog-message">
        <span>{{ t('timerConfirmPrefix') }}</span>
        <span class="task-name-highlight">{{ messageTaskName }}</span>
        <span>{{ t('timerConfirmSuffix') }}</span>
      </div>
      <textarea
        v-model="desc"
        class="dialog-textarea"
        :placeholder="t('timerConfirmPlaceholder')"
        rows="3"
      ></textarea>
      <div class="dialog-actions">
        <button class="btn btn-default" @click="$emit('cancel')">{{ t('cancel') }}</button>
        <button class="btn btn-confirm" @click="onConfirm">{{ t('startTimer') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-timer-dialog-overlay {
  position: fixed;
  z-index: 99999;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}
.confirm-timer-dialog {
  background: var(--gantt-bg-primary, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  padding: 24px 32px 18px 32px; /* 左右padding完全一致 */
  min-width: 340px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

:global(html[data-theme='dark']) .confirm-timer-dialog {
  background: var(--gantt-bg-primary, #6b6b6b);
}
.dialog-message {
  font-size: 14px;
  margin-bottom: 4px;
  line-height: 1.7;
}
.dialog-message .task-name-highlight {
  color: #f44336;
  font-size: 18px;
  font-weight: bold;
  margin: 0 2px;
  display: inline-block;
}
.dialog-textarea {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  padding: 8px 10px;
  resize: vertical;
  min-height: 60px;
  margin-bottom: 8px;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}
.btn {
  min-width: 96px;
  padding: 10px 0;
  border: none;
  border-radius: 4px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.btn-confirm {
  background: #4caf50;
  color: #fff;
}
.btn-confirm:hover {
  background: #43a047;
}
</style>

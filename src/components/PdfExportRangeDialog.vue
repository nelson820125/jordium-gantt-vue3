<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import '../styles/app.css'
import DatePicker from './DatePicker.vue'
import { useI18n } from '../composables/useI18n'

const props = defineProps<{
  visible: boolean
  /** 默认日期范围 [start, end]，格式 YYYY-MM-DD */
  defaultRange: [string, string]
  /** 导出跨度建议上限（天），仅用于提示文案，不做硬性拦截 */
  maxSpanDays?: number
}>()

const emit = defineEmits<{
  /** 用户确认按所选范围导出 */
  confirm: [range: { start: string; end: string }]
  /** 用户选择导出全部（不裁剪） */
  exportAll: []
  cancel: []
}>()

const { t } = useI18n()

const rangeValue = ref<[string, string]>(['', ''])

watch(
  () => props.visible,
  visible => {
    if (visible) {
      rangeValue.value = [...props.defaultRange]
    }
  },
  { immediate: true }
)

const isInvalidRange = computed(() => {
  const [start, end] = rangeValue.value
  if (!start || !end) return true
  return new Date(end).getTime() < new Date(start).getTime()
})

const onCancel = () => emit('cancel')
const onExportAll = () => emit('exportAll')
const onConfirm = () => {
  if (isInvalidRange.value) return
  emit('confirm', { start: rangeValue.value[0], end: rangeValue.value[1] })
}
</script>

<template>
  <div v-if="visible" class="gantt-confirm-overlay" @click="onCancel">
    <div class="gantt-confirm-dialog pdf-export-range-dialog" @click.stop>
      <div class="gantt-confirm-header">
        <h4 class="gantt-confirm-title">{{ t.pdfExportRangeTitle }}</h4>
      </div>
      <div class="gantt-confirm-content">
        <p>{{ t.pdfExportRangeMessage }}</p>
        <div class="pdf-export-range-picker">
          <DatePicker v-model="rangeValue" type="daterange" value-format="YYYY-MM-DD" />
        </div>
        <p v-if="maxSpanDays" class="pdf-export-range-hint">
          {{ t.pdfExportRangeMaxSpanHint.replace('{days}', String(maxSpanDays)) }}
        </p>
        <p v-if="isInvalidRange" class="pdf-export-range-error">{{ t.pdfExportRangeInvalid }}</p>
      </div>
      <div class="gantt-confirm-footer">
        <button type="button" class="gantt-btn gantt-btn-default" @click="onCancel">
          {{ t.cancel }}
        </button>
        <div class="gantt-confirm-footer-right">
          <button type="button" class="gantt-btn gantt-btn-default" @click="onExportAll">
            {{ t.pdfExportRangeExportAll }}
          </button>
          <button
            type="button"
            class="gantt-btn gantt-btn-danger"
            :disabled="isInvalidRange"
            @click="onConfirm"
          >
            {{ t.pdfExportRangeConfirm }}
          </button>
        </div>
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
.pdf-export-range-dialog.gantt-confirm-dialog {
  background: var(--gantt-bg-primary, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
  min-width: 360px;
  max-width: 90vw;
  padding: 24px 28px 18px 28px;
  display: flex;
  flex-direction: column;
}
.gantt-confirm-header {
  margin-bottom: 8px;
}
.gantt-confirm-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--gantt-text-primary, #1f2329);
}
.gantt-confirm-content p {
  margin: 0 0 10px 0;
  font-size: 13px;
  color: var(--gantt-text-secondary, #646a73);
  line-height: 1.5;
}
.pdf-export-range-picker {
  margin: 10px 0 6px 0;
}
.pdf-export-range-hint {
  font-size: 12px !important;
  color: var(--gantt-text-tertiary, #8f959e) !important;
}
.pdf-export-range-error {
  font-size: 12px !important;
  color: #f53f3f !important;
}
.gantt-confirm-footer {
  margin-top: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.gantt-confirm-footer-right {
  display: flex;
  gap: 8px;
}
</style>

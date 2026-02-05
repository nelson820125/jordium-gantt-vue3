<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useI18n } from '../composables/useI18n'
import DatePicker from './DatePicker.vue'
import GanttConfirmDialog from './GanttConfirmDialog.vue'
import type { Milestone } from '../models/classes/Milestone'
import type { Task } from '../models/classes/Task'
import '../styles/app.css'

interface Props {
  visible: boolean
  milestone?: Milestone | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  close: []
  save: [milestone: Task]
  delete: [milestoneId: number]
}>()

// 表单数据
const formData = reactive<Milestone>({
  id: undefined,
  name: '',
  startDate: '',
  assignee: '',
  type: 'milestone',
  icon: 'diamond',
  description: '',
})

// 表单验证错误
const errors = reactive({
  name: '',
  startDate: '',
})

// 下拉菜单状态
const dropdownOpen = ref(false)

// 删除确认状态
const showDeleteConfirm = ref(false)

// 描述文本框引用
const descriptionTextarea = ref<HTMLTextAreaElement | null>(null)

// 自动调整文本框高度
const adjustTextareaHeight = () => {
  const textarea = descriptionTextarea.value
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }
}

// 监听里程碑变化，初始化表单数据
watch(
  () => props.milestone,
  newMilestone => {
    if (newMilestone) {
      Object.assign(formData, {
        id: newMilestone.id,
        name: newMilestone.name || '',
        startDate: newMilestone.startDate || '',
        assignee: newMilestone.assignee || '',
        type: newMilestone.type || 'milestone',
        icon: newMilestone.icon || 'diamond',
        description: newMilestone.description || '',
      })
    } else {
      // 新建里程碑时重置表单
      Object.assign(formData, {
        id: undefined,
        name: '',
        startDate: '',
        assignee: '',
        type: 'milestone',
        icon: 'diamond',
        description: '',
      })
    }
    // 清空错误
    errors.name = ''
    errors.startDate = ''
  },
  { immediate: true },
)

// 监听对话框打开，确保新建时重置表单
watch(
  () => props.visible,
  (newVisible) => {
    if (newVisible && !props.milestone) {
      // 打开对话框且没有传入里程碑（新建模式），重置表单
      Object.assign(formData, {
        id: undefined,
        name: '',
        startDate: '',
        assignee: '',
        type: 'milestone',
        icon: 'diamond',
        description: '',
      })
      // 清空错误
      errors.name = ''
      errors.startDate = ''
    }
  },
)

// 表单验证
const validateForm = () => {
  errors.name = ''
  errors.startDate = ''

  let isValid = true

  if (!formData.name.trim()) {
    errors.name = t('milestoneNameRequired')
    isValid = false
  }

  if (!formData.startDate) {
    errors.startDate = t('milestoneDateRequired')
    isValid = false
  }

  return isValid
}

// 表单是否有效
const isFormValid = computed(() => {
  return formData.name.trim() && formData.startDate
})

// 选择图标
const selectIcon = (icon: string) => {
  formData.icon = icon
  dropdownOpen.value = false
}

// 保存处理
const handleSave = () => {
  if (validateForm()) {
    // 里程碑的 endDate 必须与 startDate 相同
    const milestoneData = {
      ...formData,
      endDate: formData.startDate,
      id: formData.id!, // 确保id不为undefined
    } as Task
    emit('save', milestoneData)
    closeDialog()
  }
}

// 删除处理
const handleDelete = () => {
  if (formData.id) {
    showDeleteConfirm.value = true
  }
}

// 确认删除
const confirmDelete = () => {
  if (formData.id) {
    emit('delete', formData.id)
    showDeleteConfirm.value = false
    closeDialog()
  }
}

// 取消删除
const cancelDelete = () => {
  showDeleteConfirm.value = false
}

// 是否为编辑模式
const isEditMode = computed(() => {
  return props.milestone && props.milestone.id
})

// 关闭对话框
const closeDialog = () => {
  dropdownOpen.value = false
  emit('update:visible', false)
  emit('close')
}

// 点击遮罩层关闭
const handleOverlayClick = () => {
  closeDialog()
}

// 多语言
const { t: globalT } = useI18n()

// 直接用全局 t 获取翻译
const t = (key: string) => {
  const globalValue = (globalT.value as any)[key]
  return globalValue || key
}
</script>

<template>
  <div v-if="visible" class="milestone-dialog-overlay" @click="handleOverlayClick">
    <div class="milestone-dialog" @click.stop>
      <div class="milestone-dialog-header">
        <h3 class="milestone-dialog-title">
          <svg
            class="milestone-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <g transform="rotate(45 12 12)">
              <rect
                x="4"
                y="4"
                width="16"
                height="16"
                rx="4"
                ry="4"
                fill="currentColor"
                opacity="0.1"
              />
              <rect
                x="4"
                y="4"
                width="16"
                height="16"
                rx="4"
                ry="4"
                stroke="currentColor"
                fill="none"
              />
            </g>
          </svg>
          {{ isEditMode ? globalT.editMilestone : globalT.newMilestone }}
        </h3>
        <button class="milestone-dialog-close" :title="t('close')" @click="closeDialog">×</button>
      </div>

      <div class="milestone-dialog-content">
        <form class="milestone-form" @submit.prevent="handleSave">
          <!-- 第一行：里程碑名称 -->
          <div class="milestone-form-row">
            <div class="milestone-form-item milestone-form-item-full">
              <label class="milestone-form-label required" for="milestone-name">{{
                t('milestoneName')
              }}</label>
              <input
                id="milestone-name"
                v-model="formData.name"
                type="text"
                class="milestone-form-input"
                :class="{ error: errors.name }"
                :placeholder="t('enterMilestoneName')"
                required
              />
              <span v-if="errors.name" class="milestone-form-error">{{ errors.name }}</span>
            </div>
          </div>

          <!-- 第二行：里程碑日期和图标 -->
          <div class="milestone-form-row">
            <div class="milestone-form-item">
              <label class="milestone-form-label required" for="milestone-date">{{
                t('milestoneDate')
              }}</label>
              <DatePicker
                id="milestone-date"
                v-model="formData.startDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择里程碑日期"
                :class="{ error: errors.startDate }"
              />
              <span v-if="errors.startDate" class="milestone-form-error">{{
                errors.startDate
              }}</span>
            </div>

            <div class="milestone-form-item">
              <label class="milestone-form-label" for="milestone-icon">{{
                t('milestoneIcon')
              }}</label>
              <div class="milestone-icon-dropdown" :class="{ active: dropdownOpen }">
                <button
                  id="milestone-icon"
                  type="button"
                  class="milestone-icon-trigger"
                  :aria-expanded="dropdownOpen"
                  aria-haspopup="listbox"
                  @click="dropdownOpen = !dropdownOpen"
                >
                  <div class="selected-icon">
                    <svg
                      v-if="formData.icon === 'diamond'"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <g transform="rotate(45 12 12)">
                        <rect
                          x="6"
                          y="6"
                          width="12"
                          height="12"
                          rx="3"
                          ry="3"
                          fill="currentColor"
                        />
                      </g>
                    </svg>
                    <div v-else-if="formData.icon === 'rocket'" class="rocket-emoji-mini">🚀</div>
                    <span>{{ t(formData.icon || 'diamond') }}</span>
                  </div>
                  <svg
                    class="dropdown-arrow"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                </button>

                <div v-if="dropdownOpen" class="milestone-icon-options">
                  <div
                    class="icon-option"
                    :class="{ selected: formData.icon === 'diamond' }"
                    @click="selectIcon('diamond')"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <g transform="rotate(45 12 12)">
                        <rect
                          x="6"
                          y="6"
                          width="12"
                          height="12"
                          rx="3"
                          ry="3"
                          fill="currentColor"
                        />
                      </g>
                    </svg>
                    <span>{{ t('diamond') }}</span>
                  </div>

                  <div
                    class="icon-option"
                    :class="{ selected: formData.icon === 'rocket' }"
                    @click="selectIcon('rocket')"
                  >
                    <div class="rocket-emoji-option">🚀</div>
                    <span>{{ t('rocket') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 第三行：描述 -->
          <div class="milestone-form-row">
            <div class="milestone-form-item milestone-form-item-full">
              <label class="milestone-form-label" for="milestone-description">{{
                t('description')
              }}</label>
              <div class="textarea-wrapper">
                <textarea
                  id="milestone-description"
                  ref="descriptionTextarea"
                  v-model="formData.description"
                  class="milestone-form-textarea"
                  :placeholder="t('enterDescription')"
                  rows="4"
                  maxlength="500"
                  @input="adjustTextareaHeight"
                ></textarea>
                <div class="textarea-footer">
                  <span class="char-count">{{ formData.description?.length || 0 }}/500</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      <div class="milestone-dialog-footer">
        <div class="milestone-dialog-footer-left">
          <button v-if="isEditMode" type="button" class="gantt-btn gantt-btn-danger" @click="handleDelete">
            {{ globalT.delete }}
          </button>
        </div>
        <div class="milestone-dialog-footer-right">
          <button type="button" class="gantt-btn gantt-btn-default" @click="closeDialog">
            {{ globalT.cancel }}
          </button>
          <button
            type="button"
            class="gantt-btn gantt-btn-primary"
            :disabled="!isFormValid"
            @click="handleSave"
          >
            {{ globalT.confirm }}
          </button>
        </div>
      </div>
    </div>

    <GanttConfirmDialog
      :visible="showDeleteConfirm"
      :title="globalT.delete"
      :message="globalT.confirmDelete"
      :confirm-text="globalT.confirm"
      :cancel-text="globalT.cancel"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<style scoped>
@import '../styles/theme-variables.css';

.milestone-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000; /* 确保在全屏模式下也能正常显示 */
}

.milestone-dialog {
  background: var(--gantt-bg-primary, #ffffff);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  border: 1px solid var(--gantt-border-color, #dcdfe6);
}

.milestone-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--gantt-border-color, #dcdfe6);
  background: var(--gantt-bg-secondary, #f8f9fa);
}

.milestone-dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--gantt-text-primary, #303133);
}

.milestone-icon {
  width: 20px;
  height: 20px;
  color: var(--gantt-danger, #f56c6c);
  filter: drop-shadow(0 0 4px var(--gantt-danger, #f56c6c));
}

.milestone-dialog-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gantt-text-secondary, #909399);
  transition: all 0.2s ease;
  font-size: 24px;
  font-weight: bold;
  line-height: 1;
}

.milestone-dialog-content {
  padding: 24px;
  max-height: 60vh;
  overflow-y: auto;
}

/* 表单样式 */
.milestone-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.milestone-form-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.milestone-form-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.milestone-form-item-full {
  flex: 1 1 100%;
}

.milestone-form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--gantt-text-secondary, #606266);
  line-height: 1.4;
  margin: 0;
}

.milestone-form-label.required::after {
  content: '*';
  color: var(--gantt-danger, #f56c6c);
  margin-left: 4px;
}

.milestone-form-input {
  padding: 12px 16px;
  border: 1px solid var(--gantt-border-color, #dcdfe6);
  border-radius: 4px;
  font-size: 14px;
  color: var(--gantt-text-primary, #303133);
  background: var(--gantt-bg-primary, #ffffff);
  transition: all 0.2s ease;
  box-sizing: border-box;
  height: 44px;
}

.milestone-form-input:focus {
  outline: none;
  border-color: var(--gantt-primary, #409eff);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

.milestone-form-input.error {
  border-color: var(--gantt-danger, #f56c6c);
  box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.1);
}

.milestone-form-input::placeholder {
  color: var(--gantt-text-placeholder, #c0c4cc);
}

.milestone-form-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 16px;
  border: 1px solid var(--gantt-border-color, #dcdfe6);
  border-radius: 4px;
  font-size: 14px;
  color: var(--gantt-text-primary, #303133);
  background: var(--gantt-bg-primary, #ffffff);
  transition: all 0.2s ease;
  resize: none;
  min-height: 80px;
  max-height: 120px;
  font-family: inherit;
  line-height: 1.5;
  overflow-y: auto;
}

.milestone-form-textarea:focus {
  outline: none;
  border-color: var(--gantt-primary, #409eff);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

.milestone-form-textarea::placeholder {
  color: var(--gantt-text-placeholder, #c0c4cc);
}

.textarea-wrapper {
  position: relative;
}

.textarea-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.char-count {
  font-size: 12px;
  color: var(--gantt-text-secondary, #909399);
}

.milestone-form-error {
  font-size: 12px;
  color: var(--gantt-danger, #f56c6c);
  margin-top: 4px;
}

/* 图标下拉菜单样式 */
.milestone-icon-dropdown {
  position: relative;
}

.milestone-icon-trigger {
  width: 100%;
  height: 44px; /* 固定高度 */
  padding: 12px 16px;
  border: 1px solid var(--gantt-border-color, #dcdfe6);
  border-radius: 4px;
  background: var(--gantt-bg-primary, #ffffff);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.milestone-icon-trigger:hover {
  border-color: var(--gantt-primary, #409eff);
}

.milestone-icon-dropdown.active .milestone-icon-trigger {
  border-color: var(--gantt-primary, #409eff);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

.selected-icon {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--gantt-text-primary, #303133);
}

.selected-icon svg {
  width: 16px;
  height: 16px;
  color: var(--gantt-danger, #f56c6c);
}

.rocket-emoji-mini {
  font-size: 16px;
  transform: rotate(-45deg);
  display: inline-block;
}

.dropdown-arrow {
  width: 16px;
  height: 16px;
  color: var(--gantt-text-secondary, #909399);
  transition: transform 0.2s ease;
}

.milestone-icon-dropdown.active .dropdown-arrow {
  transform: rotate(180deg);
}

.milestone-icon-options {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--gantt-bg-primary, #ffffff);
  border: 1px solid var(--gantt-border-color, #dcdfe6);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  margin-top: 4px;
}

.icon-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid var(--gantt-border-light, #e4e7ed);
}

.icon-option:last-child {
  border-bottom: none;
}

.icon-option:hover {
  background: var(--gantt-bg-light, #f5f7fa);
}

.icon-option.selected {
  background: var(--gantt-primary-lightest, #ecf5ff);
  color: var(--gantt-primary, #409eff);
}

.icon-option svg {
  width: 16px;
  height: 16px;
  color: var(--gantt-danger, #f56c6c);
}

.rocket-emoji-option {
  font-size: 16px;
  transform: rotate(-45deg);
  display: inline-block;
}

.icon-option span {
  font-size: 14px;
}

/* 对话框底部 */
.milestone-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid var(--gantt-border-color, #dcdfe6);
  background: var(--gantt-bg-secondary, #f8f9fa);
}

.milestone-dialog-footer-left {
  display: flex;
  align-items: center;
}

.milestone-dialog-footer-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 删除确认弹窗样式 */
.milestone-confirm-dialog {
  background: var(--gantt-bg-primary, #ffffff);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 400px;
  border: 1px solid var(--gantt-border-color, #dcdfe6);
}

.milestone-confirm-header {
  padding: 20px 24px 0;
}

.milestone-confirm-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--gantt-text-primary, #303133);
}

.milestone-confirm-content {
  padding: 16px 24px;
}

.milestone-confirm-content p {
  margin: 0;
  font-size: 14px;
  color: var(--gantt-text-secondary, #606266);
  line-height: 1.5;
}

.milestone-confirm-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--gantt-border-color, #dcdfe6);
  background: var(--gantt-bg-secondary, #f8f9fa);
}

/* 暗黑模式下的确认弹窗 */
:global(.gantt-root[data-theme='dark']) .milestone-confirm-dialog {
  background: var(--gantt-bg-dark, #1d1e1f);
  border-color: var(--gantt-border-dark, #3c3e40);
}

:global(.gantt-root[data-theme='dark']) .milestone-confirm-footer {
  background: var(--gantt-bg-darker, #141414);
  border-color: var(--gantt-border-dark, #3c3e40);
}
</style>

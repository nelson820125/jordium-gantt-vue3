<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from '../composables/useI18n'
import DatePicker from './DatePicker.vue'
import GanttConfirmDialog from './GanttConfirmDialog.vue'
import type { Task } from '../models/classes/Task'
import '../styles/app.css'

interface Props {
  visible: boolean
  task?: Task | null
  isEdit?: boolean
  onDelete?: (task: Task) => void
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  task: null,
  isEdit: false,
  onDelete: undefined,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  submit: [task: Task]
  close: []
  delete: [task: Task]
}>()

const { t } = useI18n()

const submitting = ref(false)
const isVisible = ref(props.visible)
const showDeleteConfirm = ref(false)

// 表单数据
const formData = reactive<Task>({
  id: 0, // 默认值，创建时会被重新分配
  name: '',
  type: 'task',
  assignee: '',
  startDate: '',
  endDate: '',
  predecessor: '',
  estimatedHours: 0,
  actualHours: 0,
  progress: 0,
  description: '',
  parentId: undefined, // 上级任务ID
})

// 任务列表数据
const allTasks = ref<Task[]>([])

// 获取可作为前置任务的任务列表（只包含type="task"的任务，且不包含当前任务）
const availablePredecessorTasks = computed(() => {
  return allTasks.value.filter(
    task => task.type === 'task' && task.id !== props.task?.id, // 排除当前任务自己
  )
})

// 获取可作为上级任务的任务列表（只显示story和task类型，排除当前任务自己）
const availableParentTasks = computed(() => {
  return allTasks.value
    .filter(
      task =>
        task.id !== props.task?.id && // 排除当前任务自己
        (task.type === 'story' || task.type === 'task'), // 只显示story和task类型
    )
    .map(task => ({
      ...task,
      displayName: `${task.name} (${getTaskTypeDisplay(task.type || 'task')})`,
    }))
})

// 获取任务类型的显示文本
const getTaskTypeDisplay = (type: string): string => {
  return (t.value.taskTypeMap as Record<string, string>)?.[type] || type
}

// 错误信息
const errors = reactive({
  name: '',
  type: '',
  startDate: '',
  endDate: '',
})

// 监听 visible 属性变化
watch(
  () => props.visible,
  newVal => {
    isVisible.value = newVal
    if (newVal) {
      resetForm()
      if (props.task && props.isEdit) {
        // 编辑模式，填充表单数据
        Object.assign(formData, props.task)
      }
      // 抽屉显示时重新请求任务数据，确保前置任务列表是最新的
      window.dispatchEvent(new CustomEvent('request-task-list'))
    }
  },
)

// 监听 isVisible 变化，同步到父组件
watch(isVisible, newVal => {
  emit('update:visible', newVal)
})

// 重置表单
const resetForm = () => {
  Object.assign(formData, {
    name: '',
    type: 'task',
    assignee: '',
    startDate: '',
    endDate: '',
    predecessor: '',
    estimatedHours: 0,
    actualHours: 0,
    progress: 0,
    description: '',
    parentId: undefined,
  })

  // 清除错误信息
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
}

// 表单验证
const validateForm = (): boolean => {
  let isValid = true
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
  if (!formData.name?.trim()) {
    errors.name = t.value.taskNameRequired
    isValid = false
  } else if (formData.name.length > 50) {
    errors.name = t.value.taskNameTooLong
    isValid = false
  }
  if (!formData.type) {
    errors.type = t.value.taskTypeRequired
    isValid = false
  }
  if (!formData.startDate) {
    errors.startDate = t.value.startDateRequired
    isValid = false
  }
  if (!formData.endDate) {
    errors.endDate = t.value.endDateRequired
    isValid = false
  } else if (formData.startDate && new Date(formData.endDate) < new Date(formData.startDate)) {
    errors.endDate = t.value.endDateInvalid
    isValid = false
  }
  return isValid
}

// 关闭抽屉
const handleClose = () => {
  isVisible.value = false
  emit('close')
}

// 点击遮罩层关闭
const handleOverlayClick = () => {
  handleClose()
}

// 提交表单
const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }
  try {
    submitting.value = true
    const taskData: Task = {
      ...formData,
      id: props.isEdit && props.task ? props.task.id : Date.now(),
    }
    emit('submit', taskData)
    showMessage(props.isEdit ? t.value.taskUpdateSuccess : t.value.taskCreateSuccess, 'success')
    handleClose()
  } catch (error) {
    // 记录异常，保证 lint 通过
    console.error(error)
    showMessage(t.value.operationFailed, 'error')
  } finally {
    submitting.value = false
  }
}

// 删除任务
const handleDelete = () => {
  showDeleteConfirm.value = true
}

const confirmDelete = () => {
  showDeleteConfirm.value = false
  if (props.task && props.isEdit) {
    try {
      submitting.value = true
      emit('delete', props.task)
      handleClose()
    } catch (error) {
      showMessage(t.value.taskDeleteFailed, 'error')
    } finally {
      submitting.value = false
    }
  }
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
}

// 获取任务数据的事件处理器
const handleTasksChanged = (event: CustomEvent) => {
  allTasks.value = event.detail || []
}

// 组件挂载时添加事件监听器
onMounted(() => {
  window.addEventListener('task-list-updated', handleTasksChanged as EventListener)
  // 请求初始任务数据
  window.dispatchEvent(new CustomEvent('request-task-list'))
})

// 组件卸载时移除事件监听器
onUnmounted(() => {
  window.removeEventListener('task-list-updated', handleTasksChanged as EventListener)
})

// 简单的消息提示函数
const showMessage = (message: string, type: 'success' | 'error') => {
  // 创建消息元素
  const messageEl = document.createElement('div')
  messageEl.className = `message ${type}`
  messageEl.textContent = message
  messageEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    z-index: 9999;
    background: ${type === 'success' ? '#67c23a' : '#f56c6c'};
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  `

  document.body.appendChild(messageEl)

  // 3秒后自动移除
  setTimeout(() => {
    if (messageEl.parentNode) {
      document.body.removeChild(messageEl)
    }
  }, 3000)
}
</script>

<template>
  <div v-if="isVisible" class="drawer-overlay" @click="handleOverlayClick">
    <div class="drawer-container" @click.stop>
      <!-- Drawer Header -->
      <div class="drawer-header">
        <h3 class="drawer-title">{{ isEdit ? t.editTask : t.newTask }}</h3>
        <button class="drawer-close-btn" type="button" @click="handleClose">
          <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Drawer Body -->
      <div class="drawer-body">
        <form class="task-form" @submit.prevent="handleSubmit">
          <div class="form-group">
            <label class="form-label" for="task-name">
              {{ t.taskName }} <span class="required">*</span></label
            >
            <input
              id="task-name"
              v-model="formData.name"
              type="text"
              class="form-input"
              :class="{ error: errors.name }"
              :placeholder="t.taskNamePlaceholder"
            />
            <span v-if="errors.name" class="error-text">{{ errors.name }}</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="task-type">
              {{ t.taskType }} <span class="required">*</span></label
            >
            <select
              id="task-type"
              v-model="formData.type"
              class="form-select"
              :class="{ error: errors.type }"
            >
              <option value="story">{{ t.taskTypeMap.story }}</option>
              <option value="task">{{ t.taskTypeMap.task }}</option>
              <option value="bug">{{ t.taskTypeMap.bug }}</option>
            </select>
            <span v-if="errors.type" class="error-text">{{ errors.type }}</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="task-assignee">{{ t.assignee }}</label>
            <select id="task-assignee" v-model="formData.assignee" class="form-select">
              <option value="">请选择负责人</option>
              <option value="张三">张三</option>
              <option value="李四">李四</option>
              <option value="王五">王五</option>
              <option value="赵六">赵六</option>
              <option value="钱七">钱七</option>
            </select>
          </div>

          <!-- 上级任务选择 -->
          <div class="form-group">
            <label class="form-label" for="task-parent">{{ t.parentTask }}</label>
            <select id="task-parent" v-model="formData.parentId" class="form-select">
              <option :value="undefined">{{ t.noParentTask }}</option>
              <option
                v-for="parentTask in availableParentTasks"
                :key="parentTask.id"
                :value="parentTask.id"
              >
                {{ parentTask.displayName }}
              </option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="task-start-date">
                {{ t.startDate }} <span class="required">*</span></label
              >
              <DatePicker
                id="task-start-date"
                v-model="formData.startDate"
                type="date"
                :placeholder="t.startDateRequired"
                :class="{ error: errors.startDate }"
              />
              <span v-if="errors.startDate" class="error-text">{{ errors.startDate }}</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="task-end-date">
                {{ t.endDate }} <span class="required">*</span></label
              >
              <DatePicker
                id="task-end-date"
                v-model="formData.endDate"
                type="date"
                :placeholder="t.endDateRequired"
                :class="{ error: errors.endDate }"
              />
              <span v-if="errors.endDate" class="error-text">{{ errors.endDate }}</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="task-predecessor">{{ t.predecessor }}</label>
            <select id="task-predecessor" v-model="formData.predecessor" class="form-select">
              <option value="">{{ t.predecessorPlaceholder }}</option>
              <option
                v-for="predTask in availablePredecessorTasks"
                :key="predTask.id"
                :value="predTask.id"
              >
                {{ predTask.name }} (ID: {{ predTask.id }})
              </option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="task-estimated-hours">{{ t.estimatedHours }}</label>
              <input
                id="task-estimated-hours"
                v-model.number="formData.estimatedHours"
                type="number"
                class="form-input"
                placeholder="0"
                min="0"
                max="999"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="task-actual-hours">{{ t.actualHours }}</label>
              <input
                id="task-actual-hours"
                v-model.number="formData.actualHours"
                type="number"
                class="form-input"
                placeholder="0"
                min="0"
                max="999"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="task-progress">{{ t.progress }}</label>
            <div class="progress-container">
              <input
                id="task-progress"
                v-model.number="formData.progress"
                type="range"
                class="progress-slider"
                min="0"
                max="100"
                step="5"
              />
              <div class="progress-value">{{ formData.progress }}%</div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="task-description">{{ t.description }}</label>
            <textarea
              id="task-description"
              v-model="formData.description"
              class="form-textarea"
              :placeholder="t.descriptionPlaceholder"
              rows="3"
            ></textarea>
          </div>
        </form>
      </div>
      <!-- Drawer Footer -->
      <div class="drawer-footer">
        <div class="footer-left">
          <!-- 删除按钮，仅在编辑模式下显示 -->
          <button
            v-if="isEdit && task"
            type="button"
            class="btn btn-danger"
            :disabled="submitting"
            @click="handleDelete"
          >
            <span v-if="submitting" class="loading-spinner"></span>
            {{ t.delete }}
          </button>
          <GanttConfirmDialog
            :visible="showDeleteConfirm"
            :title="t.delete"
            :message="t.confirmDeleteTask.replace('{name}', task?.name || '')"
            :confirm-text="t.confirm"
            :cancel-text="t.cancel"
            @confirm="confirmDelete"
            @cancel="cancelDelete"
          />
        </div>
        <div class="footer-right">
          <button type="button" class="btn btn-default" @click="handleClose">{{ t.cancel }}</button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="submitting"
            @click="handleSubmit"
          >
            <span v-if="submitting" class="loading-spinner"></span>
            {{ isEdit ? t.update : t.create }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../styles/theme-variables.css';

/* 抽屉遮罩层 */
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000; /* 确保在全屏模式下也能正常显示 */
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
}

/* 抽屉容器 */
.drawer-container {
  width: 500px;
  background: var(--gantt-bg-primary, white);
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s ease-out;
  color: var(--gantt-text-primary, #303133);
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

/* 抽屉头部 */
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--gantt-border-light, #ebeef5);
  background: var(--gantt-bg-secondary, #f5f7fa);
}

.drawer-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--gantt-text-primary, #303133);
}

.drawer-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--gantt-text-muted, #909399);
  transition: color 0.2s;
}

.drawer-close-btn:hover {
  color: var(--gantt-text-secondary, #606266);
}

.close-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

/* 抽屉主体 */
.drawer-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

/* 表单样式 */
.task-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-row .form-group {
  flex: 1;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--gantt-text-secondary, #606266);
  line-height: 1.4;
}

.required {
  color: var(--gantt-danger, #f56c6c);
  margin-left: 2px;
}

.form-input,
.form-select,
.form-textarea {
  padding: 12px 16px;
  border: 1px solid var(--gantt-border-medium, #dcdfe6);
  border-radius: 4px;
  font-size: 14px;
  color: var(--gantt-text-primary, #303133); /* 录入后为黑色，与 MilestoneDialog 保持一致 */
  background: var(--gantt-bg-primary, white);
  transition: border-color 0.2s;
  outline: none;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: var(--gantt-primary, #409eff);
}

.form-input.error,
.form-select.error {
  border-color: var(--gantt-danger, #f56c6c);
}

.form-input::placeholder,
.form-select::placeholder,
.form-textarea::placeholder {
  color: var(--gantt-text-placeholder, #c0c4cc);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.error-text {
  color: var(--gantt-danger, #f56c6c);
  font-size: 12px;
  line-height: 1.4;
}

/* 进度条容器 */
.progress-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-slider {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--gantt-border-light, #e4e7ed);
  outline: none;
  appearance: none;
  cursor: pointer;
}

.progress-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--gantt-primary, #409eff);
  cursor: pointer;
}

.progress-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--gantt-primary, #409eff);
  cursor: pointer;
  border: none;
}

.progress-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--gantt-text-secondary, #606266);
  min-width: 40px;
  text-align: right;
}

/* 抽屉底部 */
.drawer-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--gantt-border-light, #ebeef5);
  background: var(--gantt-bg-toolbar, #fafafa);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-left {
  display: flex;
  align-items: center;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 加载动画 */
.loading-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 消息提示样式 */
.message {
  animation: messageSlideIn 0.3s ease-out;
}

@keyframes messageSlideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 暗黑模式样式优化 */
:global(html[data-theme='dark']) .drawer-overlay {
  background: rgba(0, 0, 0, 0.7) !important;
}

:global(html[data-theme='dark']) .drawer-container {
  box-shadow: -4px 0 15px rgba(0, 0, 0, 0.4) !important;
}

:global(html[data-theme='dark']) .drawer-close-btn:hover {
  background: var(--gantt-bg-hover, rgba(255, 255, 255, 0.1)) !important;
  border-radius: 4px;
}

:global(html[data-theme='dark']) .form-input:focus,
:global(html[data-theme='dark']) .form-select:focus,
:global(html[data-theme='dark']) .form-textarea:focus {
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2) !important;
}

:global(html[data-theme='dark']) .form-input::placeholder,
:global(html[data-theme='dark']) .form-textarea::placeholder {
  color: var(--gantt-text-muted, #9e9e9e) !important;
}
</style>

<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from '../composables/useI18n'
import { useMessage } from '../composables/useMessage'
import DatePicker from './DatePicker.vue'
import GanttConfirmDialog from './GanttConfirmDialog.vue'
import MultiSelectPredecessor from './MultiSelectPredecessor.vue'
import ConfirmTimerDialog from './ConfirmTimerDialog.vue'
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
  delete: [task: Task, deleteChildren?: boolean]
  'start-timer': [task: Task]
  'stop-timer': [task: Task]
}>()

const { t } = useI18n()
const { showMessage } = useMessage()

const submitting = ref(false)
const isVisible = ref(props.visible)
const showDeleteConfirm = ref(false)

// 计时器相关
const timerElapsed = ref(0)
const timerInterval = ref<number | null>(null)

const isTimerRunning = computed(() => props.task?.isTimerRunning)
const timerStartTime = computed(() => props.task?.timerStartTime)
const timerElapsedTime = computed(() => props.task?.timerElapsedTime || 0)

const formattedTimer = computed(() => {
  const totalSeconds = Math.floor(timerElapsed.value / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const updateTimer = () => {
  if (isTimerRunning.value && timerStartTime.value) {
    timerElapsed.value = Date.now() - timerStartTime.value + timerElapsedTime.value
  } else {
    timerElapsed.value = timerElapsedTime.value
  }
}

// 新增：监听 props.task 的 isTimerRunning、timerStartTime、timerElapsedTime 变化，确保 header 区域按钮和计时器展示实时同步
watch(
  () => [props.task?.isTimerRunning, props.task?.timerStartTime, props.task?.timerElapsedTime],
  () => {
    updateTimer()
  }
)

// 计时器本地状态，保证点击后UI立即切换
const localTimerRunning = ref(false)

// 只要 props.task 变化或全局事件变化，立即同步本地状态
watch(
  () => props.task?.isTimerRunning,
  val => {
    localTimerRunning.value = !!val
    if (!val && timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }
  },
  { immediate: true }
)

// 修正计时器每秒递增逻辑，保证计时器正常跳动
watch(
  [localTimerRunning, timerStartTime, timerElapsedTime],
  () => {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }
    if (localTimerRunning.value && timerStartTime.value) {
      updateTimer()
      timerInterval.value = window.setInterval(updateTimer, 1000)
    } else {
      updateTimer()
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
  }
})

// 根据任务类型确定dialog类型
const dialogType = computed(() => {
  return props.task?.type === 'story' ? 'yes-no-cancel' : 'confirm-cancel'
})

// 根据任务类型确定dialog消息
const dialogMessage = computed(() => {
  if (props.task?.type === 'story') {
    return t.value.confirmDeleteStory.replace('{name}', props.task?.name || '')
  }
  return t.value.confirmDeleteTask.replace('{name}', props.task?.name || '')
})

// 表单数据
const formData = reactive<Task>({
  id: 0, // 默认值，创建时会被重新分配
  name: '',
  type: 'task',
  assignee: '',
  startDate: '',
  endDate: '',
  predecessor: [],
  estimatedHours: 0,
  actualHours: 0,
  progress: 0,
  description: '',
  parentId: undefined, // 上级任务ID
  isTimerRunning: false, // 是否正在计时
  timerStartTime: undefined, // 计时器开始时间
  timerEndTime: undefined, // 计时器结束时间
  timerElapsedTime: 0, // 计时器已用时间
})

// 任务列表数据
const allTasks = ref<Task[]>([])

// 获取可作为上级任务的任务列表（只显示story和task类型，排除当前任务自己）
const availableParentTasks = computed(() => {
  return allTasks.value
    .filter(
      task =>
        task.id !== props.task?.id && // 排除当前任务自己
        (task.type === 'story' || task.type === 'task') // 只显示story和task类型
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

// 计算进度条样式
const progressSliderStyle = computed(() => {
  const progressPercent = formData.progress || 0
  return {
    '--progress-percent': `${progressPercent}%`,
  }
})

// 进度输入框的显示值
const progressDisplayValue = ref('0')

// 处理进度输入
const handleProgressInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  let value = target.value

  // 只保留数字
  value = value.replace(/[^\d]/g, '')

  // 更新输入框显示
  target.value = value
  progressDisplayValue.value = value
}

// 处理进度输入失焦或回车
const handleProgressInputBlur = () => {
  const value = progressDisplayValue.value

  // 转换为数字
  let progress = parseInt(value) || 0

  // 数据验证：小于0或非数字显示0，大于100显示100
  if (progress < 0 || isNaN(progress)) {
    progress = 0
  } else if (progress > 100) {
    progress = 100
  }

  // 更新数据和显示
  formData.progress = progress
  progressDisplayValue.value = progress.toString()
}

// 处理进度输入框聚焦（选中全部文本）
const handleProgressInputFocus = (event: Event) => {
  const target = event.target as HTMLInputElement
  // 延迟选中，确保聚焦完成
  setTimeout(() => {
    target.select()
  }, 0)
}

// 处理键盘事件
const handleProgressKeydown = (event: KeyboardEvent) => {
  const key = event.key

  // 允许的按键：数字、退格、删除、方向键、Tab等
  const allowedKeys = [
    'Backspace',
    'Delete',
    'Tab',
    'Escape',
    'Enter',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'Control',
    'Meta',
    'Alt',
    'Shift',
  ]

  // 允许数字
  const isNumber = /^\d$/.test(key)
  const isAllowedKey = allowedKeys.includes(key)

  // 如果是Ctrl+A、Ctrl+C、Ctrl+V、Ctrl+X等组合键，允许通过
  if (event.ctrlKey || event.metaKey) {
    return
  }

  // 如果不是允许的按键或数字，阻止输入
  if (!isNumber && !isAllowedKey) {
    event.preventDefault()
  }
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
      } else if (props.task && !props.isEdit) {
        // 新建模式，自动绑定上级任务
        formData.parentId = props.task.parentId ?? undefined
        // 新建模式，自动绑定前置任务
        formData.predecessor = props.task.predecessor ?? []
      }
      // 抽屉显示时重新请求任务数据，确保前置任务列表是最新的
      window.dispatchEvent(new CustomEvent('request-task-list'))
    }
  }
)

// 监听 isVisible 变化，同步到父组件
watch(isVisible, newVal => {
  emit('update:visible', newVal)
})

// 监听 task 变化，同步更新 parentId
watch(
  () => props.task,
  newTask => {
    if (newTask && !props.isEdit) {
      // 新建时，确保 parentId 与传入的 parentId 同步
      formData.parentId = newTask.parentId ?? undefined
    }
  },
  { immediate: true }
)

// 重置表单
const resetForm = () => {
  Object.assign(formData, {
    name: '',
    type: 'task',
    assignee: '',
    startDate: '',
    endDate: '',
    predecessor: [],
    estimatedHours: 0,
    actualHours: 0,
    progress: 0,
    description: '',
    parentId: undefined,
    isTimerRunning: false,
    timerStartTime: undefined,
    timerEndTime: undefined,
    timerElapsedTime: 0,
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
    handleClose()
  } catch (error) {
    // 处理错误但不在控制台输出
  } finally {
    submitting.value = false
  }
}

// 删除任务
const handleDelete = () => {
  showDeleteConfirm.value = true
}

const handleError = (error: unknown) => {
  let msg = ''
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    msg = (error as { message: string }).message
  } else {
    msg = String(error)
  }
  showMessage(msg, 'error', { closable: true })
}

const confirmDelete = () => {
  showDeleteConfirm.value = false
  if (props.task && props.isEdit) {
    try {
      submitting.value = true
      emit('delete', props.task)
      handleClose()
    } catch (error) {
      handleError(error)
    } finally {
      submitting.value = false
    }
  }
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
}

// Story删除：选择"是" - 删除story及其所有子任务
const handleDeleteYes = () => {
  showDeleteConfirm.value = false
  if (props.task && props.isEdit) {
    try {
      submitting.value = true
      emit('delete', props.task, true) // 传递true表示删除所有子任务
      handleClose()
    } catch (error) {
      handleError(error)
    } finally {
      submitting.value = false
    }
  }
}

// Story删除：选择"否" - 仅删除story，保留子任务
const handleDeleteNo = () => {
  showDeleteConfirm.value = false
  if (props.task && props.isEdit) {
    try {
      submitting.value = true
      emit('delete', props.task, false) // 传递false表示仅删除story
      handleClose()
    } catch (error) {
      handleError(error)
    } finally {
      submitting.value = false
    }
  }
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

// 监听 formData.progress 变化，同步更新显示值
watch(
  () => formData.progress,
  newValue => {
    progressDisplayValue.value = (newValue || 0).toString()
  },
  { immediate: true }
)

// 修正计时器首次启动不跳动问题：每次打开抽屉时重置 timerElapsed，且 timerStartTime 为空时立即赋值
watch(
  () => props.visible,
  visible => {
    if (visible && props.task && props.task.type !== 'story') {
      timerElapsed.value = props.task.timerElapsedTime || 0
      // 若计时器未启动，重置本地interval
      if (!props.task.isTimerRunning) {
        if (timerInterval.value) {
          clearInterval(timerInterval.value)
          timerInterval.value = null
        }
      }
    }
  },
  { immediate: true }
)

const handleStartTimer = (desc?: string) => {
  const now = Date.now()
  if (props.task && typeof props.task === 'object') {
    Object.assign(props.task, {
      timerStartTime: now,
      isTimerRunning: true,
      timerElapsedTime: 0, // 每次从0秒开始
      timerStartDesc: desc || '',
    })
    emit('start-timer', props.task)
  }
  timerElapsed.value = 0 // 启动时重置本地计时器
  localTimerRunning.value = true
  updateTimer()
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
    timerInterval.value = null
  }
  window.dispatchEvent(new CustomEvent('start-timer', { detail: props.task }))
}
const handleStopTimer = () => {
  if (props.task && typeof props.task === 'object') {
    emit('stop-timer', props.task)
  }
  localTimerRunning.value = false
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
    timerInterval.value = null
  }
  updateTimer()
  window.dispatchEvent(new CustomEvent('stop-timer', { detail: props.task }))
}

// 计时器确认弹窗
const showTimerConfirm = ref(false)
const timerDesc = ref('')

function openTimerConfirm() {
  timerDesc.value = props.task?.name || ''
  showTimerConfirm.value = true
}
function cancelTimerConfirm() {
  showTimerConfirm.value = false
}
function confirmTimer(desc: string) {
  showTimerConfirm.value = false
  // desc 可用于后续业务
  handleStartTimer(desc)
}
</script>

<template>
  <div v-if="isVisible" class="drawer-overlay" @click="handleOverlayClick">
    <div class="drawer-container" @click.stop>
      <!-- Drawer Header -->
      <div
        class="drawer-header"
        style="display: flex; align-items: center; justify-content: flex-start; gap: 8px"
      >
        <h3 class="drawer-title" style="margin: 0">{{ isEdit ? t.editTask : t.newTask }}</h3>
        <div
          v-if="props.task?.type !== 'story' && isEdit"
          class="drawer-timer"
          style="display: flex; align-items: center; gap: 6px; margin-left: 8px"
        >
          <button
            v-if="!localTimerRunning"
            class="timer-btn start minimal"
            title="开始计时"
            style="
              width: 24px;
              height: 24px;
              background: #4caf50;
              border: none;
              padding: 0;
              margin: 0;
              box-shadow: none;
              cursor: pointer;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: background 0.2s;
            "
            @click.stop="openTimerConfirm"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style="display: block; margin: 0 auto"
            >
              <circle cx="12" cy="12" r="11" stroke="#4caf50" stroke-width="2" fill="#4caf50" />
              <polygon points="9,7 18,12 9,17" fill="#fff" />
            </svg>
          </button>
          <button
            v-else
            class="timer-btn stop minimal"
            title="停止计时"
            style="
              width: 24px;
              height: 24px;
              background: #f44336;
              border: none;
              padding: 0;
              margin: 0;
              box-shadow: none;
              cursor: pointer;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: background 0.2s;
            "
            @click.stop="handleStopTimer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" stroke="#f44336" stroke-width="2" fill="#f44336" />
              <rect x="7" y="7" width="10" height="10" fill="#fff" rx="1.5" />
            </svg>
          </button>
          <span
            v-if="localTimerRunning"
            class="timer-badge"
            :class="{ 'timer-active': localTimerRunning }"
            style="
              margin-left: 8px;
              font-size: 13px;
              font-weight: 700;
              padding: 2px 10px;
              border-radius: 10px;
              background: #fffbe6;
              color: #e6a23c;
              box-shadow: 0 0 0 1px #ffe58f;
              display: inline-flex;
              align-items: center;
              min-width: 80px;
              justify-content: center;
            "
          >
            <span
              v-if="localTimerRunning"
              class="timer-dot"
              style="
                background: #67c23a;
                width: 7px;
                height: 7px;
                border-radius: 50%;
                margin-right: 5px;
                animation: pulse 1s infinite;
              "
            ></span>
            {{ formattedTimer }}
          </span>
        </div>
        <div style="flex: 1"></div>
        <button class="drawer-close-btn" type="button" @click="handleClose">
          <svg
            class="close-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            style="vertical-align: middle"
          >
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
              <option value="">{{ t.selectAssignee }}</option>
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

          <MultiSelectPredecessor
            v-model="formData.predecessor"
            :tasks="allTasks"
            :current-task-id="props.task?.id"
            :label="t.predecessor"
            :placeholder="t.predecessorPlaceholder"
          />

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
                :style="progressSliderStyle"
                min="0"
                max="100"
                step="5"
              />
              <div class="progress-input-group">
                <input
                  v-model="progressDisplayValue"
                  type="text"
                  class="progress-input"
                  placeholder="0"
                  maxlength="3"
                  @blur="handleProgressInputBlur"
                  @keyup.enter="handleProgressInputBlur"
                  @input="handleProgressInput"
                  @focus="handleProgressInputFocus"
                  @keydown="handleProgressKeydown"
                />
                <span class="progress-unit">%</span>
              </div>
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
            :type="dialogType"
            :message="dialogMessage"
            :confirm-text="t.confirm"
            :cancel-text="t.cancel"
            :yes-text="t.storyDeleteYes"
            :no-text="t.storyDeleteNo"
            @confirm="confirmDelete"
            @yes="handleDeleteYes"
            @no="handleDeleteNo"
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

  <!-- 计时器确认弹窗 -->
  <ConfirmTimerDialog
    v-if="showTimerConfirm"
    :visible="showTimerConfirm"
    :title="'确认开始计时'"
    :message="`即将为任务${props.task?.name}计时，若有特殊说明请完善下面的描述`"
    :default-desc="props.task?.name || ''"
    @confirm="confirmTimer"
    @cancel="cancelTimerConfirm"
  />
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
  position: relative;
  /* 确保input元素本身垂直居中 */
  vertical-align: middle;
}

/* 移除悬停时的高度变化动画，避免抖动 */

/* WebKit 浏览器的已完成部分样式 */
.progress-slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(
    to right,
    var(--gantt-primary, #409eff) 0%,
    var(--gantt-primary, #409eff) var(--progress-percent, 0%),
    var(--gantt-border-light, #e4e7ed) var(--progress-percent, 0%),
    var(--gantt-border-light, #e4e7ed) 100%
  );
}

/* Firefox 浏览器的已完成部分样式 */
.progress-slider::-moz-range-track {
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(
    to right,
    var(--gantt-primary, #409eff) 0%,
    var(--gantt-primary, #409eff) var(--progress-percent, 0%),
    var(--gantt-border-light, #e4e7ed) var(--progress-percent, 0%),
    var(--gantt-border-light, #e4e7ed) 100%
  );
  border: none;
}

/* Firefox 需要额外重置，确保轨道居中 */
.progress-slider::-moz-range-progress {
  height: 6px;
  border-radius: 3px;
  background: var(--gantt-primary, #409eff);
}

/* 为更好的兼容性，添加一个伪元素来显示已完成部分 */
.progress-slider::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  height: 6px;
  width: var(--progress-percent, 0%);
  background: var(--gantt-primary, #409eff);
  border-radius: 3px;
  pointer-events: none;
  transition: width 0.2s ease; /* 只保留宽度变化的过渡效果 */
}

/* 移除悬停时的高度变化，避免抖动 */

.progress-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--gantt-primary, #409eff);
  cursor: pointer;
  position: relative;
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease; /* 只保留阴影过渡效果 */
  margin-top: -5px; /* 将滑块向上偏移，使其垂直居中 */
}

.progress-slider::-webkit-slider-thumb:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.progress-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--gantt-primary, #409eff);
  cursor: pointer;
  border: none;
  position: relative;
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease; /* 只保留阴影过渡效果 */
  margin-top: -5px; /* 将滑块向上偏移，使其垂直居中 */
}

.progress-slider::-moz-range-thumb:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

/* 移除悬停和聚焦状态下的滑块位置调整，保持一致 */

/* 进度输入组样式 */
.progress-input-group {
  display: flex;
  align-items: center;
  border: 1px solid var(--gantt-border-medium, #dcdfe6);
  border-radius: 4px;
  background: var(--gantt-bg-primary, white);
  overflow: hidden;
  transition: border-color 0.2s ease;
  width: 70px; /* 固定宽度，保持紧凑 */
}

.progress-input-group:hover {
  border-color: var(--gantt-primary, #409eff);
}

.progress-input-group:focus-within {
  border-color: var(--gantt-primary, #409eff);
}

/* 进度输入框样式 - 与其他input保持一致 */
.progress-input {
  flex: 1;
  font-size: 14px;
  color: var(--gantt-text-primary, #303133);
  text-align: center;
  border: none;
  outline: none;
  background: transparent;
  padding: 12px 8px; /* 与其他input的padding保持一致 */
  min-width: 0; /* 允许收缩 */
}

.progress-input::placeholder {
  color: var(--gantt-text-placeholder, #c0c4cc);
}

/* 百分号单位样式 */
.progress-unit {
  font-size: 14px;
  color: var(--gantt-text-secondary, #606266);
  padding: 12px 12px 12px 4px; /* 与input的padding匹配 */
  user-select: none;
  flex-shrink: 0; /* 防止%号被压缩 */
}

/* 暗黑模式样式 */
:global(html[data-theme='dark']) .progress-input-group {
  border-color: var(--gantt-border-medium, #4c4d4f);
  background: var(--gantt-bg-primary, #2b2b2b);
}

:global(html[data-theme='dark']) .progress-input-group:hover {
  border-color: var(--gantt-primary, #409eff);
}

:global(html[data-theme='dark']) .progress-input-group:focus-within {
  border-color: var(--gantt-primary, #409eff);
}

:global(html[data-theme='dark']) .progress-input {
  color: var(--gantt-text-primary, #e5eaf3);
  background: transparent;
}

:global(html[data-theme='dark']) .progress-input::placeholder {
  color: var(--gantt-text-placeholder, #8b949e);
}

:global(html[data-theme='dark']) .progress-unit {
  color: var(--gantt-text-secondary, #a8a8a8);
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

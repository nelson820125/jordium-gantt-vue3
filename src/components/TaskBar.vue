<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted, nextTick, watch } from 'vue'
import type { Task } from '../models/classes/Task'

interface Props {
  task: Task
  rowHeight: number
  dayWidth: number
  startDate: Date
  isParent?: boolean
  onDoubleClick?: (task: Task) => void
}

const props = defineProps<Props>()

const emit = defineEmits([
  'update:task',
  'bar-mounted',
  'dblclick',
  'drag-end', // 新增
  'resize-end', // 新增
])

// 日期工具函数 - 处理时区安全的日期创建和操作
const createLocalDate = (dateString: string | Date | undefined | null): Date | null => {
  if (!dateString) return null
  if (dateString instanceof Date) {
    return dateString
  }
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  const d = new Date(dateString)
  return isNaN(d.getTime()) ? null : d
}

const createLocalToday = (): Date => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const formatDateToLocalString = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDaysToLocalDate = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// 拖拽状态
const isDragging = ref(false)
const isResizingLeft = ref(false)
const isResizingRight = ref(false)
const dragStartX = ref(0)
const dragStartLeft = ref(0)
const dragStartWidth = ref(0)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)
const resizeStartLeft = ref(0)

// 缓存拖拽/拉伸过程中的临时数据，只在鼠标抬起时提交更新
const tempTaskData = ref<{
  startDate?: string
  endDate?: string
} | null>(null)

const barRef = ref<HTMLElement | null>(null)

// 计算任务条位置和宽度
const taskBarStyle = computed(() => {
  const currentStartDate = tempTaskData.value?.startDate || props.task.startDate
  const currentEndDate = tempTaskData.value?.endDate || props.task.endDate

  const startDate = createLocalDate(currentStartDate)
  const endDate = createLocalDate(currentEndDate)
  const baseStart = createLocalDate(props.startDate)
  if (!startDate || !endDate || !baseStart) {
    return {
      left: '0px',
      width: '0px',
      height: `${props.rowHeight - 10}px`,
      top: '4px',
    }
  }
  const startDiff = Math.floor((startDate.getTime() - baseStart.getTime()) / (1000 * 60 * 60 * 24))
  const duration = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

  return {
    left: `${startDiff * props.dayWidth}px`,
    width: `${duration * props.dayWidth}px`,
    height: `${props.rowHeight - 10}px`,
    top: '4px',
  }
})

// 计算任务状态和颜色
const taskStatus = computed(() => {
  // 父级任务(Story类型)使用与新建按钮一致的配色
  if (props.isParent) {
    return {
      type: 'parent',
      color: '#409eff', // 与新建按钮一致的蓝色
      bgColor: '#409eff',
      borderColor: '#409eff',
    }
  }

  const today = createLocalToday()
  const endDate = createLocalDate(props.task.endDate || '')
  const progress = props.task.progress || 0

  // 已完成
  if (progress >= 100) {
    return {
      type: 'completed',
      color: '#909399', // info color
      bgColor: '#f4f4f5',
      borderColor: '#d3d4d6',
    }
  }

  // 已延迟（结束日期早于今天且未完成）
  if (endDate && endDate < today && progress < 100) {
    return {
      type: 'delayed',
      color: '#f56c6c', // danger color
      bgColor: '#fef0f0',
      borderColor: '#fbc4c4',
    }
  }

  // 进行中（结束日期晚于今天且进度>0）
  if (endDate && endDate >= today && progress > 0) {
    return {
      type: 'in-progress',
      color: '#e6a23c', // warning color
      bgColor: '#fdf6ec',
      borderColor: '#f5dab1',
    }
  }

  // 未开始（进度为0且未延迟）
  return {
    type: 'not-started',
    color: '#409eff', // primary color
    bgColor: '#ecf5ff',
    borderColor: '#b3d8ff',
  }
})

// 判断是否已完成
const isCompleted = computed(() => {
  return (props.task.progress || 0) >= 100
})

// 计算完成部分的宽度
const progressWidth = computed(() => {
  const progress = props.task.progress || 0
  const totalWidth = parseInt(taskBarStyle.value.width)
  return `${(progress / 100) * totalWidth}px`
})

// 鼠标事件处理
const handleMouseDown = (e: MouseEvent, type: 'drag' | 'resize-left' | 'resize-right') => {
  // 如果已完成或是父级任务，禁用所有交互
  if (isCompleted.value || props.isParent) {
    return
  }

  e.preventDefault()
  e.stopPropagation()

  // 清空之前的临时数据
  tempTaskData.value = null

  if (type === 'drag') {
    isDragging.value = true
    dragStartX.value = e.clientX
    dragStartLeft.value = parseInt(taskBarStyle.value.left)
    dragStartWidth.value = parseInt(taskBarStyle.value.width)
  } else if (type === 'resize-left') {
    isResizingLeft.value = true
    resizeStartX.value = e.clientX
    resizeStartWidth.value = parseInt(taskBarStyle.value.width)
    resizeStartLeft.value = parseInt(taskBarStyle.value.left)
  } else if (type === 'resize-right') {
    isResizingRight.value = true
    resizeStartX.value = e.clientX
    resizeStartWidth.value = parseInt(taskBarStyle.value.width)
    resizeStartLeft.value = parseInt(taskBarStyle.value.left)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function reportBarPosition() {
  if (barRef.value) {
    const rect = barRef.value.getBoundingClientRect()
    emit('bar-mounted', {
      id: props.task.id,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    })
  }
}

const handleMouseMove = (e: MouseEvent) => {
  if (isDragging.value) {
    const deltaX = e.clientX - dragStartX.value
    const newLeft = Math.max(0, dragStartLeft.value + deltaX)
    const newStartDate = addDaysToLocalDate(props.startDate, newLeft / props.dayWidth)
    const duration = dragStartWidth.value / props.dayWidth
    const newEndDate = addDaysToLocalDate(newStartDate, duration - 1)

    // 只更新临时数据，不触发事件
    tempTaskData.value = {
      startDate: formatDateToLocalString(newStartDate),
      endDate: formatDateToLocalString(newEndDate),
    }
  } else if (isResizingLeft.value) {
    const deltaX = e.clientX - resizeStartX.value
    const newLeft = Math.max(0, resizeStartLeft.value + deltaX)
    const newStartDate = addDaysToLocalDate(props.startDate, newLeft / props.dayWidth)

    // 只更新临时数据，不触发事件
    tempTaskData.value = {
      startDate: formatDateToLocalString(newStartDate),
      endDate: props.task.endDate, // 保持原来的结束日期
    }
  } else if (isResizingRight.value) {
    const deltaX = e.clientX - resizeStartX.value
    const newWidth = Math.max(props.dayWidth, resizeStartWidth.value + deltaX)
    const newDurationDays = newWidth / props.dayWidth
    const newEndDate = addDaysToLocalDate(
      props.startDate,
      resizeStartLeft.value / props.dayWidth + newDurationDays - 1,
    )

    // 只更新临时数据，不触发事件
    tempTaskData.value = {
      startDate: props.task.startDate, // 保持原来的开始日期
      endDate: formatDateToLocalString(newEndDate),
    }
  }
}

const handleMouseUp = () => {
  // 如果有临时数据，说明发生了拖拽或拉伸，提交数据更新
  if (tempTaskData.value) {
    const updatedTask = {
      ...props.task,
      ...tempTaskData.value,
    }

    // 判断是拖拽还是拉伸
    if (isDragging.value) {
      emit('drag-end', updatedTask)
    } else if (isResizingLeft.value || isResizingRight.value) {
      emit('resize-end', updatedTask)
    }
    emit('update:task', updatedTask)

    // 清空临时数据
    tempTaskData.value = null

    // 下一帧报告新位置
    nextTick(() => {
      reportBarPosition()
    })
  }

  isDragging.value = false
  isResizingLeft.value = false
  isResizingRight.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

onMounted(() => {
  nextTick(() => {
    reportBarPosition()
  })
})

// 监听任务数据变化，重新报告位置
watch(
  () => [props.task.startDate, props.task.endDate],
  () => {
    nextTick(() => {
      reportBarPosition()
    })
  },
  { deep: true },
)

// 处理TaskBar双击事件
const handleTaskBarDoubleClick = (e: MouseEvent) => {
  // 阻止事件冒泡，避免触发拖拽等其他事件
  e.stopPropagation()

  // 如果正在拖拽或调整大小，不触发双击事件
  if (isDragging.value || isResizingLeft.value || isResizingRight.value) {
    return
  }

  // 优先调用外部传入的双击处理器
  if (props.onDoubleClick && typeof props.onDoubleClick === 'function') {
    props.onDoubleClick(props.task)
  } else {
    // 默认行为：发出双击事件给父组件
    emit('dblclick', props.task)
  }
}

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<template>
  <div
    ref="barRef"
    class="task-bar"
    :style="{
      ...taskBarStyle,
      backgroundColor: taskStatus.bgColor,
      borderColor: taskStatus.borderColor,
      color: taskStatus.color,
      cursor: isCompleted || isParent ? 'default' : 'move',
    }"
    :class="{
      dragging: isDragging,
      resizing: isResizingLeft || isResizingRight,
      completed: isCompleted,
      'parent-task': isParent,
    }"
    @dblclick="handleTaskBarDoubleClick"
  >
    <!-- 父级任务的标签 -->
    <div v-if="isParent" class="parent-label">{{ task.name }} ({{ task.progress || 0 }}%)</div>

    <!-- 完成进度条（非父级任务） -->
    <div
      v-if="!isParent && task.progress && task.progress > 0"
      class="progress-bar"
      :style="{
        width: progressWidth,
        backgroundColor: taskStatus.color,
      }"
    ></div>

    <!-- 左侧调整把手 -->
    <div
      v-if="!isCompleted && !isParent"
      class="resize-handle resize-handle-left"
      @mousedown="e => handleMouseDown(e, 'resize-left')"
    ></div>

    <!-- 任务条主体（非父级任务） -->
    <div v-if="!isParent" class="task-bar-content" @mousedown="e => handleMouseDown(e, 'drag')">
      <div class="task-name">{{ task.name }}</div>
      <div v-if="task.progress !== undefined" class="task-progress">{{ task.progress }}%</div>
    </div>

    <!-- 右侧调整把手 -->
    <div
      v-if="!isCompleted && !isParent"
      class="resize-handle resize-handle-right"
      @mousedown="e => handleMouseDown(e, 'resize-right')"
    ></div>
  </div>
</template>

<style scoped>
.task-bar {
  position: absolute;
  border-radius: 4px;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.2s;
  min-width: 60px;
  z-index: 100;
  border: 2px solid;
  overflow: hidden;
}

.task-bar:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  cursor: pointer;
}

.task-bar.completed {
  cursor: pointer !important;
}

.task-bar.completed:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
}

.task-bar.dragging {
  opacity: 0.8;
  z-index: 1000;
}

.task-bar.resizing {
  z-index: 1000;
}

.task-bar.parent-task {
  position: relative;
  border-radius: 0; /* 移除圆角，使用线性设计 */
  margin-bottom: 20px; /* 为标签和垂直线留出空间 */
  height: 10px !important; /* 降低高度，让条更细 */
  border: none; /* 移除边框 */
  background: #409eff !important; /* 与新建按钮一致的蓝色 */
  box-shadow: none; /* 移除阴影 */
  top: 50% !important; /* 上下居中 */
  transform: translateY(-50%); /* 上下居中 */
  cursor: pointer !important; /* 允许双击编辑 */
  overflow: visible; /* 确保伪元素可见 */
}

/* 父级任务的标签 */
.task-bar.parent-task .parent-label {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  background: #409eff; /* 与新建按钮一致的蓝色 */
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  z-index: 20;
}

/* 左侧向下箭头 - 更尖 */
.task-bar.parent-task::before {
  content: '';
  position: absolute;
  top: 10px; /* 位于进度条下方 */
  left: 0;
  width: 0;
  height: 0;
  border-right: 6px solid transparent; /* 减小宽度，让箭头更尖 */
  border-top: 10px solid #409eff; /* 与新建按钮一致的蓝色 */
  z-index: 15;
}

/* 右侧向下箭头 - 更尖 */
.task-bar.parent-task::after {
  content: '';
  position: absolute;
  top: 10px; /* 位于进度条下方 */
  right: 0;
  width: 0;
  height: 0;
  border-left: 6px solid transparent; /* 减小宽度，让箭头更尖 */
  border-top: 10px solid #409eff; /* 与新建按钮一致的蓝色 */
  z-index: 15;
}

.progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  opacity: 0.3;
  transition: width 0.3s ease;
}

.task-bar-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.task-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: 1.2;
}

.task-progress {
  opacity: 0.9;
  margin-top: 2px;
}

.resize-handle {
  position: absolute;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: ew-resize;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  transition: background 0.2s;
  z-index: 2;
}

.resize-handle:hover {
  background: rgba(0, 0, 0, 0.2);
}

.resize-handle-left {
  left: 0;
}

.resize-handle-right {
  right: 0;
}

/* 暗色主题支持 */
:global(html[data-theme='dark']) .task-bar {
  border-color: #111827 !important;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.7),
    0 2px 4px rgba(0, 0, 0, 0.3) !important;
}

:global(html[data-theme='dark']) .task-bar:hover {
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.8),
    0 4px 8px rgba(0, 0, 0, 0.4) !important;
  transform: translateY(-2px);
  transition: all 0.2s ease;
}

:global(html[data-theme='dark']) .task-bar:hover::after {
  background: rgba(7, 10, 15, 0.98) !important;
  color: #f9fafb !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6) !important;
}

:global(html[data-theme='dark']) .task-bar.normal {
  background: linear-gradient(135deg, #1e40af, #1e3a8a) !important;
  border-color: #1e3a8a !important;
}

:global(html[data-theme='dark']) .task-bar.milestone {
  background: linear-gradient(135deg, #c2410c, #9a3412) !important;
  border-color: #9a3412 !important;
}

:global(html[data-theme='dark']) .task-bar.completed {
  background: linear-gradient(135deg, #14532d, #16a34a) !important;
  border-color: #14532d !important;
}

:global(html[data-theme='dark']) .task-bar.delayed {
  background: linear-gradient(135deg, #991b1b, #dc2626) !important;
  border-color: #991b1b !important;
}

:global(html[data-theme='dark']) .task-bar.parent {
  background: linear-gradient(135deg, #581c87, #7c3aed) !important;
  border-color: #581c87 !important;
}

:global(html[data-theme='dark']) .task-content {
  color: #ffffff !important;
}

:global(html[data-theme='dark']) .task-name {
  color: #ffffff !important;
}

:global(html[data-theme='dark']) .progress-bar {
  background: rgba(255, 255, 255, 0.2) !important;
}

:global(html[data-theme='dark']) .progress-fill {
  background: rgba(255, 255, 255, 0.8) !important;
}

:global(html[data-theme='dark']) .resize-handle {
  background: rgba(255, 255, 255, 0.1) !important;
}

:global(html[data-theme='dark']) .resize-handle:hover {
  background: rgba(255, 255, 255, 0.3) !important;
}
</style>

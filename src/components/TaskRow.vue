<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useI18n } from '../composables/useI18n'
import { formatPredecessorDisplay } from '../utils/predecessorUtils'
import type { Task } from '../models/classes/Task'
import TaskContextMenu from './TaskContextMenu.vue'

interface Props {
  task: Task
  level: number
  onDoubleClick?: (task: Task) => void
  isHovered?: boolean
  hoveredTaskId?: number | null
  onHover?: (taskId: number | null) => void
}
const props = defineProps<Props>()
const emit = defineEmits([
  'toggle',
  'dblclick',
  'contextmenu',
  'start-timer',
  'stop-timer',
  'add-predecessor',
  'add-successor',
  'delete',
])
const { t } = useI18n()
const overtimeText = computed(() => t.value?.overtime ?? '')
const overdueText = computed(() => t.value?.overdue ?? '')
const daysText = computed(() => t.value?.days ?? '')

const baseIndent = 10
const indent = `${baseIndent + props.level * 20}px`
function handleToggle() {
  emit('toggle', props.task)
}

function handleRowClick() {
  // 如果是普通父级任务（story类型或有子任务的任务，非里程碑分组），点击行也可以展开/收起
  if (
    (props.task.type === 'story' || (props.task.children && props.task.children.length > 0)) &&
    props.task.type !== 'milestone-group'
  ) {
    emit('toggle', props.task)
  }
}

// 处理TaskRow双击事件 (与TaskBar逻辑保持一致)
const handleTaskRowDoubleClick = (e: MouseEvent) => {
  // 阻止事件冒泡
  e.stopPropagation()

  // 优先调用外部传入的双击处理器
  if (props.onDoubleClick && typeof props.onDoubleClick === 'function') {
    props.onDoubleClick(props.task)
  } else {
    // 默认行为：发出双击事件给父组件
    emit('dblclick', props.task)
  }
}

// 处理悬停事件
const handleMouseEnter = () => {
  // 如果正在拖拽Splitter，忽略悬停事件
  if (isSplitterDragging.value) return

  if (props.onHover) {
    props.onHover(props.task.id)
  }
}

const handleMouseLeave = () => {
  // 如果正在拖拽Splitter，忽略悬停事件
  if (isSplitterDragging.value) return

  if (props.onHover) {
    props.onHover(null)
  }
}

// 获取进度值的样式类
function getProgressClass() {
  const progress = props.task.progress || 0
  const today = new Date()
  const endDate = props.task.endDate ? new Date(props.task.endDate) : null

  // 超期且未完成
  if (endDate && today > endDate && progress < 100) {
    return 'progress-danger'
  }

  // 已完成
  if (progress >= 100) {
    return 'progress-success'
  }

  // 进行中
  if (progress > 0) {
    return 'progress-warning'
  }

  return ''
}

// 检查是否超时
function isOvertime() {
  return (
    props.task.actualHours &&
    props.task.estimatedHours &&
    props.task.actualHours > props.task.estimatedHours
  )
}

// 检查是否逾期，返回天数
function overdueDays() {
  const today = new Date()
  const endDate = props.task.endDate ? new Date(props.task.endDate) : null
  const progress = props.task.progress || 0
  if (endDate && today > endDate && progress < 100) {
    // 只计算日期部分
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const e = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
    const diff = Math.floor((t.getTime() - e.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }
  return 0
}

// 拖拽状态管理
const isSplitterDragging = ref(false)

// 处理拖拽开始事件
const handleSplitterDragStart = () => {
  isSplitterDragging.value = true
}

// 处理拖拽结束事件
const handleSplitterDragEnd = () => {
  isSplitterDragging.value = false
}

// 任务计时器状态
const timerElapsed = ref(0)
const timerInterval = ref<number | null>(null)

// 格式化计时器显示：转换为 HH:MM:SS 格式
const formattedTimer = computed(() => {
  const totalSeconds = Math.floor(timerElapsed.value / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

// 更新计时器显示
const updateTimer = () => {
  if (props.task.isTimerRunning && props.task.timerStartTime) {
    // 计算已经运行的时间 = 当前时间 - 开始时间 + 之前累积的时间
    const previousElapsed = props.task.timerElapsedTime || 0
    timerElapsed.value = Date.now() - props.task.timerStartTime + previousElapsed
  } else if (props.task.timerElapsedTime) {
    // 如果任务不在运行中，但有累计时间，显示累计时间
    timerElapsed.value = props.task.timerElapsedTime
  } else {
    // 默认情况下，计时器为0
    timerElapsed.value = 0
  }
}

// 监听任务的计时状态变化
watch(
  () => [props.task.isTimerRunning, props.task.timerStartTime, props.task.timerElapsedTime],
  () => {
    // 清除之前的计时器
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    // 如果任务正在计时，开始计时器
    if (props.task.isTimerRunning) {
      updateTimer()
      timerInterval.value = window.setInterval(updateTimer, 1000)
    } else {
      // 更新一次最终值
      updateTimer()
    }
  },
  { immediate: true },
)

// 右键菜单相关状态
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuTask = computed(() => props.task)

// 处理右键菜单显示
function handleContextMenu(event: MouseEvent) {
  // 先广播关闭所有TaskRow菜单
  window.dispatchEvent(new CustomEvent('close-all-taskbar-menus'))
  if (props.task.type !== 'task' && props.task.type !== 'story') {
    // 为了排除里程碑类型
    event.preventDefault()
    contextMenuVisible.value = false
    return
  }
  event.preventDefault()
  contextMenuVisible.value = true
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
}

// 关闭右键菜单
function closeContextMenu() {
  contextMenuVisible.value = false
}

const handleTaskDelete = (task: Task, deleteChildren?: boolean) => {
  // 触发删除事件
  emit('delete', task, deleteChildren)
  closeContextMenu()
}

// 生命周期钩子 - 注册事件监听器
onMounted(() => {
  window.addEventListener('splitter-drag-start', handleSplitterDragStart)
  window.addEventListener('splitter-drag-end', handleSplitterDragEnd)
  window.addEventListener('close-all-taskbar-menus', closeContextMenu)
})

onUnmounted(() => {
  window.removeEventListener('splitter-drag-start', handleSplitterDragStart)
  window.removeEventListener('splitter-drag-end', handleSplitterDragEnd)
  window.removeEventListener('close-all-taskbar-menus', closeContextMenu)
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
  }
})
</script>

<template>
  <div>
    <div
      class="task-row"
      :class="{
        'task-row-hovered': isHovered,
        'parent-task':
          props.task.type === 'story' ||
          (props.task.children && props.task.children.length > 0) ||
          props.task.type === 'milestone-group',
        'milestone-group-row': props.task.type === 'milestone-group',
        'task-type-story': props.task.type === 'story',
        'task-type-task': props.task.type === 'task',
        'task-type-milestone': props.task.type === 'milestone',
      }"
      @click="handleRowClick"
      @dblclick="handleTaskRowDoubleClick"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @contextmenu="handleContextMenu"
    >
      <div class="col col-name" :style="{ paddingLeft: indent }">
        <span
          v-if="
            (props.task.type === 'story' ||
              (props.task.children && props.task.children.length > 0)) &&
            props.task.type !== 'milestone-group'
          "
          class="collapse-btn"
          @click.stop="handleToggle"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline v-if="props.task.collapsed" points="9,18 15,12 9,6" />
            <polyline v-else points="18,15 12,9 6,15" />
          </svg>
        </span>

        <!-- 里程碑分组的占位空间，用于与有折叠按钮的任务对齐 -->
        <span v-if="props.task.type === 'milestone-group'" class="milestone-spacer"></span>

        <!-- 任务图标 -->
        <span class="task-icon">
          <!-- 里程碑分组图标 - 使用菱形图标 -->
          <svg
            v-if="props.task.type === 'milestone-group'"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="milestone-group-icon"
          >
            <polygon points="12,2 22,12 12,22 2,12" />
          </svg>
          <!-- 父级任务图标 -->
          <svg
            v-else-if="
              props.task.type === 'story' || (props.task.children && props.task.children.length > 0)
            "
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <!-- 普通任务图标 -->
          <svg
            v-else
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10,9 9,9 8,9" />
          </svg>
        </span>

        <span
          class="task-name-text"
          :class="{
            'parent-task':
              props.task.type === 'story' ||
              (props.task.children && props.task.children.length > 0) ||
              props.task.type === 'milestone-group',
          }"
          :title="props.task.name"
        >
          {{ props.task.name }}
          <!-- 计时器显示 -->
          <span
            v-if="props.task.isTimerRunning || props.task.timerElapsedTime"
            class="timer-badge"
            :class="{ 'timer-active': props.task.isTimerRunning }"
          >
            <span v-if="props.task.isTimerRunning" class="timer-dot"></span>
            {{ formattedTimer }}
          </span>
          <span v-if="isOvertime()" class="status-badge overtime">{{ overtimeText }}</span>
          <span v-if="overdueDays() > 0" class="status-badge overdue">
            {{ overdueText }}{{ overdueDays() > 0 ? overdueDays() + daysText : '' }}
          </span>
        </span>
      </div>

      <!-- 里程碑分组不显示详细信息 -->
      <template v-if="props.task.type === 'milestone-group'">
        <div class="col col-pre milestone-empty-col"></div>
        <div class="col col-assignee milestone-empty-col"></div>
        <div class="col col-date milestone-empty-col"></div>
        <div class="col col-date milestone-empty-col"></div>
        <div class="col col-hours milestone-empty-col"></div>
        <div class="col col-hours milestone-empty-col"></div>
        <div class="col col-progress milestone-empty-col"></div>
      </template>

      <!-- 普通任务显示详细信息 -->
      <template v-else>
        <div class="col col-pre">{{ formatPredecessorDisplay(props.task.predecessor) }}</div>
        <div class="col col-assignee">
          <div class="assignee-info">
            <div class="avatar">
              {{ props.task.assignee ? props.task.assignee.charAt(0) : '-' }}
            </div>
            <span class="assignee-name">{{ props.task.assignee || '-' }}</span>
          </div>
        </div>
        <div class="col col-date">{{ props.task.startDate || '-' }}</div>
        <div class="col col-date">{{ props.task.endDate || '-' }}</div>
        <div class="col col-hours">{{ props.task.estimatedHours || '-' }}</div>
        <div class="col col-hours">{{ props.task.actualHours || '-' }}</div>
        <div class="col col-progress">
          <span class="progress-value" :class="getProgressClass()">
            {{ props.task.progress != null ? props.task.progress + '%' : '-' }}
          </span>
        </div>
      </template>
    </div>
    <template
      v-if="props.task.children && !props.task.collapsed && props.task.type !== 'milestone-group'"
    >
      <TaskRow
        v-for="child in props.task.children"
        :key="child.id"
        :task="child"
        :level="props.level + 1"
        :is-hovered="props.hoveredTaskId === child.id"
        :hovered-task-id="props.hoveredTaskId"
        :on-double-click="props.onDoubleClick"
        :on-hover="props.onHover"
        @toggle="emit('toggle', $event)"
        @dblclick="emit('dblclick', $event)"
        @start-timer="emit('start-timer', $event)"
        @stop-timer="emit('stop-timer', $event)"
        @add-predecessor="emit('add-predecessor', $event)"
        @add-successor="emit('add-successor', $event)"
        @delete="handleTaskDelete"
      />
    </template>

    <TaskContextMenu
      :visible="contextMenuVisible"
      :task="contextMenuTask"
      :position="contextMenuPosition"
      @close="closeContextMenu"
      @start-timer="$emit('start-timer', props.task)"
      @stop-timer="$emit('stop-timer', props.task)"
      @add-predecessor="$emit('add-predecessor', props.task)"
      @add-successor="$emit('add-successor', props.task)"
      @delete="handleTaskDelete"
    />
  </div>
</template>

<style scoped>
@import '../styles/theme-variables.css';

.task-row {
  display: flex;
  border-bottom: 1px solid var(--gantt-border-light);
  height: 50px;
  background: var(--gantt-bg-primary);
  align-items: center;
  color: var(--gantt-text-secondary);
  cursor: pointer;
  transition: all 0.3s ease;
  transform: scale(1);
  transform-origin: 5px center; /* 从左侧偏右5px的位置作为放大中心 */
  z-index: 1;
  position: relative;
}

.task-row:hover {
  background-color: var(--gantt-bg-hover);
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

.task-row-hovered {
  background-color: var(--gantt-bg-hover) !important;
  transform: scale(1.02) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  z-index: 10 !important;
}

.task-row.parent-task {
  background: var(--gantt-bg-tertiary);
  font-weight: 600;
}

.task-row.parent-task:hover {
  background: var(--gantt-bg-hover-parent, var(--gantt-bg-hover));
  transform: scale(1.02);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.task-row.parent-task.task-row-hovered {
  background: var(--gantt-bg-hover-parent, var(--gantt-bg-hover)) !important;
  transform: scale(1.02) !important;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2) !important;
  z-index: 10 !important;
}

/* 里程碑分组行特殊样式 - 使用红色边框 */
.milestone-group-row {
  border-left: 3px solid var(--gantt-danger, #f56c6c);
  background: linear-gradient(90deg, var(--gantt-bg-tertiary) 0%, var(--gantt-bg-primary) 100%);
}

.milestone-group-row:hover {
  background: linear-gradient(90deg, var(--gantt-bg-hover-parent) 0%, var(--gantt-bg-hover) 100%);
  transform: scale(1.02);
  box-shadow:
    0 6px 16px rgba(245, 108, 108, 0.3),
    0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
  border-left-color: var(--gantt-danger, #f56c6c);
  border-left-width: 4px; /* 悬停时边框稍微加粗 */
}

/* 任务类型左边框颜色 */
.task-type-story {
  border-left: 3px solid var(--gantt-primary, #409eff);
}

.task-type-task {
  border-left: 3px solid var(--gantt-warning, #e6a23c);
}

.task-type-milestone {
  border-left: 3px solid var(--gantt-danger, #f56c6c);
}

/* 任务类型悬停时保持并增强左边框 */
.task-type-story:hover {
  border-left: 5px solid var(--gantt-primary, #409eff);
}

.task-type-task:hover {
  border-left: 5px solid var(--gantt-warning, #e6a23c);
}

.task-type-milestone:hover {
  border-left: 5px solid var(--gantt-danger, #f56c6c);
}

/* 悬停状态下的左边框保持 */
.task-row-hovered.task-type-story {
  border-left: 5px solid var(--gantt-primary, #409eff) !important;
}

.task-row-hovered.task-type-task {
  border-left: 5px solid var(--gantt-warning, #e6a23c) !important;
}

.task-row-hovered.task-type-milestone {
  border-left: 5px solid var(--gantt-danger, #f56c6c) !important;
}

:global(html[data-theme='dark']) .milestone-group-row {
  border-left-color: var(--gantt-danger, #f67c7c);
}

/* 暗黑模式下的任务类型左边框颜色 */
:global(html[data-theme='dark']) .task-type-story {
  border-left-color: var(--gantt-primary, #7db4f0);
}

:global(html[data-theme='dark']) .task-type-task {
  border-left-color: var(--gantt-warning, #f0b83c);
}

:global(html[data-theme='dark']) .task-type-milestone {
  border-left-color: var(--gantt-danger, #f67c7c);
}

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

/* 里程碑分组占位空间 - 与折叠按钮对齐 */
.milestone-spacer {
  display: inline-flex;
  width: 18px;
  height: 18px;
  margin-right: 4px;
}

.col {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  border-right: 1px solid var(--gantt-border-light);
  box-sizing: border-box;
  overflow: hidden;
}

.col:last-child {
  border-right: none;
}

.col-name {
  flex: 2 0 300px;
  min-width: 300px;
  justify-content: flex-start;
}

.col-pre {
  flex: 1 0 120px;
  min-width: 120px;
}

.col-assignee {
  flex: 1 0 120px;
  min-width: 120px;
}

.col-date {
  flex: 1.2 0 140px;
  min-width: 140px;
}

.col-hours {
  flex: 1 0 100px;
  min-width: 100px;
}

.col-progress {
  flex: 1 0 100px;
  min-width: 100px;
}

.task-name-text {
  display: inline-block;
  max-width: calc(100% - 24px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.task-name-text.parent-task {
  font-weight: bold;
  color: var(--gantt-text-parent, var(--gantt-text-primary));
}

.task-icon {
  margin-right: 4px;
  color: var(--gantt-text-muted);
}

.task-icon svg {
  vertical-align: middle;
}

.assignee-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--gantt-primary);
  color: var(--gantt-text-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  border: 2px solid var(--gantt-border-medium);
  box-sizing: border-box;
}

.assignee-name {
  font-size: 14px;
  color: var(--gantt-text-secondary);
}

.progress-value {
  font-weight: 500;
  color: var(--gantt-text-secondary);
}

.progress-success {
  color: var(--gantt-success);
}

.progress-warning {
  color: var(--gantt-warning);
}

.progress-danger {
  color: var(--gantt-danger);
}

.status-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: bold;
  margin-left: 6px;
  color: white;
}

.status-badge.overtime {
  background-color: transparent;
  border: 1px solid var(--gantt-danger);
  color: var(--gantt-danger);
}

.status-badge.overdue {
  background-color: var(--gantt-danger);
}

/* 里程碑分组图标样式 - 统一使用红色并添加发光效果 */
.milestone-group-icon {
  color: var(--gantt-danger, #f56c6c);
  fill: var(--gantt-danger, #f56c6c);
  opacity: 0.9;
  filter: drop-shadow(0 0 6px var(--gantt-danger, #f56c6c));
  animation: milestone-icon-glow 2.5s ease-in-out infinite alternate;
}

/* 里程碑图标悬停效果 */
.task-row:hover .milestone-group-icon {
  filter: drop-shadow(0 0 10px var(--gantt-danger, #f56c6c))
    drop-shadow(0 0 16px rgba(245, 108, 108, 0.4));
  animation: milestone-icon-glow-intense 1.8s ease-in-out infinite alternate;
}

/* 里程碑图标发光动画 */
@keyframes milestone-icon-glow {
  from {
    filter: drop-shadow(0 0 3px var(--gantt-danger, #f56c6c));
  }
  to {
    filter: drop-shadow(0 0 8px var(--gantt-danger, #f56c6c))
      drop-shadow(0 0 12px rgba(245, 108, 108, 0.3));
  }
}

@keyframes milestone-icon-glow-intense {
  from {
    filter: drop-shadow(0 0 8px var(--gantt-danger, #f56c6c))
      drop-shadow(0 0 12px rgba(245, 108, 108, 0.3));
  }
  to {
    filter: drop-shadow(0 0 12px var(--gantt-danger, #f56c6c))
      drop-shadow(0 0 20px rgba(245, 108, 108, 0.5));
  }
}

/* 里程碑行样式 - 统一使用红色 */
.milestone-item-icon {
  color: var(--gantt-danger, #f56c6c);
}

.milestone-empty-col {
  color: var(--gantt-text-disabled, #c0c4cc);
  /* 确保边框颜色与普通数据行一致 */
  border-right-color: var(--gantt-border-light) !important;
}

.milestone-empty-col::after {
  content: '-';
}

/* 暗黑模式适配 */
:global(html[data-theme='dark']) .milestone-row-icon {
  color: var(--gantt-danger, #f67c7c);
}

/* 暗黑模式下的里程碑图标发光效果 */
:global(html[data-theme='dark']) .milestone-group-icon {
  color: var(--gantt-danger, #f67c7c);
  fill: var(--gantt-danger, #f67c7c);
  filter: drop-shadow(0 0 6px var(--gantt-danger, #f67c7c));
  animation: milestone-icon-glow-dark 2.5s ease-in-out infinite alternate;
}

:global(html[data-theme='dark']) .task-row:hover .milestone-group-icon {
  filter: drop-shadow(0 0 10px var(--gantt-danger, #f67c7c))
    drop-shadow(0 0 16px rgba(246, 124, 124, 0.4));
  animation: milestone-icon-glow-intense-dark 1.8s ease-in-out infinite alternate;
}

/* 暗黑模式发光动画 */
@keyframes milestone-icon-glow-dark {
  from {
    filter: drop-shadow(0 0 3px var(--gantt-danger, #f67c7c));
  }
  to {
    filter: drop-shadow(0 0 8px var(--gantt-danger, #f67c7c))
      drop-shadow(0 0 12px rgba(246, 124, 124, 0.3));
  }
}

@keyframes milestone-icon-glow-intense-dark {
  from {
    filter: drop-shadow(0 0 8px var(--gantt-danger, #f67c7c))
      drop-shadow(0 0 12px rgba(246, 124, 124, 0.3));
  }
  to {
    filter: drop-shadow(0 0 12px var(--gantt-danger, #f67c7c))
      drop-shadow(0 0 20px rgba(246, 124, 124, 0.5));
  }
}

:global(html[data-theme='dark']) .milestone-empty-col {
  color: var(--gantt-text-disabled, #606266);
  /* 确保暗黑模式下边框颜色与普通数据行一致 */
  border-right-color: var(--gantt-border-light) !important;
}

/* 暗黑模式的悬停效果 */
:global(html[data-theme='dark']) .task-row:hover {
  box-shadow:
    0 4px 12px rgba(255, 255, 255, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.3);
}

:global(html[data-theme='dark']) .task-row.task-row-hovered {
  background-color: var(--gantt-bg-hover) !important;
  box-shadow:
    0 4px 12px rgba(255, 255, 255, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.3) !important;
}

:global(html[data-theme='dark']) .task-row.parent-task:hover {
  box-shadow:
    0 6px 16px rgba(255, 255, 255, 0.15),
    0 2px 8px rgba(0, 0, 0, 0.4);
}

:global(html[data-theme='dark']) .task-row.parent-task.task-row-hovered {
  background: var(--gantt-bg-hover-parent) !important;
  box-shadow:
    0 6px 16px rgba(255, 255, 255, 0.15),
    0 2px 8px rgba(0, 0, 0, 0.4) !important;
}

:global(html[data-theme='dark']) .milestone-group-row:hover {
  box-shadow:
    0 6px 16px rgba(246, 124, 124, 0.4),
    0 2px 8px rgba(255, 255, 255, 0.1);
}

/* 计时器样式 */
.timer-badge {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 10px;
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--text-color-secondary);
}

.timer-badge.timer-active {
  color: #e6a23c;
}

.timer-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #67c23a; /* 绿色 */
  margin-right: 4px;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(0.8);
    opacity: 0.8;
  }
}

:global(html[data-theme='dark']) .timer-badge {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--text-color-secondary-dark);
}

:global(html[data-theme='dark']) .timer-badge.timer-active {
  color: #e6c07b;
}

:global(html[data-theme='dark']) .timer-dot {
  background-color: #85ce61; /* 暗色主题下的绿色 */
}
</style>

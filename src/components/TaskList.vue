<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import TaskRow from './TaskRow.vue'
import { useI18n } from '../composables/useI18n'
import type { Task } from '../models/classes/Task'

interface Props {
  tasks?: Task[]
  onTaskDoubleClick?: (task: Task) => void
  editComponent?: any
  useDefaultDrawer?: boolean
}

const props = defineProps<Props>()

// 定义emit事件
// const emit = defineEmits(['task-collapse-change', 'start-timer', 'stop-timer'])
// +'add-predecessor': [task: Task] // 新增：添加前置任务事件
//   'add-successor': [task: Task] // 新增：添加后置任务事件

const emit = defineEmits<{
  'task-collapse-change': [task: Task]
  'start-timer': [task: Task]
  'stop-timer': [task: Task]
  'add-predecessor': [task: Task] // 新增：添加前置任务事件
  'add-successor': [task: Task] // 新增：添加后置任务事件
  delete: [task: Task, deleteChildren?: boolean]
}>()

// 多语言支持
const { t } = useI18n()

// 内部响应式任务列表
const localTasks = ref<Task[]>([])

// 悬停状态管理
const hoveredTaskId = ref<number | null>(null)

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

// 处理任务行悬停事件
const handleTaskRowHover = (taskId: number | null) => {
  // 如果正在拖拽Splitter，则不响应悬停事件
  if (isSplitterDragging.value) {
    return
  }

  hoveredTaskId.value = taskId
  // 发送事件通知Timeline组件
  window.dispatchEvent(
    new CustomEvent('task-list-hover', {
      detail: taskId,
    }),
  )
}

// 监听Timeline的悬停事件
const handleTimelineHover = (event: CustomEvent) => {
  hoveredTaskId.value = event.detail
}

// 处理TaskRow双击事件 (与Timeline的逻辑保持一致)
const handleTaskRowDoubleClick = (task: Task) => {
  // 如果是里程碑类型，则不响应双击事件
  if (task.type === 'milestone' || task.type === 'milestone-group') {
    return
  }

  // 优先调用外部传入的双击处理器
  if (props.onTaskDoubleClick && typeof props.onTaskDoubleClick === 'function') {
    props.onTaskDoubleClick(task)
  } else if (props.useDefaultDrawer) {
    // 默认行为：发送到Timeline处理（通过全局事件）
    window.dispatchEvent(
      new CustomEvent('task-row-double-click', {
        detail: task,
      }),
    )
  }
}

// 计算父级任务的进度和日期范围
const calculateParentTaskData = (
  task: Task,
): { progress: number; startDate: string; endDate: string } => {
  if (!task.children || task.children.length === 0) {
    return {
      progress: task.progress || 0,
      startDate: task.startDate || '',
      endDate: task.endDate || '',
    }
  }

  // 递归计算所有子任务（包括折叠的子任务）
  const allChildTasks: Task[] = []
  const collectChildTasks = (tasks: Task[]) => {
    tasks.forEach(childTask => {
      allChildTasks.push(childTask)
      if (childTask.children && childTask.children.length > 0) {
        collectChildTasks(childTask.children)
      }
    })
  }
  collectChildTasks(task.children)

  // 计算进度：所有子任务进度的平均值
  const totalProgress = allChildTasks.reduce((sum, childTask) => {
    return sum + (childTask.progress || 0)
  }, 0)
  const averageProgress =
    allChildTasks.length > 0 ? Math.round(totalProgress / allChildTasks.length) : 0

  // 计算日期范围：最早开始日期和最晚结束日期
  const validTasks = allChildTasks.filter(childTask => childTask.startDate && childTask.endDate)
  if (validTasks.length === 0) {
    return {
      progress: averageProgress,
      startDate: task.startDate || '',
      endDate: task.endDate || '',
    }
  }

  const startDates = validTasks.map(childTask => new Date(childTask.startDate!))
  const endDates = validTasks.map(childTask => new Date(childTask.endDate!))

  const earliestStart = new Date(Math.min(...startDates.map(date => date.getTime())))
  const latestEnd = new Date(Math.max(...endDates.map(date => date.getTime())))

  return {
    progress: averageProgress,
    startDate: earliestStart.toISOString().split('T')[0],
    endDate: latestEnd.toISOString().split('T')[0],
  }
}

// 更新所有父级任务的进度和日期范围
const updateParentTasksData = () => {
  const updateParentTask = (taskList: Task[]): Task[] => {
    return taskList.map(task => {
      if (task.children && task.children.length > 0) {
        // 先更新子任务
        const updatedChildren = updateParentTask(task.children)

        // 计算父级任务的进度和日期范围
        const parentData = calculateParentTaskData({
          ...task,
          children: updatedChildren,
        })

        return {
          ...task,
          progress: parentData.progress,
          startDate: parentData.startDate,
          endDate: parentData.endDate,
          children: updatedChildren,
        }
      }
      return task
    })
  }

  localTasks.value = updateParentTask(localTasks.value)
}

// 获取所有任务的扁平化列表（包括子任务）
const getAllTasks = (taskList: Task[]): Task[] => {
  const allTasks: Task[] = []

  const collectTasks = (tasks: Task[]) => {
    tasks.forEach(task => {
      allTasks.push(task)
      if (task.children && task.children.length > 0) {
        collectTasks(task.children)
      }
    })
  }

  collectTasks(taskList)
  return allTasks
}

// 监听外部传入的 tasks 数据变化
watch(
  () => props.tasks,
  newTasks => {
    localTasks.value = newTasks || []
    // 更新父级任务数据
    updateParentTasksData()
  },
  { immediate: true, deep: true },
)

function toggleCollapse(task: Task) {
  task.collapsed = !task.collapsed

  // 触发自定义事件，通知父组件任务折叠状态变化
  emit('task-collapse-change', task)
}

// 更新任务数据
const updateTaskData = (updatedTask: Task) => {
  const updateTaskInTree = (taskList: Task[]): Task[] => {
    return taskList.map(task => {
      if (task.id === updatedTask.id) {
        return {
          ...task,
          ...updatedTask, // 完整更新所有字段
          children: task.children, // 保留子任务结构
        }
      }
      if (task.children) {
        return {
          ...task,
          children: updateTaskInTree(task.children),
        }
      }
      return task
    })
  }

  localTasks.value = updateTaskInTree(localTasks.value)

  // 更新父级任务的进度和日期范围
  updateParentTasksData()
}

// 监听TaskBar更新事件
const handleTaskUpdated = (event: CustomEvent) => {
  const updatedTask = event.detail
  updateTaskData(updatedTask)
}

// 监听Timeline的任务新增事件
const handleTaskAdded = (event: CustomEvent) => {
  const newTask = event.detail
  localTasks.value.push(newTask)

  // 更新父级任务数据
  updateParentTasksData()
}

// 监听 TaskDrawer 请求任务列表事件
const handleRequestTaskList = () => {
  // 获取所有任务的扁平化列表
  const allTasks = getAllTasks(localTasks.value)
  // 发送任务列表给 TaskDrawer
  window.dispatchEvent(
    new CustomEvent('task-list-updated', {
      detail: allTasks,
    }),
  )
}

// 处理里程碑图标变更事件
const handleMilestoneIconChange = (event: CustomEvent) => {
  const { milestoneId, icon } = event.detail

  // 递归更新里程碑图标
  const updateMilestoneIcon = (taskList: Task[]) => {
    for (const task of taskList) {
      if (task.type === 'milestone-group' && task.children) {
        const milestone = task.children.find(m => m.id === milestoneId)
        if (milestone) {
          milestone.icon = icon
          return true
        }
      }
      if (task.children && updateMilestoneIcon(task.children)) {
        return true
      }
    }
    return false
  }

  updateMilestoneIcon(localTasks.value)
}

// 垂直滚动同步处理
const handleTaskListScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target) return

  const scrollTop = target.scrollTop

  // 同步垂直滚动到Timeline
  window.dispatchEvent(
    new CustomEvent('task-list-vertical-scroll', {
      detail: { scrollTop },
    }),
  )
}

// 处理Timeline垂直滚动同步
const handleTimelineVerticalScroll = (event: CustomEvent) => {
  const { scrollTop } = event.detail
  const taskListBodyElement = document.querySelector('.task-list-body') as HTMLElement
  if (taskListBodyElement && taskListBodyElement.scrollTop !== scrollTop) {
    // 避免循环触发，只在scrollTop不同时才设置
    taskListBodyElement.scrollTop = scrollTop
  }
}

// 处理任务行右键菜单事件
const handleTaskRowContextMenu = (event: { task: Task; position: { x: number; y: number } }) => {
  // 直接从TaskRow触发全局事件，跳过TaskList中转
  // 将事件转发为全局事件，让GanttChart组件处理
  try {
    window.dispatchEvent(
      new CustomEvent('context-menu', {
        detail: event,
      }),
    )
  } catch (error) {
    console.error('TaskList - Failed to dispatch context-menu event', error)
  }
}

// 处理TaskRow计时事件向上传递
const handleStartTimer = (task: Task) => {
  emit('start-timer', task)
}
const handleStopTimer = (task: Task) => {
  emit('stop-timer', task)
}

// 处理添加前置任务事件
const handleAddPredecessor = (task: Task) => {
  emit('add-predecessor', task)
}

// 处理添加后置任务事件
const handleAddSuccessor = (task: Task) => {
  emit('add-successor', task)
}

const handleTaskDelete = (task: Task, deleteChildren?: boolean) => {
  // 触发删除事件
  emit('delete', task, deleteChildren)
}

onMounted(async () => {
  window.addEventListener('task-updated', handleTaskUpdated as EventListener)
  window.addEventListener('task-added', handleTaskAdded as EventListener)
  window.addEventListener('request-task-list', handleRequestTaskList as EventListener)
  window.addEventListener('timeline-task-hover', handleTimelineHover as EventListener)
  window.addEventListener('timeline-vertical-scroll', handleTimelineVerticalScroll as EventListener)
  window.addEventListener('milestone-icon-changed', handleMilestoneIconChange as EventListener)
  // 监听Splitter拖拽事件
  window.addEventListener('splitter-drag-start', handleSplitterDragStart as EventListener)
  window.addEventListener('splitter-drag-end', handleSplitterDragEnd as EventListener)

  // 初始化时计算父级任务的进度和日期范围
  updateParentTasksData()
})

onUnmounted(() => {
  window.removeEventListener('task-updated', handleTaskUpdated as EventListener)
  window.removeEventListener('task-added', handleTaskAdded as EventListener)
  window.removeEventListener('request-task-list', handleRequestTaskList as EventListener)
  window.removeEventListener('timeline-task-hover', handleTimelineHover as EventListener)
  window.removeEventListener(
    'timeline-vertical-scroll',
    handleTimelineVerticalScroll as EventListener,
  )
  window.removeEventListener('milestone-icon-changed', handleMilestoneIconChange as EventListener)
  window.removeEventListener('splitter-drag-start', handleSplitterDragStart as EventListener)
  window.removeEventListener('splitter-drag-end', handleSplitterDragEnd as EventListener)
})
</script>

<template>
  <div class="task-list">
    <div class="task-list-header">
      <div class="col col-name">{{ t.taskName }}</div>
      <div class="col col-pre">{{ t.predecessor }}</div>
      <div class="col col-assignee">{{ t.assignee }}</div>
      <div class="col col-date">{{ t.startDate }}</div>
      <div class="col col-date">{{ t.endDate }}</div>
      <div class="col col-hours">{{ t.estimatedHours }}</div>
      <div class="col col-hours">{{ t.actualHours }}</div>
      <div class="col col-progress">{{ t.progress }}</div>
    </div>
    <div class="task-list-body" @scroll="handleTaskListScroll">
      <TaskRow
        v-for="task in localTasks"
        :key="task.id"
        :task="task"
        :level="0"
        :is-hovered="hoveredTaskId === task.id"
        :hovered-task-id="hoveredTaskId"
        :on-double-click="props.onTaskDoubleClick"
        :on-hover="handleTaskRowHover"
        @toggle="toggleCollapse"
        @dblclick="handleTaskRowDoubleClick"
        @contextmenu="handleTaskRowContextMenu"
        @start-timer="handleStartTimer"
        @stop-timer="handleStopTimer"
        @add-predecessor="handleAddPredecessor"
        @add-successor="handleAddSuccessor"
        @delete="handleTaskDelete"
      />
    </div>
  </div>
</template>

<style scoped>
@import '../styles/theme-variables.css';

.task-list {
  width: 100%;
  height: 100%;
  font-size: 15px;
  color: var(--gantt-text-primary);
  background: var(--gantt-bg-primary);
  display: flex;
  flex-direction: column;
  overflow-x: auto; /* 防止内容溢出 */

  /* Webkit浏览器滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: var(--gantt-scrollbar-thumb) transparent;
}

.task-list-header {
  display: flex;
  background: var(--gantt-bg-secondary);
  border-bottom: 1px solid var(--gantt-border-medium);
  border-left: 3px solid transparent; /* 添加3px透明左边框保持对齐 */
  font-weight: 700;
  padding: 0;
  height: 80px;
  align-items: center;
  width: max-content;
  flex-shrink: 0; /* 防止header被压缩 */
  position: sticky; /* 使header固定 */
  top: 0;
  z-index: 10; /* 确保在滚动时保持在最上层 */
}

.col {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  border-right: 1px solid var(--gantt-border-light);
  box-sizing: border-box;
  overflow: hidden;
  font-weight: 400;
}

.task-list-header .col {
  justify-content: center;
  font-weight: 700;
  background: var(--gantt-bg-secondary);
  color: var(--gantt-text-header);
  border-right-color: var(--gantt-border-medium);
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

.task-list-body {
  width: max-content;
  background: var(--gantt-bg-primary);
  flex: 1;
  overflow-x: hidden; /* 让body部分可以滚动 */
  overflow-y: auto; /* 允许垂直滚动 */

  /* Webkit浏览器滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: var(--gantt-scrollbar-thumb) transparent;
}

.task-list-body::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.task-list-body::-webkit-scrollbar-track {
  background: transparent;
}

.task-list-body::-webkit-scrollbar-thumb {
  background-color: var(--gantt-scrollbar-thumb);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.task-list-body::-webkit-scrollbar-thumb:hover {
  background-color: var(--gantt-scrollbar-thumb-hover);
}

.task-list-body::-webkit-scrollbar-corner {
  background: transparent;
}
</style>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, useSlots, computed, inject } from 'vue'
import type { StyleValue, Slots } from 'vue'
import TaskRow from './TaskRow.vue'
import { useI18n } from '../composables/useI18n'
import type { Task } from '../models/classes/Task'
import type { TaskListConfig, TaskListColumnConfig } from '../models/configs/TaskListConfig'
import { DEFAULT_TASK_LIST_COLUMNS } from '../models/configs/TaskListConfig'
import { useTaskRowDrag } from '../composables/useTaskRowDrag'
import { useTaskListColumns } from '../composables/useTaskListColumns'

interface Props {
  tasks?: Task[]
  useDefaultDrawer?: boolean
  taskListConfig?: TaskListConfig
  taskListColumnRenderMode?: 'default' | 'declarative'
  enableTaskRowMove?: boolean
  taskListRowClassName?: string | ((row: Task, rowIndex: number) => string)
  taskListRowStyle?: StyleValue | ((row: Task, rowIndex: number) => StyleValue)
}

const props = withDefaults(defineProps<Props>(), {
  taskListColumnRenderMode: 'default',
})

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
  'task-row-moved': [
    payload: {
      draggedTask: Task
      targetTask: Task
      position: 'after' | 'child' // 'after': 放在目标任务之后（同级）, 'child': 作为目标任务的子任务
      oldParent: Task | null
      newParent: Task | null
    },
  ]
}>()
const slots = useSlots()
const hasRowSlot = computed(() => Boolean(slots['custom-task-content']))

// 从 GanttChart 注入列级 slots
const columnSlots = inject<Slots>('gantt-column-slots', {})

// 多语言支持
const { t } = useI18n()

// 使用声明式列管理 composable
const { declarativeColumns, getColumnWidthStyle: getDeclarativeColumnWidth } =
  useTaskListColumns(
    props.taskListColumnRenderMode || 'default',
    slots,
    props.taskListConfig?.columns || DEFAULT_TASK_LIST_COLUMNS,
  )

// 计算实际使用的列配置
const columnsToUse = computed(() => {
  if (props.taskListColumnRenderMode === 'declarative') {
    return declarativeColumns.value
  }
  // 默认模式：使用 taskListConfig 中的列配置
  const columns = props.taskListConfig?.columns || DEFAULT_TASK_LIST_COLUMNS
  return columns.filter(col => col.visible !== false)
})

// TaskList 容器引用
const taskListRef = ref<HTMLElement | null>(null)
const taskListBodyRef = ref<HTMLElement | null>(null)

// 缓存容器宽度，避免频繁读取 offsetWidth 导致强制重排
const cachedContainerWidth = ref(0)

// 使用 ResizeObserver 监听容器宽度变化
let containerResizeObserver: ResizeObserver | null = null
let bodyResizeObserver: ResizeObserver | null = null

// 纵向虚拟滚动相关状态
const ROW_HEIGHT = 51 // 每行高度（与TaskList Row一致）
const VERTICAL_BUFFER = 5 // 上下额外渲染的缓冲行数
const taskListScrollTop = ref(0)
const taskListBodyHeight = ref(0)

// 获取列宽度样式（百分比转像素）
const getColumnWidthStyle = (column: { width?: number | string }) => {
  // 声明式模式：使用 composable 中的方法
  if (props.taskListColumnRenderMode === 'declarative') {
    return getDeclarativeColumnWidth(column, cachedContainerWidth.value)
  }

  // 默认模式：原有逻辑
  if (!column.width) return {}

  let widthPx: string

  // 如果是百分比，转换为像素
  if (typeof column.width === 'string' && column.width.includes('%')) {
    const containerWidth = cachedContainerWidth.value || 0
    if (containerWidth > 0) {
      const percentage = parseFloat(column.width) / 100
      const pixels = Math.floor(containerWidth * percentage)
      widthPx = `${pixels}px`
    } else {
      return {} // 容器宽度未知时返回空
    }
  } else {
    // 像素值
    widthPx = `${column.width}px`
  }

  return {
    flex: `0 0 ${widthPx}`,
    minWidth: widthPx,
    maxWidth: widthPx,
  }
}

// 计算可见的列配置（仅用于默认模式）
const visibleColumns = computed(() => {
  if (props.taskListColumnRenderMode === 'declarative') {
    return [] as TaskListColumnConfig[] // 声明式模式不需要这个
  }
  const columns = props.taskListConfig?.columns || DEFAULT_TASK_LIST_COLUMNS
  return columns.filter(col => col.visible !== false)
})

// 使用 props.tasks 的引用，不创建副本
// 这样可以直接修改对象，触发响应式更新，不需要外部监听事件
const localTasks = computed(() => props.tasks || [])

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

  // ⚠️ 拖拽结束后，手动更新一次容器宽度，触发列宽重新计算
  if (taskListRef.value) {
    const newWidth = taskListRef.value.offsetWidth
    if (Math.abs(newWidth - cachedContainerWidth.value) > 1) {
      cachedContainerWidth.value = newWidth
    }
  }
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

  // 始终发送到Timeline处理（通过全局事件），让Timeline决定是否打开编辑器
  // 这样外部监听的 @task-double-click 事件也会被触发
  window.dispatchEvent(
    new CustomEvent('task-row-double-click', {
      detail: task,
    }),
  )
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
  if (!props.tasks) return

  const updateParentTask = (taskList: Task[]): void => {
    taskList.forEach(task => {
      if (task.children && task.children.length > 0) {
        // 先更新子任务
        updateParentTask(task.children)

        // 计算父级任务的进度和日期范围
        const parentData = calculateParentTaskData(task)

        // 直接修改对象属性
        task.progress = parentData.progress
        task.startDate = parentData.startDate
        task.endDate = parentData.endDate
      }
    })
  }

  updateParentTask(props.tasks)
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

// 获取当前折叠状态下的可见任务列表
const getFlattenedVisibleTasks = (
  taskList: Task[],
  level = 0,
): Array<{ task: Task; level: number }> => {
  const result: Array<{ task: Task; level: number }> = []

  for (const task of taskList) {
    result.push({ task, level })

    const isMilestoneGroup = task.type === 'milestone-group'

    if (!isMilestoneGroup && task.children && task.children.length > 0 && !task.collapsed) {
      result.push(...getFlattenedVisibleTasks(task.children, level + 1))
    }
  }

  return result
}

// 扁平化后的可见任务列表
const flattenedTasks = computed(() => getFlattenedVisibleTasks(localTasks.value))

// 计算可视区域任务范围
const visibleTaskRange = computed(() => {
  const scrollTop = taskListScrollTop.value
  const containerHeight = taskListBodyHeight.value || 600

  const startIndex = Math.floor(scrollTop / ROW_HEIGHT) - VERTICAL_BUFFER
  const endIndex = Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VERTICAL_BUFFER

  const total = flattenedTasks.value.length
  const clampedStart = Math.min(Math.max(0, startIndex), total)
  const clampedEnd = Math.min(total, Math.max(clampedStart + 1, endIndex))

  return {
    startIndex: clampedStart,
    endIndex: clampedEnd,
  }
})

// 虚拟列表中需要渲染的任务
const visibleTasks = computed(() => {
  const { startIndex, endIndex } = visibleTaskRange.value
  const slicedTasks = flattenedTasks.value.slice(startIndex, endIndex)
  // 添加 rowIndex（基于在扁平化列表中的实际索引）
  return slicedTasks.map((item, index) => ({
    ...item,
    rowIndex: startIndex + index,
  }))
})

// Spacer 高度用于撑起滚动区域
const totalContentHeight = computed(() => flattenedTasks.value.length * ROW_HEIGHT)
const startSpacerHeight = computed(() => visibleTaskRange.value.startIndex * ROW_HEIGHT)
const endSpacerHeight = computed(() => {
  const visibleHeight = visibleTasks.value.length * ROW_HEIGHT
  return Math.max(0, totalContentHeight.value - startSpacerHeight.value - visibleHeight)
})

// 不再需要 watch，直接使用 props.tasks 的引用

function toggleCollapse(task: Task) {
  task.collapsed = !task.collapsed

  // 触发自定义事件，通知父组件任务折叠状态变化
  emit('task-collapse-change', task)
}

// 更新任务数据
const updateTaskData = (updatedTask: Task) => {
  if (!props.tasks) return

  const updateTaskInTree = (taskList: Task[]): boolean => {
    for (const task of taskList) {
      if (task.id === updatedTask.id) {
        // 直接修改对象属性
        Object.assign(task, updatedTask)
        // 保留子任务结构
        if (updatedTask.children === undefined) {
          // 如果 updatedTask 没有 children，保持原来的
          // task.children 保持不变
        }
        return true
      }
      if (task.children && updateTaskInTree(task.children)) {
        return true
      }
    }
    return false
  }

  updateTaskInTree(props.tasks)

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
  if (props.tasks) {
    props.tasks.push(newTask)
  }

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

  taskListScrollTop.value = scrollTop

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
  const taskListBodyElement = taskListBodyRef.value

  taskListScrollTop.value = scrollTop

  if (taskListBodyElement && Math.abs(taskListBodyElement.scrollTop - scrollTop) > 1) {
    // 使用更精确的比较，避免1px以内的细微差异导致的循环触发
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
    // eslint-disable-next-line no-console
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

// 处理TaskRow拖拽移动事件（核心逻辑在组件内部）
const handleTaskRowMoved = (payload: {
  draggedTask: Task
  targetTask: Task
  position: 'after' | 'child'
}) => {
  const { draggedTask, targetTask, position } = payload

  if (!props.tasks) return

  // 直接 emit 事件给父组件（GanttChart）处理，由 GanttChart 修改原始 tasks 数据
  // 这样可以确保修改的是正确的数据源，避免修改计算属性的临时结果
  emit('task-row-moved', {
    draggedTask,
    targetTask,
    position,
    oldParent: null,  // 将由 GanttChart 计算
    newParent: null,  // 将由 GanttChart 计算
  })
}

// 全局拖拽管理器（在TaskList层面，所有TaskRow共享）
const { startDrag, handleDragOver } = useTaskRowDrag({
  enabled: props.enableTaskRowMove ?? false,
  onDrop: (draggedTask, targetTask, position) => {
    handleTaskRowMoved({ draggedTask, targetTask, position })
  },
})

onMounted(async () => {
  // 初始化 ResizeObserver 监听容器宽度变化
  if (taskListRef.value) {
    containerResizeObserver = new ResizeObserver((entries) => {
      // ⚠️ 拖拽期间跳过更新，避免高频重新计算列宽
      // TaskList的列宽不需要在拖拽期间实时更新，只需在拖拽结束后更新一次
      if (isSplitterDragging.value) {
        return
      }

      for (const entry of entries) {
        // 使用 contentRect.width 避免强制重排
        cachedContainerWidth.value = entry.contentRect.width
      }
    })
    containerResizeObserver.observe(taskListRef.value)
  }

  // 监听TaskList body高度变化，提供虚拟滚动所需尺寸
  if (taskListBodyRef.value) {
    taskListBodyHeight.value = taskListBodyRef.value.clientHeight
    taskListScrollTop.value = taskListBodyRef.value.scrollTop

    bodyResizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        taskListBodyHeight.value = entry.contentRect.height
      }
    })

    bodyResizeObserver.observe(taskListBodyRef.value)
  }

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
  // 清理 ResizeObserver
  if (containerResizeObserver) {
    containerResizeObserver.disconnect()
    containerResizeObserver = null
  }

  if (bodyResizeObserver) {
    bodyResizeObserver.disconnect()
    bodyResizeObserver = null
  }

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
  <div ref="taskListRef" class="task-list">
    <div class="task-list-header">
      <!-- 声明式模式 -->
      <template v-if="taskListColumnRenderMode === 'declarative'">
        <div
          v-for="(column, index) in columnsToUse"
          :key="index"
          class="col"
          :class="column.cssClass"
          :style="{
            ...getColumnWidthStyle(column),
            justifyContent: (column as any).align === 'center' ? 'center' : (column as any).align === 'right' ? 'flex-end' : 'flex-start',
            textAlign: (column as any).align || 'left'
          }"
        >
          <!-- 使用 header slot 或显示 label -->
          <template v-if="(column as any).headerSlot">
            <component :is="(column as any).headerSlot" />
          </template>
          <template v-else>
            {{ (column as any).label }}
          </template>
        </div>
      </template>

      <!-- 默认模式：使用配置的列 -->
      <template v-else>
        <!-- 任务名称列，始终显示 -->
        <div class="col col-name">
          <!-- 检查是否有 header-name slot -->
          <template v-if="columnSlots['header-name']">
            <component :is="columnSlots['header-name']" />
          </template>
          <template v-else>
            {{ (t as any).taskName || '任务名称' }}
          </template>
        </div>
        <!-- 可配置的其他列 -->
        <div
          v-for="column in visibleColumns"
          :key="(column as TaskListColumnConfig).key"
          class="col"
          :class="(column as TaskListColumnConfig).cssClass || `col-${(column as TaskListColumnConfig).key}`"
          :style="getColumnWidthStyle(column)"
        >
          <!-- 检查是否有对应的 header-{key} slot -->
          <template v-if="columnSlots[`header-${(column as TaskListColumnConfig).key}`]">
            <component :is="columnSlots[`header-${(column as TaskListColumnConfig).key}`]" />
          </template>
          <template v-else>
            {{ (t as any)[(column as TaskListColumnConfig).key] || (column as TaskListColumnConfig).label }}
          </template>
        </div>
      </template>
    </div>
    <div ref="taskListBodyRef" class="task-list-body" @scroll="handleTaskListScroll">
      <div class="task-list-body-spacer" :style="{ height: `${startSpacerHeight}px` }"></div>

      <TaskRow
        v-for="{ task, level, rowIndex } in visibleTasks"
        :key="task.id"
        :task="task"
        :level="level"
        :row-index="rowIndex"
        :is-hovered="hoveredTaskId === task.id"
        :hovered-task-id="hoveredTaskId"
        :on-hover="handleTaskRowHover"
        :columns="taskListColumnRenderMode === 'declarative' ? [] : visibleColumns"
        :declarative-columns="taskListColumnRenderMode === 'declarative' ? columnsToUse : undefined"
        :render-mode="taskListColumnRenderMode"
        :get-column-width-style="getColumnWidthStyle"
        :disable-children-render="true"
        :show-task-icon="props.taskListConfig?.showTaskIcon"
        :enable-drag="props.enableTaskRowMove"
        :drag-start="startDrag"
        :drag-over="handleDragOver"
        :task-list-row-class-name="props.taskListRowClassName"
        :task-list-row-style="props.taskListRowStyle"
        @toggle="toggleCollapse"
        @dblclick="handleTaskRowDoubleClick"
        @contextmenu="handleTaskRowContextMenu"
        @start-timer="handleStartTimer"
        @stop-timer="handleStopTimer"
        @add-predecessor="handleAddPredecessor"
        @add-successor="handleAddSuccessor"
        @delete="handleTaskDelete"
      >
        <!-- 传递 custom-task-content slot -->
        <template v-if="hasRowSlot" #custom-task-content="rowScope">
          <slot name="custom-task-content" v-bind="rowScope" />
        </template>
      </TaskRow>

      <div class="task-list-body-spacer" :style="{ height: `${endSpacerHeight}px` }"></div>
    </div>
  </div>
</template>

<style scoped>
@import '../styles/theme-variables.css';
@import '../styles/list.css';

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

.task-list-header .col {
  justify-content: center;
  font-weight: 700;
  background: var(--gantt-bg-secondary);
  color: var(--gantt-text-header);
  border-right-color: var(--gantt-border-medium);
  padding: 0 10px;
  box-sizing: border-box; /* 确保 padding 包含在宽度内 */
}

.task-list-body {
  width: max-content;
  background: var(--gantt-bg-primary);
  flex: 1;
  overflow-x: hidden; /* 允许横向滚动，确保列完整展示 */
  overflow-y: auto;

  /* Webkit浏览器滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: var(--gantt-scrollbar-thumb) transparent;
}

.task-list-body-spacer {
  width: 100%;
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

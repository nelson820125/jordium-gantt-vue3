<script setup lang="ts">
import { ref, onMounted, onUnmounted, useSlots, computed, inject } from 'vue'
import type { StyleValue, Slots, Ref, ComputedRef } from 'vue'
import TaskRow from './taskRow/TaskRow.vue'
import { useI18n } from '../../composables/useI18n'
import type { Task } from '../../models/classes/Task'
import type { Resource } from '../../models/types/Resource'
import type { TaskListConfig, TaskListColumnConfig } from '../../models/configs/TaskListConfig'
// @ts-expect-error - ResourceListColumnConfig is used in type unions
import type { ResourceListConfig, ResourceListColumnConfig } from '../../models/configs/ResourceListConfig'
import { DEFAULT_TASK_LIST_COLUMNS } from '../../models/configs/TaskListConfig'
import { DEFAULT_RESOURCE_LIST_COLUMNS } from '../../models/configs/ResourceListConfig'
import { useTaskRowDrag } from '../../composables/useTaskRowDrag'
import { useTaskListColumns } from './composables/taskList/useTaskListColumns'
import { useTaskListLayout } from './composables/taskList/useTaskListLayout'
import { useTaskListResize } from './composables/taskList/useTaskListResize'
import { useTaskListEventHandlers } from './composables/taskList/useTaskListEventHandlers'
import { updateParentTasksData } from './composables/taskList/useTaskParentCalculation'

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

const emit = defineEmits<{
  'task-collapse-change': [task: Task]
  'start-timer': [task: Task]
  'stop-timer': [task: Task]
  'add-predecessor': [task: Task]
  'add-successor': [task: Task]
  delete: [task: Task, deleteChildren?: boolean]
  'task-row-moved': [
    payload: {
      draggedTask: Task
      targetTask: Task
      position: 'after' | 'child'
      oldParent: Task | null
      newParent: Task | null
    },
  ]
  'resource-click': [resource: Resource] // v1.9.0 资源行点击事件
}>()

const slots = useSlots()
const hasRowSlot = computed(() => Boolean(slots['custom-task-content']))

// v1.9.0 从 GanttChart 注入视图模式和数据源
const viewMode = inject<Ref<'task' | 'resource'>>('gantt-view-mode', ref('task'))
const dataSource = inject<ComputedRef<Task[] | Resource[]>>('gantt-data-source', computed(() => []))
const listConfig = inject<ComputedRef<TaskListConfig | ResourceListConfig | undefined>>(
  'gantt-list-config',
  computed(() => undefined),
)

// 从 GanttChart 注入列级 slots
const columnSlots = inject<Slots>('gantt-column-slots', {})

// 多语言支持
const { t } = useI18n()

// v1.9.0 根据视图模式获取默认列配置
const getDefaultColumns = computed(() => {
  if (viewMode.value === 'resource') {
    return DEFAULT_RESOURCE_LIST_COLUMNS as unknown as TaskListColumnConfig[]
  }
  return DEFAULT_TASK_LIST_COLUMNS
})

// v1.9.0 根据视图模式和inject的配置计算最终列配置
const finalColumnsConfig = computed(() => {
  // 优先使用inject的配置，否则使用props
  const config = listConfig.value || props.taskListConfig
  return config?.columns || getDefaultColumns.value
})

// 使用声明式列管理 composable
const { declarativeColumns, getColumnWidthStyle: getDeclarativeColumnWidth } =
  useTaskListColumns(
    computed(() => props.taskListColumnRenderMode || 'default'),
    slots,
    finalColumnsConfig.value as TaskListColumnConfig[],
  )

// 计算实际使用的列配置
const columnsToUse = computed(() => {
  if (props.taskListColumnRenderMode === 'declarative') {
    return declarativeColumns.value
  }
  const columns = props.taskListConfig?.columns || DEFAULT_TASK_LIST_COLUMNS
  return columns.filter(col => col.visible !== false)
})

// 计算可见的列配置（仅用于默认模式）
const visibleColumns = computed(() => {
  if (props.taskListColumnRenderMode === 'declarative') {
    return [] as TaskListColumnConfig[]
  }
  return finalColumnsConfig.value.filter(col => col.visible !== false)
})

// v1.9.0 使用注入的数据源或props.tasks
const localTasks = computed(() => {
  if (viewMode.value === 'resource') {
    // 资源视图：使用dataSource作为资源列表
    return (dataSource.value || []) as Task[]
  }
  // 任务视图：使用props.tasks
  return (props.tasks || []) as Task[]
})

// 使用布局计算 composable
const {
  taskListScrollTop,
  taskListBodyHeight,
  visibleTasks,
  startSpacerHeight,
  endSpacerHeight,
} = useTaskListLayout(localTasks)

// 悬停状态管理 - v1.9.0 支持资源视图中的字符串ID
const hoveredTaskId = ref<number | string | null>(null)

// 拖拽状态管理
const isSplitterDragging = ref(false)

// 使用容器尺寸管理 composable
const {
  taskListRef,
  taskListBodyRef,
  cachedContainerWidth,
  initializeResizeObservers,
  cleanupResizeObservers,
  updateContainerWidth,
} = useTaskListResize(isSplitterDragging, taskListScrollTop, taskListBodyHeight)

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

// 使用事件处理 composable
const {
  handleTaskRowHover,
  handleTaskRowDoubleClick,
  handleTaskListScroll,
  handleTaskRowContextMenu,
  registerEventListeners,
  unregisterEventListeners,
} = useTaskListEventHandlers({
  tasks: localTasks,
  hoveredTaskId,
  isSplitterDragging,
  taskListScrollTop,
  taskListBodyRef,
  updateContainerWidth,
})

function toggleCollapse(task: Task) {
  task.collapsed = !task.collapsed
  emit('task-collapse-change', task)
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
  emit('delete', task, deleteChildren)
}

// 处理TaskRow拖拽移动事件
const handleTaskRowMoved = (payload: {
  draggedTask: Task
  targetTask: Task
  position: 'after' | 'child'
}) => {
  const { draggedTask, targetTask, position } = payload

  if (!props.tasks) return

  emit('task-row-moved', {
    draggedTask,
    targetTask,
    position,
    oldParent: null,
    newParent: null,
  })
}

// v1.9.0 处理资源行点击事件
// @ts-expect-error - Reserved for future resource click handling
const handleResourceClick = (resource: Resource) => {
  emit('resource-click', resource)
}

// 全局拖拽管理器
const { startDrag, handleDragOver } = useTaskRowDrag({
  enabled: props.enableTaskRowMove ?? false,
  onDrop: (draggedTask, targetTask, position) => {
    handleTaskRowMoved({ draggedTask, targetTask, position })
  },
})

onMounted(async () => {
  // 初始化 ResizeObserver 监听容器宽度变化
  initializeResizeObservers()

  // 注册全局事件监听器
  registerEventListeners()

  // 初始化时计算父级任务的进度和日期范围
  updateParentTasksData(props.tasks)
})

onUnmounted(() => {
  // 清理 ResizeObserver
  cleanupResizeObservers()

  // 注销全局事件监听器
  unregisterEventListeners()
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
            justifyContent:
              (column as any).align === 'center'
                ? 'center'
                : (column as any).align === 'right'
                  ? 'flex-end'
                  : 'flex-start',
            textAlign: (column as any).align || 'left'
          }"
        >
          <template v-if="(column as any).headerSlot">
            <component :is="(column as any).headerSlot" />
          </template>
          <template v-else>
            {{ (column as any).label }}
          </template>
        </div>
      </template>

      <!-- 默认模式 -->
      <template v-else>
        <div class="col col-name">
          <template v-if="columnSlots['header-name']">
            <component :is="columnSlots['header-name']" />
          </template>
          <template v-else>
            {{ viewMode === 'resource' ? ((t as any).resourceName || '资源名称') : ((t as any).taskName || '任务名称') }}
          </template>
        </div>
        <div
          v-for="column in visibleColumns"
          :key="(column as TaskListColumnConfig).key"
          class="col"
          :class="
            (column as TaskListColumnConfig).cssClass ||
            `col-${(column as TaskListColumnConfig).key}`
          "
          :style="getColumnWidthStyle(column)"
        >
          <template v-if="columnSlots[`header-${(column as TaskListColumnConfig).key}`]">
            <component :is="columnSlots[`header-${(column as TaskListColumnConfig).key}`]" />
          </template>
          <template v-else>
            {{
              (t as any)[(column as TaskListColumnConfig).key] ||
              (column as TaskListColumnConfig).label
            }}
          </template>
        </div>
      </template>
    </div>
    <div ref="taskListBodyRef" class="task-list-body" @scroll="handleTaskListScroll">
      <div class="task-list-body-spacer" :style="{ height: `${startSpacerHeight}px` }"></div>

      <TaskRow
        v-for="{ task, level, rowIndex } in visibleTasks"
        v-memo="[task.id, task.name, task.collapsed, hoveredTaskId === task.id, task.startDate, task.endDate, task.progress]"
        :key="task.id"
        :task="task"
        :level="level"
        :row-index="rowIndex"
        :is-hovered="hoveredTaskId === task.id"
        :hovered-task-id="hoveredTaskId"
        :on-hover="handleTaskRowHover"
        :columns="taskListColumnRenderMode === 'declarative' ? [] : (visibleColumns as TaskListColumnConfig[])"
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
        <template v-if="hasRowSlot" #custom-task-content="rowScope">
          <slot name="custom-task-content" v-bind="rowScope" />
        </template>
        <template v-if="slots['task-list-context-menu']" #task-list-context-menu="contextMenuScope">
          <slot name="task-list-context-menu" v-bind="contextMenuScope" />
        </template>
      </TaskRow>

      <div class="task-list-body-spacer" :style="{ height: `${endSpacerHeight}px` }"></div>
    </div>
  </div>
</template>

<style scoped>
@import '../../styles/theme-variables.css';
@import '../../styles/list.css';

.task-list {
  width: 100%;
  height: 100%;
  font-size: 15px;
  color: var(--gantt-text-primary);
  background: var(--gantt-bg-primary);
  display: flex;
  flex-direction: column;
  overflow-x: auto;

  scrollbar-width: thin;
  scrollbar-color: var(--gantt-scrollbar-thumb) transparent;
}

.task-list-header {
  display: flex;
  background: var(--gantt-bg-secondary);
  border-bottom: 1px solid var(--gantt-border-medium);
  border-left: 3px solid transparent;
  font-weight: 700;
  padding: 0;
  height: 80px;
  align-items: center;
  width: max-content;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.task-list-header .col {
  justify-content: center;
  font-weight: 700;
  background: var(--gantt-bg-secondary);
  color: var(--gantt-text-header);
  border-right-color: var(--gantt-border-medium);
  padding: 0 10px;
  box-sizing: border-box;
}

.task-list-body {
  width: max-content;
  background: var(--gantt-bg-primary);
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;

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

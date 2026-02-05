<script setup lang="ts">
import { ref, computed, useSlots, toRef, inject, type ComputedRef, type Ref } from 'vue'
import type { StyleValue } from 'vue'
import { useI18n } from '../../../composables/useI18n'
import { formatPredecessorDisplay } from '../../../utils/predecessorUtils'
import type { Task } from '../../../models/classes/Task'
import type { Resource } from '../../../models/types/Resource'
import { isResourceOverloaded } from '../../../utils/resourceUtils'
import type { TaskListColumnConfig } from '../../../models/configs/TaskListConfig'
import type { DeclarativeColumnConfig } from '../composables/taskList/useTaskListColumns'
import TaskContextMenu from '../../TaskContextMenu.vue'
import TaskRowCollapseButton from './TaskRowCollapseButton.vue'
import TaskRowNameContent from './TaskRowNameContent.vue'
import { useTaskRowState } from '../composables/taskRow/useTaskRowState'
import { useTaskRowDeclarativeColumns } from '../composables/taskRow/useTaskRowDeclarativeColumns'
import { useTaskRowContextMenu } from '../composables/taskRow/useTaskRowContextMenu'
import { useTaskRowEventHandlers } from '../composables/taskRow/useTaskRowEventHandlers'
import { useTaskRowColumnSlots } from '../composables/taskRow/useTaskRowColumnSlots'

interface TaskRowSlotProps {
  isRowContent: boolean
  task: Task
  level: number
  indent: string
  isHovered: boolean
  hoveredTaskId: number | string | null
  isParent: boolean
  hasChildren: boolean
  collapsed: boolean
  formattedTimer: string
  timerRunning: boolean
  timerElapsed: number
  isOvertime: number | boolean | undefined
  overdueDays: number
  overtimeText: string
  overdueText: string
  daysText: string
  progressClass: string
  type?: string
}

interface Props {
  task: Task
  level: number
  rowIndex?: number
  isHovered?: boolean
  hoveredTaskId?: number | string | null
  onHover?: (taskId: number | string | null) => void
  columns: TaskListColumnConfig[]
  declarativeColumns?: DeclarativeColumnConfig[]
  renderMode?: 'default' | 'declarative'
  getColumnWidthStyle?: (column: { width?: number | string }) => StyleValue
  disableChildrenRender?: boolean
  showTaskIcon?: boolean // 是否显示任务图标，默认true
  enableDrag?: boolean
  dragStart?: (task: Task, element: HTMLElement, event: MouseEvent) => void
  dragOver?: (task: Task, element: HTMLElement, event: MouseEvent) => void
  taskListRowClassName?: string | ((row: Task, rowIndex: number) => string)
  taskListRowStyle?: StyleValue | ((row: Task, rowIndex: number) => StyleValue)
}
const props = withDefaults(defineProps<Props>(), {
  renderMode: 'default',
})
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

defineSlots<{
  'custom-task-content'(props: TaskRowSlotProps): unknown
}>()

const { t } = useI18n()
const overtimeText = computed(() => t.value?.overtime ?? '')
const overdueText = computed(() => t.value?.overdue ?? '')
const daysText = computed(() => t.value?.days ?? '')

const slots = useSlots()
const hasContentSlot = computed(() => Boolean(slots['custom-task-content']))

// v1.9.0 Inject view mode to detect if we're rendering a resource
const viewMode = inject<Ref<'task' | 'resource'>>('gantt-view-mode', ref('task'))

// 从 GanttChart 注入资源布局信息
const resourceTaskLayouts = inject<ComputedRef<Map<string, { taskRowMap: Map<string | number, number>, rowHeights: number[], totalHeight: number }>>>('resourceTaskLayouts', computed(() => new Map()))

// v1.9.0 Detect if current row is a resource
const isResourceRow = computed(() => {
  return viewMode.value === 'resource' && 'tasks' in props.task
})

// v1.9.0 检测资源是否超载（任务重叠）
const isResourceOverloadedComputed = computed(() => {
  if (!isResourceRow.value) return false

  // 类型断言为Resource
  const resource = props.task as Resource
  return isResourceOverloaded(resource)
})

// 计算行高度 - resource视图下使用动态高度
const rowHeight = computed(() => {
  if (isResourceRow.value) {
    const resourceId = String(props.task.id) // 转换为string
    const layout = resourceTaskLayouts.value.get(resourceId)
    return layout?.totalHeight || 56 // v1.9.1 默认56px（51 + 5px底部padding）
  }
  return 51 // task视图下使用固定高度
})

// 注入右键菜单配置
const enableTaskListContextMenu = inject<ComputedRef<boolean>>('enable-task-list-context-menu', computed(() => true))
const hasTaskListContextMenuSlot = inject<ComputedRef<boolean>>('task-list-context-menu-slot', computed(() => false))
const declarativeTaskListContextMenu = inject<ComputedRef<any>>('declarative-task-list-context-menu', computed(() => null))

// 判断是否应该显示任何右键菜单
const shouldShowAnyContextMenu = computed(() => {
  // 如果 enableTaskListContextMenu 为 false，则不显示任何菜单
  if (!enableTaskListContextMenu.value) {
    return false
  }
  return true
})

// 判断是否显示默认右键菜单（enableTaskListContextMenu=true 且没有自定义 slot 时显示）
const shouldShowDefaultContextMenu = computed(() => {
  if (!enableTaskListContextMenu.value) {
    return false
  }
  return !hasTaskListContextMenuSlot.value
})

// 判断是否显示自定义右键菜单（enableTaskListContextMenu=true 且有自定义 slot 时显示）
const shouldShowCustomContextMenu = computed(() => {
  if (!enableTaskListContextMenu.value) {
    return false
  }
  if (!hasTaskListContextMenuSlot.value) {
    return false
  }

  // 检查 taskType 过滤
  const config = declarativeTaskListContextMenu.value
  if (config?.taskType !== undefined) {
    const taskType = props.task.type || 'task'
    const allowedTypes = Array.isArray(config.taskType) ? config.taskType : [config.taskType]
    return allowedTypes.includes(taskType)
  }

  return true
})

// 性能优化：只对会变化的props使用toRef，其他直接传值
const taskRef = toRef(props, 'task')
const levelRef = toRef(props, 'level')

// 使用 composables
const { indent, hasChildren, isStoryTask, isMilestoneGroup, isMilestoneTask, isParentTask, isOvertime, overdueDays, progressClass, customRowClass, customRowStyle } =
  useTaskRowState(
    taskRef,
    levelRef,
    computed(() => props.rowIndex),
    computed(() => props.taskListRowClassName),
    computed(() => props.taskListRowStyle),
  )

const { hasColumnSlot, renderColumnSlot } = useTaskRowColumnSlots()

const { isFirstColumn, getDeclarativeColumnAlign, renderDeclarativeColumn } =
  useTaskRowDeclarativeColumns(
    taskRef,
    isParentTask,
    isMilestoneGroup,
    isStoryTask,
    hasChildren,
    computed(() => props.showTaskIcon),
    computed(() => props.rowIndex),
  )

const {
  contextMenuVisible,
  contextMenuPosition,
  contextMenuTask,
  handleContextMenu: handleContextMenuBase,
  closeContextMenu,
  handleTaskDelete,
  timerElapsed,
  formattedTimer,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} = useTaskRowContextMenu(taskRef, emit as any)

// 包装 handleContextMenu 以添加权限检查
const handleContextMenu = (event: MouseEvent) => {
  if (!shouldShowAnyContextMenu.value) {
    event.preventDefault()
    return
  }
  handleContextMenuBase(event)
}

// TaskRow拖拽功能
const taskRowRef = ref<HTMLElement | null>(null)
const isSplitterDragging = ref(false)

const {
  handleToggle,
  handleRowClick,
  handleTaskRowDoubleClick,
  handleMouseEnter,
  handleMouseLeave,
  handleMouseDown,
} = useTaskRowEventHandlers(
  taskRef,
  isStoryTask,
  hasChildren,
  isMilestoneGroup,
  isSplitterDragging,
  taskRowRef,
  computed(() => props.enableDrag),
  props.onHover,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit as any,
  props.dragStart,
  props.dragOver,
)

// 计算实际要渲染的列
const columnsToRender = computed(() => {
  if (props.renderMode === 'declarative' && props.declarativeColumns) {
    return props.declarativeColumns
  }
  return props.columns
})

const slotPayload = computed(() => ({
  isRowContent: true,
  task: props.task,
  level: props.level,
  indent: indent.value,
  isHovered: props.isHovered ?? false,
  hoveredTaskId: props.hoveredTaskId ?? null,
  isParent: isParentTask.value,
  hasChildren: hasChildren.value,
  collapsed: !!props.task.collapsed,
  formattedTimer: formattedTimer.value,
  timerRunning: !!props.task.isTimerRunning,
  timerElapsed: timerElapsed.value,
  isOvertime: isOvertime(),
  overdueDays: overdueDays(),
  overtimeText: overtimeText.value,
  overdueText: overdueText.value,
  daysText: daysText.value,
  progressClass: progressClass.value,
}))

// 计算左侧边框颜色 - 支持barColor/color自定义
const leftBorderColor = computed(() => {
  // 资源视图：优先使用resource.color
  if (isResourceRow.value) {
    const resource = props.task as any
    if (resource.color) {
      return resource.color
    }
  }
  // 任务视图：使用barColor
  if (props.task.barColor) {
    return props.task.barColor
  }
  // 否则返回null，使用CSS默认样式
  return null
})

// 计算自定义边框样式
const customBorderStyle = computed((): StyleValue => {
  if (leftBorderColor.value) {
    return {
      borderLeftColor: `${leftBorderColor.value} !important` as any,
      borderLeftWidth: '3px',
      borderLeftStyle: 'solid' as const,
    }
  }
  return {}
})

// 处理assignee列的显示数据
const assigneeDisplayData = computed(() => {
  const task = props.task
  const avatar = task.avatar
  const assignee = task.assignee

  // 处理avatar列表
  let avatarList: string[] = []
  if (avatar) {
    avatarList = Array.isArray(avatar) ? avatar : [avatar]
  }

  // 处理assignee列表
  let assigneeList: string[] = []
  if (assignee) {
    assigneeList = Array.isArray(assignee) ? assignee : [assignee]
  }

  // 如果没有avatar，从assignee生成文字头像
  const displayAvatars = avatarList.length > 0
    ? avatarList.map(url => ({ type: 'image', url }))
    : assigneeList.map(name => ({ type: 'text', name }))

  // 生成显示的名称文本（换行拼接）
  const nameText = assigneeList.join('\n') || '-'

  return {
    avatars: displayAvatars,
    nameText,
    hasMultiple: displayAvatars.length > 1,
  }
})
</script>

<template>
  <div>
    <div
      ref="taskRowRef"
      class="task-row"
      :data-task-id="props.task.id"
      :class="{
        'task-row-hovered': isHovered,
        'task-type-resource': isResourceRow, /* v1.9.0 资源视图始终显示左边框 */
        'parent-task': isParentTask,
        'milestone-group-row': isMilestoneGroup,
        'task-type-story': isStoryTask,
        'task-type-task': props.task.type === 'task',
        'task-type-milestone': isMilestoneTask,
        [customRowClass]: customRowClass,
      }"
      :style="[customRowStyle, customBorderStyle, { height: `${rowHeight}px` }]"
      @click="handleRowClick"
      @dblclick="handleTaskRowDoubleClick"
      @mousedown="handleMouseDown"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @contextmenu="handleContextMenu"
    >
      <!-- 声明式渲染模式 -->
      <template v-if="renderMode === 'declarative' && declarativeColumns">
        <div
          v-for="(column, index) in columnsToRender"
          :key="index"
          class="col"
          :class="[column.cssClass, { 'col-name': isFirstColumn(index) }]"
          :style="[
            getColumnWidthStyle ? getColumnWidthStyle(column) : {},
            getDeclarativeColumnAlign(column),
          ]"
        >
          <!-- 第一列：保留 collapse-btn, milestone-spacer, leaf-spacer -->
          <div
            v-if="isFirstColumn(index)"
            :style="{ paddingLeft: indent }"
            class="first-col-wrapper"
          >
            <TaskRowCollapseButton
              :collapsed="!!props.task.collapsed"
              :visible="(isStoryTask || hasChildren) && !isMilestoneGroup"
              @toggle="handleToggle"
            />

            <span v-if="isMilestoneGroup" class="milestone-spacer"></span>

            <span
              v-if="!isParentTask && !isMilestoneGroup && showTaskIcon === false"
              class="leaf-spacer"
            ></span>

            <!-- 渲染列内容 -->
            <component :is="() => renderDeclarativeColumn(column, index)" />
          </div>

          <!-- 其他列：直接渲染内容 -->
          <component :is="() => renderDeclarativeColumn(column, index)" v-else />
        </div>
      </template>

      <!-- 默认渲染模式 -->
      <template v-else>
        <div class="col col-name" :style="{ paddingLeft: indent }">
          <TaskRowCollapseButton
            :collapsed="!!props.task.collapsed"
            :visible="(isStoryTask || hasChildren) && !isMilestoneGroup"
            @toggle="handleToggle"
          />

          <!-- 里程碑分组的占位空间，用于与有折叠按钮的任务对齐 -->
          <span v-if="isMilestoneGroup" class="milestone-spacer"></span>

          <!-- 叶子节点的占位空间（无折叠按钮且无图标显示时） -->
          <span
            v-if="!isParentTask && !isMilestoneGroup && showTaskIcon === false && !isResourceRow"
            class="leaf-spacer"
          ></span>

          <!-- v1.9.0 资源视图：直接显示资源名称 -->
          <div v-if="isResourceRow" class="resource-row-name">
            <!-- v1.9.0 资源超载警示图标 -->
            <svg
              v-if="isResourceOverloadedComputed"
              class="resource-warning-icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L2 20h20L12 2z"
                fill="var(--gantt-danger, #f56c6c)"
              />
              <path
                d="M12 8v6M12 16h.01"
                stroke="#fff"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            <div v-if="(props.task as any).avatar" class="resource-avatar">
              <img :src="(props.task as any).avatar" :alt="(props.task as any).name" />
            </div>
            <span class="resource-name-text">{{ (props.task as any).name || '-' }}</span>
          </div>

          <!-- 任务视图：正常渲染 -->
          <TaskRowNameContent
            v-else
            :task="props.task"
            :is-parent-task="isParentTask"
            :has-children="hasChildren"
            :is-story-task="isStoryTask"
            :is-milestone-group="isMilestoneGroup"
            :is-milestone-task="isMilestoneTask"
            :show-task-icon="showTaskIcon !== false"
            :formatted-timer="formattedTimer"
            :is-overtime="!!isOvertime()"
            :overdue-days="overdueDays()"
            :overtime-text="overtimeText"
            :overdue-text="overdueText"
            :days-text="daysText"
            :has-content-slot="hasContentSlot"
            :render-column-slot="renderColumnSlot"
            :has-column-slot="hasColumnSlot"
          >
            <template #custom-task-content>
              <slot
                name="custom-task-content"
                v-bind="slotPayload"
                type="task-row"
              />
            </template>
          </TaskRowNameContent>
      </div>

      <!-- 动态渲染列 -->
      <div
        v-for="column in columns"
        :key="column.key"
        class="col"
        :class="column.cssClass || `col-${column.key}`"
        :style="getColumnWidthStyle ? getColumnWidthStyle(column) : undefined"
      >
        <!-- 里程碑分组显示空列 -->
        <template v-if="isMilestoneGroup">
          <div class="milestone-empty-col"></div>
        </template>
        <!-- 普通任务显示具体内容 -->
        <template v-else>
          <!-- 优先级1: 列级自定义 Slot (约定: #column-{key})，通过 renderColumnSlot 动态渲染 -->
          <component
            :is="() =>
            renderColumnSlot(column.key,
                            { task: props.task, column, value: (props.task as any)[column.key] })"
            v-if="hasColumnSlot(column.key)"
          />

          <!-- 优先级2: Formatter 函数 -->
          <template v-else-if="column.formatter">
            {{ column.formatter(props.task, column) }}
          </template>

          <!-- v1.9.0 资源视图：使用formatter或直接显示资源属性 -->
          <template v-else-if="isResourceRow">
            {{ (props.task as any)[column.key] || '-' }}
          </template>

          <!-- 优先级3: 内置列类型渲染（任务视图） -->
          <!-- 前置任务列 -->
          <template v-else-if="column.key === 'predecessor'">
            {{ formatPredecessorDisplay(props.task.predecessor) }}
          </template>

          <!-- 负责人列 -->
          <template v-else-if="column.key === 'assignee'">
            <div class="assignee-info">
              <!-- 多头像容器 -->
              <div class="assignee-avatars-container">
                <div
                  v-for="(avatarItem, idx) in assigneeDisplayData.avatars"
                  :key="idx"
                  class="avatar"
                  :style="{
                    zIndex: idx + 1,
                    marginLeft: idx > 0 ? '-8px' : '0'
                  }"
                >
                  <!-- 图片头像 -->
                  <img v-if="avatarItem.type === 'image'" :src="(avatarItem as any).url" :alt="`avatar-${idx}`" />
                  <!-- 文字头像 -->
                  <span v-else class="avatar-text">{{ (avatarItem as any).name.charAt(0).toUpperCase() }}</span>
                </div>
              </div>
              <!-- 名称显示，支持换行和超出显示... -->
              <span class="assignee-name" :title="assigneeDisplayData.nameText">{{ assigneeDisplayData.nameText }}</span>
            </div>
          </template>

          <!-- 开始日期列 -->
          <template v-else-if="column.key === 'startDate'">
            {{ props.task.startDate || '-' }}
          </template>

          <!-- 结束日期列 -->
          <template v-else-if="column.key === 'endDate'">
            {{ props.task.endDate || '-' }}
          </template>

          <!-- 预估工时列 -->
          <template v-else-if="column.key === 'estimatedHours'">
            {{ props.task.estimatedHours || '-' }}
          </template>

          <!-- 实际工时列 -->
          <template v-else-if="column.key === 'actualHours'">
            {{ props.task.actualHours || '-' }}
          </template>

          <!-- 进度列 -->
          <template v-else-if="column.key === 'progress'">
            <span class="progress-value" :class="progressClass">
              {{ props.task.progress != null ? props.task.progress + '%' : '-' }}
            </span>
          </template>

          <!-- 优先级4: 默认渲染 - 自定义列通过task对象的key动态获取值 -->
          <template v-else>
            {{ (props.task as any)[column.key] || '-' }}
          </template>
        </template>
      </div>
      </template>
      <!-- 结束默认渲染模式 -->
    </div>

    <!--
      性能优化：移除递归渲染
      TaskList已经通过虚拟滚动和扁平化处理子任务
      TaskRow只负责渲染单个任务行，不再递归渲染子任务
    -->

    <!-- 默认右键菜单 -->
    <TaskContextMenu
      v-if="shouldShowDefaultContextMenu"
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

    <!-- 声明式右键菜单 -->
    <Teleport to="body">
      <div
        v-if="shouldShowCustomContextMenu && contextMenuVisible && declarativeTaskListContextMenu?.defaultSlot"
        class="gantt-context-menu-wrapper"
        :style="{
          position: 'fixed',
          left: `${contextMenuPosition.x}px`,
          top: `${contextMenuPosition.y}px`,
          zIndex: 9999,
        }"
      >
        <component
          :is="declarativeTaskListContextMenu.defaultSlot"
          :row="contextMenuTask"
          :$index="props.rowIndex ?? -1"
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@import '../../../styles/theme-variables.css';
@import '../../../styles/list.css';

.task-row {
  display: flex;
  border-bottom: 1px solid var(--gantt-border-light);
  height: 51px; /* v1.9.1 任务视图51px（包含border-bottom 1px），资源视图动态高度（第一行56px，后续行46px） */
  box-sizing: border-box; /* 确保border包含在高度计算中 */
  background: var(--gantt-bg-primary);
  align-items: center;
  color: var(--gantt-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
  z-index: 1;
  position: relative;
}

.task-row:hover {
  background-color: var(--gantt-bg-hover);
  box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15);
  z-index: 10;
}

.task-row-hovered {
  background-color: var(--gantt-bg-hover) !important;
  box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15) !important;
  z-index: 10 !important;
}

.task-row.parent-task {
  background: var(--gantt-bg-tertiary);
  font-weight: 600;
}

.task-row.parent-task:hover {
  background: var(--gantt-bg-hover-parent, var(--gantt-bg-hover));
  box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15);
  z-index: 10;
}

.task-row.parent-task.task-row-hovered {
  background: var(--gantt-bg-hover-parent, var(--gantt-bg-hover)) !important;
  box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15) !important;
  z-index: 10 !important;
}

/* 里程碑分组行特殊样式 - 使用红色边框 */
.milestone-group-row {
  border-left: 3px solid var(--gantt-danger, #f56c6c);
  background: linear-gradient(90deg, var(--gantt-bg-tertiary) 0%, var(--gantt-bg-primary) 100%);
}

.mbox-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15);
  ilestone-group-row:hover {
  background: linear-gradient(90deg, var(--gantt-bg-hover-parent) 0%, var(--gantt-bg-hover) 100%);
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

/* v1.9.0 资源类型左边框颜色 */
.task-type-resource {
  border-left: 3px solid var(--gantt-success, #67c23a);
}

/* 任务类型悬停时保持左边框，无需加粗 */
.task-type-story:hover {
  border-left: 3px solid var(--gantt-primary, #409eff);
}

.task-type-task:hover {
  border-left: 3px solid var(--gantt-warning, #e6a23c);
}

.task-type-milestone:hover {
  border-left: 3px solid var(--gantt-danger, #f56c6c);
}

.task-type-resource:hover {
  border-left: 3px solid var(--gantt-success, #67c23a);
}

/* 悬停状态下的左边框保持 */
.task-row-hovered.task-type-story {
  border-left: 3px solid var(--gantt-primary, #409eff) !important;
}

.task-row-hovered.task-type-task {
  border-left: 3px solid var(--gantt-warning, #e6a23c) !important;
}

.task-row-hovered.task-type-milestone {
  border-left: 3px solid var(--gantt-danger, #f56c6c) !important;
}

.task-row-hovered.task-type-resource {
  border-left: 3px solid var(--gantt-success, #67c23a) !important;
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

:global(html[data-theme='dark']) .task-type-resource {
  border-left-color: var(--gantt-success, #85ce61);
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

/* 叶子节点占位空间 - 当不显示图标时保持缩进层级 */
.leaf-spacer {
  display: inline-flex;
  width: 20px; /* 18px (折叠按钮宽度) + 2px (额外间距) */
  height: 18px;
}

.assignee-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 多头像容器 */
.assignee-avatars-container {
  display: flex;
  align-items: center;
  position: relative;
}

.assignee-avatars-container .avatar {
  position: relative;
  transition: transform 0.2s ease;
  cursor: pointer;
}

.assignee-avatars-container .avatar:hover {
  transform: translateY(-2px) scale(1.1);
  z-index: 999 !important;
}

.avatar {
  min-width: 25px;
  min-height: 25px;
  width: 25px;
  height: 25px;
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
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.avatar .avatar-text {
  font-size: 11px;
  font-weight: 600;
}

.assignee-name {
  font-size: 14px;
  color: var(--gantt-text-secondary);
  white-space: pre-line;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
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

:global(html[data-theme='dark']) .milestone-empty-col {
  color: var(--gantt-text-disabled, #606266);
  /* 确保暗黑模式下边框颜色与普通数据行一致 */
  border-right-color: var(--gantt-border-light) !important;
}

/* 暗黑模式的悬停效果 */
:global(html[data-theme='dark']) .task-row:hover {
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15);
}

:global(html[data-theme='dark']) .task-row.task-row-hovered {
  background-color: var(--gantt-bg-hover) !important;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15) !important;
}

:global(html[data-theme='dark']) .task-row.parent-task:hover {
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15);
}

:global(html[data-theme='dark']) .task-row.parent-task.task-row-hovered {
  background: var(--gantt-bg-hover-parent) !important;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15) !important;
}

:global(html[data-theme='dark']) .milestone-group-row:hover {
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15);
}

/* TaskRow拖拽样式 */
.task-row-dragging {
  opacity: 0.6 !important;
  cursor: move !important;
}

/* 拖拽目标高亮样式 */
.task-row-drop-target.drop-after {
  border-bottom: 3px solid var(--gantt-primary, #409eff) !important;
  background-color: rgba(64, 158, 255, 0.05) !important;
}

.task-row-drop-target.drop-child {
  border: 2px solid var(--gantt-primary, #409eff) !important;
  background-color: rgba(64, 158, 255, 0.05) !important;
}

/* v1.9.0 资源视图行样式 */
.resource-row-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--gantt-text-primary);
}

/* v1.9.0 资源超载警示图标 */
.resource-warning-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.resource-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.resource-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.resource-name-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:global(html[data-theme='dark']) .task-row-drop-target.drop-after {
  background-color: rgba(125, 180, 240, 0.1) !important;
}

:global(html[data-theme='dark']) .task-row-drop-target.drop-child {
  background-color: rgba(125, 180, 240, 0.1) !important;
}

/* 声明式列第一列的包装器 */
.first-col-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
}

/* 声明式列的 padding，与 header 保持一致 */
.task-row .col {
  padding: 0 10px;
}
</style>

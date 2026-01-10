<script setup lang="ts">
import { ref, computed, useSlots, toRef, inject, type ComputedRef } from 'vue'
import type { StyleValue } from 'vue'
import { useI18n } from '../../../composables/useI18n'
import { formatPredecessorDisplay } from '../../../utils/predecessorUtils'
import type { Task } from '../../../models/classes/Task'
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
  hoveredTaskId: number | null
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
  hoveredTaskId?: number | null
  onHover?: (taskId: number | null) => void
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
</script>

<template>
  <div>
    <div
      ref="taskRowRef"
      class="task-row"
      :data-task-id="props.task.id"
      :class="{
        'task-row-hovered': isHovered,
        'parent-task': isParentTask,
        'milestone-group-row': isMilestoneGroup,
        'task-type-story': isStoryTask,
        'task-type-task': props.task.type === 'task',
        'task-type-milestone': isMilestoneTask,
        [customRowClass]: customRowClass,
      }"
      :style="customRowStyle"
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
            v-if="!isParentTask && !isMilestoneGroup && showTaskIcon === false"
            class="leaf-spacer"
          ></span>

          <TaskRowNameContent
            :task="props.task"
            :isParentTask="isParentTask"
            :hasChildren="hasChildren"
            :isStoryTask="isStoryTask"
            :isMilestoneGroup="isMilestoneGroup"
            :isMilestoneTask="isMilestoneTask"
            :showTaskIcon="showTaskIcon !== false"
            :formattedTimer="formattedTimer"
            :isOvertime="!!isOvertime()"
            :overdueDays="overdueDays()"
            :overtimeText="overtimeText"
            :overdueText="overdueText"
            :daysText="daysText"
            :hasContentSlot="hasContentSlot"
            :renderColumnSlot="renderColumnSlot"
            :hasColumnSlot="hasColumnSlot"
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

          <!-- 优先级3: 内置列类型渲染 -->
          <!-- 前置任务列 -->
          <template v-else-if="column.key === 'predecessor'">
            {{ formatPredecessorDisplay(props.task.predecessor) }}
          </template>

          <!-- 负责人列 -->
          <template v-else-if="column.key === 'assignee'">
            <div class="assignee-info">
              <div class="avatar">
                {{ props.task.assignee ? props.task.assignee.charAt(0) : '-' }}
              </div>
              <span class="assignee-name">{{ props.task.assignee || '-' }}</span>
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
  height: 51px; /* 修改为51px，与Timeline中的task-row高度保持一致，包含border-bottom 1px */
  box-sizing: border-box; /* 确保border包含在高度计算中 */
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

.avatar {
  min-width: 25px;
  min-height: 25px;
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

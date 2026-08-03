import type { Ref } from 'vue'
import type { Task } from '../../../../models/classes/Task'
import { updateParentTasksData, getAllTasks } from './useTaskParentCalculation'
import type { ComputedRef } from 'vue'

/**
 * TaskList 事件处理逻辑
 * 负责处理各种全局事件的监听和响应
 */

export interface TaskListEventHandlersOptions {
  tasks: Ref<Task[]>
  hoveredTaskId: Ref<number | string | null>
  isSplitterDragging: Ref<boolean>
  taskListScrollTop: Ref<number>
  taskListBodyRef: Ref<HTMLElement | null>
  updateContainerWidth: () => void
  onTaskUpdate?: (task: Task) => void
  enableParentTaskAutoSchedule?: Ref<boolean> | ComputedRef<boolean>
  // v2.0 资源视图下 `tasks` 实际绑定的是 Resource[]（见 TaskList.vue 的 localTasks），
  // 而非任务树。若不区分视图模式，下面按 id 匹配 + Object.assign 的任务树更新逻辑
  // 可能会把 Resource 当作 Task 命中（当 resource.id 与某个 task.id 数值相同时），
  // 把任务的字段（包括 name）整体覆盖到该资源对象上。
  viewMode?: Ref<'task' | 'resource'>
}

export function useTaskListEventHandlers(options: TaskListEventHandlersOptions) {
  const {
    tasks,
    hoveredTaskId,
    isSplitterDragging,
    taskListScrollTop,
    taskListBodyRef,
    updateContainerWidth,
    onTaskUpdate,
    enableParentTaskAutoSchedule,
    viewMode,
  } = options

  // ==================== 悬停事件处理 ====================

  const handleTaskRowHover = (taskId: number | string | null) => {
    if (isSplitterDragging.value) {
      return
    }

    hoveredTaskId.value = taskId
    window.dispatchEvent(
      new CustomEvent('task-list-hover', {
        detail: taskId,
      })
    )
  }

  const handleTimelineHover = (event: CustomEvent) => {
    hoveredTaskId.value = event.detail
  }

  // ==================== 双击事件处理 ====================

  const handleTaskRowDoubleClick = (task: Task) => {
    if (task.type === 'milestone' || task.type === 'milestone-group') {
      return
    }

    window.dispatchEvent(
      new CustomEvent('task-row-double-click', {
        detail: task,
      })
    )
  }

  // ==================== 任务数据更新事件 ====================

  const updateTaskData = (updatedTask: Task) => {
    if (!tasks.value) return
    // 资源视图下 tasks.value 是 Resource[]，任务树匹配/合并逻辑在此不适用
    // （资源侧的任务数据同步已经由 GanttChart 的 updateTaskAndSyncToResources 负责）
    if (viewMode?.value === 'resource') return

    const updateTaskInTree = (taskList: Task[]): boolean => {
      for (const task of taskList) {
        if (task.id === updatedTask.id) {
          Object.assign(task, updatedTask)
          if (updatedTask.children === undefined) {
            // 保持原来的 children
          }
          return true
        }
        if (task.children && updateTaskInTree(task.children)) {
          return true
        }
      }
      return false
    }

    updateTaskInTree(tasks.value)
    const skipDateRange = !(enableParentTaskAutoSchedule?.value ?? true)
    updateParentTasksData(tasks.value, skipDateRange)

    // 调用回调通知外部
    if (onTaskUpdate) {
      onTaskUpdate(updatedTask)
    }
  }

  const handleTaskUpdated = (event: CustomEvent) => {
    const updatedTask = event.detail
    updateTaskData(updatedTask)
  }

  const handleTaskAdded = (event: CustomEvent) => {
    // 资源视图下 tasks.value 是 Resource[]，新增任务不应被当作资源 push 进去
    // （资源侧的新增任务同步已经由 GanttChart 的 addTaskToResource 负责）
    if (viewMode?.value === 'resource') return

    const newTask = event.detail
    if (tasks.value) {
      // eslint-disable-next-line vue/no-mutating-props
      tasks.value.push(newTask)
    }
    updateParentTasksData(tasks.value)
  }

  // ==================== 任务列表请求事件 ====================

  const handleRequestTaskList = () => {
    const allTasks = getAllTasks(tasks.value)
    window.dispatchEvent(
      new CustomEvent('task-list-updated', {
        detail: allTasks,
      })
    )
  }

  // ==================== 里程碑图标变更事件 ====================

  const handleMilestoneIconChange = (event: CustomEvent) => {
    const { milestoneId, icon } = event.detail

    const updateMilestoneIcon = (taskList: Task[]) => {
      for (const task of taskList) {
        if (task.type === 'milestone-group' && task.children) {
          const milestone = task.children.find((m: Task) => m.id === milestoneId)
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

    updateMilestoneIcon(tasks.value)
  }

  // ==================== 滚动同步事件 ====================

  // 滚动同步标志位：防止 Timeline → TaskList 写入后反向再次派发（2跳链路优化）
  let _isSyncingScrollFromTimeline = false

  const handleTaskListScroll = (event: Event) => {
    const target = event.target as HTMLElement
    if (!target) return

    const scrollTop = target.scrollTop
    taskListScrollTop.value = scrollTop

    // 由 Timeline → TaskList 同步写入触发时，不再反向派发，避免 2 跳循环
    if (_isSyncingScrollFromTimeline) return

    // 滚动时关闭所有右键菜单
    window.dispatchEvent(new CustomEvent('close-all-taskbar-menus'))

    window.dispatchEvent(
      new CustomEvent('task-list-vertical-scroll', {
        detail: { scrollTop },
      })
    )
  }

  const handleTimelineVerticalScroll = (event: CustomEvent) => {
    const { scrollTop } = event.detail
    const taskListBodyElement = taskListBodyRef.value

    taskListScrollTop.value = scrollTop

    if (taskListBodyElement && Math.abs(taskListBodyElement.scrollTop - scrollTop) > 1) {
      // 设置标志位：当前是由 Timeline 触发的同步写入
      // 防止 handleTaskListScroll 被触发后反向再次派发事件（2跳链路）
      _isSyncingScrollFromTimeline = true
      taskListBodyElement.scrollTop = scrollTop
      Promise.resolve().then(() => {
        _isSyncingScrollFromTimeline = false
      })
    }
  }

  // ==================== 右键菜单事件 ====================

  const handleTaskRowContextMenu = (event: { task: Task; position: { x: number; y: number } }) => {
    try {
      window.dispatchEvent(
        new CustomEvent('context-menu', {
          detail: event,
        })
      )
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('TaskList - Failed to dispatch context-menu event', error)
    }
  }

  // ==================== Splitter 拖拽事件 ====================

  const handleSplitterDragStart = () => {
    isSplitterDragging.value = true
  }

  const handleSplitterDragEnd = () => {
    isSplitterDragging.value = false
    // 拖拽结束后，手动更新一次容器宽度，触发列宽重新计算
    updateContainerWidth()
  }

  // ==================== 事件监听器注册和清理 ====================

  const registerEventListeners = () => {
    window.addEventListener('task-updated', handleTaskUpdated as EventListener)
    window.addEventListener('task-added', handleTaskAdded as EventListener)
    window.addEventListener('request-task-list', handleRequestTaskList as EventListener)
    window.addEventListener('timeline-task-hover', handleTimelineHover as EventListener)
    window.addEventListener(
      'timeline-vertical-scroll',
      handleTimelineVerticalScroll as EventListener
    )
    window.addEventListener('milestone-icon-changed', handleMilestoneIconChange as EventListener)
    window.addEventListener('splitter-drag-start', handleSplitterDragStart as EventListener)
    window.addEventListener('splitter-drag-end', handleSplitterDragEnd as EventListener)
  }

  const unregisterEventListeners = () => {
    window.removeEventListener('task-updated', handleTaskUpdated as EventListener)
    window.removeEventListener('task-added', handleTaskAdded as EventListener)
    window.removeEventListener('request-task-list', handleRequestTaskList as EventListener)
    window.removeEventListener('timeline-task-hover', handleTimelineHover as EventListener)
    window.removeEventListener(
      'timeline-vertical-scroll',
      handleTimelineVerticalScroll as EventListener
    )
    window.removeEventListener('milestone-icon-changed', handleMilestoneIconChange as EventListener)
    window.removeEventListener('splitter-drag-start', handleSplitterDragStart as EventListener)
    window.removeEventListener('splitter-drag-end', handleSplitterDragEnd as EventListener)
  }

  return {
    // 事件处理函数
    handleTaskRowHover,
    handleTaskRowDoubleClick,
    handleTaskListScroll,
    handleTaskRowContextMenu,

    // 生命周期方法
    registerEventListeners,
    unregisterEventListeners,
  }
}

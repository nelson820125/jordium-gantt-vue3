<script setup lang="ts">
import { ref, onUnmounted, onMounted, computed, watch, nextTick } from 'vue'
import TaskList from './TaskList.vue'
import Timeline from './Timeline.vue'
import GanttToolbar from './GanttToolbar.vue'
import TaskDrawer from './TaskDrawer.vue'
import MilestoneDialog from './MilestoneDialog.vue'
import { useI18n, setCustomMessages } from '../composables/useI18n'
import { formatPredecessorDisplay } from '../utils/predecessorUtils'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Task } from '../models/classes/Task'
import type { Milestone } from '../models/classes/Milestone'
import type { ToolbarConfig } from '../models/configs/ToolbarConfig'
import type { TaskListConfig } from '../models/configs/TaskListConfig'
import {
  DEFAULT_TASK_LIST_WIDTH,
  DEFAULT_TASK_LIST_MIN_WIDTH,
  DEFAULT_TASK_LIST_MAX_WIDTH,
  parseWidthValue,
} from '../models/configs/TaskListConfig'
import type { TaskBarConfig } from '../models/configs/TaskBarConfig'
import { TimelineScale, SCALE_CONFIGS } from '../models/types/TimelineScale'
import { useMessage } from '../composables/useMessage'

const props = withDefaults(defineProps<Props>(), {
  tasks: () => [],
  milestones: () => [],
  useDefaultDrawer: true,
  useDefaultMilestoneDialog: true,
  toolbarConfig: () => ({}),
  showToolbar: true,
  onTodayLocate: undefined,
  onExportCsv: undefined,
  onExportPdf: undefined,
  onLanguageChange: undefined,
  onThemeChange: undefined,
  onFullscreenChange: undefined,
  onExpandAll: undefined,
  onCollapseAll: undefined,
  localeMessages: undefined,
  workingHours: () => ({
    morning: { start: 8, end: 11 },
    afternoon: { start: 13, end: 17 },
  }),
  taskListConfig: undefined,
  taskBarConfig: undefined,
  autoSortByStartDate: false,
  allowDragAndResize: true,
})

const emit = defineEmits([
  'task-click',
  'task-double-click',
  'taskbar-drag-end',
  'taskbar-resize-end',
  'milestone-drag-end',
  'milestone-double-click',
  'timer-started',
  'timer-stopped',
  'predecessor-added',
  'successor-added',
  'task-deleted',
  'task-added',
  'task-updated',
  // 工具栏事件
  'add-task',
  'add-milestone',
  // 里程碑事件
  'milestone-saved',
  'milestone-deleted',
  'milestone-icon-changed',
])

const { showMessage } = useMessage()

interface Props {
  // 任务数据
  tasks?: Task[]
  // 里程碑数据
  milestones?: Task[]
  // 是否使用默认的TaskDrawer
  useDefaultDrawer?: boolean
  // 是否使用默认的MilestoneDialog
  useDefaultMilestoneDialog?: boolean
  // 工具栏配置
  toolbarConfig?: ToolbarConfig
  // 是否显示工具栏
  showToolbar?: boolean
  // 工具栏事件处理器
  onTodayLocate?: () => void
  onExportCsv?: () => boolean | void
  onExportPdf?: () => void
  onLanguageChange?: (lang: 'zh-CN' | 'en-US') => void
  onThemeChange?: (isDark: boolean) => void
  onFullscreenChange?: (isFullscreen: boolean) => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  /**
   * 自定义多语言（国际化）配置，支持多语言扩展。
   * 例如：
   * localeMessages={{
   *   'zh-CN': { department: '部门', departmentCode: '部门编号' },
   *   'en-US': { department: 'Department', departmentCode: 'Department Code' }
   * }}
   * 支持嵌套对象（如 csvHeaders、taskTypeMap 等）。
   * 仅在组件初始化时合并，运行时变更会自动响应。
   */
  localeMessages?: Partial<{
    'zh-CN'?: Partial<import('../composables/useI18n').Messages['zh-CN']>
    'en-US'?: Partial<import('../composables/useI18n').Messages['en-US']>
  }>
  // 工作时间配置
  workingHours?: {
    morning?: { start: number; end: number } // 上午工作时间，如 { start: 8, end: 11 }
    afternoon?: { start: number; end: number } // 下午工作时间，如 { start: 13, end: 17 }
  }
  // 任务列表配置
  taskListConfig?: TaskListConfig
  // TaskBar 配置
  taskBarConfig?: TaskBarConfig
  // 是否启用自动排序（根据开始时间排序任务）
  autoSortByStartDate?: boolean
  // 是否允许拖拽和拉伸（默认为 true）
  allowDragAndResize?: boolean
}

// TaskList的固定总长度（所有列的最小宽度之和 + 边框等额外空间）
// 列宽: 300+120+120+140+140+100+100+100 = 1120px
// 边框: 7个列间边框 * 1px = 7px
// 滚动条预留: 20px
// 额外边距: 13px (task-list-header的左边距3px + 其他10px预留)
// 总计: 1160px (已在 TaskListConfig 中定义)

// 甘特图容器宽度
const ganttRootRef = ref<HTMLElement | null>(null)
const ganttContainerWidth = ref(1920) // 默认使用常见的屏幕宽度作为初始值

// ResizeObserver 用于监听容器宽度变化
let ganttRootResizeObserver: ResizeObserver | null = null

// 监听容器宽度变化
const updateContainerWidth = (newWidth: number) => {
  if (newWidth !== ganttContainerWidth.value) {
    ganttContainerWidth.value = newWidth
    // 容器宽度变化时，重新计算 TaskList 的宽度限制
    ganttPanelLeftMinWidth.value = getTaskListMinWidth()
    taskListBodyWidth.value = getTaskListMaxWidth()
    taskListBodyProposedWidth.value = getTaskListMaxWidth()
    taskListBodyWidthLimit.value = getTaskListMaxWidth()

    // 确保当前宽度在新的限制范围内
    const adjustedWidth = checkWidthLimits(leftPanelWidth.value)
    if (adjustedWidth !== leftPanelWidth.value) {
      leftPanelWidth.value = adjustedWidth
    }
  }
}

onMounted(() => {
  if (ganttRootRef.value) {
    // 使用 ResizeObserver 监听容器宽度变化，避免频繁读取 clientWidth
    ganttRootResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // 使用 contentRect.width，避免强制重排
        updateContainerWidth(entry.contentRect.width)
      }
    })
    ganttRootResizeObserver.observe(ganttRootRef.value)
  }
})

onUnmounted(() => {
  if (ganttRootResizeObserver) {
    ganttRootResizeObserver.disconnect()
    ganttRootResizeObserver = null
  }
})

// TaskList最小宽度，支持通过taskListConfig配置（支持像素和百分比）
const getTaskListMinWidth = () => {
  const configMinWidth = parseWidthValue(
    props.taskListConfig?.minWidth,
    ganttContainerWidth.value,
    DEFAULT_TASK_LIST_MIN_WIDTH,
  )
  return Math.max(configMinWidth, DEFAULT_TASK_LIST_MIN_WIDTH) // 确保不小于280px
}

// TaskList最大宽度，支持通过taskListConfig配置（支持像素和百分比）
const getTaskListMaxWidth = () => {
  return parseWidthValue(
    props.taskListConfig?.maxWidth,
    ganttContainerWidth.value,
    DEFAULT_TASK_LIST_MAX_WIDTH,
  )
}

// TaskList默认宽度，支持通过taskListConfig配置（支持像素和百分比）
const getTaskListDefaultWidth = () => {
  return parseWidthValue(
    props.taskListConfig?.defaultWidth,
    ganttContainerWidth.value,
    DEFAULT_TASK_LIST_WIDTH,
  )
}

const taskListBodyWidth = ref(getTaskListMaxWidth()) // TaskList默认宽度
const ganttPanelLeftMinWidth = ref(getTaskListMinWidth()) // 左侧面板最小宽度
const ganttPanelLeftCurrentWidth = ref(getTaskListMinWidth()) // 当前左侧面板宽度
const taskListBodyProposedWidth = ref(getTaskListMaxWidth())
const taskListBodyWidthLimit = ref(getTaskListMaxWidth())

// 使用taskListConfig中的默认宽度，如果未配置则使用320px
const leftPanelWidth = ref(getTaskListDefaultWidth())

// 简化的限制检查函数：直接基于面板实际宽度判断
const checkWidthLimits = (proposedLeftWidth: number): number => {
  if (proposedLeftWidth < ganttPanelLeftMinWidth.value) {
    return ganttPanelLeftMinWidth.value
  } else if (proposedLeftWidth > taskListBodyWidthLimit.value) {
    return taskListBodyWidthLimit.value
  } else {
    return Math.max(ganttPanelLeftMinWidth.value, proposedLeftWidth)
  }
}

// 监听taskListConfig变化，更新相关配置
watch(
  () => props.taskListConfig,
  newConfig => {
    if (newConfig) {
      // 更新默认宽度（支持像素和百分比）
      if (newConfig.defaultWidth !== undefined) {
        leftPanelWidth.value = getTaskListDefaultWidth()
      }

      // 更新最小最大宽度限制
      ganttPanelLeftMinWidth.value = getTaskListMinWidth()
      taskListBodyWidth.value = getTaskListMaxWidth()
      taskListBodyProposedWidth.value = getTaskListMaxWidth()
      taskListBodyWidthLimit.value = getTaskListMaxWidth()
      ganttPanelLeftCurrentWidth.value = getTaskListMinWidth()

      // 确保当前宽度在新的限制范围内
      const adjustedWidth = checkWidthLimits(leftPanelWidth.value)
      if (adjustedWidth !== leftPanelWidth.value) {
        leftPanelWidth.value = adjustedWidth
      }
    }
  },
  { immediate: false, deep: true },
)

// Timeline组件的引用
const timelineRef = ref<InstanceType<typeof Timeline> | null>(null)

// Timeline容器宽度（用于计算需要多少列才能铺满）
const timelineContainerWidth = ref<number>(0)

// 任务拖拽/拉伸触发器（用于触发timeline范围重新计算）
const updateTaskTrigger = ref<number>(0)

// 时间刻度状态
const currentTimeScale = ref<TimelineScale>(TimelineScale.DAY)

// 计算是否显示关闭按钮
const showCloseButton = computed(() => {
  const taskId = timelineRef.value?.highlightedTaskId
  return taskId !== null && taskId !== undefined
})

watch(
  () => timelineRef.value,
  newTimeline => {
    if (newTimeline) {
      newTimeline.updateTimeScale(currentTimeScale.value)
    }
  },
)

const dragging = ref(false)

function onMouseDown(e: MouseEvent) {
  // 检查事件目标是否是task-list-toggle按钮或其子元素
  const target = e.target as HTMLElement
  if (target.closest('.task-list-toggle')) {
    // 如果点击的是toggle按钮，不执行拖拽逻辑
    return
  }

  // 阻止默认行为和事件冒泡，防止选择文本和触发其他事件
  e.preventDefault()
  e.stopPropagation()

  dragging.value = true

  // ⚠️ 关键修复：初始化拖拽起始点和宽度
  const startX = e.clientX
  const startWidth = leftPanelWidth.value

  // 获取task-list-body的宽度
  const taskListBody = document.querySelector('.task-list-body')
  if (!taskListBody) return
  const taskListBodyRect = taskListBody.getBoundingClientRect()
  taskListBodyWidth.value = taskListBodyRect.width

  // 获取当前inner windows宽度, 右侧预留20%的空间
  taskListBodyProposedWidth.value = window.innerWidth * 0.8 - 6 // 减去splitter宽度

  // 获取左侧面板的最小宽度
  taskListBodyWidthLimit.value = Math.min(taskListBodyProposedWidth.value,
    taskListBodyWidthLimit.value)

  // 广播拖拽开始事件，通知其他组件暂停悬停效果
  window.dispatchEvent(new CustomEvent('splitter-drag-start'))

  // 在拖拽期间禁用页面选择和所有指针事件
  document.body.style.userSelect = 'none'
  document.body.style.webkitUserSelect = 'none'
  document.body.style.cursor = 'col-resize'
  document.body.style.pointerEvents = 'none' // 禁止所有指针事件

  // 全局事件拦截器：在捕获阶段拦截所有事件（除了 mousemove 和 mouseup）
  const blockAllEvents = (ev: Event) => {
    if (ev.type !== 'mousemove' && ev.type !== 'mouseup') {
      ev.preventDefault()
      ev.stopPropagation()
      ev.stopImmediatePropagation()
    }
  }

  // 在捕获阶段添加事件监听，确保最先拦截
  document.addEventListener('mousedown', blockAllEvents, { capture: true })
  document.addEventListener('click', blockAllEvents, { capture: true })
  document.addEventListener('dblclick', blockAllEvents, { capture: true })
  document.addEventListener('mouseover', blockAllEvents, { capture: true })
  document.addEventListener('mouseout', blockAllEvents, { capture: true })
  document.addEventListener('mouseenter', blockAllEvents, { capture: true })
  document.addEventListener('mouseleave', blockAllEvents, { capture: true })
  document.addEventListener('wheel', blockAllEvents, { capture: true, passive: false })
  document.addEventListener('contextmenu', blockAllEvents, { capture: true })

  // ⚠️ 使用requestAnimationFrame节流，但移除阈值检测，确保每帧都更新
  let rafId: number | null = null

  function onMouseMove(ev: MouseEvent) {
    if (!dragging.value) return
    // 强制阻止所有默认行为和事件传播
    ev.preventDefault()
    ev.stopPropagation()
    ev.stopImmediatePropagation()

    const delta = ev.clientX - startX
    const proposedWidth = startWidth + delta
    const finalWidth = checkWidthLimits(proposedWidth)

    // 取消之前的帧请求
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }

    // 在下一帧更新（节流到60fps，避免过度触发响应式系统）
    rafId = requestAnimationFrame(() => {
      leftPanelWidth.value = finalWidth
      rafId = null
    })
  }

  function onMouseUp() {
    dragging.value = false

    // 取消未完成的帧请求
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

    // 移除全局事件拦截器
    document.removeEventListener('mousedown', blockAllEvents, { capture: true })
    document.removeEventListener('click', blockAllEvents, { capture: true })
    document.removeEventListener('dblclick', blockAllEvents, { capture: true })
    document.removeEventListener('mouseover', blockAllEvents, { capture: true })
    document.removeEventListener('mouseout', blockAllEvents, { capture: true })
    document.removeEventListener('mouseenter', blockAllEvents, { capture: true })
    document.removeEventListener('mouseleave', blockAllEvents, { capture: true })
    document.removeEventListener('wheel', blockAllEvents, { capture: true })
    document.removeEventListener('contextmenu', blockAllEvents, { capture: true })

    // 广播拖拽结束事件，通知其他组件恢复悬停效果
    window.dispatchEvent(new CustomEvent('splitter-drag-end'))

    // 恢复页面选择、光标和指针事件
    document.body.style.userSelect = ''
    document.body.style.webkitUserSelect = ''
    document.body.style.cursor = ''
    document.body.style.pointerEvents = ''

    taskListBodyWidth.value = getTaskListMaxWidth() // TaskList默认宽度
    ganttPanelLeftMinWidth.value = getTaskListMinWidth() // 左侧面板最小宽度
    taskListBodyProposedWidth.value = getTaskListMaxWidth()
    taskListBodyWidthLimit.value = getTaskListMaxWidth()
    ganttPanelLeftCurrentWidth.value = getTaskListMinWidth() // 当前左侧面板宽度

    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

// TaskList显示/隐藏状态管理
const isTaskListVisible = ref(true)

// 动画状态管理
const isAnimating = ref(false)
const animationClass = ref('')

// 切换TaskList显示状态
const toggleTaskList = () => {
  // 如果正在动画中，忽略点击
  if (isAnimating.value) return

  // 触发撞击动画
  isAnimating.value = true

  if (isTaskListVisible.value) {
    // 收起时：左侧撞击动画
    animationClass.value = 'impact-left'
  } else {
    // 展开时：右侧撞击动画
    animationClass.value = 'impact-right'
  }

  // 在动画进行到一半时切换状态
  setTimeout(() => {
    isTaskListVisible.value = !isTaskListVisible.value
  }, 200)

  // 动画结束后清理状态，并通知Timeline容器变化
  setTimeout(() => {
    isAnimating.value = false
    animationClass.value = ''

    // 手动切换TaskList后，通知Timeline重新计算半圆
    nextTick(() => {
      window.dispatchEvent(
        new CustomEvent('timeline-container-resized', {
          detail: { source: 'manual-task-list-toggle' },
        }),
      )
    })
  }, 400)
}

// 监听Timeline的TaskList切换事件
const handleToggleTaskList = (event: CustomEvent) => {
  isTaskListVisible.value = event.detail

  // TaskList切换会改变Timeline容器宽度，需要通知Timeline重新计算半圆
  // 派发事件通知Timeline容器宽度发生了变化
  nextTick(() => {
    window.dispatchEvent(
      new CustomEvent('timeline-container-resized', {
        detail: { source: 'task-list-toggle' },
      }),
    )
  })
}

// --- 事件链路：监听 Timeline 传递上来的拖拽/拉伸事件，更新数据并通过 emit 暴露 ---
function handleTaskBarDragEnd(event: CustomEvent) {
  const updatedTask = event.detail
  // 更新 props.tasks 中的任务数据
  if (props.tasks) {
    updateTaskInTree(props.tasks, updatedTask)
  }
  updateTaskTrigger.value++
  emit('taskbar-drag-end', updatedTask)
}
function handleTaskBarResizeEnd(event: CustomEvent) {
  const updatedTask = event.detail
  // 更新 props.tasks 中的任务数据
  if (props.tasks) {
    updateTaskInTree(props.tasks, updatedTask)
  }
  updateTaskTrigger.value++
  emit('taskbar-resize-end', updatedTask)
}
function handleMilestoneDragEnd(event: CustomEvent) {
  const updatedMilestone = event.detail
  updateTaskTrigger.value++
  emit('milestone-drag-end', updatedMilestone)
}

// ResizeObserver 引用，用于清理
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  window.addEventListener('taskbar-drag-end', handleTaskBarDragEnd as EventListener)
  window.addEventListener('taskbar-resize-end', handleTaskBarResizeEnd as EventListener)
  window.addEventListener('milestone-drag-end', handleMilestoneDragEnd as EventListener)

  // 监听 timeline 容器宽度变化
  nextTick(() => {
    // 监听右侧面板（timeline 的可视容器）的宽度
    const rightPanel = document.querySelector('.gantt-panel-right')
    if (rightPanel) {
      // 使用 ResizeObserver 自动更新宽度，避免直接读取clientWidth造成强制重排
      // ResizeObserver 会在开始观察时立即触发一次回调，提供初始宽度
      resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          timelineContainerWidth.value = entry.contentRect.width
        }
      })
      resizeObserver.observe(rightPanel)
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('taskbar-drag-end', handleTaskBarDragEnd as EventListener)
  window.removeEventListener('taskbar-resize-end', handleTaskBarResizeEnd as EventListener)
  window.removeEventListener('milestone-drag-end', handleMilestoneDragEnd as EventListener)

  // 清理 ResizeObserver
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

// 处理TaskList的任务折叠状态变化
const handleTaskCollapseChange = (task: Task) => {
  // 递归查找并更新原始数据中的任务折叠状态
  const updateTaskCollapsedState = (
    tasks: Task[],
    targetId: number,
    collapsed: boolean,
  ): boolean => {
    for (const t of tasks) {
      if (t.id === targetId) {
        t.collapsed = collapsed
        return true
      }
      if (t.children && t.children.length > 0) {
        if (updateTaskCollapsedState(t.children, targetId, collapsed)) {
          return true
        }
      }
    }
    return false
  }

  // 更新原始任务数据的折叠状态
  if (props.tasks) {
    updateTaskCollapsedState(props.tasks, task.id, task.collapsed ?? false)
  }

  // 触发Timeline重新计算
  updateTaskTrigger.value++
}

// 全部展开任务
const handleExpandAll = () => {
  if (props.onExpandAll && typeof props.onExpandAll === 'function') {
    props.onExpandAll()
  } else {
    // 默认行为：递归展开所有任务
    const expandAllTasks = (tasks: Task[]): void => {
      tasks.forEach(task => {
        if (task.children && task.children.length > 0) {
          task.collapsed = false
          expandAllTasks(task.children)
        }
      })
    }

    if (props.tasks) {
      expandAllTasks(props.tasks)
      // 触发Timeline重新计算
      updateTaskTrigger.value++
    }
  }
}

// 全部折叠任务
const handleCollapseAll = () => {
  if (props.onCollapseAll && typeof props.onCollapseAll === 'function') {
    props.onCollapseAll()
  } else {
    // 默认行为：递归折叠所有任务
    const collapseAllTasks = (tasks: Task[]): void => {
      tasks.forEach(task => {
        if (task.children && task.children.length > 0) {
          task.collapsed = true
          collapseAllTasks(task.children)
        }
      })
    }

    if (props.tasks) {
      collapseAllTasks(props.tasks)
      // 触发Timeline重新计算
      updateTaskTrigger.value++
    }
  }
}

// 处理TaskDrawer请求任务列表
const handleRequestTaskList = () => {
  // 创建扁平化的任务列表，包含所有任务和里程碑
  const flatTasks: Task[] = []

  // 递归扁平化任务
  const flattenTasks = (taskList: Task[]) => {
    taskList.forEach(task => {
      flatTasks.push(task)
      if (task.children && task.children.length > 0) {
        flattenTasks(task.children)
      }
    })
  }

  // 添加任务数据
  if (props.tasks) {
    flattenTasks(props.tasks)
  }

  // 添加里程碑数据
  if (props.milestones) {
    flatTasks.push(...props.milestones)
  }

  // 发送任务列表给TaskDrawer
  window.dispatchEvent(new CustomEvent('task-list-updated', { detail: flatTasks }))
}

// 当任务数据变化时，通知TaskDrawer更新
const notifyTaskListUpdated = () => {
  handleRequestTaskList()
}

// 监听任务数据变化，自动通知TaskDrawer
watch(
  [() => props.tasks, () => props.milestones],
  () => {
    // 延迟一点时间确保数据更新完成
    nextTick(() => {
      notifyTaskListUpdated()
    })
  },
  { deep: true, immediate: true },
)

onMounted(() => {
  // 监听Timeline的TaskList切换事件
  window.addEventListener('toggle-task-list', handleToggleTaskList as EventListener)
  // 监听GanttToolbar的全屏切换事件
  window.addEventListener('fullscreen-toggle', handleFullscreenToggle as EventListener)
  // 监听Timeline的里程碑相关事件
  window.addEventListener('milestone-icon-changed', handleMilestoneIconChangeEvent as EventListener)
  // 监听里程碑删除和数据变化事件
  window.addEventListener('milestone-deleted', handleMilestoneDeleted as EventListener)
  window.addEventListener('milestone-data-changed', handleMilestoneDataChanged as EventListener)
  // 监听TaskDrawer的任务列表请求
  window.addEventListener('request-task-list', handleRequestTaskList as EventListener)
  // 监听窗口大小变化
  window.addEventListener('resize', handleWindowResize)
  // 监听TaskBar的右键菜单事件
  window.addEventListener('context-menu', handleTaskContextMenu as EventListener)

  nextTick(() => {
    if (timelineRef.value && typeof timelineRef.value.scrollToTodayCenter === 'function') {
      timelineRef.value.scrollToTodayCenter()
    }
  })
})

onUnmounted(() => {
  dragging.value = false
  // 移除事件监听器
  window.removeEventListener('toggle-task-list', handleToggleTaskList as EventListener)
  window.removeEventListener('fullscreen-toggle', handleFullscreenToggle as EventListener)
  window.removeEventListener(
    'milestone-icon-changed',
    handleMilestoneIconChangeEvent as EventListener,
  )
  window.removeEventListener('milestone-deleted', handleMilestoneDeleted as EventListener)
  window.removeEventListener('milestone-data-changed', handleMilestoneDataChanged as EventListener)
  window.removeEventListener('request-task-list', handleRequestTaskList as EventListener)
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('context-menu', handleTaskContextMenu as EventListener)
})

// 全屏状态管理
const isFullscreen = ref(false)

// 多语言支持
const { t, locale } = useI18n()
const collapseTaskListText = computed(() => t.value.collapseTaskList)
const expandTaskListText = computed(() => t.value.expandTaskList)

// 为TaskList提供层级数据（保持原始层级结构，只扁平化里程碑）
const tasksForTaskList = computed(() => {
  const result: Task[] = []

  // 如果有里程碑，创建里程碑分组行（扁平化显示）
  if (props.milestones && props.milestones.length > 0) {
    const milestoneGroupRow: Task = {
      id: -1,
      name: t.value.milestoneGroup,
      startDate: '',
      endDate: '',
      type: 'milestone-group',
      children: props.milestones,
      isParent: true,
      collapsed: false,
    }
    result.push(milestoneGroupRow)
  }

  // 添加原始任务数据（完全保持层级结构，不扁平化）
  if (props.tasks && props.tasks.length > 0) {
    // 根据配置决定是否排序
    if (props.autoSortByStartDate) {
      // 递归排序函数：根据实际开始时间排序
      const sortTasksByStartDate = (tasks: Task[]): Task[] => {
        return [...tasks]
          .map(task => {
            // 递归处理子任务
            const sortedTask = { ...task }
            if (task.children && task.children.length > 0) {
              sortedTask.children = sortTasksByStartDate(task.children)
            }
            return sortedTask
          })
          .sort((a, b) => {
            // 获取实际开始时间（考虑子任务的最早时间）
            const getEarliestStartDate = (task: Task): Date => {
              // 如果有子任务，找子任务中的最早时间
              if (task.children && task.children.length > 0) {
                const childDates = task.children
                  .map(child => getEarliestStartDate(child))
                  .filter(date => date.getTime() > 0) // 过滤无效日期

                if (childDates.length > 0) {
                  return new Date(Math.min(...childDates.map(d => d.getTime())))
                }
              }

              // 没有子任务或子任务都没有时间，使用自身时间
              return task.startDate ? new Date(task.startDate) : new Date('9999-12-31')
            }

            const dateA = getEarliestStartDate(a)
            const dateB = getEarliestStartDate(b)

            // 按时间排序，时间相同时按ID排序
            const timeDiff = dateA.getTime() - dateB.getTime()
            return timeDiff !== 0 ? timeDiff : a.id - b.id
          })
      }

      // 启用排序：对任务进行递归排序
      const sortedTasks = sortTasksByStartDate(props.tasks)
      result.push(...sortedTasks)
    } else {
      // 不排序：直接使用原始任务数据
      result.push(...props.tasks)
    }
  }
  return result
})

// 为Timeline提供正确的扁平化数据
const tasksForTimeline = computed(() => {
  // 通过条件判断访问触发器，确保折叠状态变化时重新计算
  if (updateTaskTrigger.value >= 0) {
    // 触发器起作用，继续执行计算逻辑
  }

  // 创建最终结果数组
  const result: Task[] = []

  // 1. 处理里程碑数据 - 只显示里程碑分组行，不重复显示里程碑本身
  if (props.milestones && props.milestones.length > 0) {
    // 只添加里程碑分组行，里程碑本身的显示由TaskBar组件内部处理
    const milestoneGroupRow: Task = {
      id: -1,
      name: t.value.milestoneGroup,
      startDate: '',
      endDate: '',
      type: 'milestone-group',
      children: props.milestones,
      isParent: true,
      collapsed: false,
    }
    result.push(milestoneGroupRow)
  }

  // 2. 处理任务数据 - 根据TaskList的折叠状态进行智能扁平化
  if (props.tasks && props.tasks.length > 0) {
    // 递归获取所有子任务日期范围的工具函数
    const getAllChildDates = (children: Task[]): { starts: string[]; ends: string[] } => {
      const starts: string[] = []
      const ends: string[] = []

      children.forEach(child => {
        if (child.startDate) starts.push(child.startDate)
        if (child.endDate) ends.push(child.endDate)

        if (child.children && child.children.length > 0) {
          const childDates = getAllChildDates(child.children)
          starts.push(...childDates.starts)
          ends.push(...childDates.ends)
        }
      })

      return { starts, ends }
    }

    // 计算父任务的实际时间范围
    const calculateParentDateRange = (parentTask: Task): { startDate: string; endDate: string } => {
      if (!parentTask.children || parentTask.children.length === 0) {
        return {
          startDate: parentTask.startDate || '',
          endDate: parentTask.endDate || '',
        }
      }

      const { starts, ends } = getAllChildDates(parentTask.children)

      if (starts.length === 0 || ends.length === 0) {
        return {
          startDate: parentTask.startDate || '',
          endDate: parentTask.endDate || '',
        }
      }

      // 找到最早的开始日期和最晚的结束日期
      const earliestStart = starts.reduce((earliest, current) => {
        return new Date(current) < new Date(earliest) ? current : earliest
      })

      const latestEnd = ends.reduce((latest, current) => {
        return new Date(current) > new Date(latest) ? current : latest
      })

      return { startDate: earliestStart, endDate: latestEnd }
    }

    // 递归更新任务树中所有父任务的时间范围（从叶子节点开始向上）
    const updateParentDateRanges = (tasks: Task[]): Task[] => {
      return tasks.map(task => {
        let updatedTask = { ...task }

        // 先递归更新子任务
        if (task.children && task.children.length > 0) {
          updatedTask.children = updateParentDateRanges(task.children)
        }

        // 基于任务类型判断是否为父任务
        const isParent =
          task.type === 'story' || (updatedTask.children && updatedTask.children.length > 0)
        updatedTask.isParent = isParent

        // 如果是父任务且有子任务，重新计算时间范围
        if (isParent && updatedTask.children && updatedTask.children.length > 0) {
          const { startDate, endDate } = calculateParentDateRange(updatedTask)
          updatedTask = {
            ...updatedTask,
            startDate,
            endDate,
          }
        }

        return updatedTask
      })
    }

    // 智能扁平化：只扁平化未折叠的任务
    const smartFlattenTasks = (tasks: Task[], level = 0): Task[] => {
      const flattened: Task[] = []

      tasks.forEach(task => {
        // 添加当前任务（设置层级）
        const processedTask: Task = {
          ...task,
          level,
        }
        flattened.push(processedTask)

        // 关键：只有当父任务未折叠时，才添加子任务到Timeline
        if (task.children && task.children.length > 0 && !task.collapsed) {
          const childTasks = smartFlattenTasks(task.children, level + 1)
          flattened.push(...childTasks)
        }
      })

      return flattened
    }

    // 使用TaskList当前的数据状态进行扁平化
    // 重要：确保使用TaskList组件内部的最新状态，包括折叠状态
    const currentTasks = tasksForTaskList.value.filter(task => task.type !== 'milestone-group')

    // 先更新所有父任务的时间范围（从叶子节点开始向上递归）
    const tasksWithUpdatedDates = updateParentDateRanges(currentTasks)

    // 因为tasksForTaskList返回的是props.tasks的副本，我们需要确保Timeline能看到最新的折叠状态
    // 通过触发器强制重新计算来实现状态同步
    const flattenedTasks = smartFlattenTasks(tasksWithUpdatedDates)
    result.push(...flattenedTasks)
  }

  return result
})

// 将Task[]转换为Milestone[]的计算属性，确保类型兼容
const milestonesForTimeline = computed((): Milestone[] => {
  // 通过条件判断访问触发器，确保里程碑更新时重新计算
  if (updateTaskTrigger.value >= 0) {
    // 触发器起作用，继续执行计算逻辑
  }

  if (!props.milestones) return []

  // 过滤出有startDate的里程碑，并转换为Milestone类型
  const result = props.milestones
    .filter((task): task is Task & { startDate: string } => !!task.startDate)
    .map(task => ({
      id: task.id,
      name: task.name,
      startDate: task.startDate, // 此时已确保非空
      endDate: task.endDate,
      assignee: task.assignee,
      type: task.type || 'milestone',
      icon: task.icon,
      description: task.description,
    }))

  return result
})

// 计算所有任务和里程碑的最小开始时间和最大结束时间
const timelineDateRange = computed(() => {
  // 触发器依赖：确保拖拽/拉伸后会重新计算
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  updateTaskTrigger.value

  // 扁平化所有任务和子任务
  const flattenTasks = (tasks: Task[]): Task[] => {
    let result: Task[] = []
    tasks.forEach(task => {
      result.push(task)
      if (task.children && task.children.length > 0) {
        result = result.concat(flattenTasks(task.children))
      }
    })
    return result
  }

  let allTasks: Task[] = []
  if (props.tasks) allTasks = allTasks.concat(flattenTasks(props.tasks))
  if (props.milestones) allTasks = allTasks.concat(props.milestones)

  // 过滤出有日期的任务
  const startDates = allTasks
    .map(t => t.startDate)
    .filter(Boolean)
    .map(d => new Date(d!))
  const endDates = allTasks
    .map(t => t.endDate)
    .filter(Boolean)
    .map(d => new Date(d!))

  // 如果没有任务，使用默认范围（今天为中心，±6个月）
  if (startDates.length === 0 || endDates.length === 0) {
    const today = new Date()
    const min = new Date(today.getFullYear(), today.getMonth() - 6, 1)
    const max = new Date(today.getFullYear(), today.getMonth() + 6 + 1, 0)
    return { min, max }
  }

  // 1. 获取任务的实际范围
  const taskMinDate = new Date(Math.min(...startDates.map(d => d.getTime())))
  const taskMaxDate = new Date(Math.max(...endDates.map(d => d.getTime())))

  // 2. 获取容器宽度和当前刻度的列宽
  const containerWidth = timelineContainerWidth.value || 1200 // 默认值
  const columnWidth = SCALE_CONFIGS[currentTimeScale.value].cellWidth

  // 3. 计算需要多少列才能铺满容器
  const minColumns = Math.ceil(containerWidth / columnWidth)

  // 4. 应用固定 buffer + 确保铺满容器
  const { min, max } = applyBufferAndFillContainer(
    taskMinDate,
    taskMaxDate,
    currentTimeScale.value,
    minColumns,
    columnWidth,
  )

  return { min, max }
})

/**
 * 应用固定 buffer 规则并确保铺满容器
 * Buffer 规则：
 * - 小时视图：±1天
 * - 日视图：±15天
 * - 周视图：±1个月（对齐到整月）
 * - 月视图：±1年
 * - 季度视图：±1年
 * - 年度视图：±1年
 */
function applyBufferAndFillContainer(
  taskMin: Date,
  taskMax: Date,
  scale: TimelineScale,
  minColumns: number,
  columnWidth: number,
): { min: Date; max: Date } {
  let min: Date
  let max: Date

  switch (scale) {
  case TimelineScale.HOUR: {
    // 小时视图：±1天
    min = new Date(taskMin.getTime() - 24 * 60 * 60 * 1000)
    max = new Date(taskMax.getTime() + 24 * 60 * 60 * 1000)
    // 确保至少有 minColumns 小时
    const currentHours = Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60))
    if (currentHours < minColumns) {
      const needHours = minColumns - currentHours
      const expandEach = Math.ceil(needHours / 2)
      min = new Date(min.getTime() - expandEach * 60 * 60 * 1000)
      max = new Date(max.getTime() + expandEach * 60 * 60 * 1000)
    }
    break
  }
  case TimelineScale.DAY: {
    // 日视图：±15天，显示 buffer 日期所在月份的完整月份

    // 1. 计算 buffer 日期
    const minBufferDate = new Date(taskMin)
    minBufferDate.setDate(minBufferDate.getDate() - 15)

    const maxBufferDate = new Date(taskMax)
    maxBufferDate.setDate(maxBufferDate.getDate() + 15)

    // 2. 获取 buffer 日期所在月份的第一天和最后一天
    min = new Date(minBufferDate.getFullYear(), minBufferDate.getMonth(), 1)
    max = new Date(maxBufferDate.getFullYear(), maxBufferDate.getMonth() + 1, 0)

    // 3. 确保至少有 minColumns 天
    const currentDays = Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24))
    if (currentDays < minColumns) {
      const needDays = minColumns - currentDays
      const expandMonths = Math.ceil(needDays / 30) // 按月扩展

      // 向前扩展整月
      const newMinMonth = min.getMonth() - expandMonths
      const newMinYear = min.getFullYear() + Math.floor(newMinMonth / 12)
      const normalizedMinMonth = ((newMinMonth % 12) + 12) % 12
      min = new Date(newMinYear, normalizedMinMonth, 1)

      // 向后扩展整月
      const newMaxMonth = max.getMonth() + expandMonths + 1
      const newMaxYear = max.getFullYear() + Math.floor(newMaxMonth / 12)
      const normalizedMaxMonth = ((newMaxMonth % 12) + 12) % 12
      max = new Date(newMaxYear, normalizedMaxMonth, 0)
    }
    break
  }
  case TimelineScale.WEEK: {
    // 周视图：确保铺满容器，按整月扩展

    // 工具函数：获取某日期所在周的周一
    const getMonday = (date: Date): Date => {
      const d = new Date(date)
      const day = d.getDay() || 7
      d.setDate(d.getDate() - (day - 1))
      return d
    }

    // 工具函数：获取某月第一个周一在该月的周（该月最小日期作为周一的周）
    const getFirstMondayOfMonth = (year: number, month: number): Date => {
      let day = 1
      while (day <= 31) {
        const date = new Date(year, month, day)
        if (date.getMonth() !== month) break // 超出该月
        const monday = getMonday(date)
        if (monday.getMonth() === month) {
          return monday
        }
        day++
      }
      return new Date(year, month, 1) // 兜底
    }

    // 工具函数：获取某月最后一个周一在该月的周（该月最大日期作为周一的周）
    const getLastMondayOfMonth = (year: number, month: number): Date => {
      const lastDay = new Date(year, month + 1, 0).getDate()
      for (let day = lastDay; day >= 1; day--) {
        const date = new Date(year, month, day)
        const monday = getMonday(date)
        if (monday.getMonth() === month) {
          return monday
        }
      }
      return new Date(year, month, 1) // 兜底
    }

    // 工具函数：获取某月的所有周（周一在该月的周）
    const getWeeksOfMonth = (year: number, month: number): Date[] => {
      const weeks: Date[] = []
      const firstMonday = getFirstMondayOfMonth(year, month)
      const lastMonday = getLastMondayOfMonth(year, month)
      const current = new Date(firstMonday)
      while (current <= lastMonday) {
        weeks.push(new Date(current))
        current.setDate(current.getDate() + 7)
      }
      return weeks
    }

    // 1. 获取最早TaskBar/Milestone的最小开始日期所在周的周一
    const minMonday = getMonday(taskMin)
    const minYear = minMonday.getFullYear()
    const minMonth = minMonday.getMonth()

    // 2. 基于第一周周一往前追加一个完整月份的周数作为baseBuffer
    const prevMonth = minMonth === 0 ? 11 : minMonth - 1
    const prevYear = minMonth === 0 ? minYear - 1 : minYear
    const prevMonthWeeks = getWeeksOfMonth(prevYear, prevMonth)

    // 3. 获取最晚TaskBar/Milestone的最大开始日期所在周的周一
    const maxMonday = getMonday(taskMax)
    const maxYear = maxMonday.getFullYear()
    const maxMonth = maxMonday.getMonth()

    // 4. 基于最后一周周日往后追加一个完整月份的周数作为baseBuffer
    const nextMonth = maxMonth === 11 ? 0 : maxMonth + 1
    const nextYear = maxMonth === 11 ? maxYear + 1 : maxYear
    const nextMonthWeeks = getWeeksOfMonth(nextYear, nextMonth)

    // 初始weeks：前buffer月 + 最小月到最大月之间所有月 + 后buffer月
    let weeks: Date[] = []

    // 添加前buffer月
    weeks.push(...prevMonthWeeks)

    // 添加最小月到最大月之间的所有月份的周
    let currentYear = minYear
    let currentMonth = minMonth
    while (currentYear < maxYear || (currentYear === maxYear && currentMonth <= maxMonth)) {
      const monthWeeks = getWeeksOfMonth(currentYear, currentMonth)
      weeks.push(...monthWeeks)
      currentMonth++
      if (currentMonth > 11) {
        currentMonth = 0
        currentYear++
      }
    }

    // 添加后buffer月
    weeks.push(...nextMonthWeeks)

    // 5. 判断是否填满容器，不够则继续扩展前后的完整月份
    const weekWidth = 60 // 周视图：每周60px
    let totalWidth = weeks.length * weekWidth
    while (totalWidth < minColumns * columnWidth) {
      // 前面扩展一个完整月
      const firstWeek = weeks[0]
      const firstYear = firstWeek.getFullYear()
      const firstMonth = firstWeek.getMonth()
      const extendPrevMonth = firstMonth === 0 ? 11 : firstMonth - 1
      const extendPrevYear = firstMonth === 0 ? firstYear - 1 : firstYear
      const extendPrevWeeks = getWeeksOfMonth(extendPrevYear, extendPrevMonth)
      weeks = [...extendPrevWeeks, ...weeks]
      totalWidth = weeks.length * weekWidth

      if (totalWidth >= minColumns * columnWidth) break

      // 后面扩展一个完整月
      const lastWeek = weeks[weeks.length - 1]
      const lastYear = lastWeek.getFullYear()
      const lastMonth = lastWeek.getMonth()
      const extendNextMonth = lastMonth === 11 ? 0 : lastMonth + 1
      const extendNextYear = lastMonth === 11 ? lastYear + 1 : lastYear
      const extendNextWeeks = getWeeksOfMonth(extendNextYear, extendNextMonth)
      weeks = [...weeks, ...extendNextWeeks]
      totalWidth = weeks.length * weekWidth
    }

    // 6. 计算最终 min/max
    min = new Date(weeks[0])
    max = new Date(weeks[weeks.length - 1])
    max.setDate(max.getDate() + 6) // 该周的周日

    break
  }
  case TimelineScale.MONTH: {
    // 月视图：±1年
    min = new Date(taskMin.getFullYear() - 1, taskMin.getMonth(), 1)
    max = new Date(taskMax.getFullYear() + 1, taskMax.getMonth() + 1, 0)
    // 确保至少有 minColumns 月
    const currentMonths =
      (max.getFullYear() - min.getFullYear()) * 12 + (max.getMonth() - min.getMonth())
    if (currentMonths < minColumns) {
      const needMonths = minColumns - currentMonths
      const expandEach = Math.ceil(needMonths / 2)
      min = new Date(min.getFullYear(), min.getMonth() - expandEach, 1)
      max = new Date(max.getFullYear(), max.getMonth() + expandEach + 1, 0)
    }
    break
  }
  case TimelineScale.QUARTER: {
    // 季度视图：以今日为中心，±2年 buffer，不够则继续扩展
    const today = new Date()
    const todayYear = today.getFullYear()

    // 1. 先确保包含任务范围 + ±2年 buffer
    const taskMinYear = taskMin.getFullYear()
    const taskMaxYear = taskMax.getFullYear()

    min = new Date(Math.min(todayYear - 2, taskMinYear - 2), 0, 1)
    max = new Date(Math.max(todayYear + 2, taskMaxYear + 2), 11, 31)

    // 2. 检查是否能填充容器
    const currentQuarters = (max.getFullYear() - min.getFullYear() + 1) * 4
    if (currentQuarters < minColumns) {
      // 需要扩展，以1年（4个季度）为单位
      const needQuarters = minColumns - currentQuarters
      const expandYears = Math.ceil(needQuarters / 4)

      // 以今日为中心扩展
      const expandEach = Math.ceil(expandYears / 2)
      min = new Date(min.getFullYear() - expandEach, 0, 1)
      max = new Date(max.getFullYear() + expandEach, 11, 31)
    }
    break
  }
  case TimelineScale.YEAR: {
    // 年度视图：以今日为中心，±2年 buffer，不够则继续扩展（与季度视图逻辑一致）
    const today = new Date()
    const todayYear = today.getFullYear()

    // 1. 先确保包含任务范围 + ±2年 buffer
    const taskMinYear = taskMin.getFullYear()
    const taskMaxYear = taskMax.getFullYear()

    min = new Date(Math.min(todayYear - 2, taskMinYear - 2), 0, 1)
    max = new Date(Math.max(todayYear + 2, taskMaxYear + 2), 11, 31)

    // 2. 检查是否能填充容器（年度视图每年2个半年，每个半年是一列）
    const currentHalfYears = (max.getFullYear() - min.getFullYear() + 1) * 2
    if (currentHalfYears < minColumns) {
      // 需要扩展，以1年（2个半年）为单位
      const needHalfYears = minColumns - currentHalfYears
      const expandYears = Math.ceil(needHalfYears / 2)

      // 以今日为中心扩展
      const expandEach = Math.ceil(expandYears / 2)
      min = new Date(min.getFullYear() - expandEach, 0, 1)
      max = new Date(max.getFullYear() + expandEach, 11, 31)
    }
    break
  }
  default:
    min = taskMin
    max = taskMax
  }

  return { min, max }
}

// CSV导出处理器包装函数
const csvExportHandler = () => {
  // 如果有外部处理器，先调用它
  if (props.onExportCsv && typeof props.onExportCsv === 'function') {
    const result = props.onExportCsv()
    // 如果外部处理器返回 false，则继续执行默认导出
    // 如果返回其他值或者 undefined，则认为外部已经处理了导出
    if (result === false) {
      defaultExportCsv()
    }
    return
  }

  // 使用默认导出实现
  defaultExportCsv()
}

// 时间刻度变化处理函数
const handleTimeScaleChange = (scale: TimelineScale) => {
  currentTimeScale.value = scale
  // 通知 Timeline 组件更新时间刻度
  if (timelineRef.value) {
    timelineRef.value.updateTimeScale(scale)
  }
}

// Timeline组件时间刻度变化完成后的处理函数
const handleTimelineScaleChanged = (scale: TimelineScale) => {
  // 强制重新渲染所有TaskBar，触发位置重新计算
  nextTick(() => {
    // 触发强制更新，让所有TaskBar重新计算位置
    const event = new CustomEvent('timeline-scale-updated', { detail: scale })
    window.dispatchEvent(event)
  })
}

// 处理关闭高亮
const handleClearHighlight = () => {
  if (timelineRef.value?.clearHighlight) {
    timelineRef.value.clearHighlight()
  }
}

// 默认CSV导出功能
const defaultExportCsv = () => {
  try {
    // 合并任务和里程碑数据进行导出
    const allData: Task[] = []

    // 添加任务数据
    if (props.tasks && props.tasks.length > 0) {
      allData.push(...props.tasks)
    }

    // 添加里程碑数据
    if (props.milestones && props.milestones.length > 0) {
      allData.push(...props.milestones)
    }

    // 生成CSV内容
    const csvContent = generateCsvContent(allData)

    // 添加UTF-8 BOM以确保在Excel等程序中正确显示中文
    const BOM = '\uFEFF'
    const csvWithBOM = BOM + csvContent

    // 创建下载链接，明确指定UTF-8编码
    const blob = new Blob([csvWithBOM], {
      type: 'text/csv;charset=utf-8;',
    })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    // 根据当前语言生成文件名
    const currentDate = new Date().toISOString().split('T')[0]
    const filename = `gantt-tasks-${currentDate}.csv`

    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // 清理URL对象
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('CSV导出失败:', error)
    showMessage('CSV导出失败', 'error', { closable: false })
  }
}

// 生成CSV内容
const generateCsvContent = (tasks: Task[]): string => {
  // 使用多语言的CSV头部 - 动态获取当前语言状态
  const csvHeaders = t.value.csvHeaders
  const headers = [
    csvHeaders.id,
    csvHeaders.taskName,
    csvHeaders.predecessor,
    csvHeaders.assignee,
    csvHeaders.startDate,
    csvHeaders.endDate,
    csvHeaders.estimatedHours,
    csvHeaders.actualHours,
    csvHeaders.progress,
    csvHeaders.type,
    csvHeaders.description,
  ]

  // 安全的字符串转义函数
  const escapeCSVField = (value: any): string => {
    if (value === null || value === undefined) {
      return ''
    }

    const stringValue = String(value)

    // 如果字段包含逗号、引号、换行符等特殊字符，需要用引号包围并转义内部引号
    if (
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n') ||
      stringValue.includes('\r')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`
    }

    return stringValue
  }

  // 扁平化任务数据（包含子任务）
  const flattenTasks = (taskList: Task[]): any[] => {
    const result: any[] = []

    taskList.forEach(task => {
      // 添加当前任务，使用安全的数据处理
      result.push({
        id: task.id,
        name: task.name || '',
        predecessor: formatPredecessorDisplay(task.predecessor),
        assignee: task.assignee || '',
        startDate: task.startDate || '',
        endDate: task.endDate || '',
        estimatedHours: task.estimatedHours || '',
        actualHours: task.actualHours || '',
        progress: task.progress !== undefined ? `${task.progress}%` : '',
        type: task.type || '',
        description: task.description || '',
      })

      // 递归添加子任务
      if (task.children && task.children.length > 0) {
        result.push(...flattenTasks(task.children))
      }
    })

    return result
  }

  const flatTasks = flattenTasks(tasks)

  // 生成CSV行，使用安全的字符串转义
  const csvRows = [
    // 头部行 - 也需要进行转义处理
    headers.map(header => escapeCSVField(header)).join(','),
    // 数据行
    ...flatTasks.map(task => {
      return [
        escapeCSVField(task.id),
        escapeCSVField(task.name),
        escapeCSVField(formatPredecessorDisplay(task.predecessor)),
        escapeCSVField(task.assignee),
        escapeCSVField(task.startDate),
        escapeCSVField(task.endDate),
        escapeCSVField(task.estimatedHours),
        escapeCSVField(task.actualHours),
        escapeCSVField(task.progress),
        escapeCSVField(task.type),
        escapeCSVField(task.description),
      ].join(',')
    }),
  ]

  return csvRows.join('\n')
}

// PDF导出处理器
const pdfExportHandler = async () => {
  try {
    // 获取当前语言的文本
    const loadingText = t.value.pdfExportLoading
    const titleText = t.value.pdfExportTitle
    const dateLabel = t.value.pdfExportDate

    // 创建加载提示
    const loadingEl = document.createElement('div')
    loadingEl.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                  background: rgba(0,0,0,0.5); display: flex; align-items: center;
                  justify-content: center; z-index: 10000; color: white; font-size: 16px;">
        ${loadingText}
      </div>
    `
    document.body.appendChild(loadingEl)

    // 获取甘特图容器元素
    const ganttElement = document.querySelector('.gantt-body') as HTMLElement
    if (!ganttElement) {
      throw new Error('找不到甘特图元素')
    }

    // 设置临时样式以确保完整截图
    const originalStyle = {
      overflow: ganttElement.style.overflow,
      height: ganttElement.style.height,
    }

    ganttElement.style.overflow = 'visible'
    ganttElement.style.height = 'auto'

    // 使用html2canvas捕获甘特图
    const canvas = await html2canvas(ganttElement, {
      allowTaint: true,
      useCORS: true,
      scale: 2, // 提高清晰度
      width: ganttElement.scrollWidth,
      height: ganttElement.scrollHeight,
      backgroundColor: '#ffffff',
    })

    // 恢复原始样式
    ganttElement.style.overflow = originalStyle.overflow
    ganttElement.style.height = originalStyle.height

    // 创建PDF
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'landscape', // 横向布局更适合甘特图
      unit: 'mm',
      format: 'a4',
    })

    // 计算图片在PDF中的尺寸
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = canvas.width
    const imgHeight = canvas.height

    // 计算缩放比例，保持宽高比
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
    const scaledWidth = imgWidth * ratio
    const scaledHeight = imgHeight * ratio

    // 居中放置
    const x = (pdfWidth - scaledWidth) / 2
    const y = (pdfHeight - scaledHeight) / 2

    // 添加标题
    pdf.setFontSize(16)
    pdf.text(titleText, pdfWidth / 2, 15, { align: 'center' })

    // 添加日期
    pdf.setFontSize(10)
    const currentDate = new Date().toLocaleDateString(locale.value)
    pdf.text(`${dateLabel}: ${currentDate}`, pdfWidth - 10, 10, { align: 'right' })

    // 添加甘特图图片
    pdf.addImage(imgData, 'PNG', x, y + 10, scaledWidth, scaledHeight - 15)

    // 如果内容超出一页，分页处理
    if (scaledHeight > pdfHeight - 30) {
      // 计算需要的页数
      const pages = Math.ceil(scaledHeight / (pdfHeight - 30))

      for (let i = 1; i < pages; i++) {
        pdf.addPage()
        const offsetY = -i * (pdfHeight - 30)
        pdf.addImage(imgData, 'PNG', x, y + 10 + offsetY, scaledWidth, scaledHeight - 15)
      }
    }

    // 保存PDF
    const filename = `gantt-chart-${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(filename)

    // 移除加载提示
    if (loadingEl && loadingEl.parentNode) {
      loadingEl.parentNode.removeChild(loadingEl)
    }
  } catch (error) {
    // 移除加载提示
    const loadingEl = document.querySelector('[style*="position: fixed"]')
    if (loadingEl && loadingEl.parentNode) {
      loadingEl.parentNode.removeChild(loadingEl)
    }

    console.error('PDF导出失败:', error)
    alert('PDF导出失败')
  }
}

// 监听GanttToolbar的全屏切换事件
const handleFullscreenToggle = (event: CustomEvent) => {
  isFullscreen.value = event.detail

  // 调用外部传入的全屏处理器
  if (props.onFullscreenChange && typeof props.onFullscreenChange === 'function') {
    props.onFullscreenChange(isFullscreen.value)
  }

  // 全屏切换会改变Timeline容器宽度，需要通知Timeline重新计算TaskBar位置和关系线
  // 延迟到动画完成后（全屏动画需要 300ms），确保容器尺寸已经稳定
  setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent('timeline-container-resized', {
        detail: { source: 'fullscreen-toggle' },
      }),
    )
  }, 500) // 比动画时间稍长一点，确保完全完成
}

// 更新或添加里程碑到列表中
const updateOrAddMilestone = (milestones: Task[], milestone: Task): boolean => {
  const existingIndex = milestones.findIndex(m => m.id === milestone.id)
  if (existingIndex !== -1) {
    // 更新现有里程碑 - 使用 splice 确保响应式
    milestones.splice(existingIndex, 1, { ...milestones[existingIndex], ...milestone })
    return true
  } else {
    // 添加新里程碑
    milestones.push(milestone)
    return true
  }
}

// 处理里程碑保存事件
const handleMilestoneSave = (milestone: Task) => {
  // 如果是新建里程碑（没有id），生成一个临时ID
  if (!milestone.id) {
    milestone.id = Date.now()
  }

  // 确保里程碑有必要的属性
  milestone.type = 'milestone'

  // 1. 先更新 props.milestones 数据（自动处理数据）
  if (props.milestones) {
    updateOrAddMilestone(props.milestones, milestone)
  }

  // 2. 触发里程碑保存事件（新的事件驱动 API）
  emit('milestone-saved', milestone)

  // 3. 强制更新任务触发器，确保Timeline重新计算
  updateTaskTrigger.value++

  // 如果是从对话框保存的，关闭对话框
  if (milestoneDialogVisible.value) {
    handleMilestoneDialogClose()
  }
}

// 更新里程碑图标
const updateMilestoneIcon = (milestones: Task[], milestoneId: number, icon: string): boolean => {
  const index = milestones.findIndex(m => m.id === milestoneId)
  if (index !== -1) {
    // 使用 splice 确保响应式更新
    milestones.splice(index, 1, { ...milestones[index], icon })
    return true
  }
  return false
}

// 处理里程碑图标变更事件
const handleMilestoneIconChangeEvent = (event: CustomEvent) => {
  const { milestoneId, icon } = event.detail

  // 1. 先更新 props.milestones 中的图标（自动处理数据）
  if (props.milestones) {
    updateMilestoneIcon(props.milestones, milestoneId, icon)
  }

  // 2. 触发里程碑图标变更事件（新的事件驱动 API）
  emit('milestone-icon-changed', { milestoneId, icon })

  // 3. 强制更新任务触发器，确保Timeline重新计算
  updateTaskTrigger.value++
}

// 从里程碑列表中删除指定的里程碑
const removeMilestone = (milestones: Task[], milestoneId: number): boolean => {
  const index = milestones.findIndex(m => m.id === milestoneId)
  if (index !== -1) {
    milestones.splice(index, 1)
    return true
  }
  return false
}

// 处理里程碑删除事件（从全局事件触发，主要用于向后兼容）
const handleMilestoneDeleted = () => {
  // 注意：由于新的架构中，handleMilestoneDialogDelete 已经处理了数据删除
  // 这里只处理强制更新，避免重复删除导致的问题

  // 强制更新任务触发器，确保Timeline重新计算
  updateTaskTrigger.value++
}

// 处理里程碑数据变化事件
const handleMilestoneDataChanged = () => {
  // 里程碑数据发生变化时，强制更新任务触发器
  // 这会触发 tasksForTimeline 的重新计算
  updateTaskTrigger.value++

  // 确保DOM更新
  nextTick(() => {
    // 可以在这里添加额外的更新逻辑
  })
}

// 保证页面加载后自动居中今日
onMounted(() => {
  nextTick(() => {
    if (timelineRef.value && typeof timelineRef.value.scrollToTodayCenter === 'function') {
      timelineRef.value.scrollToTodayCenter()
    }
  })
})

// 今日定位处理器
const todayLocateHandler = () => {
  // 如果有外部处理器，先调用它
  if (props.onTodayLocate && typeof props.onTodayLocate === 'function') {
    props.onTodayLocate()
    return
  }
  // 使用Timeline组件的scrollToTodayCenter方法，确保今日居中
  if (timelineRef.value && typeof timelineRef.value.scrollToTodayCenter === 'function') {
    timelineRef.value.scrollToTodayCenter()
    return
  }
  // 兜底方案
  defaultTodayLocate()
}

// 里程碑添加处理器
const milestoneAddHandler = () => {
  // 先派发事件，让外部有机会处理
  emit('add-milestone')

  // 如果启用默认里程碑对话框，则使用内置实现
  if (props.useDefaultMilestoneDialog) {
    defaultAddMilestone()
  }
}

// 默认里程碑添加功能
const defaultAddMilestone = () => {
  // 打开里程碑对话框（editingMilestone 为 null 表示新建）
  editingMilestone.value = null
  milestoneDialogVisible.value = true
}

// 默认今日定位功能
const defaultTodayLocate = () => {
  // 优先使用Timeline组件的scrollToToday方法（已优化的定位逻辑）
  if (timelineRef.value && typeof timelineRef.value.scrollToToday === 'function') {
    timelineRef.value.scrollToToday()
    return
  }

  // 如果Timeline组件或方法不可用，使用备用方案
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentDay = today.getDate()

  // 计算今天在时间轴中的位置
  let totalDays = 0
  for (let i = 0; i < currentMonth; i++) {
    totalDays += new Date(today.getFullYear(), i + 1, 0).getDate()
  }
  totalDays += currentDay

  // 计算滚动位置（每个日期30px宽度）
  const timelinePanel = document.querySelector('.gantt-panel-right')
  const timelinePanelW = timelinePanel?.clientWidth
  const offset = timelinePanelW ? timelinePanelW / 2 : 200 // 偏移量让今天居中显示
  const scrollPosition = (totalDays - 1) * 30 - offset

  // 滚动到指定位置
  const timeline = document.querySelector('.timeline') as HTMLElement
  if (timeline) {
    timeline.scrollLeft = Math.max(0, scrollPosition)

    // 添加今日高亮效果到对应的日期列
    const todayColumn = timeline.querySelector('.day-column.today') as HTMLElement
    if (todayColumn) {
      todayColumn.classList.add('today-highlight')
      setTimeout(() => {
        todayColumn.classList.remove('today-highlight')
      }, 2000)
    }
  }
}

// 窗口大小变化处理函数
const handleWindowResize = () => {
  // 直接检查当前宽度是否仍然有效，如果超出限制则调整
  const adjustedWidth = checkWidthLimits(leftPanelWidth.value)
  if (adjustedWidth !== leftPanelWidth.value) {
    leftPanelWidth.value = adjustedWidth
  }
}

// 设置自定义多语言消息（支持多语言）
if (props.localeMessages) {
  Object.keys(props.localeMessages).forEach(localeKey => {
    const messages = props.localeMessages![localeKey as keyof typeof props.localeMessages]
    if (messages) {
      setCustomMessages(localeKey as import('../composables/useI18n').Locale, messages)
    }
  })
}

// 监听自定义多语言变化
watch(
  () => props.localeMessages,
  val => {
    if (val) {
      Object.keys(val).forEach(localeKey => {
        const messages = val[localeKey as keyof typeof val]
        if (messages) {
          setCustomMessages(localeKey as import('../composables/useI18n').Locale, messages)
        }
      })
    }
  },
  { deep: true },
)

// 右键菜单状态管理
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuVisible = ref(false)
const contextMenuTask = ref<Task | null>(null)

// TaskDrawer 相关变量
const taskDrawerVisible = ref(false)
const taskDrawerTask = ref<Task | null>(null)
const taskDrawerEditMode = ref(false)

// MilestoneDialog 相关变量
const milestoneDialogVisible = ref(false)
const editingMilestone = ref<Milestone | null>(null)

// 添加前置任务功能相关变量
const taskToAddPredecessorTo = ref<Task | null>(null) // 要添加前置任务的目标任务
// 添加后置任务功能相关变量
const taskToAddSuccessorTo = ref<Task | null>(null) // 要添加后置任务的目标任务

// 处理任务条的右键菜单事件
const handleTaskContextMenu = (event: CustomEvent) => {
  // 显示右键菜单
  const { task, position } = event.detail

  // 显示右键菜单
  contextMenuTask.value = task
  contextMenuPosition.value = position
  contextMenuVisible.value = true
}

// 关闭右键菜单
const closeContextMenu = () => {
  contextMenuVisible.value = false
}

// 工具栏新建任务事件处理
function handleToolbarAddTask() {
  // 向外部发出 add-task 事件，让使用者决定如何处理
  emit('add-task')

  // 如果使用默认 TaskDrawer，则打开内置的任务抽屉
  if (props.useDefaultDrawer) {
    const newTask: Task = {
      id: Date.now(), // 临时id，实际保存时应由后端分配
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
      children: [],
    }
    taskDrawerTask.value = newTask
    taskDrawerEditMode.value = false
    taskDrawerVisible.value = true
  }
}

// 监听TaskDrawer、TaskList、Timeline的计时事件，统一处理
const handleStartTimer = (task: Task) => {
  // 任务树内状态同步
  if (props.tasks) {
    const updateTask = (tasks: Task[]): boolean => {
      for (let i = 0; i < tasks.length; i++) {
        if (tasks[i].id === task.id) {
          tasks[i].isTimerRunning = true
          tasks[i].timerStartTime = task.timerStartTime || Date.now()
          tasks[i].timerEndTime = undefined
          tasks[i].timerElapsedTime = 0
          return true
        }
        if (tasks[i].children?.length) {
          if (updateTask(tasks[i].children as Task[])) return true
        }
      }
      return false
    }
    updateTask(props.tasks)
  }
  closeContextMenu()
  emit('timer-started', task)
}

const handleStopTimer = (task: Task) => {
  // 任务树内状态同步
  if (props.tasks) {
    const updateTask = (tasks: Task[]): boolean => {
      for (let i = 0; i < tasks.length; i++) {
        if (tasks[i].id === task.id) {
          if (tasks[i].isTimerRunning && tasks[i].timerStartTime !== undefined) {
            const elapsed = tasks[i].timerElapsedTime || 0
            tasks[i].timerElapsedTime = elapsed + (Date.now() - tasks[i].timerStartTime!)
            tasks[i].timerEndTime = Date.now()
          }
          tasks[i].isTimerRunning = false
          if (
            taskDrawerVisible.value &&
            taskDrawerTask.value &&
            taskDrawerTask.value.id === task.id
          ) {
            taskDrawerTask.value.isTimerRunning = false
            taskDrawerTask.value.timerEndTime = Date.now()
          }
          return true
        }
        if (tasks[i].children?.length) {
          if (updateTask(tasks[i].children as Task[])) return true
        }
      }
      return false
    }
    updateTask(props.tasks)
  }
  closeContextMenu()
  emit('timer-stopped', task)
}

// 监听来自Timeline的任务单击事件
function handleTimelineClickTask(task: Task, event: MouseEvent) {
  emit('task-click', task, event)
}

// 监听来自Timeline的任务编辑事件（双击）
function handleTimelineEditTask(task: Task) {
  emit('task-double-click', task)

  // 根据 useDefaultDrawer 决定是否打开内置 TaskDrawer
  if (props.useDefaultDrawer) {
    taskDrawerTask.value = task
    taskDrawerEditMode.value = true
    taskDrawerVisible.value = true
  }
}

// 处理添加前置任务事件
function handleAddPredecessor(targetTask: Task) {
  if (!targetTask) return

  // 1. 记录要添加前置任务的目标任务
  taskToAddPredecessorTo.value = targetTask

  // 2. 打开TaskDrawer，进入新增模式
  // 新建任务，parentId与目标任务一致
  const newTask: Task = {
    id: Date.now(), // 临时id，实际保存时应由后端分配
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
    parentId: targetTask.parentId,
    children: [],
    isTimerRunning: false,
    timerStartTime: undefined,
    timerEndTime: undefined,
    timerElapsedTime: 0,
  }
  taskDrawerTask.value = newTask
  taskDrawerEditMode.value = false
  taskDrawerVisible.value = true
}

// 处理添加后置任务事件
function handleAddSuccessor(targetTask: Task) {
  if (!targetTask) return
  // 记录要添加后置任务的目标任务
  taskToAddSuccessorTo.value = targetTask
  // 构造新任务，parentId 与目标任务一致，predecessor 仅包含目标任务 id
  const newTask: Task = {
    id: Date.now(), // 临时id，实际保存时应由后端分配
    name: '',
    type: 'task',
    assignee: '',
    startDate: '',
    endDate: '',
    predecessor: [targetTask.id],
    estimatedHours: 0,
    actualHours: 0,
    progress: 0,
    description: '',
    parentId: targetTask.parentId,
    children: [],
    isTimerRunning: false,
    timerStartTime: undefined,
    timerEndTime: undefined,
    timerElapsedTime: 0,
  }
  taskDrawerTask.value = newTask
  taskDrawerEditMode.value = false
  taskDrawerVisible.value = true
}

// 新增Task插入到任务树中
// 插入新任务到任务树（parentId 已在打开 TaskDrawer 时预设好）
const insertTask = (tasks: Task[], newTask: Task) => {
  if (!newTask.parentId) {
    tasks.push(newTask)
    return true
  }
  for (const t of tasks) {
    if (t.id === newTask.parentId) {
      if (!t.children) t.children = []
      t.children.push(newTask)
      return true
    }
    if (t.children && t.children.length > 0) {
      if (insertTask(t.children, newTask)) return true
    }
  }
  return false
}

// 编辑模式：递归查找并更新任务树节点
const updateTaskInTree = (tasks: Task[], updatedTask: Task): boolean => {
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].id === updatedTask.id) {
      tasks[i] = { ...tasks[i], ...updatedTask }
      return true
    }
    if (tasks[i].children && (tasks[i].children as Task[]).length > 0) {
      if (updateTaskInTree(tasks[i].children as Task[], updatedTask)) return true
    }
  }
  return false
}

// 在 handleTaskDrawerSubmit 里补充：如果是添加前置任务，自动将新任务id加入目标任务的 predecessor
function handleTaskDrawerSubmit(task: Task) {
  if (!taskDrawerEditMode.value) {
    if (props.tasks) {
      insertTask(props.tasks, task)
    }
    // emit 新增任务事件
    emit('task-added', { task })
    if (taskToAddPredecessorTo.value) {
      if (!taskToAddPredecessorTo.value.predecessor) {
        taskToAddPredecessorTo.value.predecessor = []
      }
      taskToAddPredecessorTo.value.predecessor.push(task.id)
      // emit 添加前置任务事件
      emit('predecessor-added', { targetTask: taskToAddPredecessorTo.value, newTask: task })
      taskToAddPredecessorTo.value = null
    }
    if (taskToAddSuccessorTo.value) {
      // emit 添加后置任务事件
      emit('successor-added', { targetTask: taskToAddSuccessorTo.value, newTask: task })
      taskToAddSuccessorTo.value = null
    }
  } else {
    if (props.tasks) {
      updateTaskInTree(props.tasks, task)
    }
    updateTaskTrigger.value++
    // emit 任务更新事件
    emit('task-updated', { task })
  }
}

// 删除任务的递归工具函数，支持 deleteChildren 逻辑
function removeTaskFromTree(tasks: Task[], taskId: number, deleteChildren?: boolean): boolean {
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].id === taskId) {
      if (deleteChildren) {
        // 递归删除该节点及所有子节点（直接 splice 即可）
        tasks.splice(i, 1)
      } else {
        // 只删除该节点，把 children 提升到同级
        const children = tasks[i].children || []
        tasks.splice(i, 1, ...children)
      }
      return true
    }
    if (tasks[i].children && (tasks[i].children as Task[]).length > 0) {
      if (removeTaskFromTree(tasks[i].children as Task[], taskId, deleteChildren)) return true
    }
  }
  return false
}

// 处理 Task 的删除事件
function handleTaskDelete(task: Task, deleteChildren?: boolean) {
  if (props.tasks) {
    removeTaskFromTree(props.tasks, task.id, deleteChildren)
  }
  taskDrawerVisible.value = false
  taskDrawerTask.value = null
  // emit 删除事件
  emit('task-deleted', { task })
}

// 处理里程碑双击事件
function handleMilestoneDoubleClick(milestone: Milestone) {
  // 先触发外部事件，让外部可以自定义处理
  emit('milestone-double-click', milestone)

  // 根据 useDefaultMilestoneDialog 决定是否打开内置 MilestoneDialog
  if (props.useDefaultMilestoneDialog) {
    editingMilestone.value = milestone
    milestoneDialogVisible.value = true
  }
}

// 处理里程碑对话框关闭事件
function handleMilestoneDialogClose() {
  milestoneDialogVisible.value = false
  editingMilestone.value = null
}

// 处理里程碑对话框删除事件
function handleMilestoneDialogDelete(milestoneId: number) {
  // 1. 先从 props.milestones 中删除（自动处理数据）
  if (props.milestones) {
    removeMilestone(props.milestones, milestoneId)
  }

  // 2. 触发里程碑删除事件（新的事件驱动 API）
  emit('milestone-deleted', { milestoneId })

  // 3. 强制更新任务触发器，确保Timeline重新计算
  updateTaskTrigger.value++

  // 4. 关闭对话框
  handleMilestoneDialogClose()
}
</script>

<template>
  <div
    ref="ganttRootRef"
    class="gantt-root"
    :class="{ 'gantt-fullscreen': isFullscreen, 'splitter-dragging': dragging }"
  >
    <!-- 工具栏 -->
    <GanttToolbar
      v-if="props.showToolbar"
      :config="props.toolbarConfig"
      :on-today-locate="todayLocateHandler"
      :on-export-csv="csvExportHandler"
      :on-export-pdf="pdfExportHandler"
      :on-language-change="props.onLanguageChange"
      :on-theme-change="props.onThemeChange"
      :on-fullscreen-change="props.onFullscreenChange"
      :on-time-scale-change="handleTimeScaleChange"
      :on-expand-all="handleExpandAll"
      :on-collapse-all="handleCollapseAll"
      @add-task="handleToolbarAddTask"
      @add-milestone="milestoneAddHandler"
      @expand-all="handleExpandAll"
      @collapse-all="handleCollapseAll"
    />

    <!-- 甘特图主体 -->
    <div class="gantt-body">
      <div
        v-if="isTaskListVisible"
        class="gantt-panel gantt-panel-left"
        :class="{ dragging: dragging }"
        :style="{ width: leftPanelWidth + 'px' }"
      >
        <TaskList
          :tasks="tasksForTaskList"
          :use-default-drawer="props.useDefaultDrawer"
          :task-list-config="props.taskListConfig"
          @task-collapse-change="handleTaskCollapseChange"
          @start-timer="handleStartTimer"
          @stop-timer="handleStopTimer"
          @add-predecessor="handleAddPredecessor"
          @add-successor="handleAddSuccessor"
          @delete="handleTaskDelete"
        >
          <template v-if="$slots['custom-task-content']" #custom-task-content="rowScope">
            <slot name="custom-task-content" v-bind="rowScope" />
          </template>
        </TaskList>
      </div>
      <div class="gantt-splitter" @mousedown="onMouseDown">
        <!-- TaskList切换按钮 - 贴合splitter右侧 -->
        <div
          class="task-list-toggle"
          :title="isTaskListVisible ? collapseTaskListText : expandTaskListText"
          :class="{
            collapsed: !isTaskListVisible,
            [animationClass]: isAnimating,
          }"
          @click.stop="toggleTaskList"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <!-- 收起图标 (显示任务列表时) -->
            <polyline v-if="isTaskListVisible" points="15,18 9,12 15,6" />
            <!-- 展开图标 (隐藏任务列表时) -->
            <polyline v-else points="9,18 15,12 9,6" />
          </svg>
        </div>
      </div>

      <div class="gantt-panel gantt-panel-right" :class="{ 'full-width': !isTaskListVisible }">
        <Timeline
          ref="timelineRef"
          :tasks="tasksForTimeline"
          :milestones="milestonesForTimeline"
          :start-date="timelineDateRange.min"
          :end-date="timelineDateRange.max"
          :working-hours="props.workingHours"
          :task-bar-config="props.taskBarConfig"
          :allow-drag-and-resize="props.allowDragAndResize"
          :use-default-drawer="props.useDefaultDrawer"
          :use-default-milestone-dialog="props.useDefaultMilestoneDialog"
          :on-milestone-save="handleMilestoneSave"
          @timeline-scale-changed="handleTimelineScaleChanged"
          @click-task="handleTimelineClickTask"
          @edit-task="handleTimelineEditTask"
          @milestone-double-click="handleMilestoneDoubleClick"
          @start-timer="handleStartTimer"
          @stop-timer="handleStopTimer"
          @add-predecessor="handleAddPredecessor"
          @add-successor="handleAddSuccessor"
          @delete="handleTaskDelete"
        >
          <template v-if="$slots['custom-task-content']" #custom-task-content="barScope">
            <slot name="custom-task-content" v-bind="barScope" />
          </template>
        </Timeline>

        <!-- 关闭聚焦按钮 - 固定在gantt-panel-right底部居中 -->
        <div
          v-if="showCloseButton"
          class="focus-close-button"
          @click.stop="handleClearHighlight"
        >
          <svg
            class="close-icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="close-text">{{ t.disableTaskbarFocusMode }}</span>
        </div>
      </div>
    </div>

    <!-- 任务抽屉组件 - 用于添加前置任务 -->
    <TaskDrawer
      v-if="props.useDefaultDrawer"
      v-model:visible="taskDrawerVisible"
      :task="taskDrawerTask"
      :is-edit="taskDrawerEditMode"
      @submit="handleTaskDrawerSubmit"
      @close="taskDrawerVisible = false"
      @start-timer="handleStartTimer"
      @stop-timer="handleStopTimer"
      @delete="handleTaskDelete"
    />

    <!-- 里程碑对话框组件 - 用于编辑里程碑 -->
    <MilestoneDialog
      v-if="props.useDefaultMilestoneDialog"
      v-model:visible="milestoneDialogVisible"
      :milestone="editingMilestone"
      @close="handleMilestoneDialogClose"
      @save="handleMilestoneSave"
      @delete="handleMilestoneDialogDelete"
    />
  </div>
</template>

<style scoped>
@import '../styles/theme-variables.css';
.gantt-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  box-shadow:
    0 6px 32px 0 rgba(0, 0, 0, 0.1),
    0 1.5px 6px 0 rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.gantt-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.gantt-panel {
  height: 100%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
}

.gantt-panel-left {
  /* width 由js控制 */
  min-width: 320px;
  /* ⚠️ 拖拽时禁用transition，提升响应速度 */
  transition: none;
}

.gantt-panel-left:not(.dragging) {
  /* 非拖拽时保留平滑过渡效果（如toggle时） */
  transition: width 0.1s;
}

.gantt-panel-right {
  flex: 1;
  min-width: 0;
  position: relative; /* 为渐隐覆盖层定位 */
}

.gantt-panel-right.full-width {
  flex: 1;
  width: 100%;
}

/* 关闭聚焦按钮 - 固定在gantt-panel-right底部居中 */
.focus-close-button {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1004;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #f56c6c;
  border: 1px solid #f56c6c;
  border-radius: 20px;
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.4);
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
}

.focus-close-button:hover {
  background: #f78989;
  border-color: #f78989;
  box-shadow: 0 6px 16px rgba(245, 108, 108, 0.5);
  transform: translateX(-50%) translateY(-2px);
}

.focus-close-button .close-icon {
  width: 18px;
  height: 18px;
  color: #ffffff;
  transition: color 0.3s ease;
}

.focus-close-button:hover .close-icon {
  color: #ffffff;
}

.focus-close-button .close-text {
  font-size: 14px;
  color: #ffffff;
  font-weight: 500;
  transition: color 0.3s ease;
}

.focus-close-button:hover .close-text {
  color: #ffffff;
}

.gantt-splitter {
  position: relative; /* 添加相对定位以支持绝对定位的子元素 */
  width: 6px;
  cursor: col-resize;
  background: var(--gantt-border-light, #e4e7ed);
  transition: all 0.2s ease;
  z-index: 999;
  /* 禁用文本选择和拖拽干扰 */
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  touch-action: none; /* 禁用触摸事件 */
}

.gantt-splitter:hover {
  background: var(--gantt-border-dark, #c0c4cc);
}

.placeholder {
  color: #909399;
  text-align: center;
  margin: auto;
  font-size: 18px;
}

/* 左侧撞击动画 */
@keyframes slideLeftImpact {
  0% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-8px);
  }
  40% {
    transform: translateX(2px);
  }
  60% {
    transform: translateX(-3px);
  }
  80% {
    transform: translateX(1px);
  }
  100% {
    transform: translateX(0);
  }
}

@keyframes slideRightImpact {
  0% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(8px);
  }
  40% {
    transform: translateX(-2px);
  }
  60% {
    transform: translateX(3px);
  }
  80% {
    transform: translateX(-1px);
  }
  100% {
    transform: translateX(0);
  }
}

/* TaskList切换按钮样式 */
.task-list-toggle {
  position: absolute;
  top: 0px; /* 紧贴splitter顶端 */
  left: 6px; /* 贴合splitter右侧，稍微调整以更好地附着 */
  width: 15px;
  height: 35px; /* 稍微增加高度，让按钮更明显 */
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #d9d9d9;
  border-radius: 0 6px 6px 0; /* 右侧圆角，左侧直角贴合splitter */
  cursor: pointer;
  z-index: 1000;
  color: #666;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
  box-shadow: 1px 1px 4px rgba(0, 0, 0, 0.15);
}

.task-list-toggle.collapsed:hover {
  box-shadow: -1px 2px 8px rgba(64, 158, 255, 0.25);
}

.task-list-toggle:active {
  transform: scale(1);
}

.task-list-toggle svg {
  transition: transform 0.2s ease;
}

.task-list-toggle:hover svg {
  transform: scale(1.1);
}

/* 暗色主题支持 */
:global(html[data-theme='dark']) .gantt-root {
  background: #1e1e1e !important;
  color: #e5e5e5 !important;
}

:global(html[data-theme='dark']) .gantt-panel {
  background: #2c2c2c !important;
}

:global(html[data-theme='dark']) .gantt-panel-left {
  border-right-color: #4c4c4c !important;
}

:global(html[data-theme='dark']) .focus-close-button {
  background: #d85555;
  border-color: #d85555;
  box-shadow: 0 4px 12px rgba(216, 85, 85, 0.4);
}

:global(html[data-theme='dark']) .focus-close-button:hover {
  background: #e67676;
  border-color: #e67676;
  box-shadow: 0 6px 16px rgba(216, 85, 85, 0.5);
}

:global(html[data-theme='dark']) .focus-close-button .close-icon,
:global(html[data-theme='dark']) .focus-close-button .close-text {
  color: #ffffff;
}

:global(html[data-theme='dark']) .focus-close-button:hover .close-icon,
:global(html[data-theme='dark']) .focus-close-button:hover .close-text {
  color: #ffffff;
}

:global(html[data-theme='dark']) .gantt-splitter {
  background: linear-gradient(
    to right,
    transparent,
    var(--gantt-border-dark, #666666) 20%,
    var(--gantt-border-dark, #666666) 80%,
    transparent
  ) !important;
  box-shadow: inset 0 0 2px rgba(255, 255, 255, 0.1) !important;
}

:global(html[data-theme='dark']) .gantt-splitter:hover {
  background: linear-gradient(
    to right,
    transparent,
    var(--gantt-primary, #409eff) 20%,
    var(--gantt-primary, #409eff) 80%,
    transparent
  ) !important;
  border-left-color: var(--gantt-primary, #409eff) !important;
  border-right-color: var(--gantt-primary, #409eff) !important;
  box-shadow:
    inset 0 0 4px rgba(64, 158, 255, 0.3),
    0 0 8px rgba(64, 158, 255, 0.2) !important;
}

/* 暗色主题支持 - TaskList切换按钮 */
:global(html[data-theme='dark']) .task-list-toggle {
  background: rgba(42, 42, 42, 0.95) !important;
  border-color: #555555 !important;
  color: #cccccc !important;
  box-shadow: 1px 1px 4px rgba(0, 0, 0, 0.4) !important;
}

:global(html[data-theme='dark']) .task-list-toggle.collapsed {
  box-shadow: -1px 1px 4px rgba(0, 0, 0, 0.4) !important;
}

:global(html[data-theme='dark']) .task-list-toggle:hover {
  background: rgba(42, 42, 42, 1) !important;
  color: #569cd6 !important;
  box-shadow: 1px 2px 8px rgba(86, 156, 214, 0.3) !important;
}

:global(html[data-theme='dark']) .task-list-toggle.collapsed:hover {
  box-shadow: -1px 2px 8px rgba(86, 156, 214, 0.3) !important;
}

/* 撞击动画 */
.task-list-toggle.impact-left {
  animation: slideLeftImpact 0.4s ease-out;
}

.task-list-toggle.impact-right {
  animation: slideRightImpact 0.4s ease-out;
}

/* 全屏模式样式 */
.gantt-fullscreen {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 9999 !important;
  background: #f5f7fa !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  margin: 0 !important;
  padding: 0 !important;
  transition: all 0.3s ease-in-out;
  animation: ganttFullscreenEnter 0.3s ease-out;
}

@keyframes ganttFullscreenEnter {
  0% {
    transform: scale(0.9);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 全屏模式下的甘特图主体 */
.gantt-fullscreen .gantt-body {
  height: calc(100vh - 60px); /* 减去工具栏高度 */
}

/* 全屏模式下的工具栏 */
.gantt-fullscreen .gantt-toolbar {
  border-radius: 0 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

/* 暗色主题下的全屏模式 */
:global(html[data-theme='dark']) .gantt-fullscreen {
  background: #1e1e1e !important;
}

:global(html[data-theme='dark']) .gantt-fullscreen .gantt-toolbar {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
}

/* 拖拽分割器时的保护样式 */
.gantt-root.splitter-dragging {
  /* 禁用整个甘特图的文本选择 */
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.gantt-root.splitter-dragging .gantt-panel-right {
  /* 拖拽时高亮右侧面板 */
  background: rgba(255, 255, 255, 0.1);
}

.gantt-root.splitter-dragging * {
  /* 强制所有元素使用col-resize光标 */
  cursor: col-resize !important;
}
</style>

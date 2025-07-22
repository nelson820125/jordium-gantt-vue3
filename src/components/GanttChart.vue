<script setup lang="ts">
import { ref, onUnmounted, onMounted, computed, watch, nextTick, defineEmits } from 'vue'
import TaskList from './TaskList.vue'
import Timeline from './Timeline.vue'
import GanttToolbar from './GanttToolbar.vue'
import TaskDrawer from './TaskDrawer.vue'
import { useI18n, setCustomMessages } from '../composables/useI18n'
import { formatPredecessorDisplay } from '../utils/predecessorUtils'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Task } from '../models/classes/Task'
import type { ToolbarConfig } from '../models/configs/ToolbarConfig'
import { TimelineScale } from '../models/types/TimelineScale'
import { useMessage } from '../composables/useMessage'

const props = withDefaults(defineProps<Props>(), {
  tasks: () => [],
  milestones: () => [],
  onTaskDoubleClick: undefined,
  editComponent: undefined,
  useDefaultDrawer: true,
  onTaskDelete: undefined,
  onMilestoneSave: undefined,
  onMilestoneDelete: undefined,
  onTaskUpdate: undefined,
  onTaskAdd: undefined,
  onMilestoneIconChange: undefined,
  toolbarConfig: () => ({}),
  showToolbar: true,
  onAddTask: undefined,
  onAddMilestone: undefined,
  onTodayLocate: undefined,
  onExportCsv: undefined,
  onExportPdf: undefined,
  onLanguageChange: undefined,
  onThemeChange: undefined,
  onFullscreenChange: undefined,
  localeMessages: undefined,
})

const emit = defineEmits([
  'taskbar-drag-end',
  'taskbar-resize-end',
  'milestone-drag-end',
  'timer-started',
  'timer-stopped',
  'predecessor-added',
  'successor-added',
  'task-deleted',
  'task-added',
  'task-updated',
])

const { showMessage } = useMessage()

interface Props {
  // 任务数据
  tasks?: Task[]
  // 里程碑数据
  milestones?: Task[]
  // TaskBar双击事件处理器API
  onTaskDoubleClick?: (task: Task) => void
  // 自定义编辑组件
  editComponent?: any
  // 是否使用默认的TaskDrawer
  useDefaultDrawer?: boolean
  // 自定义删除处理器API
  onTaskDelete?: (task: Task, deleteChildren?: boolean) => void
  // 里程碑保存处理器API
  onMilestoneSave?: (milestone: Task) => void
  // 里程碑删除处理器API
  onMilestoneDelete?: (milestoneId: number) => void
  // 任务更新处理器API
  onTaskUpdate?: (task: Task) => void
  // 任务添加处理器API
  onTaskAdd?: (task: Task) => void
  // 里程碑图标变更处理器API
  onMilestoneIconChange?: (milestoneId: number, icon: string) => void
  // 工具栏配置
  toolbarConfig?: ToolbarConfig
  // 是否显示工具栏
  showToolbar?: boolean
  // 工具栏事件处理器
  onAddTask?: () => void
  onAddMilestone?: () => void
  onTodayLocate?: () => void
  onExportCsv?: () => boolean | void
  onExportPdf?: () => void
  onLanguageChange?: (lang: 'zh-CN' | 'en-US') => void
  onThemeChange?: (isDark: boolean) => void
  onFullscreenChange?: (isFullscreen: boolean) => void
  /**
   * 自定义多语言（国际化）配置，结构参考内置 messages['zh-CN']，只需传递需要覆盖的 key 即可。
   * 例如：
   * localeMessages={{ taskName: '自定义任务名', addTask: '自定义新增任务' }}
   * 支持嵌套对象（如 csvHeaders、taskTypeMap 等）。
   * 仅在组件初始化时合并，运行时变更会自动响应。
   */
  localeMessages?: Partial<import('../composables/useI18n').Messages['zh-CN']>
}

const leftPanelWidth = ref(320)

// Timeline组件的引用
const timelineRef = ref<InstanceType<typeof Timeline> | null>(null)

// 时间刻度状态
const currentTimeScale = ref<TimelineScale>(TimelineScale.DAY)

// TaskList的固定总长度（所有列的最小宽度之和 + 边框等额外空间）
// 列宽: 300+120+120+140+140+100+100+100 = 1120px
// 边框: 7个列间边框 * 1px = 7px
// 滚动条预留: 20px
// 额外边距: 13px (task-list-header的左边距3px + 其他10px预留)
const TASK_LIST_MAX_WIDTH = 1120 + 7 + 20 + 13 // = 1160px
const TASK_LIST_MIN_WIDTH = 320 // TaskList最小宽度

const taskListBodyWidth = ref(TASK_LIST_MAX_WIDTH) // TaskList默认宽度
const ganttPanelLeftMinWidth = ref(TASK_LIST_MIN_WIDTH) // 左侧面板最小宽度
const ganttPanelLeftCurrentWidth = ref(TASK_LIST_MIN_WIDTH) // 当前左侧面板宽度
const taskListBodyProposedWidth = ref(TASK_LIST_MAX_WIDTH)
const taskListBodyWidthLimit = ref(TASK_LIST_MAX_WIDTH)

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
  taskListBodyWidthLimit.value = Math.min(taskListBodyProposedWidth.value, taskListBodyWidth.value)

  // 广播拖拽开始事件，通知其他组件暂停悬停效果
  window.dispatchEvent(new CustomEvent('splitter-drag-start'))

  // 在拖拽期间禁用页面选择
  document.body.style.userSelect = 'none'
  document.body.style.webkitUserSelect = 'none'
  document.body.style.cursor = 'col-resize'

  function onMouseMove(ev: MouseEvent) {
    if (!dragging.value) return

    // 阻止默认行为，防止滚动等
    ev.preventDefault()
    ev.stopPropagation()

    const delta = ev.clientX - startX
    const proposedWidth = startWidth + delta

    // 直接使用面板宽度限制检查，无需复杂的坐标计算
    const finalWidth = checkWidthLimits(proposedWidth)
    leftPanelWidth.value = finalWidth
  }

  function onMouseUp() {
    dragging.value = false

    // 广播拖拽结束事件，通知其他组件恢复悬停效果
    window.dispatchEvent(new CustomEvent('splitter-drag-end'))

    // 恢复页面选择和光标
    document.body.style.userSelect = ''
    document.body.style.webkitUserSelect = ''
    document.body.style.cursor = ''

    taskListBodyWidth.value = TASK_LIST_MAX_WIDTH // TaskList默认宽度
    ganttPanelLeftMinWidth.value = TASK_LIST_MIN_WIDTH // 左侧面板最小宽度
    taskListBodyProposedWidth.value = TASK_LIST_MAX_WIDTH
    taskListBodyWidthLimit.value = TASK_LIST_MAX_WIDTH
    ganttPanelLeftCurrentWidth.value = TASK_LIST_MIN_WIDTH // 当前左侧面板宽度

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
        })
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
      })
    )
  })
}

// --- 事件链路：监听 Timeline 传递上来的拖拽/拉伸事件，并通过 props 回调暴露 ---
function handleTaskBarDragEnd(event: CustomEvent) {
  emit('taskbar-drag-end', event.detail)
}
function handleTaskBarResizeEnd(event: CustomEvent) {
  emit('taskbar-resize-end', event.detail)
}
function handleMilestoneDragEnd(event: CustomEvent) {
  emit('milestone-drag-end', event.detail)
}

onMounted(() => {
  window.addEventListener('taskbar-drag-end', handleTaskBarDragEnd as EventListener)
  window.addEventListener('taskbar-resize-end', handleTaskBarResizeEnd as EventListener)
  window.addEventListener('milestone-drag-end', handleMilestoneDragEnd as EventListener)
})
onUnmounted(() => {
  window.removeEventListener('taskbar-drag-end', handleTaskBarDragEnd as EventListener)
  window.removeEventListener('taskbar-resize-end', handleTaskBarResizeEnd as EventListener)
  window.removeEventListener('milestone-drag-end', handleMilestoneDragEnd as EventListener)
})

// 处理TaskList的任务折叠状态变化
const handleTaskCollapseChange = (task: Task) => {
  // 递归查找并更新原始数据中的任务折叠状态
  const updateTaskCollapsedState = (
    tasks: Task[],
    targetId: number,
    collapsed: boolean
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

// 用于强制触发Timeline重新计算的响应式值
const updateTaskTrigger = ref(0)

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
  { deep: true, immediate: true }
)

onMounted(() => {
  // 监听Timeline的TaskList切换事件
  window.addEventListener('toggle-task-list', handleToggleTaskList as EventListener)
  // 监听GanttToolbar的全屏切换事件
  window.addEventListener('fullscreen-toggle', handleFullscreenToggle as EventListener)
  // 监听Timeline的任务相关事件
  window.addEventListener('task-updated', handleTaskUpdate as EventListener)
  window.addEventListener('task-added', handleTaskAdd as EventListener)
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
  window.removeEventListener('task-updated', handleTaskUpdate as EventListener)
  window.removeEventListener('task-added', handleTaskAdd as EventListener)
  window.removeEventListener(
    'milestone-icon-changed',
    handleMilestoneIconChangeEvent as EventListener
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
    result.push(...props.tasks)
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

// 计算所有任务和里程碑的最小开始时间和最大结束时间
const timelineDateRange = computed(() => {
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

  if (startDates.length === 0 || endDates.length === 0) {
    // 没有任务时，默认以今天为中心
    const today = new Date()
    const min = new Date(today.getFullYear(), today.getMonth() - 6, 1)
    const max = new Date(today.getFullYear(), today.getMonth() + 6 + 1, 0)
    return { min, max }
  }

  // 找到最小开始和最大结束
  const minDate = new Date(Math.min(...startDates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...endDates.map(d => d.getTime())))

  // 日视图前后各延伸6个月
  let min = new Date(minDate.getFullYear(), minDate.getMonth() - 6, 1)
  let max = new Date(maxDate.getFullYear(), maxDate.getMonth() + 6 + 1, 0)
  if (currentTimeScale.value === TimelineScale.WEEK) {
    // 月视图Timeline周期为往前1年~往后1年
    min = new Date(minDate.getFullYear() - 1, minDate.getMonth(), 1)
    max = new Date(maxDate.getFullYear() + 1, maxDate.getMonth() + 1, 0)
  } else if (currentTimeScale.value === TimelineScale.MONTH) {
    // 月视图Timeline周期为往前2年~往后2年
    min = new Date(minDate.getFullYear() - 2, minDate.getMonth(), 1)
    max = new Date(maxDate.getFullYear() + 2, maxDate.getMonth() + 1, 0)
  }
  return { min, max }
})

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
}

// 处理里程碑保存事件
const handleMilestoneSave = (milestone: Task) => {
  // 调用外部传入的里程碑保存处理器
  if (props.onMilestoneSave && typeof props.onMilestoneSave === 'function') {
    props.onMilestoneSave(milestone)
  }

  // 如果没有外部处理器，执行默认的更新逻辑
  // 这里可以添加默认的里程碑数据更新逻辑，比如更新本地数据或者触发重新渲染
}

// 处理任务更新事件
const handleTaskUpdate = (event: CustomEvent) => {
  const updatedTask = event.detail

  // 如果更新的是task类型且有parentId，需要同时更新对应的story进度
  if (updatedTask.type === 'task' && updatedTask.parentId) {
    const updatedStory = calculateStoryProgress(updatedTask.parentId, updatedTask)

    // 先调用外部的任务更新处理器更新子任务
    if (props.onTaskUpdate && typeof props.onTaskUpdate === 'function') {
      props.onTaskUpdate(updatedTask)
    }

    // 如果story进度有变化，也更新story
    if (updatedStory && props.onTaskUpdate && typeof props.onTaskUpdate === 'function') {
      props.onTaskUpdate(updatedStory)
    }
  } else if (props.onTaskUpdate && typeof props.onTaskUpdate === 'function') {
    // 普通任务更新
    props.onTaskUpdate(updatedTask)
  }

  // 关键：任务更新后强制刷新Timeline时间轴
  updateTaskTrigger.value++
}

// 计算story的进度（根据其下所有task的进度计算）
const calculateStoryProgress = (storyId: number, updatedTask?: Task): Task | null => {
  // 获取所有任务的扁平列表
  const allTasks = [...(props.tasks || [])]
  const flatTasks: Task[] = []

  const flattenTasks = (tasks: Task[]) => {
    tasks.forEach(task => {
      flatTasks.push(task)
      if (task.children && task.children.length > 0) {
        flattenTasks(task.children)
      }
    })
  }

  flattenTasks(allTasks)

  // 找到对应的story
  const storyTask = flatTasks.find(task => task.id === storyId && task.type === 'story')
  if (!storyTask) return null

  // 获取该story下所有的task
  let childTasks = flatTasks.filter(task => task.parentId === storyId && task.type === 'task')
  if (childTasks.length === 0) return null

  // 如果有正在更新的task，使用最新的数据替换旧数据
  if (updatedTask && updatedTask.type === 'task' && updatedTask.parentId === storyId) {
    childTasks = childTasks.map(task => (task.id === updatedTask.id ? updatedTask : task))
  }

  // 计算平均进度
  const totalProgress = childTasks.reduce((sum, task) => sum + (task.progress || 0), 0)
  const avgProgress = Math.round(totalProgress / childTasks.length)

  // 如果进度有变化，返回更新后的story
  if (storyTask.progress !== avgProgress) {
    return { ...storyTask, progress: avgProgress }
  }

  // 进度没有变化，返回null
  return null
}

// 处理任务添加事件
const handleTaskAdd = (event: CustomEvent) => {
  const newTask = event.detail
  if (props.onTaskAdd && typeof props.onTaskAdd === 'function') {
    props.onTaskAdd(newTask)
  }
  // 关键：任务新增后强制刷新Timeline时间轴
  updateTaskTrigger.value++
}

// 处理里程碑图标变更事件
const handleMilestoneIconChangeEvent = (event: CustomEvent) => {
  const { milestoneId, icon } = event.detail
  if (props.onMilestoneIconChange && typeof props.onMilestoneIconChange === 'function') {
    props.onMilestoneIconChange(milestoneId, icon)
  }
}

// 处理里程碑删除事件
const handleMilestoneDeleted = (event: CustomEvent) => {
  const { milestoneId } = event.detail

  // 调用外部的里程碑删除处理器
  if (props.onMilestoneDelete && typeof props.onMilestoneDelete === 'function') {
    props.onMilestoneDelete(milestoneId)
  }

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
  // 如果有外部处理器，先调用它
  if (props.onAddMilestone && typeof props.onAddMilestone === 'function') {
    props.onAddMilestone()
    return
  }

  // 使用默认里程碑添加实现
  defaultAddMilestone()
}

// 默认里程碑添加功能
const defaultAddMilestone = () => {
  // 派发全局事件，让其他组件处理
  window.dispatchEvent(new CustomEvent('add-milestone'))
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

// 设置自定义多语言消息

if (props.localeMessages) {
  setCustomMessages(locale.value, props.localeMessages)
}
watch(
  () => props.localeMessages,
  val => {
    if (val) setCustomMessages(locale.value, val)
  },
  { deep: true }
)

// 右键菜单状态管理
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuVisible = ref(false)
const contextMenuTask = ref<Task | null>(null)

// TaskDrawer 相关变量
const taskDrawerVisible = ref(false)
const taskDrawerTask = ref<Task | null>(null)
const taskDrawerEditMode = ref(false)

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
  // 构造一个空的新任务对象
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

// 监听来自Timeline的任务编辑事件
function handleTimelineEditTask(task: Task) {
  taskDrawerTask.value = task
  taskDrawerEditMode.value = true
  taskDrawerVisible.value = true
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
</script>

<template>
  <div
    class="gantt-root"
    :class="{ 'gantt-fullscreen': isFullscreen, 'splitter-dragging': dragging }"
  >
    <!-- 工具栏 -->
    <GanttToolbar
      v-if="props.showToolbar"
      :config="props.toolbarConfig"
      :on-add-task="props.onAddTask"
      :on-add-milestone="milestoneAddHandler"
      :on-today-locate="todayLocateHandler"
      :on-export-csv="csvExportHandler"
      :on-export-pdf="pdfExportHandler"
      :on-language-change="props.onLanguageChange"
      :on-theme-change="props.onThemeChange"
      :on-fullscreen-change="props.onFullscreenChange"
      :on-time-scale-change="handleTimeScaleChange"
      @add-task="handleToolbarAddTask"
    />

    <!-- 甘特图主体 -->
    <div class="gantt-body">
      <div
        v-if="isTaskListVisible"
        class="gantt-panel gantt-panel-left"
        :style="{ width: leftPanelWidth + 'px' }"
      >
        <TaskList
          :tasks="tasksForTaskList"
          :on-task-double-click="props.onTaskDoubleClick"
          :edit-component="props.editComponent"
          :use-default-drawer="props.useDefaultDrawer"
          @task-collapse-change="handleTaskCollapseChange"
          @start-timer="handleStartTimer"
          @stop-timer="handleStopTimer"
          @add-predecessor="handleAddPredecessor"
          @add-successor="handleAddSuccessor"
          @delete="handleTaskDelete"
        />
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
          :milestones="props.milestones"
          :start-date="timelineDateRange.min"
          :end-date="timelineDateRange.max"
          :on-task-double-click="props.onTaskDoubleClick"
          :edit-component="props.editComponent"
          :use-default-drawer="props.useDefaultDrawer"
          :on-milestone-save="handleMilestoneSave"
          @timeline-scale-changed="handleTimelineScaleChanged"
          @edit-task="handleTimelineEditTask"
          @start-timer="handleStartTimer"
          @stop-timer="handleStopTimer"
          @add-predecessor="handleAddPredecessor"
          @add-successor="handleAddSuccessor"
          @delete="handleTaskDelete"
        />
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

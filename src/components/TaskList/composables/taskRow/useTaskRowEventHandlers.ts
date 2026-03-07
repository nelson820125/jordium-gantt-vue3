import { onMounted, onUnmounted, type Ref } from 'vue'
import type { Task } from '../../../../models/classes/Task'
import { registerDragOver, unregisterDragOver } from '../../../../utils/dragOverRegistry'

/**
 * TaskRow 事件处理和拖拽交互
 * 管理任务行的点击、悬停、拖拽等事件
 */
export function useTaskRowEventHandlers(
  task: Ref<Task>,
  isStoryTask: Ref<boolean>,
  hasChildren: Ref<boolean>,
  isMilestoneGroup: Ref<boolean>,
  isSplitterDragging: Ref<boolean>,
  taskRowRef: Ref<HTMLElement | null>,
  enableDrag: Ref<boolean | undefined>,
  onHover?: (taskId: number | null) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit?: (...args: any[]) => void,
  dragStart?: (task: Task, element: HTMLElement, event: MouseEvent) => void,
  dragOver?: (task: Task, element: HTMLElement, event: MouseEvent) => void,
) {
  // 处理折叠/展开
  const handleToggle = () => {
    if (emit) {
      emit('toggle', task.value)
    }
  }

  // 处理行点击
  const handleRowClick = () => {
    // 如果是普通父级任务（story类型或有子任务的任务，非里程碑分组），点击行也可以展开/收起
    if ((isStoryTask.value || hasChildren.value) && !isMilestoneGroup.value) {
      if (emit) {
        emit('toggle', task.value)
      }
    }
  }

  // 处理TaskRow双击事件 (与TaskBar逻辑保持一致)
  const handleTaskRowDoubleClick = (e: MouseEvent) => {
    // 阻止事件冒泡
    e.stopPropagation()

    // 发出双击事件给父组件
    if (emit) {
      emit('dblclick', task.value)
    }
  }

  // 处理悬停事件
  const handleMouseEnter = () => {
    // 如果正在拖拽Splitter，忽略悬停事件
    if (isSplitterDragging.value) return

    if (onHover) {
      onHover(task.value.id)
    }
  }

  const handleMouseLeave = () => {
    // 如果正在拖拽Splitter，忽略悬停事件
    if (isSplitterDragging.value) return

    if (onHover) {
      onHover(null)
    }
  }

  // 拖拽状态管理
  const handleSplitterDragStart = () => {
    isSplitterDragging.value = true
  }

  const handleSplitterDragEnd = () => {
    isSplitterDragging.value = false
  }

  // 处理鼠标按下事件（拖拽）
  const handleMouseDown = (event: MouseEvent) => {
    // 如果未启用拖拽，直接返回
    if (!enableDrag.value) return

    // 如果点击的是按钮、输入框等交互元素，不触发拖拽
    const target = event.target as HTMLElement
    if (
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'TEXTAREA' ||
      target.closest('.collapse-btn') ||
      target.closest('.task-context-menu')
    ) {
      return
    }

    if (taskRowRef.value && dragStart) {
      dragStart(task.value, taskRowRef.value, event)
    }
  }

  // 处理全局拖拽悬停事件（通过 dragOverRegistry 委托，不再直接监听 window）
  // 优化：从每行独立注册 window 监听器改为全局单一监听器 + Map 直接查找 O(1)
  const handleTaskRowDragOver = (mouseEvent: MouseEvent) => {
    if (!enableDrag.value || !taskRowRef.value || !dragOver) return
    dragOver(task.value, taskRowRef.value, mouseEvent)
  }

  // 生命周期钩子 - 注册事件监听器
  onMounted(() => {
    window.addEventListener('splitter-drag-start', handleSplitterDragStart)
    window.addEventListener('splitter-drag-end', handleSplitterDragEnd)
    // 使用 dragOverRegistry 委托注册，避免每个 TaskRow 各自占用一个 window 监听器
    registerDragOver(task.value.id, handleTaskRowDragOver)
  })

  onUnmounted(() => {
    window.removeEventListener('splitter-drag-start', handleSplitterDragStart)
    window.removeEventListener('splitter-drag-end', handleSplitterDragEnd)
    unregisterDragOver(task.value.id)
  })

  return {
    handleToggle,
    handleRowClick,
    handleTaskRowDoubleClick,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseDown,
  }
}

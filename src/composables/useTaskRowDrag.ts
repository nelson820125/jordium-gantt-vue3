import { ref, onMounted, onUnmounted } from 'vue'
import type { Task } from '../models/classes/Task'

interface DragState {
  isDragging: boolean
  draggedTask: Task | null
  draggedElement: HTMLElement | null
  ghostElement: HTMLElement | null
  dropTargetTask: Task | null
  dropPosition: 'after' | 'child' | null
}

interface UseDragOptions {
  enabled: boolean
  onDragStart?: (task: Task) => void
  onDragOver?: (task: Task, position: 'after' | 'child') => void
  onDrop?: (draggedTask: Task, targetTask: Task, position: 'after' | 'child') => void
}

export function useTaskRowDrag(options: UseDragOptions) {
  const dragState = ref<DragState>({
    isDragging: false,
    draggedTask: null,
    draggedElement: null,
    ghostElement: null,
    dropTargetTask: null,
    dropPosition: null,
  })

  const startDrag = (task: Task, element: HTMLElement, event: MouseEvent) => {
    if (!options.enabled) return

    // 防止里程碑分组、里程碑被拖拽
    if (task.type === 'milestone-group' || task.type === 'milestone') {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    // eslint-disable-next-line no-console
    console.log('[TaskRowDrag] 开始拖拽任务:', task.name)

    dragState.value.isDragging = true
    dragState.value.draggedTask = task
    dragState.value.draggedElement = element

    // 创建拖拽的幽灵元素
    const ghost = element.cloneNode(true) as HTMLElement
    ghost.style.position = 'fixed'
    ghost.style.left = '-9999px'
    ghost.style.top = '-9999px'
    ghost.style.width = `${element.offsetWidth}px`
    ghost.style.height = `${element.offsetHeight}px`
    ghost.style.opacity = '0.6'
    ghost.style.pointerEvents = 'none'
    ghost.style.zIndex = '999999'
    ghost.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)'
    ghost.classList.add('task-row-dragging')

    // 查找全屏容器或使用body
    const fullscreenContainer = document.querySelector('.gantt-fullscreen') || document.body
    fullscreenContainer.appendChild(ghost)
    dragState.value.ghostElement = ghost

    // 设置原始元素为半透明
    element.style.opacity = '0.4'

    // 禁用页面选择
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'
    document.body.style.cursor = 'move'

    // 广播拖拽开始事件
    window.dispatchEvent(
      new CustomEvent('task-row-drag-start', {
        detail: { task },
      }),
    )

    if (options.onDragStart) {
      options.onDragStart(task)
    }

    // 初始定位幽灵元素
    updateGhostPosition(event)
  }

  const updateGhostPosition = (event: MouseEvent) => {
    if (dragState.value.ghostElement) {
      const ghost = dragState.value.ghostElement
      ghost.style.left = `${event.clientX + 10}px`
      ghost.style.top = `${event.clientY - 25}px`
    }
  }

  const handleDragOver = (task: Task, element: HTMLElement, event: MouseEvent) => {
    if (!dragState.value.isDragging || !dragState.value.draggedTask) return

    // 不能拖拽到自己身上
    if (task.id === dragState.value.draggedTask.id) {
      // eslint-disable-next-line no-console
      console.log('[TaskRowDrag] 跳过：不能拖拽到自己身上')
      clearDropTarget()
      return
    }

    // 不能拖拽到自己的子任务上
    if (isDescendant(dragState.value.draggedTask, task)) {
      // eslint-disable-next-line no-console
      console.log('[TaskRowDrag] 跳过：不能拖拽到自己的子任务上')
      clearDropTarget()
      return
    }

    event.preventDefault()
    event.stopPropagation()

    // 确定放置位置：根据是否有子任务
    const hasChildren = task.children && task.children.length > 0
    const position: 'after' | 'child' = hasChildren ? 'child' : 'after'

    dragState.value.dropTargetTask = task
    dragState.value.dropPosition = position

    // 移除之前的高亮
    document.querySelectorAll('.task-row-drop-target').forEach(el => {
      el.classList.remove('task-row-drop-target', 'drop-after', 'drop-child')
    })

    // 添加新的高亮
    element.classList.add('task-row-drop-target')
    if (position === 'after') {
      element.classList.add('drop-after')
    } else {
      element.classList.add('drop-child')
    }

    // eslint-disable-next-line no-console
    console.log('[TaskRowDrag] 悬停在任务上:', task.name, 'position:', position)

    if (options.onDragOver) {
      options.onDragOver(task, position)
    }
  }

  const clearDropTarget = () => {
    if (dragState.value.dropTargetTask) {
      // eslint-disable-next-line no-console
      console.log('[TaskRowDrag] 清除放置目标')
    }
    dragState.value.dropTargetTask = null
    dragState.value.dropPosition = null
    document.querySelectorAll('.task-row-drop-target').forEach(el => {
      el.classList.remove('task-row-drop-target', 'drop-after', 'drop-child')
    })
  }

  const endDrag = () => {
    if (!dragState.value.isDragging) return

    const draggedTask = dragState.value.draggedTask
    const dropTargetTask = dragState.value.dropTargetTask
    const dropPosition = dragState.value.dropPosition

    // eslint-disable-next-line no-console
    console.log('[TaskRowDrag] endDrag - dropTargetTask:', dropTargetTask?.name, 'dropPosition:', dropPosition)

    // 恢复原始元素样式
    if (dragState.value.draggedElement) {
      dragState.value.draggedElement.style.opacity = ''
    }

    // 移除幽灵元素
    if (dragState.value.ghostElement && dragState.value.ghostElement.parentElement) {
      dragState.value.ghostElement.parentElement.removeChild(dragState.value.ghostElement)
    }

    // 清除高亮
    clearDropTarget()

    // 恢复页面选择
    document.body.style.userSelect = ''
    document.body.style.webkitUserSelect = ''
    document.body.style.cursor = ''

    // 广播拖拽结束事件
    window.dispatchEvent(new CustomEvent('task-row-drag-end'))

    // 如果有有效的放置目标，触发drop回调
    if (draggedTask && dropTargetTask && dropPosition && options.onDrop) {
      // eslint-disable-next-line no-console
      console.log('[TaskRowDrag] 放置任务:', draggedTask.name, '到', dropTargetTask.name, 'position:', dropPosition)
      options.onDrop(draggedTask, dropTargetTask, dropPosition)
    } else {
      // eslint-disable-next-line no-console
      console.log('[TaskRowDrag] 结束拖拽，没有有效的放置目标')
    }

    // 重置状态
    dragState.value = {
      isDragging: false,
      draggedTask: null,
      draggedElement: null,
      ghostElement: null,
      dropTargetTask: null,
      dropPosition: null,
    }
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (dragState.value.isDragging) {
      updateGhostPosition(event)

      // 临时隐藏幽灵元素以检测下方元素
      const ghost = dragState.value.ghostElement
      if (ghost) {
        ghost.style.display = 'none'
      }

      // 检测鼠标下的元素
      const elementUnderMouse = document.elementFromPoint(event.clientX, event.clientY)

      // 恢复幽灵元素显示
      if (ghost) {
        ghost.style.display = ''
      }

      if (elementUnderMouse) {
        // 查找最近的task-row元素
        const taskRow = elementUnderMouse.closest('.task-row') as HTMLElement
        if (taskRow && taskRow.dataset.taskId) {
          const taskId = Number(taskRow.dataset.taskId)
          // eslint-disable-next-line no-console
          console.log('[TaskRowDrag] 检测到taskRow:', taskId)

          // 触发全局事件，让TaskRow组件处理
          window.dispatchEvent(
            new CustomEvent('task-row-drag-over', {
              detail: { taskId, event },
            }),
          )
        }
      }
    }
  }

  const handleMouseUp = () => {
    if (dragState.value.isDragging) {
      endDrag()
    }
  }

  // 检查task2是否是task1的后代
  const isDescendant = (ancestor: Task, descendant: Task): boolean => {
    if (!ancestor.children) return false

    for (const child of ancestor.children) {
      if (child.id === descendant.id) return true
      if (isDescendant(child, descendant)) return true
    }

    return false
  }

  onMounted(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)

    // 清理可能残留的幽灵元素
    if (dragState.value.ghostElement && dragState.value.ghostElement.parentElement) {
      dragState.value.ghostElement.parentElement.removeChild(dragState.value.ghostElement)
    }
  })

  return {
    dragState,
    startDrag,
    handleDragOver,
    endDrag,
  }
}

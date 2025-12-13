import { ref, onMounted, onUnmounted } from 'vue'
import type { Task } from '../models/classes/Task'

interface DragState {
  isDragging: boolean
  isPreparing: boolean // 新增：准备拖拽状态（鼠标按下但未移动足够距离）
  draggedTask: Task | null
  draggedElement: HTMLElement | null
  ghostElement: HTMLElement | null
  dropTargetTask: Task | null
  dropPosition: 'after' | 'child' | null
  startX: number // 记录起始鼠标位置
  startY: number
}

interface UseDragOptions {
  enabled: boolean
  dragThreshold?: number // 拖拽触发阈值（像素），默认5px
  onDragStart?: (task: Task) => void
  onDragOver?: (task: Task, position: 'after' | 'child') => void
  onDrop?: (draggedTask: Task, targetTask: Task, position: 'after' | 'child') => void
}

export function useTaskRowDrag(options: UseDragOptions) {
  const DRAG_THRESHOLD = options.dragThreshold ?? 5 // 默认5px触发拖拽

  const dragState = ref<DragState>({
    isDragging: false,
    isPreparing: false,
    draggedTask: null,
    draggedElement: null,
    ghostElement: null,
    dropTargetTask: null,
    dropPosition: null,
    startX: 0,
    startY: 0,
  })

  const startDrag = (task: Task, element: HTMLElement, event: MouseEvent) => {
    if (!options.enabled) return

    // 防止里程碑分组、里程碑被拖拽
    if (task.type === 'milestone-group' || task.type === 'milestone') {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    // 进入准备状态，记录起始位置，但不创建ghost
    dragState.value.isPreparing = true
    dragState.value.draggedTask = task
    dragState.value.draggedElement = element
    dragState.value.startX = event.clientX
    dragState.value.startY = event.clientY
  }

  // 真正激活拖拽（创建ghost等）
  const activateDrag = (event: MouseEvent) => {
    if (!dragState.value.isPreparing || dragState.value.isDragging) return

    const task = dragState.value.draggedTask!
    const element = dragState.value.draggedElement!

    dragState.value.isDragging = true
    dragState.value.isPreparing = false

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
      clearDropTarget()
      return
    }

    // 不能拖拽到自己的子任务上
    if (isDescendant(dragState.value.draggedTask, task)) {
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

    if (options.onDragOver) {
      options.onDragOver(task, position)
    }
  }

  const clearDropTarget = () => {
    dragState.value.dropTargetTask = null
    dragState.value.dropPosition = null
    document.querySelectorAll('.task-row-drop-target').forEach(el => {
      el.classList.remove('task-row-drop-target', 'drop-after', 'drop-child')
    })
  }

  const endDrag = () => {
    // 如果只是准备状态（未真正拖拽），直接取消
    if (dragState.value.isPreparing && !dragState.value.isDragging) {
      dragState.value.isPreparing = false
      dragState.value.draggedTask = null
      dragState.value.draggedElement = null
      return
    }

    if (!dragState.value.isDragging) return

    const draggedTask = dragState.value.draggedTask
    const dropTargetTask = dragState.value.dropTargetTask
    const dropPosition = dragState.value.dropPosition

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
      options.onDrop(draggedTask, dropTargetTask, dropPosition)
    }

    // 重置状态
    dragState.value = {
      isDragging: false,
      isPreparing: false,
      draggedTask: null,
      draggedElement: null,
      ghostElement: null,
      dropTargetTask: null,
      dropPosition: null,
      startX: 0,
      startY: 0,
    }
  }

  const handleMouseMove = (event: MouseEvent) => {
    // 如果处于准备状态，检查是否移动超过阈值
    if (dragState.value.isPreparing && !dragState.value.isDragging) {
      const deltaX = Math.abs(event.clientX - dragState.value.startX)
      const deltaY = Math.abs(event.clientY - dragState.value.startY)
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      // 超过阈值，激活真正的拖拽
      if (distance > DRAG_THRESHOLD) {
        activateDrag(event)
      }
      return
    }

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
    if (dragState.value.isDragging || dragState.value.isPreparing) {
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

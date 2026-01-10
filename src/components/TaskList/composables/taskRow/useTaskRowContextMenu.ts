import { ref, computed, watch, onMounted, onUnmounted, type Ref, type WatchStopHandle } from 'vue'
import type { Task } from '../../../../models/classes/Task'

/**
 * TaskRow 右键菜单和计时器管理
 * 管理右键菜单的显示、隐藏和事件处理，以及任务计时器的状态和更新
 */
export function useTaskRowContextMenu(
  task: Ref<Task>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit: (...args: any[]) => void,
) {
  // 右键菜单相关状态
  const contextMenuVisible = ref(false)
  const contextMenuPosition = ref({ x: 0, y: 0 })
  const contextMenuTask = computed(() => task.value)

  // 任务计时器状态
  const timerElapsed = ref(0)
  const timerInterval = ref<number | null>(null)
  let watchStopHandle: WatchStopHandle | null = null

  // 格式化计时器显示：转换为 HH:MM:SS 格式
  const formattedTimer = computed(() => {
    const totalSeconds = Math.floor(timerElapsed.value / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  })

  // 更新计时器显示
  const updateTimer = () => {
    if (task.value.isTimerRunning && task.value.timerStartTime) {
      // 计算已经运行的时间 = 当前时间 - 开始时间 + 之前累积的时间
      const previousElapsed = task.value.timerElapsedTime || 0
      timerElapsed.value = Date.now() - task.value.timerStartTime + previousElapsed
    } else if (task.value.timerElapsedTime) {
      // 如果任务不在运行中，但有累计时间，显示累计时间
      timerElapsed.value = task.value.timerElapsedTime
    } else {
      // 默认情况下，计时器为0
      timerElapsed.value = 0
    }
  }

  // 启动watch监听（懒加载）
  const startTimerWatch = () => {
    if (watchStopHandle) return // 已经创建，避免重复

    watchStopHandle = watch(
      () => [task.value.isTimerRunning, task.value.timerStartTime, task.value.timerElapsedTime],
      () => {
        // 清除之前的计时器
        if (timerInterval.value) {
          clearInterval(timerInterval.value)
          timerInterval.value = null
        }

        // 如果任务正在计时，开始计时器
        if (task.value.isTimerRunning) {
          updateTimer()
          timerInterval.value = window.setInterval(updateTimer, 1000)
        } else {
          // 更新一次最终值
          updateTimer()
        }
      },
      { immediate: true },
    )
  }

  // 性能优化：只在任务有计时相关数据时才启动watch
  if (task.value.isTimerRunning || task.value.timerElapsedTime) {
    startTimerWatch()
  }

  // 处理右键菜单显示
  const handleContextMenu = (event: MouseEvent) => {
    // 先广播关闭所有TaskRow菜单
    window.dispatchEvent(new CustomEvent('close-all-taskbar-menus'))
    const taskType = task.value.type || 'task'
    if (taskType !== 'task' && taskType !== 'story') {
      // 为了排除里程碑类型
      event.preventDefault()
      contextMenuVisible.value = false
      return
    }
    event.preventDefault()
    contextMenuVisible.value = true
    contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  }

  // 关闭右键菜单
  const closeContextMenu = () => {
    contextMenuVisible.value = false
  }

  // 处理文档点击事件，点击菜单外部时关闭
  const handleDocumentClick = (event: MouseEvent) => {
    if (!contextMenuVisible.value) return

    const target = event.target as HTMLElement
    // 检查点击是否在右键菜单内部
    const contextMenuElement = document.querySelector('.task-context-menu')
    if (contextMenuElement && contextMenuElement.contains(target)) {
      return
    }

    closeContextMenu()
  }

  // 处理任务删除
  const handleTaskDelete = (task: Task, deleteChildren?: boolean) => {
    emit('delete', task, deleteChildren)
    closeContextMenu()
  }

  // 生命周期钩子 - 注册事件监听器
  onMounted(() => {
    window.addEventListener('close-all-taskbar-menus', closeContextMenu)
    document.addEventListener('click', handleDocumentClick)
  })

  onUnmounted(() => {
    window.removeEventListener('close-all-taskbar-menus', closeContextMenu)
    document.removeEventListener('click', handleDocumentClick)
    // 清理定时器和watch
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
    }
    if (watchStopHandle) {
      watchStopHandle()
    }
  })

  return {
    contextMenuVisible,
    contextMenuPosition,
    contextMenuTask,
    handleContextMenu,
    closeContextMenu,
    handleTaskDelete,
    timerElapsed,
    formattedTimer,
  }
}

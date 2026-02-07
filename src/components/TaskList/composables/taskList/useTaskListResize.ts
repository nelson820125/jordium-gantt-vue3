import { ref, watch, type Ref } from 'vue'

/**
 * TaskList 容器尺寸管理
 * 负责管理容器宽度、高度以及 ResizeObserver
 */

export function useTaskListResize(
  isSplitterDragging: Ref<boolean>,
  taskListScrollTop: Ref<number>,
  taskListBodyHeight: Ref<number>,
) {
  // TaskList 容器引用
  const taskListRef = ref<HTMLElement | null>(null)
  const taskListBodyRef = ref<HTMLElement | null>(null)

  // 缓存容器宽度，避免频繁读取 offsetWidth 导致强制重排
  const cachedContainerWidth = ref(0)

  // ResizeObserver 实例
  let containerResizeObserver: ResizeObserver | null = null
  let bodyResizeObserver: ResizeObserver | null = null

  /**
   * 手动更新容器宽度（用于 Splitter 拖拽结束后）
   */
  const updateContainerWidth = () => {
    if (taskListRef.value) {
      const newWidth = taskListRef.value.offsetWidth
      if (Math.abs(newWidth - cachedContainerWidth.value) > 1) {
        cachedContainerWidth.value = newWidth
      }
    }
  }

  // v1.9.9 监听拖拽结束，手动更新尺寸
  watch(isSplitterDragging, (dragging) => {
    if (!dragging) {
      // 拖拽结束后手动更新容器宽度
      updateContainerWidth()

      // 同时更新body高度
      if (taskListBodyRef.value) {
        const newHeight = taskListBodyRef.value.clientHeight
        if (Math.abs(newHeight - taskListBodyHeight.value) > 1) {
          taskListBodyHeight.value = newHeight
        }
      }
    }
  })

  /**
   * 初始化 ResizeObserver
   */
  const initializeResizeObservers = () => {
    // 监听容器宽度变化
    if (taskListRef.value) {
      containerResizeObserver = new ResizeObserver((entries) => {
        // 拖拽期间跳过更新，避免高频重新计算列宽
        if (isSplitterDragging.value) {
          return
        }

        for (const entry of entries) {
          cachedContainerWidth.value = entry.contentRect.width
        }
      })
      containerResizeObserver.observe(taskListRef.value)
    }

    // 监听 TaskList body 高度变化，提供虚拟滚动所需尺寸
    if (taskListBodyRef.value) {
      taskListBodyHeight.value = taskListBodyRef.value.clientHeight
      taskListScrollTop.value = taskListBodyRef.value.scrollTop

      bodyResizeObserver = new ResizeObserver(entries => {
        // v1.9.9 拖拽期间跳过更新，避免影响拖拽性能
        if (isSplitterDragging.value) {
          return
        }

        for (const entry of entries) {
          taskListBodyHeight.value = entry.contentRect.height
        }
      })

      bodyResizeObserver.observe(taskListBodyRef.value)
    }
  }

  /**
   * 清理 ResizeObserver
   */
  const cleanupResizeObservers = () => {
    if (containerResizeObserver) {
      containerResizeObserver.disconnect()
      containerResizeObserver = null
    }

    if (bodyResizeObserver) {
      bodyResizeObserver.disconnect()
      bodyResizeObserver = null
    }
  }

  return {
    taskListRef,
    taskListBodyRef,
    cachedContainerWidth,
    initializeResizeObservers,
    cleanupResizeObservers,
    updateContainerWidth,
  }
}

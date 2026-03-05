import { ref, computed, inject, type Ref, type ComputedRef } from 'vue'
import type { Task } from '../../../../models/classes/Task'
import type { Resource } from '../../../../models/classes/Resource'

/**
 * TaskList 布局计算逻辑
 * 包含虚拟滚动、任务扁平化、可见区域计算等
 */

// 常量定义
export const ROW_HEIGHT = 51 // 每行高度（与TaskList Row一致）
export const VERTICAL_BUFFER = 5 // 上下额外渲染的缓冲行数

export interface TaskWithLevel {
  task: Task
  level: number
}

export interface TaskWithLevelAndIndex extends TaskWithLevel {
  rowIndex: number
}

export interface VisibleTaskRange {
  startIndex: number
  endIndex: number
}

export function useTaskListLayout(tasks: Ref<Task[]>) {
  // 纵向虚拟滚动相关状态
  const taskListScrollTop = ref(0)
  const taskListBodyHeight = ref(0)

  // v1.9.0 注入视图模式和资源布局信息
  const viewMode = inject<Ref<'task' | 'resource'>>('gantt-view-mode', ref('task'))
  const dataSource = inject<ComputedRef<Task[] | Resource[]>>('gantt-data-source', computed(() => []))
  const resourceTaskLayouts = inject<ComputedRef<Map<string | number, {
    taskRowMap: Map<string | number, number>,
    rowHeights: number[],
    totalHeight: number
  }>>>('resourceTaskLayouts', computed(() => new Map()))

  /**
   * 获取当前折叠状态下的可见任务列表（扁平化）
   */
  const getFlattenedVisibleTasks = (
    taskList: Task[],
    level = 0,
  ): TaskWithLevel[] => {
    const result: TaskWithLevel[] = []

    for (const task of taskList) {
      result.push({ task, level })

      const isMilestoneGroup = task.type === 'milestone-group'

      if (!isMilestoneGroup && task.children && task.children.length > 0 && !task.collapsed) {
        result.push(...getFlattenedVisibleTasks(task.children, level + 1))
      }
    }

    return result
  }

  // 扁平化后的可见任务列表
  const flattenedTasks = computed(() => getFlattenedVisibleTasks(tasks.value))

  /**
   * 资源视图专用：累计高度数组（动态行高，需要数组+二分查找）
   * 任务视图固定行高，直接用公式计算，不构造此数组，避免 O(n) 分配
   */
  const cumulativeHeights = computed<number[]>(() => {
    if (viewMode.value !== 'resource') return []

    const resources = dataSource.value as Resource[]
    const heights: number[] = [0]
    let cumulative = 0
    resources.forEach(resource => {
      const layout = resourceTaskLayouts.value.get(resource.id)
      const height = layout?.totalHeight || ROW_HEIGHT
      cumulative += height
      heights.push(cumulative)
    })
    return heights
  })

  /**
   * 资源视图专用：根据滚动位置查找资源索引（二分查找）
   */
  const findIndexByScrollTop = (scrollTop: number): number => {
    const heights = cumulativeHeights.value
    let left = 0
    let right = heights.length - 1
    while (left < right) {
      const mid = Math.floor((left + right) / 2)
      if (heights[mid] <= scrollTop) {
        left = mid + 1
      } else {
        right = mid
      }
    }
    return Math.max(0, left - 1)
  }

  /**
   * 计算可视区域任务范围
   * - 任务视图：固定行高，O(1) 公式直接计算（不依赖 cumulativeHeights）
   * - 资源视图：动态行高，使用累计高度数组 + 二分查找
   */
  const visibleTaskRange = computed<VisibleTaskRange>(() => {
    const scrollTop = taskListScrollTop.value
    const containerHeight = taskListBodyHeight.value || 600

    if (viewMode.value === 'resource') {
      const heights = cumulativeHeights.value
      if (heights.length <= 1) return { startIndex: 0, endIndex: 0 }

      const total = (dataSource.value as Resource[]).length
      let startIndex = Math.max(0, findIndexByScrollTop(scrollTop) - VERTICAL_BUFFER)
      const scrollBottom = scrollTop + containerHeight
      let endIndex = Math.min(heights.length - 1, findIndexByScrollTop(scrollBottom) + VERTICAL_BUFFER + 1)
      return {
        startIndex: Math.min(startIndex, total),
        endIndex: Math.min(endIndex, total),
      }
    } else {
      // 任务视图：固定行高 ROW_HEIGHT，O(1) 直接计算，不访问 cumulativeHeights
      const total = flattenedTasks.value.length
      if (total === 0) return { startIndex: 0, endIndex: 0 }
      const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VERTICAL_BUFFER)
      const endIndex = Math.min(total, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VERTICAL_BUFFER)
      return { startIndex, endIndex }
    }
  })

  /**
   * 虚拟列表中需要渲染的任务
   */
  const visibleTasks = computed<TaskWithLevelAndIndex[]>(() => {
    const { startIndex, endIndex } = visibleTaskRange.value
    const slicedTasks = flattenedTasks.value.slice(startIndex, endIndex)
    return slicedTasks.map((item, index) => ({
      ...item,
      rowIndex: startIndex + index,
    }))
  })

  /**
   * Spacer 高度撑起滚动区域
   * 任务视图：O(1) 乘法；资源视图：从累计高度数组读取
   */
  const totalContentHeight = computed(() => {
    if (viewMode.value === 'resource') {
      const heights = cumulativeHeights.value
      return heights.length > 0 ? heights[heights.length - 1] : 0
    }
    return flattenedTasks.value.length * ROW_HEIGHT
  })

  const startSpacerHeight = computed(() => {
    if (viewMode.value === 'resource') {
      return cumulativeHeights.value[visibleTaskRange.value.startIndex] || 0
    }
    return visibleTaskRange.value.startIndex * ROW_HEIGHT
  })

  const endSpacerHeight = computed(() => {
    if (viewMode.value === 'resource') {
      const endIdx = visibleTaskRange.value.endIndex
      const endHeight = cumulativeHeights.value[endIdx] || 0
      return Math.max(0, totalContentHeight.value - endHeight)
    }
    return Math.max(0, (flattenedTasks.value.length - visibleTaskRange.value.endIndex) * ROW_HEIGHT)
  })

  return {
    // 状态
    taskListScrollTop,
    taskListBodyHeight,

    // 计算属性
    flattenedTasks,
    visibleTaskRange,
    visibleTasks,
    totalContentHeight,
    startSpacerHeight,
    endSpacerHeight,

    // 方法
    getFlattenedVisibleTasks,
  }
}

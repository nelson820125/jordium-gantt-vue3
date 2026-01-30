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
   * v1.9.0 计算每个任务/资源的累计高度位置（支持动态行高）
   */
  const cumulativeHeights = computed<number[]>(() => {
    if (viewMode.value === 'resource') {
      // 资源视图：使用每个资源的实际高度
      const resources = dataSource.value as Resource[]
      const heights: number[] = [0] // 第一个位置是0
      let cumulative = 0

      resources.forEach(resource => {
        const layout = resourceTaskLayouts.value.get(resource.id)
        const height = layout?.totalHeight || ROW_HEIGHT
        cumulative += height
        heights.push(cumulative)
      })

      return heights
    } else {
      // 任务视图：使用固定行高
      const heights: number[] = [0]
      for (let i = 1; i <= flattenedTasks.value.length; i++) {
        heights.push(i * ROW_HEIGHT)
      }
      return heights
    }
  })

  /**
   * 根据滚动位置查找对应的任务/资源索引（二分查找）
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
   * 计算可视区域任务范围（支持动态行高）
   */
  const visibleTaskRange = computed<VisibleTaskRange>(() => {
    const scrollTop = taskListScrollTop.value
    const containerHeight = taskListBodyHeight.value || 600
    const heights = cumulativeHeights.value

    if (heights.length <= 1) {
      return { startIndex: 0, endIndex: 0 }
    }

    // 找到起始索引（考虑缓冲区）
    let startIndex = findIndexByScrollTop(scrollTop)
    startIndex = Math.max(0, startIndex - VERTICAL_BUFFER)

    // 找到结束索引（考虑缓冲区）
    const scrollBottom = scrollTop + containerHeight
    let endIndex = findIndexByScrollTop(scrollBottom)
    endIndex = Math.min(heights.length - 1, endIndex + VERTICAL_BUFFER + 1)

    const total = viewMode.value === 'resource'
      ? (dataSource.value as Resource[]).length
      : flattenedTasks.value.length

    return {
      startIndex: Math.min(startIndex, total),
      endIndex: Math.min(endIndex, total),
    }
  })

  /**
   * 虚拟列表中需要渲染的任务
   */
  const visibleTasks = computed<TaskWithLevelAndIndex[]>(() => {
    const { startIndex, endIndex } = visibleTaskRange.value
    const slicedTasks = flattenedTasks.value.slice(startIndex, endIndex)
    // 添加 rowIndex（基于在扁平化列表中的实际索引）
    return slicedTasks.map((item, index) => ({
      ...item,
      rowIndex: startIndex + index,
    }))
  })

  /**
   * Spacer 高度用于撑起滚动区域（支持动态行高）
   */
  const totalContentHeight = computed(() => {
    const heights = cumulativeHeights.value
    return heights.length > 0 ? heights[heights.length - 1] : 0
  })

  const startSpacerHeight = computed(() => {
    const startIdx = visibleTaskRange.value.startIndex
    return cumulativeHeights.value[startIdx] || 0
  })

  const endSpacerHeight = computed(() => {
    const endIdx = visibleTaskRange.value.endIndex
    const endHeight = cumulativeHeights.value[endIdx] || 0
    return Math.max(0, totalContentHeight.value - endHeight)
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

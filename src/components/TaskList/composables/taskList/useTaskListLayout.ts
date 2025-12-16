import { ref, computed, type Ref } from 'vue'
import type { Task } from '../../../../models/classes/Task'

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
   * 计算可视区域任务范围
   */
  const visibleTaskRange = computed<VisibleTaskRange>(() => {
    const scrollTop = taskListScrollTop.value
    const containerHeight = taskListBodyHeight.value || 600

    const startIndex = Math.floor(scrollTop / ROW_HEIGHT) - VERTICAL_BUFFER
    const endIndex = Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VERTICAL_BUFFER

    const total = flattenedTasks.value.length
    const clampedStart = Math.min(Math.max(0, startIndex), total)
    const clampedEnd = Math.min(total, Math.max(clampedStart + 1, endIndex))

    return {
      startIndex: clampedStart,
      endIndex: clampedEnd,
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
   * Spacer 高度用于撑起滚动区域
   */
  const totalContentHeight = computed(() => flattenedTasks.value.length * ROW_HEIGHT)
  const startSpacerHeight = computed(() => visibleTaskRange.value.startIndex * ROW_HEIGHT)
  const endSpacerHeight = computed(() => {
    const visibleHeight = visibleTasks.value.length * ROW_HEIGHT
    return Math.max(0, totalContentHeight.value - startSpacerHeight.value - visibleHeight)
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

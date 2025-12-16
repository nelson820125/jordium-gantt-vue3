import { computed, type Ref, type StyleValue } from 'vue'
import type { Task } from '../../../../models/classes/Task'

/**
 * TaskRow 状态管理
 * 管理任务行的基础状态计算、进度状态、样式计算
 * 性能优化：合并多个computed为单个，减少计算链
 */
export function useTaskRowState(
  task: Ref<Task>,
  level: Ref<number>,
  rowIndex?: Ref<number | undefined>,
  taskListRowClassName?: Ref<string | ((row: Task, rowIndex: number) => string) | undefined>,
  taskListRowStyle?: Ref<StyleValue | ((row: Task, rowIndex: number) => StyleValue) | undefined>,
) {
  const baseIndent = 10

  // 性能优化：合并所有状态计算到单个computed中
  const taskState = computed(() => {
    const type = task.value.type
    const children = task.value.children
    const hasChildren = !!(children && children.length > 0)
    const isStoryTask = type === 'story'
    const isMilestoneGroup = type === 'milestone-group'
    const isMilestoneTask = type === 'milestone'
    const isParentTask = isStoryTask || hasChildren || isMilestoneGroup

    return {
      indent: `${baseIndent + level.value * 20}px`,
      hasChildren,
      isStoryTask,
      isMilestoneGroup,
      isMilestoneTask,
      isParentTask,
    }
  })

  // 获取进度值的样式类
  const getProgressClass = () => {
    const progress = task.value.progress || 0
    const today = new Date()
    const endDate = task.value.endDate ? new Date(task.value.endDate) : null

    // 超期且未完成
    if (endDate && today > endDate && progress < 100) {
      return 'progress-danger'
    }

    // 已完成
    if (progress >= 100) {
      return 'progress-success'
    }

    // 进行中
    if (progress > 0) {
      return 'progress-warning'
    }

    return ''
  }

  // 检查是否超时
  const isOvertime = () => {
    return (
      task.value.actualHours &&
      task.value.estimatedHours &&
      task.value.actualHours > task.value.estimatedHours
    )
  }

  // 检查是否逾期，返回天数
  const overdueDays = () => {
    const today = new Date()
    const endDate = task.value.endDate ? new Date(task.value.endDate) : null
    const progress = task.value.progress || 0
    if (endDate && today > endDate && progress < 100) {
      // 只计算日期部分
      const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const e = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
      const diff = Math.floor((t.getTime() - e.getTime()) / (1000 * 60 * 60 * 24))
      return diff
    }
    return 0
  }

  const progressClass = computed(() => getProgressClass())

  // 计算自定义行类名
  const customRowClass = computed(() => {
    if (!taskListRowClassName?.value) return ''

    if (typeof taskListRowClassName.value === 'function') {
      return taskListRowClassName.value(task.value, rowIndex?.value ?? 0)
    }

    return taskListRowClassName.value
  })

  // 计算自定义行样式（优先级高于类名）
  const customRowStyle = computed(() => {
    if (!taskListRowStyle?.value) return {}

    if (typeof taskListRowStyle.value === 'function') {
      return taskListRowStyle.value(task.value, rowIndex?.value ?? 0)
    }

    return taskListRowStyle.value
  })

  // 使用解构返回单个computed的属性
  return {
    indent: computed(() => taskState.value.indent),
    hasChildren: computed(() => taskState.value.hasChildren),
    isStoryTask: computed(() => taskState.value.isStoryTask),
    isMilestoneGroup: computed(() => taskState.value.isMilestoneGroup),
    isMilestoneTask: computed(() => taskState.value.isMilestoneTask),
    isParentTask: computed(() => taskState.value.isParentTask),
    getProgressClass,
    isOvertime,
    overdueDays,
    progressClass,
    customRowClass,
    customRowStyle,
  }
}

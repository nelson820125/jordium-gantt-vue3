import type { Task } from '../../../models/classes/Task'

/**
 * 父任务数据计算逻辑
 * 负责计算父任务的进度和日期范围
 */

/**
 * 计算父级任务的进度和日期范围
 */
export function calculateParentTaskData(
  task: Task,
): { progress: number; startDate: string; endDate: string } {
  if (!task.children || task.children.length === 0) {
    return {
      progress: task.progress || 0,
      startDate: task.startDate || '',
      endDate: task.endDate || '',
    }
  }

  // 递归收集所有子任务
  const allChildTasks: Task[] = []
  const collectChildTasks = (tasks: Task[]) => {
    tasks.forEach(childTask => {
      allChildTasks.push(childTask)
      if (childTask.children && childTask.children.length > 0) {
        collectChildTasks(childTask.children)
      }
    })
  }
  collectChildTasks(task.children)

  // 计算进度：所有子任务进度的平均值
  const totalProgress = allChildTasks.reduce((sum, childTask) => {
    return sum + (childTask.progress || 0)
  }, 0)
  const averageProgress =
    allChildTasks.length > 0 ? Math.round(totalProgress / allChildTasks.length) : 0

  // 计算日期范围：最早开始日期和最晚结束日期
  const validTasks = allChildTasks.filter(childTask => childTask.startDate && childTask.endDate)
  if (validTasks.length === 0) {
    return {
      progress: averageProgress,
      startDate: task.startDate || '',
      endDate: task.endDate || '',
    }
  }

  const startDates = validTasks.map(childTask => new Date(childTask.startDate!))
  const endDates = validTasks.map(childTask => new Date(childTask.endDate!))

  const earliestStart = new Date(Math.min(...startDates.map(date => date.getTime())))
  const latestEnd = new Date(Math.max(...endDates.map(date => date.getTime())))

  return {
    progress: averageProgress,
    startDate: earliestStart.toISOString().split('T')[0],
    endDate: latestEnd.toISOString().split('T')[0],
  }
}

/**
 * 更新所有父级任务的进度和日期范围
 */
export function updateParentTasksData(tasks: Task[] | undefined) {
  if (!tasks) return

  const updateParentTask = (taskList: Task[]): void => {
    taskList.forEach(task => {
      if (task.children && task.children.length > 0) {
        // 先更新子任务
        updateParentTask(task.children)

        // 计算父级任务的进度和日期范围
        const parentData = calculateParentTaskData(task)
        task.progress = parentData.progress
        task.startDate = parentData.startDate
        task.endDate = parentData.endDate
      }
    })
  }

  updateParentTask(tasks)
}

/**
 * 获取所有任务的扁平化列表（包括子任务）
 */
export function getAllTasks(taskList: Task[]): Task[] {
  const allTasks: Task[] = []

  const collectTasks = (tasks: Task[]) => {
    tasks.forEach(task => {
      allTasks.push(task)
      if (task.children && task.children.length > 0) {
        collectTasks(task.children)
      }
    })
  }

  collectTasks(taskList)
  return allTasks
}

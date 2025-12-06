import type { Task } from '../models/classes/Task'

/**
 * 任务树操作工具函数
 */

/**
 * 从任务树中查找任务的父任务
 */
export function findTaskParent(
  taskList: Task[],
  targetId: number,
  parent: Task | null = null,
): Task | null {
  for (const task of taskList) {
    if (task.id === targetId) {
      return parent
    }
    if (task.children && task.children.length > 0) {
      const found = findTaskParent(task.children, targetId, task)
      if (found !== null) return found
    }
  }
  return null
}

/**
 * 从任务树中移除指定任务
 * @returns 被移除的任务，如果未找到则返回 null
 */
export function removeTaskFromTree(taskList: Task[], taskId: number): Task | null {
  for (let i = 0; i < taskList.length; i++) {
    if (taskList[i].id === taskId) {
      return taskList.splice(i, 1)[0]
    }
    if (taskList[i].children && taskList[i].children!.length > 0) {
      const removed = removeTaskFromTree(taskList[i].children!, taskId)
      if (removed) return removed
    }
  }
  return null
}

/**
 * 将任务插入到任务树的指定位置
 * @param taskList 任务列表
 * @param targetId 目标任务ID
 * @param taskToInsert 要插入的任务
 * @param position 插入位置：'after' 表示在目标任务之后，'child' 表示作为目标任务的子任务
 * @returns 是否插入成功
 */
export function insertTaskInTree(
  taskList: Task[],
  targetId: number,
  taskToInsert: Task,
  position: 'after' | 'child',
): boolean {
  for (let i = 0; i < taskList.length; i++) {
    if (taskList[i].id === targetId) {
      if (position === 'after') {
        // 算法#1: 放置在目标任务之后（同级）
        // 更新 parentId 为目标任务的 parentId
        taskToInsert.parentId = taskList[i].parentId
        taskList.splice(i + 1, 0, taskToInsert)
      } else {
        // 算法#2: 作为子任务插入（第一个子任务位置）
        // 重要：里程碑组（milestone-group）不能添加子任务，只能在其后插入
        if (taskList[i].type === 'milestone-group') {
          // 降级为 'after' 逻辑
          taskToInsert.parentId = taskList[i].parentId
          taskList.splice(i + 1, 0, taskToInsert)
        } else {
          // 更新 parentId 为目标任务的 id
          taskToInsert.parentId = targetId
          if (!taskList[i].children) {
            taskList[i].children = []
          }
          taskList[i].children!.unshift(taskToInsert)
        }
      }
      return true
    }
    if (taskList[i].children && taskList[i].children!.length > 0) {
      if (insertTaskInTree(taskList[i].children!, targetId, taskToInsert, position)) {
        return true
      }
    }
  }
  return false
}

/**
 * 执行任务移动操作（直接修改传入的 taskList）
 * @returns 移动信息，如果移动失败则返回 null
 */
export function moveTask(
  taskList: Task[],
  draggedTaskId: number,
  targetTaskId: number,
  position: 'after' | 'child',
): {
  movedTask: Task
  oldParent: Task | null
  newParent: Task | null
} | null {
  // 1. 记录原始父任务
  const oldParent = findTaskParent(taskList, draggedTaskId)

  // 2. 从原位置移除任务
  const removedTask = removeTaskFromTree(taskList, draggedTaskId)
  if (!removedTask) {
    return null
  }

  // 3. 插入到新位置
  const inserted = insertTaskInTree(taskList, targetTaskId, removedTask, position)
  if (!inserted) {
    // 插入失败，需要恢复任务到原位置
    // 如果有父任务，恢复到父任务的 children 中
    if (oldParent && oldParent.children) {
      oldParent.children.push(removedTask)
    } else {
      // 否则恢复到根级别
      taskList.push(removedTask)
    }
    return null
  }

  // 4. 计算新的父任务
  const newParent = findTaskParent(taskList, draggedTaskId)

  return {
    movedTask: removedTask,
    oldParent,
    newParent,
  }
}

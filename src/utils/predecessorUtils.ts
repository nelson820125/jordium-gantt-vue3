/**
 * 前置任务工具函数
 */

/**
 * 获取任务的前置任务ID数组
 * @param predecessor 前置任务字段，可能是数组、字符串或空
 * @returns 前置任务ID数组
 */
export function getPredecessorIds(predecessor?: number[] | string | string[]): number[] {
  if (!predecessor) return []

  // 如果已经是number数组，直接返回
  if (Array.isArray(predecessor) && typeof predecessor[0] === 'number') {
    return predecessor as number[]
  }

  // 如果是字符串数组
  if (Array.isArray(predecessor)) {
    return predecessor
      .filter(id => id && id.toString().trim())
      .map(id => Number(id.toString().trim()))
      .filter(id => !isNaN(id))
  }

  // 字符串格式，支持逗号分隔的多个ID
  return predecessor
    .split(',')
    .map(id => id.trim())
    .filter(id => id)
    .map(id => Number(id))
    .filter(id => !isNaN(id))
}

/**
 * 将前置任务ID数组转换为数组格式（标准格式）
 * @param predecessorIds 前置任务ID数组
 * @returns number数组
 */
export function predecessorIdsToArray(predecessorIds: number[]): number[] {
  return predecessorIds.filter(id => id > 0)
}

/**
 * 将前置任务ID数组转换为字符串格式（兼容性）
 * @param predecessorIds 前置任务ID数组
 * @returns 逗号分隔的字符串
 */
export function predecessorIdsToString(predecessorIds: number[]): string {
  return predecessorIds.filter(id => id > 0).join(',')
}

/**
 * 将前置任务字符串转换为数组格式
 * @param predecessor 前置任务字符串
 * @returns 前置任务ID数组
 */
export function predecessorStringToArray(predecessor?: string): string[] {
  if (!predecessor) return []
  return predecessor
    .split(',')
    .map(id => id.trim())
    .filter(id => id)
}

/**
 * 检查任务是否有特定的前置任务
 * @param task 任务对象
 * @param predecessorId 要检查的前置任务ID
 * @returns 是否包含该前置任务
 */
export function hasPredecessor(task: { predecessor?: number[] }, predecessorId: number): boolean {
  const ids = getPredecessorIds(task.predecessor)
  return ids.includes(predecessorId)
}

/**
 * 添加前置任务到任务
 * @param task 任务对象
 * @param predecessorId 要添加的前置任务ID
 */
export function addPredecessor(task: { predecessor?: number[] }, predecessorId: number): void {
  const ids = getPredecessorIds(task.predecessor)
  if (!ids.includes(predecessorId)) {
    ids.push(predecessorId)
    task.predecessor = predecessorIdsToArray(ids)
  }
}

/**
 * 从任务中移除前置任务
 * @param task 任务对象
 * @param predecessorId 要移除的前置任务ID
 */
export function removePredecessor(task: { predecessor?: number[] }, predecessorId: number): void {
  const ids = getPredecessorIds(task.predecessor)
  const filteredIds = ids.filter(id => id !== predecessorId)
  task.predecessor = filteredIds.length > 0 ? predecessorIdsToArray(filteredIds) : undefined
}

/**
 * 格式化前置任务显示文本
 * @param predecessor 前置任务字段
 * @returns 格式化后的显示文本
 */
export function formatPredecessorDisplay(predecessor?: number[]): string {
  const ids = getPredecessorIds(predecessor)
  return ids.length > 0 ? ids.join(', ') : '-'
}

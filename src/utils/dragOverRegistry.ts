/**
 * dragOverRegistry - 任务行拖拽悬停事件委托注册表
 *
 * 解决性能问题：原来每个可见 TaskRow 各自注册一个 window 'task-row-drag-over' 监听器，
 * 拖拽时 CustomEvent 广播需逐一触发所有监听器（O(n) 开销）。
 *
 * 改进后：改为单一全局监听器 + Map 直接查找（O(1)），
 * 监听器数量从 N 个（可见行数）降为 1 个。
 */

type DragOverCallback = (mouseEvent: MouseEvent) => void

const _registry = new Map<number | string, DragOverCallback>()

function _handleGlobalDragOver(e: Event) {
  const { taskId, event: mouseEvent } = (e as CustomEvent).detail
  const handler = _registry.get(taskId)
  if (handler) handler(mouseEvent)
}

/**
 * 注册任务行的拖拽悬停回调。
 * 第一次注册时自动绑定全局 window 监听器。
 */
export function registerDragOver(taskId: number | string, handler: DragOverCallback): void {
  const wasEmpty = _registry.size === 0
  _registry.set(taskId, handler)
  if (wasEmpty) {
    window.addEventListener('task-row-drag-over', _handleGlobalDragOver)
  }
}

/**
 * 注销任务行的拖拽悬停回调。
 * 最后一个注销时自动解绑全局 window 监听器。
 */
export function unregisterDragOver(taskId: number | string): void {
  _registry.delete(taskId)
  if (_registry.size === 0) {
    window.removeEventListener('task-row-drag-over', _handleGlobalDragOver)
  }
}

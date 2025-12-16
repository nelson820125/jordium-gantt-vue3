import { inject, type Slots } from 'vue'

/**
 * TaskRow 列级 Slot 管理
 * 管理从 GanttChart 注入的列级自定义 slots
 */
export function useTaskRowColumnSlots() {
  // 从 GanttChart 注入列级 slots
  const columnSlots = inject<Slots>('gantt-column-slots', {})

  // 检查指定列是否有自定义 slot（从注入的 slots 中查找）
  const hasColumnSlot = (columnKey: string) => {
    const slotName = `column-${columnKey}`
    return Boolean(columnSlots[slotName])
  }

  // 渲染列级 slot
  const renderColumnSlot = (columnKey: string, slotProps: any) => {
    const slotName = `column-${columnKey}`
    const slotFn = columnSlots[slotName]
    if (slotFn) {
      return slotFn(slotProps)
    }
    return null
  }

  return {
    columnSlots,
    hasColumnSlot,
    renderColumnSlot,
  }
}

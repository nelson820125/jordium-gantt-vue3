import { computed, type VNode, type Slots, type VNodeChild, type Component } from 'vue'
import type { Task } from '../../../models/classes/Task'

/**
 * 声明式右键菜单配置接口
 */
export interface DeclarativeContextMenuConfig {
  // slot 渲染函数
  defaultSlot?: (scope: {
    row: Task
    $index: number
  }) => VNodeChild
  // 指定哪些任务类型显示此右键菜单
  taskType?: string | string[]
}

/**
 * 从 VNode 中提取 task-bar-context-menu 的配置
 */
export function extractTaskBarContextMenuConfig(vnode: VNode): DeclarativeContextMenuConfig | null {
  // 检查是否是 TaskBarContextMenu 组件
  let isTaskBarContextMenu = false

  if (typeof vnode.type === 'object') {
    const component = vnode.type as Component & {
      __name?: string
      __file?: string
    }
    // 检查组件名称的多种可能性
    isTaskBarContextMenu =
      component.name === 'TaskBarContextMenu' ||
      component.__name === 'TaskBarContextMenu' ||
      // 检查文件名（setup script 组件）
      (component.__file !== undefined && component.__file.includes('TaskBarContextMenu'))
  }

  if (!isTaskBarContextMenu) {
    return null
  }

  // 提取 props
  const props = vnode.props || {}

  // 提取 slots
  type ChildrenType =
    | {
        default?: (scope: {
          row: Task
          $index: number
        }) => VNodeChild
      }
    | null
  const children = vnode.children as ChildrenType

  const defaultSlot = children?.default

  if (!defaultSlot) {
    return null
  }

  return {
    defaultSlot,
    taskType: props.taskType || props['task-type'],
  }
}

/**
 * 解析声明式右键菜单配置
 * 从默认 slot 的 VNode 中提取 TaskBarContextMenu 的配置
 */
export function parseDeclarativeTaskBarContextMenu(
  slots: Slots,
): DeclarativeContextMenuConfig | null {
  const defaultSlot = slots.default?.()

  if (!defaultSlot || !Array.isArray(defaultSlot)) {
    return null
  }

  // 递归查找 TaskBarContextMenu
  const findContextMenu = (vnodes: VNode[]): DeclarativeContextMenuConfig | null => {
    for (const vnode of vnodes) {
      if (!vnode) {
        continue
      }

      // 如果是 Fragment 或其他 Symbol 类型，直接处理子节点
      if (typeof vnode.type === 'symbol') {
        if (vnode.children && Array.isArray(vnode.children)) {
          const result = findContextMenu(vnode.children as VNode[])
          if (result) return result
        }
        continue
      }

      const config = extractTaskBarContextMenuConfig(vnode)
      if (config) {
        return config
      }

      // 递归处理子节点
      if (vnode.children && Array.isArray(vnode.children)) {
        const result = findContextMenu(vnode.children as VNode[])
        if (result) return result
      }
    }

    return null
  }

  return findContextMenu(defaultSlot)
}

/**
 * TaskBar Context Menu Composable
 * 用于管理 TaskBar 的右键菜单（支持声明式）
 */
export function useTaskBarContextMenu(slots: Slots) {
  // 声明式菜单配置
  const declarativeContextMenu = computed(() => {
    return parseDeclarativeTaskBarContextMenu(slots)
  })

  // 是否有声明式菜单
  const hasDeclarativeContextMenu = computed(() => {
    return !!declarativeContextMenu.value
  })

  return {
    declarativeContextMenu,
    hasDeclarativeContextMenu,
  }
}

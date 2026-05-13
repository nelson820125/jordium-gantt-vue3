import {
  computed,
  watch,
  shallowRef,
  type VNode,
  type Slots,
  type VNodeChild,
  type ComputedRef,
} from 'vue'
import type { Task } from '../../../../models/classes/Task'
import type { TaskListColumnConfig } from '../../../../models/configs/TaskListConfig'

/**
 * 声明式列配置接口
 * 从 task-list-column 组件解析出的列配置
 */
export interface DeclarativeColumnConfig {
  prop?: string
  label?: string
  width?: number | string
  align?: 'left' | 'center' | 'right'
  cssClass?: string
  // slot 函数
  headerSlot?: () => VNodeChild
  defaultSlot?: (scope: { row: Task; $index: number }) => VNodeChild
}

/**
 * 从 VNode 中提取 task-list-column 的配置
 */
export function extractColumnConfig(vnode: VNode): DeclarativeColumnConfig | null {
  // 检查是否是 task-list-column 组件
  // 支持多种识别方式
  let isTaskListColumn = false

  if (typeof vnode.type === 'object') {
    const component = vnode.type as any
    // 检查组件名称的多种可能性
    isTaskListColumn =
      component.name === 'TaskListColumn' ||
      component.__name === 'TaskListColumn' ||
      // 检查文件名（setup script 组件）
      (component.__file && component.__file.includes('TaskListColumn'))
  }

  if (!isTaskListColumn) {
    return null
  }

  // 提取 props
  const props = vnode.props || {}
  type ChildrenType = {
    header?: () => VNodeChild
    default?: (scope: { row: Task; $index: number }) => VNodeChild
  } | null
  const children = vnode.children as ChildrenType

  // 提取 slots
  const headerSlot = children?.header
  const defaultSlot = children?.default

  return {
    prop: props.prop,
    label: props.label,
    width: props.width,
    align: props.align || 'left',
    cssClass: props.cssClass,
    headerSlot,
    defaultSlot,
  }
}

/**
 * 解析声明式列配置
 * 从默认 slot 的 VNode 中提取所有 task-list-column 的配置
 */
export function parseDeclarativeColumns(slots: Slots): DeclarativeColumnConfig[] {
  const defaultSlot = slots.default?.()

  if (!defaultSlot || !Array.isArray(defaultSlot)) {
    return []
  }

  const columns: DeclarativeColumnConfig[] = []

  // 递归提取所有 task-list-column
  const extractColumns = (vnodes: VNode[]) => {
    for (const vnode of vnodes) {
      // 跳过注释节点和文本节点，但继续处理 Fragment
      if (!vnode) {
        continue
      }

      // 如果是 Fragment 或其他 Symbol 类型，直接处理子节点
      if (typeof vnode.type === 'symbol') {
        if (vnode.children && Array.isArray(vnode.children)) {
          extractColumns(vnode.children as VNode[])
        }
        continue
      }

      const config = extractColumnConfig(vnode)
      if (config) {
        columns.push(config)
      }

      // 递归处理子节点
      if (vnode.children && Array.isArray(vnode.children)) {
        extractColumns(vnode.children as VNode[])
      }
    }
  }

  extractColumns(defaultSlot)

  return columns
} /**
 * Task List Columns Composable
 * 用于管理任务列表的列配置（支持声明式和配置式）
 */
export function useTaskListColumns(
  renderMode: ComputedRef<'default' | 'declarative'> | 'default' | 'declarative',
  slots: Slots,
  defaultColumns?: TaskListColumnConfig[]
) {
  const getMode = () => (typeof renderMode === 'string' ? renderMode : renderMode.value)

  // 声明式列配置
  // ⚠️ 不能用 computed(() => parseDeclarativeColumns(slots))：
  //   computed 的 getter 在响应式追踪上下文中运行，slots.default() 执行时会捕获
  //   slot 闭包里的外部响应式变量（如 viewMode、t），导致父级任意状态变化都触发 TaskList 重渲染。
  // 解决方案：shallowRef 存结果 + watch(source, callback)。
  //   watch 只在 source 函数中追踪依赖（slots.default 引用 + renderMode），
  //   callback 在非追踪上下文中运行，调用 parseDeclarativeColumns(slots) 不会订阅 slot 内部依赖。
  // 初始值在 setup 顶层（同样是非追踪上下文）直接计算，安全。
  const declarativeColumns = shallowRef<DeclarativeColumnConfig[]>(
    getMode() === 'declarative' ? parseDeclarativeColumns(slots) : []
  )

  watch(
    () => (getMode() === 'declarative' ? (slots.default ?? null) : null),
    () => {
      declarativeColumns.value = getMode() === 'declarative' ? parseDeclarativeColumns(slots) : []
    }
  )

  // 最终使用的列配置
  const finalColumns = computed(() => {
    const mode = typeof renderMode === 'string' ? renderMode : renderMode.value
    if (mode === 'declarative') {
      return declarativeColumns.value
    }
    return defaultColumns || []
  })

  // 获取列宽度样式
  const getColumnWidthStyle = (column: { width?: number | string }, containerWidth?: number) => {
    if (!column.width) return {}

    let widthPx: string

    // 如果是百分比，转换为像素
    if (typeof column.width === 'string' && column.width.includes('%')) {
      if (containerWidth && containerWidth > 0) {
        const percentage = parseFloat(column.width) / 100
        const pixels = Math.floor(containerWidth * percentage)
        widthPx = `${pixels}px`
      } else {
        return {} // 容器宽度未知时返回空
      }
    } else {
      // 像素值：处理数字或字符串数字
      if (typeof column.width === 'number') {
        widthPx = `${column.width}px`
      } else if (typeof column.width === 'string') {
        // 如果字符串已经包含单位（px, rem, em等），直接使用
        if (/\d+(px|rem|em|%)/.test(column.width)) {
          widthPx = column.width
        } else {
          // 纯数字字符串，添加 px 单位
          widthPx = `${column.width}px`
        }
      } else {
        widthPx = String(column.width)
      }
    }

    return {
      flex: `0 0 ${widthPx}`,
      minWidth: widthPx,
      maxWidth: widthPx,
    }
  }

  // 获取列对齐样式
  const getColumnAlignStyle = (align?: 'left' | 'center' | 'right') => {
    if (!align || align === 'left') return {}
    return {
      justifyContent: align === 'center' ? 'center' : 'flex-end',
      textAlign: align,
    }
  }

  return {
    declarativeColumns,
    finalColumns,
    getColumnWidthStyle,
    getColumnAlignStyle,
  }
}

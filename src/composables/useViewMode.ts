/**
 * useViewMode - 视图模式状态管理
 * v1.9.9 统一管理视图切换状态，减少组件间inject复杂度
 *
 * 职责：
 * - 封装视图模式相关的inject逻辑
 * - 提供统一的视图状态访问接口
 * - 简化组件中的状态获取代码
 */

import { inject, computed, ref, type Ref, type ComputedRef } from 'vue'
import type { Task } from '../models/classes/Task'
import type { Resource } from '../models/classes/Resource'
import type { TaskListConfig } from '../models/configs/TaskListConfig'
import type { ResourceListConfig } from '../models/configs/ResourceListConfig'

/**
 * 在子组件中使用：统一注入视图模式相关状态
 *
 * 用法：
 * ```ts
 * const { viewMode, dataSource, isResourceView, isTaskView } = useViewMode()
 * ```
 */
export function useViewMode() {
  // 注入视图模式
  const viewMode = inject<Ref<'task' | 'resource'>>('gantt-view-mode', ref('task'))

  // 注入数据源
  const dataSource = inject<ComputedRef<Task[] | Resource[]>>('gantt-data-source', computed(() => []))

  // 注入列表配置
  const listConfig = inject<ComputedRef<TaskListConfig | ResourceListConfig | null>>(
    'gantt-list-config',
    computed(() => null),
  )

  // 派生状态：是否资源视图
  const isResourceView = computed(() => viewMode.value === 'resource')

  // 派生状态：是否任务视图
  const isTaskView = computed(() => viewMode.value === 'task')

  return {
    // 原始状态
    viewMode,
    dataSource,
    listConfig,
    // 派生状态
    isResourceView,
    isTaskView,
  }
}

/**
 * 在GanttChart等父组件中使用：提供视图模式状态
 *
 * 用法：
 * ```ts
 * const { provideViewMode } = useViewMode()
 * provideViewMode(currentViewMode, currentDataSource, currentListConfig)
 * ```
 */
export function provideViewMode(
  viewMode: Ref<'task' | 'resource'>,
  dataSource: ComputedRef<Task[] | Resource[]>,
  listConfig: ComputedRef<TaskListConfig | ResourceListConfig | null>,
) {
  // 注意：实际的provide调用仍在GanttChart中进行
  // 这个函数主要用于类型安全和文档目的
  return {
    viewMode,
    dataSource,
    listConfig,
  }
}

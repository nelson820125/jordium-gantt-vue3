/**
 * useResourceLayout - 资源视图布局计算
 * v1.9.9 从Timeline.vue抽取，符合单一职责原则
 *
 * 职责：
 * - 计算资源行内任务的子行布局（taskRowMap, rowHeights, totalHeight）
 * - 提供布局缓存机制，避免重复计算
 * - 管理资源行的累积位置计算
 */

import { computed, ref, watch, type Ref } from 'vue'
import { assignTaskRows } from '../utils/taskLayoutUtils'
import type { Resource } from '../models/classes/Resource'
import type { Task } from '../models/classes/Task'

// 布局结果接口
export interface ResourceLayout {
  taskRowMap: Map<string | number, number>
  rowHeights: number[]
  totalHeight: number
}

// 布局缓存（全局单例，避免重复创建）
const layoutCache = new Map<string, ResourceLayout>()

// 默认行高常量
const DEFAULT_ROW_HEIGHT = 51
const VERTICAL_BUFFER = 2

/**
 * 核心composable：管理资源视图布局
 */
export function useResourceLayout(
  viewMode: Ref<'task' | 'resource'>,
  dataSource: Ref<Task[] | Resource[]>,
  timelineBodyScrollTop: Ref<number>,
  timelineBodyHeight: Ref<number>,
) {
  // 性能监控计数器
  const layoutsCallCount = ref(0)
  const positionsCallCount = ref(0)

  // v1.9.9 layoutTrigger用于手动触发布局重新计算（当资源tasks变化时）
  const layoutTrigger = ref(0)

  /**
   * 计算所有资源的任务布局
   * 注意：必须计算所有资源，不能只计算可见资源，因为resourceRowPositions依赖完整数据
   */
  const resourceTaskLayouts = computed(() => {
    layoutsCallCount.value++
    // 读取trigger以建立依赖
    void layoutTrigger.value

    const layoutMap = new Map<string | number, ResourceLayout>()

    if (viewMode.value !== 'resource') {
      return layoutMap
    }

    const resources = dataSource.value as Resource[]

    // 为所有资源计算布局（使用缓存优化）
    resources.forEach(resource => {
      // v1.9.9 通过访问tasks.length建立对tasks数组变化的依赖
      // 这样当tasks数组增删元素时，computed会自动重新计算
      const tasks = (resource as Resource & { tasks?: Task[] }).tasks || []
      void tasks.length // 建立依赖但不使用值

      // 获取布局（内部会使用缓存）
      const layout = getResourceLayout(resource)
      layoutMap.set(resource.id, layout)
    })

    return layoutMap
  })

  /**
   * 计算资源行的累积位置（懒加载优化：只计算到需要的位置）
   */
  const resourceRowPositions = computed(() => {
    positionsCallCount.value++
    const positions = new Map<string | number, number>()

    if (viewMode.value !== 'resource') {
      return positions
    }

    const resources = dataSource.value as Resource[]
    const scrollTop = timelineBodyScrollTop.value
    const containerHeight = timelineBodyHeight.value || 600
    const scrollBottom = scrollTop + containerHeight + DEFAULT_ROW_HEIGHT * VERTICAL_BUFFER * 2

    let cumulativeTop = 0
    let processedCount = 0

    // 懒加载计算：只计算到scrollBottom以下一定范围
    for (const resource of resources) {
      positions.set(resource.id, cumulativeTop)

      const layout = getResourceLayout(resource)
      const resourceHeight = layout.totalHeight || DEFAULT_ROW_HEIGHT
      cumulativeTop += resourceHeight
      processedCount++

      // 优化：已经计算到scrollBottom之下足够远，停止详细计算
      if (cumulativeTop > scrollBottom + DEFAULT_ROW_HEIGHT * 20) {
        // 剩余资源使用近似位置（假设都是51px高度）
        for (let i = processedCount; i < resources.length; i++) {
          positions.set(resources[i].id, cumulativeTop)
          cumulativeTop += DEFAULT_ROW_HEIGHT
        }
        break
      }
    }

    return positions
  })

  /**
   * 获取单个资源的布局（按需计算+缓存）
   */
  function getResourceLayout(resource: Resource): ResourceLayout {
    const resourceTasks = (resource as Resource & { tasks?: Task[] }).tasks || []

    // 缓存key包含任务时间信息，因为时间交汇会影响换行布局
    const timeHash = resourceTasks
      .map((t: Task) => `${t.id}-${t.startDate || ''}-${t.endDate || ''}`)
      .join('|')
    const cacheKey = `${resource.id}-${resourceTasks.length}-${timeHash}`

    // 检查缓存
    if (layoutCache.has(cacheKey)) {
      return layoutCache.get(cacheKey)!
    }

    // 未命中缓存，重新计算
    let result: ResourceLayout
    if (resourceTasks.length > 0) {
      result = assignTaskRows(resourceTasks, DEFAULT_ROW_HEIGHT)
    } else {
      result = {
        taskRowMap: new Map(),
        rowHeights: [DEFAULT_ROW_HEIGHT],
        totalHeight: DEFAULT_ROW_HEIGHT,
      }
    }

    layoutCache.set(cacheKey, result)
    return result
  }

  /**
   * 缓存清理策略（保留最近100个条目，防止内存泄漏）
   */
  watch(dataSource, () => {
    if (layoutCache.size > 100) {
      const keysToDelete = Array.from(layoutCache.keys()).slice(0, layoutCache.size - 100)
      keysToDelete.forEach(key => layoutCache.delete(key))
    }
  })

  /**
   * 清空布局缓存（用于数据源切换等场景）
   */
  function clearLayoutCache() {
    layoutCache.clear()
  }

  /**
   * 清除指定资源的布局缓存
   * @param resourceId 资源ID
   */
  function clearResourceCache(resourceId: string | number) {
    const keysToDelete = Array.from(layoutCache.keys()).filter(key =>
      key.startsWith(`${resourceId}-`),
    )
    keysToDelete.forEach(key => layoutCache.delete(key))
  }

  /**
   * v1.9.9 强制使布局失效并重新计算
   * 用于资源拖拽等场景，当资源的tasks数组被外部修改后调用
   * @param resourceIds 可选，指定需要刷新的资源ID数组，不传则刷新所有
   */
  function invalidateLayout(resourceIds?: (string | number)[]) {
    if (resourceIds && resourceIds.length > 0) {
      // 清除指定资源的缓存
      resourceIds.forEach(id => clearResourceCache(id))
    } else {
      // 清除所有缓存
      layoutCache.clear()
    }
    // 触发computed重新计算
    layoutTrigger.value++
  }

  return {
    // 计算结果
    resourceTaskLayouts,
    resourceRowPositions,
    // 辅助函数
    getResourceLayout,
    clearLayoutCache,
    clearResourceCache,
    invalidateLayout,
    // 性能监控
    layoutsCallCount,
    positionsCallCount,
  }
}

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import type { Task } from '../../models/classes/Task'
import { useI18n } from '../../composables/useI18n'

interface Props {
  task: Task
  currentResourceId: string | number
  resourceColor: string
  resourceCapacity: number
  resourceName: string
  taskBarWidth?: number
  taskBarLeft?: number
  scrollLeft?: number
  containerWidth?: number
  // 冲突相关 - v1.9.2 传递冲突任务列表以显示详细信息
  hasConflict?: boolean
  conflictTasks?: Task[]  // 与当前任务存在资源超载的任务列表
  // 资源列表（用于获取avatar等信息）
  resources?: Array<{ id: string | number; name: string; avatar?: string; color?: string }>
}

const props = withDefaults(defineProps<Props>(), {
  taskBarWidth: undefined,
  taskBarLeft: undefined,
  scrollLeft: 0,
  containerWidth: 0,
  hasConflict: false,
  conflictTasks: () => [],
})

// Emits
const emit = defineEmits<{
  'hover-change': [isHovered: boolean]
}>()

const { t } = useI18n()

// 状态管理
const isExpanded = ref(false)
const tabElement = ref<HTMLElement | null>(null)
let hideTimer: number | null = null // 延迟隐藏定时器

// v1.9.4 P1优化 - 防抖定时器
let debounceTimer: number | null = null
const DEBOUNCE_DELAY = 50 // 50ms 防抖延迟

// 百分比文字
const percentText = computed(() => `${Math.round(props.resourceCapacity)}%`)

// Tab 宽度：基于 taskBarWidth，严格不超过taskbar宽度
// 参考截图，对于窄taskbar需要严格保证tab不超出
const tabWidth = computed(() => {
  if (!props.taskBarWidth) return 30
  const maxWidth = 50
  // Tab 严格不超过 taskbar 宽度，减去少量边距(最多2px)确保不溢出
  // 对于很窄的taskbar，不强制最小宽度，完全跟随taskbar宽度
  const margin = Math.min(2, props.taskBarWidth * 0.1) // 边距最多2px或taskbar宽度的10%
  return Math.min(props.taskBarWidth - margin, maxWidth)
})

// Tab左侧位置：磁铁停靠效果
// 当TaskBar左侧超出可视区域时，Tab停靠在左边界
const tabLeftOffset = computed(() => {
  if (props.taskBarLeft === undefined || props.scrollLeft === undefined) {
    return 0
  }

  const taskBarLeft = props.taskBarLeft
  const viewportLeft = props.scrollLeft

  // TaskBar完全在可视区域右侧，不显示Tab
  if (taskBarLeft > viewportLeft + (props.containerWidth || 0)) {
    return 0
  }

  // TaskBar左侧超出可视区域，Tab停靠在左边界
  if (taskBarLeft < viewportLeft) {
    const stickyOffset = viewportLeft - taskBarLeft
    // Tab不能超过TaskBar右侧边界
    const maxOffset = Math.max(0, (props.taskBarWidth || 0) - tabWidth.value)
    return Math.min(stickyOffset, maxOffset)
  }

  // TaskBar在可视区域内，Tab在默认位置（左侧）
  return 0
})

// Tab样式（使用资源颜色）
const tabStyle = computed(() => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    backgroundColor: `${props.resourceColor} !important` as any,
    width: `${tabWidth.value}px`,
    left: `${tabLeftOffset.value}px`,
  }
})

// 当前资源对象
const currentResource = computed(() => {
  if (!props.resources || !props.currentResourceId) return null
  return props.resources.find(r => String(r.id) === String(props.currentResourceId))
})

// 资源名称（优先使用resource对象的name）
const resourceDisplayName = computed(() => {
  return currentResource.value?.name || props.resourceName || ''
})

// 资源头像URL或首字母
const resourceAvatar = computed(() => {
  return currentResource.value?.avatar || null
})

// 资源名称首字母（用于没有头像时显示）
const resourceNameInitial = computed(() => {
  const name = resourceDisplayName.value
  return name.charAt(0).toUpperCase() || 'R'
})

// 资源头像样式
const avatarStyle = computed(() => {
  return {
    backgroundColor: props.resourceColor,
    color: getContrastColor(props.resourceColor),
  }
})

// 展开区域样式（智能定位：根据位置向上或向下展开）
const expandedStyle = computed(() => {
  if (!tabElement.value) {
    return {}
  }

  const rect = tabElement.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight

  // 估算弹窗高度（根据是否有冲突信息动态计算）
  const baseHeight = 120 // 基础信息高度
  const conflictHeight = conflictInfoList.value.length * 80 // 每个冲突项约80px
  const estimatedPanelHeight = baseHeight + conflictHeight

  // 判断是否有足够空间向上展开
  const spaceAbove = rect.top
  const spaceBelow = viewportHeight - rect.bottom
  const shouldExpandUpward = spaceAbove >= estimatedPanelHeight || spaceAbove > spaceBelow

  if (shouldExpandUpward) {
    // 向上展开（默认行为）
    return {
      position: 'fixed' as const,
      bottom: `${viewportHeight - rect.top + 2}px`,
      left: `${rect.left}px`,
      maxHeight: `${Math.min(spaceAbove - 10, 400)}px`, // 限制最大高度，留10px边距
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      backgroundColor: props.resourceColor as any,
    }
  } else {
    // 向下展开（当顶部空间不足时）
    return {
      position: 'fixed' as const,
      top: `${rect.bottom + 2}px`,
      left: `${rect.left}px`,
      maxHeight: `${Math.min(spaceBelow - 10, 400)}px`, // 限制最大高度，留10px边距
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      backgroundColor: props.resourceColor as any,
    }
  }
})

// 格式化日期范围
const formattedDateRange = computed(() => {
  if (!props.task.startDate || !props.task.endDate) return '-'

  const start = new Date(props.task.startDate)
  const end = new Date(props.task.endDate)

  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}/${month}/${day}`
  }

  return `${formatDate(start)} ~ ${formatDate(end)}`
})

// 冲突信息列表（显示多个冲突任务的详细信息）
const conflictInfoList = computed(() => {
  if (!props.hasConflict || !props.conflictTasks || props.conflictTasks.length === 0) {
    return []
  }

  const currentTask = props.task
  if (!currentTask.startDate || !currentTask.endDate) return []

  const currentStart = new Date(currentTask.startDate).getTime()
  const currentEnd = new Date(currentTask.endDate).getTime()

  // v1.9.8 修改：只显示冲突任务自己的利用率
  return props.conflictTasks.map(conflictTask => {
    if (!conflictTask.startDate || !conflictTask.endDate) return null

    const conflictStart = new Date(conflictTask.startDate).getTime()
    const conflictEnd = new Date(conflictTask.endDate).getTime()

    // 计算冲突任务的资源占比
    // v1.9.10 注释：如果冲突任务没有 resources 字段，默认使用 100%
    // 这是因为在资源视图中，任务隶属于该资源但未明确指定占比时，视为全职投入
    let conflictPercent = 100
    if (conflictTask.resources && Array.isArray(conflictTask.resources)) {
      const allocation = conflictTask.resources.find(
        (r: any) => String(r.id) === String(props.currentResourceId),
      )
      if (allocation && allocation.capacity !== undefined) {
        conflictPercent = Math.max(20, Math.min(100, allocation.capacity))
      }
    }
    // else: 保持默认 100%（资源视图中任务隶属于当前资源）

    // 计算当前任务与该冲突任务的重叠时间段
    const overlapStart = Math.max(currentStart, conflictStart)
    const overlapEnd = Math.min(currentEnd, conflictEnd)

    const formatDate = (timestamp: number) => {
      const date = new Date(timestamp)
      return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
    }

    return {
      taskName: conflictTask.name,
      overlapStart: formatDate(overlapStart),
      overlapEnd: formatDate(overlapEnd),
      conflictPercent, // 该冲突任务自己的利用率
    }
  }).filter(Boolean)
})

// v1.9.8 新增：计算总超载量（所有任务的总和 - 100%）
const totalOverloadPercent = computed(() => {
  if (!props.hasConflict || !props.conflictTasks || props.conflictTasks.length === 0) {
    return 0
  }

  const currentTask = props.task
  if (!currentTask.startDate || !currentTask.endDate) return 0
  const currentPercent = props.resourceCapacity || 100

  // v1.9.9 修复：endDate 包含当天，需要 +1 天来判断交集
  const DAY_MS = 24 * 60 * 60 * 1000

  // 计算所有冲突任务在重叠时间段内的最大总占比
  let maxTotalPercent = currentPercent

  // 收集所有涉及的任务（当前任务 + 所有冲突任务）
  const allTasks = [currentTask, ...props.conflictTasks]

  // 找出所有任务的时间交集区域，计算最大总占比
  allTasks.forEach((task1, i) => {
    if (!task1.startDate || !task1.endDate) return
    const start1 = new Date(task1.startDate).getTime()
    const end1 = new Date(task1.endDate).getTime()
    const end1Plus = end1 + DAY_MS // endDate 包含当天，需要 +1 天

    allTasks.forEach((task2, j) => {
      if (i >= j || !task2.startDate || !task2.endDate) return
      const start2 = new Date(task2.startDate).getTime()
      const end2 = new Date(task2.endDate).getTime()
      const end2Plus = end2 + DAY_MS // endDate 包含当天，需要 +1 天

      // 检查是否有时间重叠（使用 +1 天后的 endDate）
      // 例如：任务A endDate=12-24, 任务B startDate=12-24，应判断为重叠
      if (start1 < end2Plus && start2 < end1Plus) {
        // 计算该重叠区间的所有任务总占比
        const overlapStart = Math.max(start1, start2)
        const overlapEnd = Math.min(end1, end2)
        const overlapEndPlus = overlapEnd + DAY_MS

        let intervalTotal = 0
        allTasks.forEach(task => {
          if (!task.startDate || !task.endDate) return
          const tStart = new Date(task.startDate).getTime()
          const tEnd = new Date(task.endDate).getTime()
          const tEndPlus = tEnd + DAY_MS

          // 检查任务是否在该重叠区间内（使用 +1 天后的 endDate）
          if (tStart < overlapEndPlus && tEndPlus > overlapStart) {
            // v1.9.10 注释：如果任务没有 resources 字段，默认使用 100%
            // 这确保了资源视图中未明确指定占比的任务被正确计入冲突检测
            let taskPercent = 100
            if (task.resources && Array.isArray(task.resources)) {
              const allocation = task.resources.find(
                (r: any) => String(r.id) === String(props.currentResourceId),
              )
              if (allocation && allocation.capacity !== undefined) {
                taskPercent = allocation.capacity
              }
            }
            // else: 保持默认 100%（资源视图中任务隶属于当前资源）
            intervalTotal += taskPercent
          }
        })

        maxTotalPercent = Math.max(maxTotalPercent, intervalTotal)
      }
    })
  })

  return Math.max(0, maxTotalPercent - 100)
})

// v1.9.4 P1优化 - 带防抖的鼠标进入处理
const handleMouseEnter = () => {
  // 清除之前的隐藏定时器
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }

  // 清除防抖定时器
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
  }

  // 防抖：延迟展开，避免快速滑过时频繁触发
  debounceTimer = window.setTimeout(() => {
    isExpanded.value = true
    emit('hover-change', true) // 通知父组件：禁止taskbar的tooltip，启用边框动画
    debounceTimer = null
  }, DEBOUNCE_DELAY)
}

// 鼠标离开
const handleMouseLeave = () => {
  // 清除防抖定时器
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  // 延迟隐藏，给用户时间移动到面板上
  hideTimer = window.setTimeout(() => {
    isExpanded.value = false
    emit('hover-change', false) // 通知父组件：恢复正常
    hideTimer = null
  }, 100) // 100ms 延迟
}

// 面板鼠标进入（保持展开状态）
const handlePanelMouseEnter = () => {
  // 清除隐藏定时器
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  isExpanded.value = true
}

// 面板鼠标离开（延迟隐藏）
const handlePanelMouseLeave = () => {
  // 延迟隐藏
  hideTimer = window.setTimeout(() => {
    isExpanded.value = false
    emit('hover-change', false)
    hideTimer = null
  }, 100)
}

// 工具函数：获取对比色（黑或白）
const getContrastColor = (bgColor: string): string => {
  const hex = bgColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // 计算亮度
  const brightness = (r * 299 + g * 587 + b * 114) / 1000

  return brightness > 128 ? '#333' : '#fff'
}

// v1.9.4 P1优化 - 组件卸载时清理所有定时器和资源
onUnmounted(() => {
  // 清理隐藏定时器
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }

  // 清理防抖定时器
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  // 清理所有状态，避免内存泄漏
  isExpanded.value = false

  // 通知父组件
  emit('hover-change', false)
})
</script>

<template>
  <div
    ref="tabElement"
    class="task-bar-tab"
    :style="tabStyle"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @click.stop
  >
    <!-- 悬停展开面板（使用 Teleport 避免滚动问题） -->
    <Teleport to="body">
      <div
        v-if="isExpanded"
        class="tab-expanded"
        :style="expandedStyle"
        @mouseenter="handlePanelMouseEnter"
        @mouseleave="handlePanelMouseLeave"
      >
        <div class="expanded-content">
          <!-- 标题：资源名称 + 头像 -->
          <div class="expanded-title">
            <div v-if="resourceAvatar" class="resource-avatar" :style="avatarStyle">
              <img :src="resourceAvatar" alt="avatar" class="avatar-img" />
            </div>
            <div v-else class="resource-avatar" :style="avatarStyle">
              {{ resourceNameInitial }}
            </div>
            <span class="resource-name">{{ resourceDisplayName }}</span>
          </div>

          <!-- 内容区域 -->
          <div class="expanded-body">
            <!-- 利用率 -->
            <div class="expanded-row">
              <span class="info-label">{{ t.resourceView.capacity }}</span>
              <span class="info-value">{{ percentText }}</span>
            </div>
            <!-- 日期范围 -->
            <div class="expanded-row">
              <span class="info-label">{{ t.resourceView.duration }}</span>
              <span class="info-value">{{ formattedDateRange }}</span>
            </div>
            <!-- 冲突预警（有冲突时才显示） -->
            <div v-if="hasConflict && conflictInfoList.length > 0" class="conflict-section">
              <!-- 固定标题 -->
              <div class="conflict-header">
                <svg class="warning-icon" viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
                <span class="conflict-title">{{ t.resourceView.overloadWarning }}</span>
                <span class="total-overload">▲ {{ totalOverloadPercent }}%</span>
              </div>
              <!-- 可滚动的冲突列表 -->
              <div class="conflict-list-container">
                <div v-for="(info, index) in conflictInfoList" :key="index" class="conflict-item">
                  <div class="conflict-task-name">{{ t.resourceView.conflictWith }}《{{ info ? info.taskName : '' }}》{{ t.resourceView.conflictSuffix }}</div>
                  <div class="conflict-detail">
                    <span class="conflict-label">{{ t.resourceView.conflictDuration }}：</span>
                    <span class="conflict-value">{{ info ? info.overlapStart : '' }} ~ {{ info ? info.overlapEnd : '' }}</span>
                  </div>
                  <div class="conflict-detail">
                    <span class="conflict-label">{{ t.resourceView.capacity }}: </span>
                    <span class="conflict-value">{{ info ? info.conflictPercent : '' }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Tab 基础样式 - 梯形标签，上窄下宽，位于 TaskBar 左上角外部 */
.task-bar-tab {
  position: absolute;
  top: -6px; /* 在 TaskBar 上边缘外部，略微向上以消除缝隙 */
  left: 0;
  height: 7px; /* 增加高度以实现梯形效果 */
  /* width 由 style 动态设置 */
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 11; /* 高于 TaskBar */
  user-select: none;
  pointer-events: auto;
  /* 使用 clip-path 创建梯形：上窄下宽 */
  clip-path: polygon(
    10% 0%,     /* 左上角，向内收窄 */
    90% 0%,     /* 右上角，向内收窄 */
    100% 100%,  /* 右下角 */
    0% 100%     /* 左下角 */
  );
  /* 下方圆角通过与taskbar融合实现 */
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
}

/* 悬停展开面板 - 智能定位，自动向上或向下展开 */
.tab-expanded {
  min-width: 150px;
  max-width: 250px;
  background-color: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  z-index: 10000;
  pointer-events: auto;
  animation: expandFromTabUpRight 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: bottom left;
  overflow: visible; /* 不滚动整个弹出层 */
  max-height: 400px; /* 限制最大高度 */
  display: flex;
  flex-direction: column;
}

/* 向右+向上展开动画 */
@keyframes expandFromTabUpRight {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.expanded-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 标题区域 */
.expanded-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 13px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
}

/* 内容区域 */
.expanded-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 冲突警告区域 - v1.9.2 详细冲突信息 */
.conflict-section {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  flex-direction: column;
}

/* 可滚动的冲突列表容器 - v1.9.8 */
.conflict-list-container {
  max-height: 200px; /* 限制冲突列表最大高度 */
  overflow-y: auto; /* 垂直滚动 */
  overflow-x: hidden;
  /* 细滚动条样式 */
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent; /* Firefox */
}

/* Webkit浏览器（Chrome、Safari、Edge）的细滚动条样式 */
.conflict-list-container::-webkit-scrollbar {
  width: 4px; /* 细滚动条 */
}

.conflict-list-container::-webkit-scrollbar-track {
  background: transparent; /* 透明轨道 */
}

.conflict-list-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3); /* 半透明滑块 */
  border-radius: 2px;
}

.conflict-list-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5); /* 悬停时更明显 */
}

.conflict-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #FFC107;
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 8px;
}

.conflict-title {
  font-size: 12px;
  flex: 1;
}

.total-overload {
  font-size: 12px;
  font-weight: 700;
  color: #ff5252;
  margin-left: auto;
  background: #FFC107;
  padding: 2px 4px;
  border-radius: 4px;
}

.conflict-item {
  background: rgba(255, 193, 7, 0.1);
  border-left: 3px solid #FFC107;
  padding: 8px;
  margin-bottom: 8px;
  border-radius: 4px;
}

.conflict-item:last-child {
  margin-bottom: 0;
}

.conflict-task-name {
  font-weight: 600;
  font-size: 11px;
  color: #FFC107;
  margin-bottom: 4px;
}

.conflict-detail {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  margin-bottom: 2px;
  line-height: 1.4;
}

.conflict-label {
  opacity: 0.9;
  flex-shrink: 0;
}

.conflict-value {
  font-weight: 500;
  text-align: right;
  word-break: break-word;
}

.overload-highlight {
  color: #ff5252;
  font-weight: 600;
  margin-top: 2px;
}

.overload-highlight .conflict-value {
  font-weight: 700;
}

.warning-icon {
  flex-shrink: 0;
  color: #FFC107;
}

/* 资源头像 */
.resource-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.3);
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 资源名称 */
.resource-name {
  font-size: 13px;
  font-weight: 600;
  flex: 1;
}

/* 信息行 */
.expanded-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 11px;
}

/* 信息标签和值 */
.info-label {
  opacity: 0.9;
  white-space: nowrap;
}

.info-value {
  font-weight: 500;
  text-align: right;
}

/* 冲突警告行 */
.conflict-warning {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  color: #FFC107;
  font-size: 11px;
  gap: 6px;
  align-items: flex-start;
}

.warning-icon {
  flex-shrink: 0;
  color: #FFC107;
  margin-top: 1px;
}

.conflict-text {
  flex: 1;
  word-break: break-word;
  white-space: normal;
  line-height: 1.4;
}
</style>

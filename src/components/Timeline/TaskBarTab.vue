<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import type { Task } from '../../models/classes/Task'

interface Props {
  task: Task
  currentResourceId: string | number
  resourceColor: string
  resourcePercent: number
  resourceName: string
  taskBarWidth?: number
  // 冲突相关 - v1.9.2 传递冲突任务列表以显示详细信息
  hasConflict?: boolean
  conflictTasks?: Task[]  // 与当前任务存在资源超载的任务列表
  // 资源列表（用于获取avatar等信息）
  resources?: Array<{ id: string | number; name: string; avatar?: string; color?: string }>
}

const props = withDefaults(defineProps<Props>(), {
  taskBarWidth: undefined,
  hasConflict: false,
  conflictTasks: () => [],
})

// Emits
const emit = defineEmits<{
  'hover-change': [isHovered: boolean]
}>()

// 状态管理
const isExpanded = ref(false)
const tabElement = ref<HTMLElement | null>(null)
let hideTimer: number | null = null // 延迟隐藏定时器

// 百分比文字
const percentText = computed(() => `${Math.round(props.resourcePercent)}%`)

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

// Tab样式（使用资源颜色）
const tabStyle = computed(() => {
  console.log('🏷️ TaskBarTab - 收到的颜色 props:', {
    resourceColor: props.resourceColor,
    taskId: props.task.id,
    taskName: props.task.name,
    resourceName: props.resourceName
  })
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    backgroundColor: `${props.resourceColor} !important` as any,
    width: `${tabWidth.value}px`,
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
      position: 'fixed',
      bottom: `${viewportHeight - rect.top + 2}px`,
      left: `${rect.left}px`,
      maxHeight: `${Math.min(spaceAbove - 10, 400)}px`, // 限制最大高度，留10px边距
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      backgroundColor: props.resourceColor as any,
    }
  } else {
    // 向下展开（当顶部空间不足时）
    return {
      position: 'fixed',
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
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${month}-${day}`
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

  // 计算当前任务的资源占比
  const currentPercent = props.resourcePercent || 100

  return props.conflictTasks.map(conflictTask => {
    if (!conflictTask.startDate || !conflictTask.endDate) return null

    const conflictStart = new Date(conflictTask.startDate).getTime()
    const conflictEnd = new Date(conflictTask.endDate).getTime()

    // 计算冲突任务的资源占比
    let conflictPercent = 100
    if (conflictTask.resources && Array.isArray(conflictTask.resources)) {
      const allocation = conflictTask.resources.find(
        (r: any) => String(r.id) === String(props.currentResourceId)
      )
      if (allocation && allocation.percent !== undefined) {
        conflictPercent = Math.max(20, Math.min(100, allocation.percent))
      }
    }

    // 计算重叠时间段
    const overlapStart = Math.max(currentStart, conflictStart)
    const overlapEnd = Math.min(currentEnd, conflictEnd)

    // 计算超载百分比
    const totalPercent = currentPercent + conflictPercent
    const overloadPercent = totalPercent - 100

    const formatDate = (timestamp: number) => {
      const date = new Date(timestamp)
      return `${date.getMonth() + 1}/${date.getDate()}`
    }

    return {
      taskName: conflictTask.name,
      overlapStart: formatDate(overlapStart),
      overlapEnd: formatDate(overlapEnd),
      currentPercent,
      conflictPercent,
      totalPercent,
      overloadPercent,
    }
  }).filter(Boolean)
})

// 鼠标进入
const handleMouseEnter = () => {
  // 清除之前的隐藏定时器
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  isExpanded.value = true
  emit('hover-change', true) // 通知父组件：禁止taskbar的tooltip，启用边框动画
}

// 鼠标离开
const handleMouseLeave = () => {
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

onUnmounted(() => {
  // 清理定时器
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
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
            <!-- 投入占比 -->
            <div class="expanded-row">
              <span class="info-label">投入占比</span>
              <span class="info-value">{{ percentText }}</span>
            </div>
            <!-- 日期范围 -->
            <div class="expanded-row">
              <span class="info-label">时间范围</span>
              <span class="info-value">{{ formattedDateRange }}</span>
            </div>
            <!-- 冲突预警（有冲突时才显示） -->
            <div v-if="hasConflict && conflictInfoList.length > 0" class="conflict-section">
              <div class="conflict-header">
                <svg class="warning-icon" viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
                <span class="conflict-title">资源超载警告</span>
              </div>
              <div v-for="(info, index) in conflictInfoList" :key="index" class="conflict-item">
                <div class="conflict-task-name">与《{{ info.taskName }}》冲突</div>
                <div class="conflict-detail">
                  <span class="conflict-label">冲突时段：</span>
                  <span class="conflict-value">{{ info.overlapStart }} ~ {{ info.overlapEnd }}</span>
                </div>
                <div class="conflict-detail">
                  <span class="conflict-label">资源占用：</span>
                  <span class="conflict-value">{{ info.currentPercent }}% + {{ info.conflictPercent }}% = {{ info.totalPercent }}%</span>
                </div>
                <div class="conflict-detail overload-highlight">
                  <span class="conflict-label">超载：</span>
                  <span class="conflict-value">+{{ info.overloadPercent }}%</span>
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
  overflow-y: auto; /* 支持滚动，防止内容过多 */
  overflow-x: hidden;
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

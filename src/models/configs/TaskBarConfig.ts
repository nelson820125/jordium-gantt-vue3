// TaskBar 配置类型定义

export interface TaskBarConfig {
  showAvatar?: boolean // 是否展示头像，默认 true
  showTitle?: boolean // 是否展示标题文字，默认 true
  showProgress?: boolean // 是否展示进度文字，默认 true
  dragThreshold?: number // 拖拽触发阈值（像素），默认 5px
  resizeHandleWidth?: number // 拉伸手柄宽度（像素），默认 5px，最大 15px
  enableDragDelay?: boolean // 是否启用拖拽延迟（防止误触），默认 false
  dragDelayTime?: number // 拖拽延迟时间（毫秒），默认 150ms
}

// 默认配置
export const DEFAULT_TASK_BAR_CONFIG: TaskBarConfig = {
  showAvatar: true,
  showTitle: true,
  showProgress: true,
  dragThreshold: 5,
  resizeHandleWidth: 5,
  enableDragDelay: false,
  dragDelayTime: 150,
}

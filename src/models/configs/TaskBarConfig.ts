// TaskBar 配置类型定义

export interface TaskBarConfig {
  showAvatar?: boolean // 是否展示头像，默认 true
  showTitle?: boolean // 是否展示标题文字，默认 true
  showProgress?: boolean // 是否展示进度文字，默认 true
  dragThreshold?: number // 拖拽触发阈值（像素），默认 5px
  resizeHandleWidth?: number // 拉伸手柄宽度（像素），默认 5px，最大 15px
  enableDragDelay?: boolean // 是否启用拖拽延迟（防止误触），默认 false
  dragDelayTime?: number // 拖拽延迟时间（毫秒），默认 150ms
  /**
   * 任务标题渲染位置（默认 'inside'）v1.12.0
   * 'inside' → 标题渲染在任务条内部（白色文字，默认行为）
   * 'above'  → 标题渲染在任务条上方，条内仅显示进度百分比
   *            适用于任务条较窄（1–3天）或任务名称较长的场景
   */
  titlePosition?: 'inside' | 'above'
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
  titlePosition: 'inside',
}

// ==================== R1: 连线样式配置 ====================

/** 连线路径类型 */
export type LinkType = 'bezier' | 'straight' | 'orthogonal'

/** 连线样式配置 */
export interface LinkConfig {
  /** 连线路径类型，默认 'bezier' */
  type?: LinkType
  /** 普通连线颜色，默认 '#c0c4cc' */
  color?: string
  /** 高亮连线颜色，默认 '#409eff' */
  highlightColor?: string
  /** 悬停连线颜色，默认 '#67c23a' */
  hoverColor?: string
  /** 普通连线线宽，默认 2 */
  width?: number
  /** 高亮连线线宽，默认 4 */
  highlightWidth?: number
  /** 连线样式，'dotted' 虚线 | 'solid' 实线，默认 'dotted' */
  style?: 'dotted' | 'solid'
}

export const DEFAULT_LINK_CONFIG: Required<LinkConfig> = {
  type: 'bezier',
  color: '#c0c4cc',
  highlightColor: '#409eff',
  hoverColor: '#67c23a',
  width: 2,
  highlightWidth: 4,
  style: 'dotted',
}

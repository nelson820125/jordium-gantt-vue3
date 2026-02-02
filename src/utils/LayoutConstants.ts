/**
 * 布局常量定义
 * v1.9.4 P1优化 - 统一管理魔法数字，便于维护和主题定制
 *
 * @module LayoutConstants
 */

/**
 * 时间轴布局常量
 */
export const TIMELINE_LAYOUT = {
  /** 日视图：每天的宽度（px） */
  DAY_WIDTH: 30,

  /** 周视图：每周的宽度（px） */
  WEEK_WIDTH: 60,

  /** 月视图：每月的宽度（px） */
  MONTH_WIDTH: 60,

  /** 季度视图：每季度的宽度（px） */
  QUARTER_WIDTH: 60,

  /** 年视图：每半年的宽度（px） */
  HALF_YEAR_WIDTH: 180,
} as const

/**
 * 任务列表布局常量
 */
export const TASK_LIST_LAYOUT = {
  /** 任务行默认高度（px） */
  ROW_HEIGHT: 30,

  /** 任务行最小高度（px） */
  ROW_MIN_HEIGHT: 24,

  /** 任务行最大高度（px） */
  ROW_MAX_HEIGHT: 60,

  /** 任务缩进基础值（px） */
  INDENT_BASE: 10,

  /** 每级缩进增加（px） */
  INDENT_STEP: 20,

  /** 任务名称列最小宽度（px） */
  NAME_COLUMN_MIN_WIDTH: 150,

  /** 任务名称列默认宽度（px） */
  NAME_COLUMN_DEFAULT_WIDTH: 300,
} as const

/**
 * TaskBar 布局常量
 */
export const TASK_BAR_LAYOUT = {
  /** TaskBar 高度（px） */
  HEIGHT: 24,

  /** TaskBar 最小宽度（px） */
  MIN_WIDTH: 4,

  /** TaskBar 圆角（px） */
  BORDER_RADIUS: 4,

  /** TaskBar 边框宽度（px） */
  BORDER_WIDTH: 1,

  /** TaskBar 悬停边框宽度（px） */
  HOVER_BORDER_WIDTH: 2,

  /** 里程碑菱形大小（px） */
  MILESTONE_SIZE: 20,

  /** TaskBar 垂直偏移（px，对齐行中心） */
  VERTICAL_OFFSET: 3,
} as const

/**
 * 资源Tab布局常量
 */
export const RESOURCE_TAB_LAYOUT = {
  /** Tab 默认宽度（px） */
  DEFAULT_WIDTH: 30,

  /** Tab 最大宽度（px） */
  MAX_WIDTH: 50,

  /** Tab 高度（px） */
  HEIGHT: 20,

  /** Tab 边距（px） */
  MARGIN: 2,

  /** 展开面板最大高度（px） */
  PANEL_MAX_HEIGHT: 400,

  /** 展开面板边距（px） */
  PANEL_MARGIN: 10,
} as const

/**
 * 冲突可视化布局常量
 */
export const CONFLICT_LAYOUT = {
  /** 冲突边框宽度（px） */
  BORDER_WIDTH: 2,

  /** 警告图标大小（px） */
  WARNING_ICON_SIZE: 16,

  /** 警告图标内边距（px） */
  WARNING_ICON_PADDING: 4,

  /** 纹理pattern尺寸（px） */
  PATTERN_SIZE: 10,

  /** 冲突等级阈值 */
  THRESHOLDS: {
    /** 轻度冲突（>100%） */
    LIGHT: 100,

    /** 中度冲突（>120%） */
    MEDIUM: 120,

    /** 严重冲突（>150%） */
    SEVERE: 150,
  },
} as const

/**
 * 动画时长常量（ms）
 */
export const ANIMATION_DURATION = {
  /** 快速动画（悬停、tooltip） */
  FAST: 100,

  /** 标准动画（折叠展开、过渡） */
  NORMAL: 200,

  /** 慢速动画（拖拽、缩放） */
  SLOW: 300,

  /** TaskBarTab 防抖延迟 */
  DEBOUNCE_DELAY: 50,

  /** 隐藏延迟 */
  HIDE_DELAY: 100,
} as const

/**
 * Z-Index 层级常量
 */
export const Z_INDEX = {
  /** Timeline 基础层 */
  TIMELINE_BASE: 1,

  /** TaskBar 正常层 */
  TASK_BAR: 100,

  /** TaskBar 拖拽中 */
  TASK_BAR_DRAGGING: 200,

  /** 冲突可视化层（需要在TaskBar之上） */
  CONFLICTS: 250,

  /** 资源Tab展开面板 */
  RESOURCE_TAB_PANEL: 300,

  /** 右键菜单 */
  CONTEXT_MENU: 500,

  /** 对话框 */
  DIALOG: 1000,

  /** Tooltip */
  TOOLTIP: 2000,
} as const

/**
 * 颜色常量
 */
export const COLORS = {
  /** 冲突颜色 */
  CONFLICTS: {
    LIGHT: 'rgba(255,220,0,0.15)', // 浅黄
    MEDIUM: 'rgba(255,165,0,0.15)', // 橙色
    SEVERE: 'rgba(255,69,0,0.2)',   // 红色
    BORDER: '#f56c6c',              // 边框红色
    WARNING: '#faad14',             // 警告黄色
  },

  /** 任务状态颜色 */
  TASK_STATUS: {
    NORMAL: '#409eff',
    WARNING: '#e6a23c',
    DANGER: '#f56c6c',
    SUCCESS: '#67c23a',
  },
} as const

/**
 * 性能优化常量
 */
export const PERFORMANCE = {
  /** 区间树算法切换阈值（任务数） */
  INTERVAL_TREE_THRESHOLD: 100,

  /** Canvas增量重绘阈值（变化率） */
  INCREMENTAL_REPAINT_THRESHOLD: 0.5,

  /** 性能监控日志阈值（ms） */
  PERF_LOG_THRESHOLD: 50,

  /** 虚拟滚动缓冲区行数 */
  VIRTUAL_SCROLL_BUFFER: 5,
} as const

// 导出所有常量的联合类型
export type LayoutConstants =
  | typeof TIMELINE_LAYOUT
  | typeof TASK_LIST_LAYOUT
  | typeof TASK_BAR_LAYOUT
  | typeof RESOURCE_TAB_LAYOUT
  | typeof CONFLICT_LAYOUT
  | typeof ANIMATION_DURATION
  | typeof Z_INDEX
  | typeof COLORS
  | typeof PERFORMANCE

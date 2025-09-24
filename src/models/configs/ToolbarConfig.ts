import type { TimelineScale } from '../types/TimelineScale'

// ToolbarConfig 类型定义
export interface ToolbarConfig {
  showAddTask?: boolean
  showAddMilestone?: boolean
  showTodayLocate?: boolean
  showExportCsv?: boolean
  showExportPdf?: boolean
  showLanguage?: boolean
  showTheme?: boolean
  showFullscreen?: boolean
  showTimeScale?: boolean // 显示时间刻度按钮组
  timeScaleDimensions?: TimelineScale[] // 设置时间刻度按钮的展示维度
  defaultTimeScale?: TimelineScale // 默认选中的时间刻度
}

# API_USAGE

## 组件导出
```js
import { GanttChart, TaskList, TaskRow, MilestonePoint, GanttToolbar, GanttConfirmDialog } from 'jordium-gantt-vue3'
```

## 主要 Props 说明
- `tasks`: 任务数据数组
- `milestones`: 里程碑数据数组
- `onDelete`: 删除回调，已统一弹窗交互
- `theme`: 主题切换（如 'light'/'dark'）
- 其它详见各组件 props 类型定义

## 事件
- `@delete`：删除任务/里程碑
- `@update`：任务/里程碑更新
- `@confirm`/`@cancel`：弹窗交互

## 样式与主题
- 全局按钮、弹窗、表格等样式统一于 `src/styles/app.css`
- 主题变量见 `src/styles/theme-variables.css`

## 扩展
- 支持自定义工具栏、弹窗内容、国际化
- 详细用法见 README.md

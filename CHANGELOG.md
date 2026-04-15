# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.11.3] - 2026-04-15

### Fixed
- 🔧 修复：清除代码中中文hardcode
- 🔧 Fixed: Removed hardcoded Chinese text in the code

## [1.11.2] - 2026-04-10

### Fixed
- 🔧 修复：TaskContextMenu内置ClassName，导致特定条件下无法自动关闭
- 🔧 修复：expand-all属性设置不生效问题
- 🔧 修复：弱点修复-vite & lodash
- 🔧 修复：内置ConfirmDialog确认和取消问题，影响语言和主题切换
- 🔧 修复：内置MilestoneDialog和TaskDrawer组件升级到Body层级
- 🔧 修复：内置ContextMenu跟随主题切换，自定义ContextMenu亦可通过Theme传递完成主题切换
- 🔧 Fixed: Built-in ClassName in TaskContextMenu caused it to not auto-close under certain conditions
- 🔧 Fixed: expand-all prop not taking effect
- 🔧 Fixed: Vulnerability fixes for vite & lodash
- 🔧 Fixed: Issues with built-in ConfirmDialog's confirm and cancel actions affecting language and theme switching
- 🔧 Fixed: Upgraded built-in MilestoneDialog and TaskDrawer components to the Body level
- 🔧 Fixed: Built-in ContextMenu now follows theme switching, and custom ContextMenu can also switch themes through Theme

## [1.11.1] - 2026-04-09

### Fixed
- 🔧 修复：修复周视图中每月1日标记线污染问题
- 🔧 修复：参考element plus组件库设计，升级该组件z-index定义
- 🔧 Fixed: Fixed contamination issue with monthly marker line on the 1st in weekly view
- 🔧 Fixed: Updated z-index definition of the component based on Element Plus design

## [1.11.0] - 2026-04-08

### Added
- 🎉 新增：GanttChart 新增 `scaleConfigs` 属性，支持按时间刻度自定义单元格宽度（`cellWidth`）、标题格式化字符串（`formatter`）及时间线缓冲区（`preBuffer` / `sufBuffer`），仅需传入需要覆盖的刻度，其余保持内置默认值不变
- 🎉 新增：`cellWidth` 内置最小/最大值约束，传入超出范围的值将自动截断至边界（各刻度约束详见 README）
- 🎉 Added: GanttChart new prop `scaleConfigs` — customize `cellWidth`, `formatter`, `preBuffer`, `sufBuffer` per time scale; unspecified scales continue using built-in defaults
- 🎉 Added: Built-in `cellWidth` min/max clamping per scale; out-of-range values are automatically clamped (see README for per-scale limits)

### Fixed
- 🔧 修复：Taskbar，Milestone，GanttConflicts，GanttLinks在timeScale-cellWidth变化时坐标问题
- 🔧 修复：减小SplitterBar的`z-index`属性，防止应用层被覆盖
- 🔧 修复：导出 PDF 时中文标题乱码问题，改为 html2canvas 截图渲染，彻底避免字体缺失
- 🔧 Fixed: Coordinate issues for Taskbar, Milestone, GanttConflicts, and GanttLinks when timeScale or cellWidth changes
- 🔧 Fixed: Reduced SplitterBar z-index to prevent covering application layer
- 🔧 Fixed: Garbled Chinese title when exporting PDF; switched to html2canvas screenshot rendering to fully avoid missing font issues

## [1.10.5] - 2026-04-01

### Enhancement
- 🔧 修复：修复资源视图的小时维度下，同一天内Taskbar冲突计算错误
- 🔧 Fixed: Fixed Taskbar conflict calculation error in hourly view of resource view

## [1.10.4] - 2026-03-31

### Enhancement
- 🔧 修复：删除里程碑tooltip中的'11111111111'信息
- 🔧 修复：修复小时视图下，Taskbar拖拽精度计算问题
- 🔧 修复：三方包弱点升级
- 🔧 Fixed: Removed '11111111111' information from milestone tooltip
- 🔧 Fixed: Fixed Taskbar drag precision calculation issue in hourly view
- 🔧 Fixed: Upgraded vulnerabilities in third-party packages

## [1.10.3] - 2026-03-24

### Enhancement
- 🔧 优化：Taskbar右键触发后，禁止Tooltip的展示
- 🔧 优化：移除里程碑以及Taskbar停靠磁贴的闪缩动画，提升资源效率
- 🔧 优化：优化内部接口
- 🔧 修复：三方包弱点升级，jspdf & flatted
- 🔧 Optimized: After right-clicking on Taskbar, the display of Tooltip is disabled
- 🔧 Optimized: Removed flicker animation for Milestone and Taskbar docking tiles, improving resource efficiency
- 🔧 Optimized: Optimized internal interfaces
- 🔧 Fixed: Upgraded vulnerabilities in third-party packages, jspdf & flatted

## [1.10.2] - 2026-03-16

### Added
- 🎉 新增：里程碑支持悬停 Tooltip，正常显示和磁吸停靠状态均可触发，内置气泡样式与 TaskBar Tooltip 保持一致
- 🎉 新增：GanttChart 新增 `enableMilestoneTooltip` 属性（默认 `true`），设为 `false` 可关闭里程碑 Tooltip
- 🎉 新增：GanttChart 支持 `#milestone-tooltip` 自定义 Scoped Slot，可完全替换里程碑内置 Tooltip内容，提供 `milestone` 对象作为作用域参数
- 🎉 新增：Tooltip 三角箭头内置默认内容、箭头颜色自动跟随里程碑颜色（`milestoneColor`）变化
- 🎉 Added: Milestone supports hover Tooltip in both normal visible and sticky states, with built-in tooltip style consistent with TaskBar Tooltip
- 🎉 Added: GanttChart new prop `enableMilestoneTooltip` (default `true`); set to `false` to disable milestone Tooltip
- 🎉 Added: GanttChart supports `#milestone-tooltip` custom Scoped Slot to fully replace built-in milestone Tooltip content, exposing `milestone` as scope parameter
- 🎉 Added: Tooltip arrow color automatically follows milestone color (`milestoneColor`)

### Fixed
- 🔧 清理：移除 GanttChart 中已废弃的 `provide('gantt-has-milestone-tooltip-slot', ...)` 死代码
- 🔧 Cleaned: Removed dead code `provide('gantt-has-milestone-tooltip-slot', ...)` from GanttChart

## [1.10.1] - 2026-03-013

### Enhancement
- 🔧 优化：优化算法，提升GanttLinks以及GanttConflicts的绘制性能
- 🔧 Optimized: Algorithm optimizations for improved GanttLinks and GanttConflicts rendering performance

## [1.10.0] - 2026-03-07

### Fixed
- 🔧 优化：优化算法，提升插件性能，更好兼容移动设备的访问
- 🔧 优化：来自Github一位用户的共同探讨，带来此次性能的飞跃，同时他也提供了另外一种应用层的优化方案，请参考: [discussion #16](https://github.com/nelson820125/jordium-gantt-vue3/discussions/16)
- 🔧 Optimized: Algorithm optimizations for improved plugin performance and better compatibility with mobile device access
- 🔧 Optimized: Collaborative discussions with a Github user led to this performance leap, and they also provided another application-level optimization方案, please refer to: [discussion #16](https://github.com/nelson820125/jordium-gantt-vue3/discussions/16)

## [1.9.4] - 2026-03-06

### Fixed
- 🔧 修复：日期视图下，SplitterBar拖拽以及TaskList收起/展开后，计算导致2月份周期丢失问题
- 🔧 修复：任务视图切换至资源视图后今日定位偏移问题
- 🔧 修复：任务视图切换至资源视图后最大和最小日期范围计算问题
- 🔧 修复：资源视图下，小时/日/周视图切换后，最大值和最小值范围问题
- 🔧 Fixed: In date view, after dragging the SplitterBar and collapsing/expanding the TaskList, the calculation caused the February cycle to be lost
- 🔧 Fixed: After switching from task view to resource view, the today marker offset issue
- 🔧 Fixed: After switching from task view to resource view, the max and min date range calculation issue
- 🔧 Fixed: In resource view, after switching between hourly/daily/weekly views, the max and min date range issue

## [1.9.3] - 2026-03-05

### Added
- 🎉 新增：GanttChart 新增 enableTaskDrawerAutoClose 属性，设置为 false 时禁用 TaskDrawer 的自动关闭行为
- 🎉 Added: GanttChart new prop enableTaskDrawerAutoClose — set to false to disable the automatic closing behavior of the TaskDrawer

### Fixed
- 🔧 修复：周视图下拖拽 TaskBar 左右移动后任务宽度（持续时间）自动缩短的问题
- 🔧 Fixed: TaskBar width (duration) shrinking after dragging left and right in weekly view

## [1.9.2] - 2026-02-26

### Added
- 🎉 新增：Singleton Tooltip 架构重构，TaskBar 不再独立维护 Teleport DOM，改由 Timeline 统一管理单一 Tooltip 节点，大幅降低大数据量下的 DOM 开销
- 🎉 新增：GanttChart 支持 `#taskbar-tooltip` 自定义 Scoped Slot，可完全替换内置 Tooltip 内容，获得 `task`、`taskStatus`、`resourcePercent` 三个作用域参数
- 🎉 新增：GanttChart 新增 Props `enableTaskListCollapsible`（默认 `true`），设为 `false` 时强制隐藏 TaskList 并让 Timeline 独占全宽
- 🎉 新增：GanttChart 新增 Props `taskListVisible`（默认 `true`），支持响应式外部控制 TaskList 显隐
- 🎉 新增：GanttChart Expose API 新增 `getTaskListVisible()`、`setTaskListVisible(visible)`、`toggleTaskList()` 三个方法，支持命令式控制 TaskList
- 🎉 新增：ToolbarConfig 新增 `showViewMode` 字段，用于控制视图切换按钮组的可见性
- 🎉 新增：Demo 新增 `data-100.json` 中等规模数据集（100 条任务），默认数据源切换至此
- 🎉 Added: Singleton Tooltip architecture refactored — TaskBar no longer maintains independent Teleport DOM, Timeline now manages a single shared Tooltip node, significantly reducing DOM overhead for large datasets
- 🎉 Added: GanttChart supports `#taskbar-tooltip` custom Scoped Slot to fully replace built-in Tooltip content, exposing `task`, `taskStatus`, `resourcePercent` scope parameters
- 🎉 Added: GanttChart new prop `enableTaskListCollapsible` (default `true`); set to `false` to force-hide TaskList and let Timeline occupy full width
- 🎉 Added: GanttChart new prop `taskListVisible` (default `true`) for reactive external control of TaskList visibility
- 🎉 Added: GanttChart Expose API adds `getTaskListVisible()`, `setTaskListVisible(visible)`, `toggleTaskList()` for imperative TaskList control
- 🎉 Added: ToolbarConfig adds `showViewMode` field to control visibility of the view-mode toggle button group
- 🎉 Added: Demo adds `data-100.json` medium-scale dataset (100 tasks) as the new default data source

### Fixed
- 🔧 修复：异步加载数据时首次滚动以空任务列表计算范围，真实数据到来后今日定位失效
- 🔧 修复：从资源视图切换回任务视图后，`updateTimelineRange` 重算偏移导致今日标记偏离视口
- 🔧 修复：GanttToolbar 中视图切换按钮组缺少 `v-if` 守卫，导致 `showViewMode: false` 设置不生效
- 🔧 Fixed: When data is loaded asynchronously, initial scroll used empty task list; today marker lost after real data arrived
- 🔧 Fixed: After switching from resource view back to task view, `updateTimelineRange` recalculation caused today marker to move out of viewport
- 🔧 Fixed: View-mode toggle button group in GanttToolbar was missing `v-if` guard, causing `showViewMode: false` to have no effect

## [1.9.1] - 2026-02-07

### Fixed
- 🔧 修复: GanttChart管理ThemeChange的问题
- 🔧 Fixed: Issue with ThemeChange management in GanttChart

## [1.9.0] - 2026-02-07

### Added
- 🎉 新增：GanttChart支持资源视图模式，通过viewMode属性切换任务视图和资源视图
- 🎉 新增：资源视图以资源为行维度展示，支持一行多任务条布局
- 🎉 新增：Task对象增加resources字段，支持配置每个资源的投入占比（10%-100%）
- 🎉 新增：TaskBar高度按资源占比动态缩放，支持占比文字标注和Tooltip显示
- 🎉 新增：基于占比累计的资源超负荷检测和视觉预警
- 🎉 新增：TaskDrawer增加资源占比配置控件，支持输入校验
- 🎉 新增：资源视图支持任务拖拽、拉伸、计时等交互操作
- 🎉 新增：资源列表支持声明式组件配置列
- 🎉 新增：Resource数据模型类和useResourceLayout、useViewMode等composables
- 🎉 Added: GanttChart supports resource view mode, switch via viewMode property
- 🎉 Added: Resource view displays by resource dimension with multiple task bars per row
- 🎉 Added: Task object adds resources field for configuring resource allocation percentage (10%-100%)
- 🎉 Added: TaskBar height scales by percentage with text label and Tooltip support
- 🎉 Added: Resource overload detection and visual alerts based on percentage accumulation
- 🎉 Added: TaskDrawer adds resource percentage configuration with input validation
- 🎉 Added: Resource view supports task drag, resize, timing and other interactions
- 🎉 Added: Resource list supports declarative component column configuration
- 🎉 Added: Resource model class and composables including useResourceLayout, useViewMode

### Enhancement
- 🎉 优化：抽取资源布局计算逻辑到独立composable，避免组件职责膨胀
- 🎉 优化：扩展v-memo优化覆盖范围，提升渲染性能
- 🎉 优化：重构provide/inject依赖传递，简化组件依赖关系
- 🎉 优化：恢复滚动防抖机制，平衡响应性和性能
- 🎉 优化：历史数据向后兼容，未配置占比时默认为100%
- 🎉 Optimized: Extracted resource layout logic to independent composable
- 🎉 Optimized: Extended v-memo optimization coverage for better performance
- 🎉 Optimized: Refactored provide/inject dependency passing
- 🎉 Optimized: Restored scroll debounce mechanism
- 🎉 Optimized: Backward compatible with historical data, defaults to 100%

### Fixed
- 🔧 修复: 将Theme设置从HTML root变更到Gantt Component root
- 🔧 Fixed: Changed Theme setting from HTML root to Gantt Component root

## [1.8.1] - 2026-02-05

### Enhancement
- 🎉 优化：重构组件，Theme作用域从全局调整至局部.gantt-root
- 🎉 优化：重构组件，Theme自动跟随系统设置
- 🎉 优化：重构组件，完美支持Nuxt3、TailwindCSS等框架
- 🎉 Optimized: Refactored components, Theme scope adjusted from global to local .gantt-root
- 🎉 Optimized: Refactored components, Theme automatically follows system settings
- 🎉 Optimized: Refactored components, Perfectly supports Nuxt3, TailwindCSS and other frameworks

## [1.8.0] - 2026-01-17

### Added
- 🎉 新增：GanttChart允许展示实际Taskbar
- 🎉 新增：TaskDrawer增加实际开始日期和实际结束日期的属性
- 🎉 新增：TaskDrawer增加当前Task状态：待处理、进行中、已完成、已逾期
- 🎉 新增：GanttChart增加Taskbar不同状态下背景色预设属性pendingTaskBackgroundColor、delayTaskBackgroundColo- pleteTaskBackgroundColor、ongoingTaskBackgroundColor
- 🎉 新增：Task对象增加barColor属性，允许自定义对应Taskbar的背景色，优先级高于GanttChart预设背景色
- 🎉 新增：Taskbar增加气泡提示框
- 🎉 新增：GanttChart增加showActualTaskbar属性用于控制是否展示实际Taskbar，默认值为false，需要时手动打开
- 🎉 新增：GanttChart增加enableTaskbarTooltip属性用于控制是否展示Taskbar的气泡提示框，默认值为true，需要时手动关闭
- 🎉 Added: GanttChart allows displaying actual Taskbar
- 🎉 Added: TaskDrawer adds properties for actual start date and actual end date
- 🎉 Added: TaskDrawer adds current Task status: Pending, Ongoing, Completed, Overdue
- 🎉 Added: GanttChart adds preset background color properties for Taskbar in different statuses: pendingTaskBackgroundColor, delayTaskBackgroundColor, completeTaskBackgroundColor, ongoingTaskBackgroundColor
- 🎉 Added: Task object adds barColor property to allow customization of the corresponding Taskbar background color, with higher priority than GanttChart preset background colors
- 🎉 Added: Taskbar adds tooltip
- 🎉 Added: GanttChart adds showActualTaskbar property to control whether to show actual Taskbar
- 🎉 Added: GanttChart adds enableTaskbarTooltip property to control whether to show Taskbar tooltip

### Enhancement
- 🎉 优化：Task对象assignee以及avatar属性允许接收数组，标记多为负责人
- Optimized: The assignee and avatar properties of the Task object now accept arrays to mark multiple assignees

## [1.7.2] - 2026-01-15

### Added
- 🎉 新增：GanttChart新增属性，enableLinkAnchor用于控制Taskbar的关系线锚点
- 🎉 Added: New property in GanttChart - enableLinkAnchor to control the relationship line anchor points of Taskbar

## [1.7.1] - 2026-01-11

### Added
- 🎉 新增：GanttChart新增属性，locale, theme, timeScale, fullscreen, expandAll供外部调用
- 🎉 新增：GanttChart暴露国际化相关方法，setLocale & currentLocale
- 🎉 新增：GanttChart暴露主题相关方法，setTheme & currentTheme，setTimeScale & currentScale
- 🎉 新增：GanttChart暴露全屏相关方法，toggleFullscreen & enterFullscreen & exitFullscreen & isFullscreen
- 🎉 新增：GanttChart暴露展开/收起相关方法，toggleExpandAll & expandAll & collapseAll & isExpandAll
- 🎉 新增：GanttChart暴露滑至今日/任务/指定日期相关方法，scrollToToday & scrollToTask & scrollToDate
- 🎉 Added: New properties in GanttChart - locale, theme, timeScale, fullscreen, expandAll for external calls
- 🎉 Added: Exposed internationalization related methods in GanttChart - setLocale & currentLocale
- 🎉 Added: Exposed theme related methods in GanttChart - setTheme & currentTheme, setTimeScale & currentScale
- 🎉 Added: Exposed fullscreen related methods in GanttChart - toggleFullscreen & enterFullscreen & exitFullscreen & isFullscreen
- 🎉 Added: Exposed expand/collapse related methods in GanttChart - toggleExpandAll & expandAll & collapseAll & isExpandAll
- 🎉 Added: Exposed methods in GanttChart to scroll to today/task/specified date - scrollToToday & scrollToTask & scrollToDate

## [1.7.0] - 2026-01-10

### Added
- TaskList和TaskBar声明式定义ContextMenu方式, 使用组件TaskListContextMenu和TaskBarContextMenu
- TaskListContextMenu和TaskBarContextMenu的default Slots
- TaskListContextMenu和TaskBarContextMenu是否展示属性 - enable-task-list-context-menu和enable-task-bar-context-menu
- Declarative definition ContextMenu method for TaskList and TaskBar using the TaskListContextMenu and TaskBarContextMenu components
- default Slots for TaskListContextMenu and TaskBarContextMenu
- Properties to control the display of TaskListContextMenu and TaskBarContextMenu - enable-task-list-context-menu and enable-task-bar-context-menu

### Enhancement
- 拆分TaskList子组件代码，更易读、易维护
- Split TaskList sub-component code for better readability and maintainability

### Fixed
- 🔧 依赖包happy-dom，jspdf，vitest漏洞升级
- 🔧 Upgraded vulnerabilities in dependent packages happy-dom, jspdf, vitest

## [1.6.2] - 2025-12-23

### Fixed
- 🔧 修复：I18n外部使用的问题
- 🔧 Fixed: Issue with using I18n externally

## [1.6.1] - 2025-12-15

### Fixed
- 🔧 修复：声明式Task List数据展示问题
- 🔧 Fixed: Declarative Task List data display issue

## [1.6.0] - 2025-12-14

### Added
- 🎉 新增：Task Table列声明式定义方式, 使用组件TaskListColumn
- 🎉 新增：Task Table #header和#default Slots
- 🎉 新增：Task List行样式设置属性 - task-list-row-class-name和task-list-row-style
- 🎉 新增：为兼容旧版本TaskListColumnConfig，提供task-list-column-render-mode属性开关，可以通过设置选择Task表格列定义方式
- 🎉 Added: Declarative definition method for Task Table columns using the TaskListColumn component
- 🎉 Added: Task Table #header and #default Slots
- 🎉 Added: Task List row style setting properties - task-list-row-class-name and task-list-row-style
- 🎉 Added: A switch for task-list-column-render-mode attribute to choose Task Table column definition method for compatibility with older versions of TaskListColumnConfig

### Fixed
- 🔧 修复：仅删除Story层级后，子Task升级后关系线丢失问题
- 🔧 修复：Task拖方后数据的Bug
- 🔧 修复：修复已知问题
- 🔧 Fixed: Issue of missing relationship lines after upgrading child Tasks when only deleting Story
- 🔧 Fixed: Bug in Task data after dragging and dropping
- 🔧 Fixed: Fixed issues

## [1.5.0] - 2025-12-13

### Added
- TaskBar增加可视化关系线添加，删除功能
- 支持适配uniapp开发
- TaskListConfig支持Task图标显示/隐藏配置
- TaskBar adds visual relationship line addition and deletion functions
- Support for uniapp development
- TaskListConfig supports Task icon show/hide configuration

### Fixed
- Task双击时，禁止Task拖放事件的触发
- Disabled Task drag-and-drop event trigger on double-click

## [1.4.6-patch.1] - 2025-12-09

### Fixed
- 修复：Github编译错误
- Fixed: build errors From github

## [1.4.6] - 2025-12-09

### Fixed
- 修复：内置TaskDrawer中负责人列表可以外部初始化
- 修复：未设置startDate和endDate时，任务无法正确显示的问题
- Fixed: The assignee list in the built-in TaskDrawer can be initialized externally
- Fixed: The issue where tasks could not be displayed correctly when startDate and endDate were not set

## [1.4.5] - 2025-12-06

### Changed
- 优化：任务列表中任务项的移动拖放功能
- Optimized：Task item move and drag-and-drop functionality in the task list

## [1.4.4] - 2025-12-06

### Added
- 任务列表中任务项的移动拖放功能
- Task item move and drag-and-drop functionality in the task list

## [1.4.3] - 2025-11-28

### Added
- 大数据加载演示
- Large data loading demonstration

### Enhancement
- 性能优化：TaskList和Timeline增加虚拟滚动支持，大幅降低节点数和重绘开销
- 性能优化：大数据量任务渲染性能优化
- 性能优化：虚拟渲染优化
- Performance Optimization: TaskList and Timeline add virtualized scrolling support, greatly reducing node count and redraw overhead
- Performance Optimization: Large data volume task rendering performance optimization
- Performance Optimization: Virtualized rendering optimization

### Fixed
- jspdf弱点升级
- jspdf vulnerabilies

## [1.4.2-patch3] - 2025-11-13

### Added
- 支持视图上下/左右拖拽
- Support for vertical/horizontal dragging of the view

### Enhancement
- 性能优化：canvas绘制性能优化
- 性能优化：拖拽视图性能优化，拖拽期间禁止重绘canvas
- 性能优化：周视图月开始分隔线实现使用canvas替代dom
- 性能优化：使用canvas替代svg links实现
- 性能优化：路径缓存+防抖+shallowRef计算
- Performance Optimization: Canvas drawing performance optimization
- Performance Optimization: View dragging performance optimization, disabling canvas redraw during dragging
- Performance Optimization: Weekly view month start separator line implemented using canvas instead of DOM
- Performance Optimization: Using canvas instead of SVG links implementation
- Performance Optimization: Path caching + debounce + shallowRef calculation

## [1.4.2-patch1] - 2025-11-03

### Fixed
- 缺陷修复：更新父级任务后，再次更新子级任务是发生无限循环调用的问题修复
- Defect fix: Fixed the issue of infinite loop calls when updating child tasks after updating the parent task

## [1.4.2-patch2] - 2025-11-11

### Fixed
- 缺陷修复：TaskList配置列宽无效的问题修复
- Defect fix: Fixed the issue of invalid column width configuration in TaskList

## [1.4.2-patch1] - 2025-11-03

### Fixed
- 缺陷修复：更新父级任务后，再次更新子级任务是发生无限循环调用的问题修复
- Defect fix: Fixed the issue of infinite loop calls when updating child tasks after updating the parent task

## [1.4.2] - 2025-11-01

### Added
- TaskBar增加头像显示
- TaskBar展示信息显示可配置
- TaskBar长按聚焦高亮
- Timeline Range自动优化计算, 提升显示效果
- TaskListConfig支持像素和百分比设置方式
- 支持拖拽和拉伸TaskBar/Milestone接近边界自动扩充时间轴范围
- 支持通过属性配置限制TaskBar/Milestone拖拽和拉伸
- 暴露更多外部可以使用属性和事件
- 增加NPM包应用示例
- Added avatar display on TaskBar
- Configurable display information on TaskBar
- Long-press to focus and highlight TaskBar
- Automatically optimized Timeline Range calculation for better visual performance
- TaskListConfig now supports both pixel and percentage-based sizing
- Support dragging and stretching TaskBar/Milestone to automatically expand timeline range near boundaries
- Support property-based configuration to limit dragging and stretching of TaskBar/Milestone
- Expose more external properties and events
- Added NPM package application examples

### Changed
- 客制化多语言扩展支持
- 说明文档更新，可读性更强
- 增强Timeline时间轴的拖拽体验,增加防抖保护
- Custom multi-language extension support
- Documentation updated for better readability
- Enhance dragging experience on Timeline, adding debounce protection

### Fixed
- SonarQube代码质量检查问题修改
- 缺陷修复
- Modification of SonarQube code quality inspection issues
- Bugfix

## [1.4.1] - 2025-10-26

### Fixed
- TaskList客制化列展示问题修复
- TaskList客制化列数据动态绑定问题修复
- SonarQube代码质量检查问题修改
- MTaskList Custom Column Display Issue Fix
- TaskList Custom Column Data Dynamic Binding Issue Fix
- SonarQube code quality inspection issue modification

## [1.4.0] - 2025-10-11

### Added
- Timeline Scale客制化
- TaskList可配置
- TaskRow/TaskBar内容支持HTML插槽
- TaskRow/TaskBar支持自定义样式
- 增加全部展开/收起按钮
- 按照时间排序TaskList
- 增加周视图的1号旗帜元素
- Timeline Scale Customization
- TaskList Configurable
- TaskRow/TaskBar content supports HTML slots
- TaskRow/TaskBar supports custom styles
- Add Expand/Collapse All Button
- Sort TaskList by time
- Add 1st flag element for weekly view

### Fixed
- SonarQube代码质量检查问题修改
- 缺陷修复
- Modification of SonarQube code quality inspection issues
- Bugfix

## [1.3.0] - 2025-09-12

### Added
- 增加年度视图
- 增加季度视图
- 增加小时视图
- Add annual timeline view
- Add a quarterly timeline view
- Add hourly timeline view

### Changed
- 升级TaskDrawer中DatePicker组件，接受小时的设定
- 升级TaskDrawer中预计时间和实际时间的控件，接受小数后两位的录入
- Upgrade the DatePicker component in TaskDrawer to accept the setting of hours
- Upgrade the control for estimated and actual time in TaskDrawer to accept entries with two decimal places

### Fixed
- SonarQube代码质量检查问题修改
- Modification of SonarQube code quality inspection issues

## [1.2.1] - 2025-07-22

### Fixed
- SonarQube代码质量检查问题修改

## [1.2.0] - 2025-07-21

### Added
- 增加TaskRow/TaskBar的右键菜单
- 增加Task的执行定时
- 增加添加前置任务功能
- 增加添加后置任务功能
- 增加TaskRow/TaskBar的删除功能
- GanttChart增加@predecessor-added(添加前置任务完成)事件
- GanttChart增加@successor-added(添加后置任务完成)事件
- GanttChart增加@task-deleted(删除任务完成)事件
- GanttChart增加@task-added(添加任务完成)事件
- GanttChart增加@task-updated(编辑任务完成)事件

### Changed
- 升级TaskDrawer统一在GanttChart中管理

## [1.1.0] - 2025-07-08

### Added
- TaskBar拖拽触发Timeline水平滑动
- 增加日|周|月视图切换

### Fixed
- 问题修复

## [1.0.10] - 2025-07-06

### Added
- 支持多前置任务功能
- 增加边框粘性toolBar，表示隐藏的TaskBar和MilestoneBar
- 点击边框粘性toolBar，快速定位滑动到对应的TaskBar和MilestoneBar

### Changed
- 支持多前置任务功能
- Timeline中sub-task隐藏后，关系线也随之隐藏

## [1.0.9] - 2025-07-04

### Changed
- 更新多语言标签

### Added
- 增加Story删除时选择是否删除子任务的选项
- 删除Story或Task时同时删除前后的关系线路

## [1.0.6] - 2025-07-03

### Changed
- 更新TaskDrawer组件的Progressbar样式
- 可通过拖拽进度条和文本修改的方式更改任务的进度
- Story进度根据子任务集进度改编重新计算
- 同时保留Story进度单独的调整方式

## [1.0.5] - 2025-07-02

### Changed
- 更新README中所有NPM徽章CDN地址

## [1.0.4] - 2025-07-02

### Changed
- 更新NPM徽章CDN

## [1.0.3] - 2025-07-02

### Added
- 增加Github Pages

### Changed
- 修改README, 添加GIthub在线Demo入口

### Removed
- 移除大体积静态资源

## [1.0.2] - 2025-07-01

### Changed / Added
- 更新README文档
- 增加贡献说明
- 增加贡献者列表

## [1.0.1] - 2025-07-01

### Added
- 增加npm安装及组件集成示例

## [1.0.0] - 2025-06-29

### Added
- GanttChart 接口增强，提供更丰富的 API 支持
- 添加 GanttChart 的拖拽事件回调功能
- 添加 GanttChart 的里程碑拖拽事件回调功能
- 重构项目目录结构，提升代码组织性

### Fixed
- 修复里程碑点的样式问题

### Changed
- 更新 README 文档，完善使用说明

### Documentation
- 完善 API 文档和使用示例

## [0.9.8] - 2025-06-28

### Changed
- 按钮样式统一管理，提升 UI 一致性

## [0.9.7] - 2025-06-28

### Fixed
- 解决 Milestone 组件和类型的同名问题

## [0.9.6] - 2025-06-27

### Changed
- 各个组件分离 Task/Milestone/Language 对象，提升模块化程度

## [0.9.5] - 2025-06-27

### Added
- 统一管理各个组件的全球化配置

## [0.9.4] - 2025-06-27

### Changed
- 调整暗黑主题的亮度和布局

### Fixed
- 修复暗黑主题下的版本历史的样式

## [0.9.3] - 2025-06-27

### Fixed
- 修复今日定位问题

## [0.9.2] - 2025-06-27

### Added
- 增加历史版本查看功能

## [0.9.1] - 2025-06-27

### Improved
- 优化时间轴的延伸功能

## [0.9.0] - 2025-06-26

### Added
- 添加新增里程碑功能
- 添加删除里程碑功能

## [0.8.5] - 2025-06-26

### Fixed
- 升级 Timeline 今日定位和滑动问题

## [0.8.4] - 2025-06-25

### Added
- 添加 Github 和 Gitee 的文档入口

### Changed
- 升级需求/任务 TaskBar 新建以及上下级关系变更

## [0.8.3] - 2025-06-25

### Added
- 升级里程碑 Taskbar，允许拖拽功能

## [0.8.2] - 2025-06-25

### Changed
- 升级 Demo 演示
- 移除导出按钮的初始化光晕效果

## [0.8.1] - 2025-06-25

### Improved
- 升级优化 DatePicker 组件

---

## 版本说明

- **Major Version (1.x.x)**: 包含破坏性变更的重大版本更新
- **Minor Version (x.1.x)**: 向后兼容的功能性新增
- **Patch Version (x.x.1)**: 向后兼容的问题修复

## 图例

- 🎉 **Added**: 新增功能
- 🔄 **Changed**: 功能变更  
- 🐛 **Fixed**: 问题修复
- 🗑️ **Removed**: 功能移除
- 📚 **Documentation**: 文档更新
- ⚡ **Improved**: 性能优化

## 反馈与支持

- 📬 [提交 Github Issue](https://github.com/nelson820125/jordium-gantt-vue3/issues)
- 📬 [提交 Gitee Issue](https://gitee.com/jordium/jordium-gantt-vue3/issues)
- 📧 邮箱：ning.li@jordium.com / nelson820125@gmail.com / lining820125@163.com

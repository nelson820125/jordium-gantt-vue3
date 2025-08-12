# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

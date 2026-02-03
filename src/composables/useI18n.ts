import { ref, computed } from 'vue'

// 支持的语言类型
export type Locale = 'zh-CN' | 'en-US'

// 多语言配置
const messages = {
  'zh-CN': {
    dateNotSet: '未设置',
    // TaskList Header
    taskName: '任务名称',
    resourceName: '资源名称',
    predecessor: '前置任务',
    assignee: '分配人',
    startDate: '开始日期',
    endDate: '结束日期',
    plannedStartDate: '预计开始日期',
    plannedEndDate: '预计结束日期',
    actualStartDate: '实际开始日期',
    actualEndDate: '实际结束日期',
    estimatedHours: '预计工时(hr)',
    actualHours: '实际工时(hr)',
    progress: '进度',
    type: '类型',
    description: '描述',
    // CSV Export Headers（去除重复，仅保留引用）
    csvHeaders: {
      id: 'ID',
      taskName: '任务名称',
      predecessor: '前置任务',
      assignee: '分配人',
      startDate: '开始日期',
      endDate: '结束日期',
      plannedStartDate: '预计开始日期',
      plannedEndDate: '预计结束日期',
      actualStartDate: '实际开始日期',
      actualEndDate: '实际结束日期',
      estimatedHours: '预计工时(hr)',
      actualHours: '实际工时(hr)',
      progress: '进度(%)',
      type: '类型',
      description: '描述',
    },

    // 日期格式
    yearMonthFormat: (year: number, month: number) =>
      `${year}年${String(month).padStart(2, '0')}月`,
    // 月份格式
    monthFormat: (month: number) => `${month}月`,

    // 月份名称
    monthNames: [
      '一月',
      '二月',
      '三月',
      '四月',
      '五月',
      '六月',
      '七月',
      '八月',
      '九月',
      '十月',
      '十一月',
      '十二月',
    ],
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],

    // 其他
    milestone: '里程碑',
    targetDate: '目标日期',
    today: '今天',
    // 里程碑对话框
    milestoneDetails: '里程碑详情',
    milestoneName: '里程碑名称',
    milestoneDate: '里程碑日期',
    milestoneIcon: '里程碑图标',
    diamond: '菱形',
    rocket: '火箭',
    enterMilestoneName: '请输入里程碑名称',
    enterAssignee: '请输入负责人',
    enterDescription: '请输入描述信息',
    milestoneNameRequired: '里程碑名称为必填项',
    milestoneDateRequired: '里程碑日期为必填项',
    save: '保存',
    close: '关闭',
    confirm: '确认',
    delete: '删除',
    confirmDelete: '确定要删除这个里程碑吗？',
    // 工具栏按钮
    addTask: '新增需求/任务',
    addMilestone: '新增里程碑',
    todayLocate: '今日',
    todayLocateTooltip: '定位到今天',
    exportCsv: '导出 CSV',
    exportPdf: '导出 PDF',
    expandAll: '全部展开',
    collapseAll: '全部折叠',
    // v1.9.0 视图模式
    taskView: '任务视图',
    language: '中文',
    languageTooltip: '选择语言',
    lightMode: '明亮模式',
    darkMode: '暗黑模式',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    githubDocs: '查看Github文档',
    giteeDocs: '查看Gitee文档',
    // 时间刻度按钮
    timeScaleHour: '时',
    timeScaleDay: '日',
    timeScaleWeek: '周',
    timeScaleMonth: '月',
    timeScaleQuarter: '季',
    timeScaleYear: '年',
    timeScaleTooltip: '切换时间刻度',
    halfYearFirst: '上半年',
    halfYearSecond: '下半年',
    // 确认对话框
    confirmDialogMessage: '是否需要保留该设置?',
    // 新建任务对话框
    newTask: '新建任务',
    taskNamePlaceholder: '请输入任务名称',
    assigneePlaceholder: '请输入负责人',
    progressPlaceholder: '0-100',
    hoursPlaceholder: '工时',
    descriptionPlaceholder: '请输入任务描述...',
    hours: '小时',
    create: '创建',
    taskNameRequired: '任务名称不能为空',
    startDateRequired: '开始日期不能为空',
    endDateRequired: '结束日期不能为空',
    endDateInvalid: '结束日期不能早于开始日期',
    plannedStartDateRequired: '预计开始日期不能为空',
    plannedEndDateRequired: '预计结束日期不能为空',
    plannedEndDateInvalid: '预计结束日期不能早于预计开始日期',
    actualEndDateInvalid: '实际结束日期不能早于实际开始日期',
    // 任务状态
    statusPending: '待处理',
    statusOngoing: '进行中',
    statusDelayed: '已逾期',
    statusCompleted: '已完成',
    // 新建里程碑对话框
    newMilestone: '新建里程碑',
    editMilestone: '编辑里程碑',
    cancel: '取消',
    // 右键菜单
    startTimer: '开始计时',
    stopTimer: '停止计时',
    timerStarted: '任务计时已开始',
    timerStopped: '任务计时已停止',
    addPredecessor: '添加前置任务',
    addSuccessor: '添加后置任务',

    // PDF导出相关
    pdfExportLoading: '正在生成PDF，请稍候...',
    pdfExportTitle: '甘特图导出',
    pdfExportDate: '导出日期',

    milestoneGroup: '里程碑',
    collapseTaskList: '收起任务列表',
    expandTaskList: '展开任务列表',
    // TaskDrawer 相关
    taskType: '任务类型',
    taskTypeRequired: '请选择任务类型',
    taskTypeMap: {
      task: '任务',
      milestone: '里程碑',
      story: '需求',
      epic: '史诗',
      bug: '缺陷',
    },
    editTask: '编辑任务',
    parentTask: '上级任务',

    // 时间选择器相关
    time: '时间',
    selectTime: '选择时间',
    hour: '时',
    minute: '分',
    noParentTask: '无上级任务',
    update: '更新',
    taskNameTooLong: '任务名称不能超过50个字符',
    predecessorPlaceholder: '请选择前置任务',
    selectPredecessor: '选择前置任务',
    removePredecessor: '移除前置任务',
    deleteLinks: '删除链接',
    noLinks: '无链接',
    predecessorLink: '前置: {name}',
    successorLink: '后置: {name}',
    operationFailed: '操作失败，请重试',
    taskUpdateSuccess: '任务更新成功',
    taskCreateSuccess: '任务创建成功',
    confirmDeleteTask: '确定要删除任务"{name}"吗？此操作不可撤销。',
    taskDeleteFailed: '删除失败，请重试',
    // Story删除相关
    confirmDeleteStory: '是否删除该需求{name}及其所有的子任务？该操作不可撤回',
    storyDeleteYes: '是, 继续',
    storyDeleteNo: '不，仅删除需求',
    storyDeleteAllSuccess: '已删除需求【{name}】及其所有子任务',
    storyDeleteOnlySuccess: '已删除需求【{name}】，{count}个子任务已升级保留',
    storyNotFound: '未找到要删除的需求，ID：{id}',
    // 里程碑删除成功
    milestoneDeleteSuccess: '里程碑删除成功',
    // 其他删除成功消息
    taskDeletedSuccess: '已删除任务',
    // 选择器占位符
    selectAssignee: '请选择负责人',
    // v1.9.0 资源分配
    resourceAllocation: '资源分配',
    selectResource: '选择资源',
    addResource: '添加资源',
    percentMinError: '最小占比为20%',
    percentMaxWarning: '占比超过100%将标记为超负荷',
    // 通用消息
    customCsvExportCalled: '自定义CSV导出被调用',
    languageSwitchedTo: '语言切换到：{language}',
    themeSwitchedTo: '主题切换到：{theme}',
    lightModeText: '明亮模式',
    darkModeText: '暗黑模式',
    taskNotFound: '未找到要更新的任务，ID：{id}',
    newParentTaskNotFound: '未找到新父任务，ID：{parentId}，将作为顶级任务添加',
    inPlaceUpdateFailed: '就地更新失败，未找到任务，ID：{id}',
    taskToDeleteNotFound: '未找到要删除的任务，ID：{id}',
    milestoneIconUpdateNotFound: '未找到要更新图标的里程碑，ID：{id}',
    overtime: '超',
    overdue: '逾期',
    days: '天',
    // 计时确认弹窗
    timerConfirmPrefix: '即将为任务',
    timerConfirmSuffix: '计时，若有特殊说明请完善下面的描述',
    timerConfirmPlaceholder: '请输入计时说明',
    // Demo配置面板
    configDemo: '配置演示',
    // TaskList配置
    taskListConfig: {
      title: 'TaskList 配置',
      columns: {
        title: '列显示(默认渲染模式下生效)',
        renderMode: '渲染模式',
        renderModeDefault: '默认（通过 TaskListColumnConfig 设置）',
        renderModeDeclarative: '声明式（使用 TaskListColumn 设置可见列）',
      },
      width: {
        title: '宽度设置',
        defaultWidth: '默认宽度',
        minWidth: '最小宽度',
        maxWidth: '最大宽度',
        pixelsModel: '像素 (px)',
        percentageModel: '百分比 (%)',
      },
    },
    // TaskBar配置
    taskBarConfig: {
      title: 'TaskBar 配置',
      display: {
        title: '显示选项',
        showAvatar: '显示头像 (Avatar)',
        showTitle: '显示标题 (Title)',
        showProgress: '显示进度 (Progress)',
      },
      mistouch: {
        title: '防误触配置',
        dragThreshold: '拖拽阈值 (px)',
        dragThresholdHint: '移动超过此距离才触发拖拽',
        resizeHandleWidth: '拉伸手柄宽度 (px)',
        resizeHandleWidthHint: '调整手柄的可点击宽度 (5-15px)',
        enableDragDelay: '启用拖拽延迟',
        enableDragDelayHint: '按住一段时间后才能拖拽',
        dragDelayTime: '延迟时间 (ms)',
        dragDelayTimeHint: '延迟启动拖拽的时间',
        allowDragOnClick: '允许拖拽和拉伸 TaskBar 和 Milestone',
        allowDragOnClickHint: '控制是否允许拖拽 TaskBar 和 Milestone，以及拉伸 TaskBar 的长度',
      },
    },
    disableTaskbarFocusMode: '关闭聚焦功能',
    dataSourceAlreadyLoaded: '{name} 已是当前数据源',
    dataSourceLoadSuccess: '已加载 {name}',
    dataSourceLoadFailed: '{name} 加载失败',
    dataSourceSwitch: {
      title: '数据源切换',
      subtitle: '对比常规与超大数据集的初始化体验',
      loading: '数据加载中，请稍候...',
      alreadyLoaded: '{name} 已是当前数据源',
      loadSuccess: '已加载 {name}',
      loadFailed: '{name} 加载失败',
      sources: {
        normal: {
          label: '常规数据源',
          description: 'data.json · 含完整前/后置依赖，适合功能演示',
          badge: 'data.json',
        },
        large: {
          label: '超大数据源',
          description: 'data-large-1m.json · 百万级任务，验证虚拟渲染性能',
          badge: 'data-large-1m.json',
        },
      },
    },
    resourceView: {
      desc: '资源视图',
      capacity: '利用率',
      overloaded: '超负荷',
      duration: '时间周期',
      overloadWarning: '资源超负荷警告',
      conflictDuration: '冲突时段',
      conflictWith: '与',
      conflictSuffix: '冲突',
    },
  },
  'en-US': {
    dateNotSet: 'Not set',
    // TaskList Header
    taskName: 'Task Name',
    resourceName: 'Resource Name',
    predecessor: 'Predecessor',
    assignee: 'Assignee',
    startDate: 'Start Date',
    endDate: 'End Date',
    plannedStartDate: 'Planned Start Date',
    plannedEndDate: 'Planned End Date',
    actualStartDate: 'Actual Start Date',
    actualEndDate: 'Actual End Date',
    estimatedHours: 'Est. Hours',
    actualHours: 'Act. Hours',
    progress: 'Progress',
    type: 'Type',
    // CSV Export Headers（去除重复，仅保留引用）
    csvHeaders: {
      id: 'ID',
      taskName: 'Task Name',
      predecessor: 'Predecessor',
      assignee: 'Assignee',
      startDate: 'Start Date',
      endDate: 'End Date',
      plannedStartDate: 'Planned Start Date',
      plannedEndDate: 'Planned End Date',
      actualStartDate: 'Actual Start Date',
      actualEndDate: 'Actual End Date',
      estimatedHours: 'Est. Hours',
      actualHours: 'Act. Hours',
      progress: 'Progress (%)',
      type: 'Type',
      description: 'Description',
    },

    // 日期格式
    yearMonthFormat: (year: number, month: number) => `${year}/${String(month).padStart(2, '0')}`,
    // 月份格式
    monthFormat: (month: number) => `${String(month).padStart(2, '0')}`,

    // Month name
    monthNames: [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ],
    weekDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],

    // 其他
    milestone: 'Milestone',
    today: 'Today',
    targetDate: 'Target Date',
    // 里程碑对话框
    milestoneDetails: 'Milestone Details',
    milestoneName: 'Milestone Name',
    milestoneDate: 'Milestone Date',
    milestoneIcon: 'Milestone Icon',
    diamond: 'Diamond',
    rocket: 'Rocket',
    enterMilestoneName: 'Enter milestone name',
    enterAssignee: 'Enter assignee',
    enterDescription: 'Enter description',
    milestoneNameRequired: 'Milestone name is required',
    milestoneDateRequired: 'Milestone date is required',
    save: 'Save',
    close: 'Close',
    confirm: 'Confirm',
    description: 'Description',
    delete: 'Delete',
    confirmDelete: 'Are you sure you want to delete this milestone?',
    // 工具栏按钮
    addTask: 'Add Requirement/Task',
    addMilestone: 'Add Milestone',
    todayLocate: 'Today',
    todayLocateTooltip: 'Locate to today',
    exportCsv: 'Export CSV',
    exportPdf: 'Export PDF',
    expandAll: 'Expand All',
    collapseAll: 'Collapse All',
    // v1.9.0 视图模式
    taskView: 'Task View',
    language: 'English',
    languageTooltip: 'Select language',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    githubDocs: 'GitHub Docs',
    giteeDocs: 'Gitee Docs',
    // 时间刻度按钮
    timeScaleHour: 'Hour',
    timeScaleDay: 'Day',
    timeScaleWeek: 'Week',
    timeScaleMonth: 'Month',
    timeScaleQuarter: 'Quarter',
    timeScaleYear: 'Year',
    timeScaleTooltip: 'Switch Time Scale',
    halfYearFirst: 'First Half',
    halfYearSecond: 'Second Half',
    // Confirm dialog
    confirmDialogMessage: 'Do you want to save this setting?',
    taskNamePlaceholder: 'Enter task name',
    assigneePlaceholder: 'Enter assignee',
    progressPlaceholder: '0-100',
    hoursPlaceholder: 'Hours',
    descriptionPlaceholder: 'Enter task description...',
    hours: 'Hours',
    create: 'Create',
    taskNameRequired: 'Task name is required',
    startDateRequired: 'Start date is required',
    endDateRequired: 'End date is required',
    endDateInvalid: 'End date cannot be earlier than start date',
    plannedStartDateRequired: 'Planned start date is required',
    plannedEndDateRequired: 'Planned end date is required',
    plannedEndDateInvalid: 'Planned end date cannot be earlier than planned start date',
    actualEndDateInvalid: 'Actual end date cannot be earlier than actual start date',
    // Task status
    statusPending: 'Pending',
    statusOngoing: 'Ongoing',
    statusDelayed: 'Delayed',
    statusCompleted: 'Completed',
    // 新建里程碑对话框
    newMilestone: 'New Milestone',
    editMilestone: 'Edit Milestone',
    cancel: 'Cancel',
    // Context menu
    timerStarted: 'Timer Started',
    timerStopped: 'Timer Stopped',
    startTimer: 'Start Timer',
    stopTimer: 'Stop Timer',
    addPredecessor: 'Add Predecessor',
    addSuccessor: 'Add Successor',

    // PDF export
    pdfExportLoading: 'Generating PDF, please wait...',
    pdfExportTitle: 'Gantt Chart Export',
    pdfExportDate: 'Export Date',

    milestoneGroup: 'Milestone',
    collapseTaskList: 'Collapse Task List',
    expandTaskList: 'Expand Task List',
    // TaskDrawer related
    taskType: 'Task Type',
    taskTypeRequired: 'Please select task type',
    taskTypeMap: {
      task: 'Task',
      milestone: 'Milestone',
      story: 'Story',
      epic: 'Epic',
      bug: 'Bug',
    },
    editTask: 'Edit Task',
    newTask: 'New Task',
    parentTask: 'Parent Task',

    // 时间选择器相关
    time: 'Time',
    selectTime: 'Select Time',
    hour: 'Hour',
    minute: 'Minute',

    noParentTask: 'No Parent Task',
    update: 'Update',
    taskNameTooLong: 'Task name cannot exceed 50 characters',
    predecessorPlaceholder: 'Select predecessor',
    selectPredecessor: 'Select Predecessor',
    removePredecessor: 'Remove Predecessor',
    deleteLinks: 'Delete Links',
    noLinks: 'No Links',
    predecessorLink: 'Predecessor: {name}',
    successorLink: 'Successor: {name}',
    operationFailed: 'Operation failed, please try again',
    taskUpdateSuccess: 'Task updated successfully',
    taskCreateSuccess: 'Task created successfully',
    confirmDeleteTask:
      'Are you sure you want to delete task "{name}"? This action cannot be undone.',
    taskDeleteFailed: 'Delete failed, please try again',
    // Story deletion related
    confirmDeleteStory:
      'Do you want to delete the requirement {name} and all its subtasks? This action cannot be undone',
    storyDeleteYes: 'Yes, Continue',
    storyDeleteNo: 'No, Delete Requirement Only',
    storyDeleteAllSuccess: 'Deleted requirement [{name}] and all its subtasks',
    storyDeleteOnlySuccess: 'Deleted requirement [{name}], {count} subtasks have been promoted',
    storyNotFound: 'Requirement not found, ID: {id}',
    // Milestone deletion success
    milestoneDeleteSuccess: 'Milestone deleted successfully',
    // Other deletion success messages
    taskDeletedSuccess: 'Task deleted',
    // Selector placeholders
    selectAssignee: 'Select assignee',
    // v1.9.0 Resource allocation
    resourceAllocation: 'Resource Allocation',
    selectResource: 'Select resource',
    addResource: 'Add Resource',
    percentMinError: 'Minimum percentage is 20%',
    percentMaxWarning: 'Percentage over 100% will be marked as overloaded',
    // Common messages
    customCsvExportCalled: 'Custom CSV export called',
    languageSwitchedTo: 'Language switched to: {language}',
    themeSwitchedTo: 'Theme switched to: {theme}',
    lightModeText: 'Light Mode',
    darkModeText: 'Dark Mode',
    taskNotFound: 'Task not found for update, ID: {id}',
    newParentTaskNotFound:
      'New parent task not found, ID: {parentId}, will be added as top-level task',
    inPlaceUpdateFailed: 'In-place update failed, task not found, ID: {id}',
    taskToDeleteNotFound: 'Task to delete not found, ID: {id}',
    milestoneIconUpdateNotFound: 'Milestone not found for icon update, ID: {id}',
    overtime: 'Over',
    overdue: 'Overdue',
    days: ' days',
    // 计时确认弹窗
    timerConfirmPrefix: 'About to start timing for',
    timerConfirmSuffix: '. If there are special notes, please complete the description below.',
    timerConfirmPlaceholder: 'Please enter timer description',
    // Demo配置面板
    configDemo: 'Configuration Demo',
    // TaskList配置
    taskListConfig: {
      title: 'TaskList Configuration',
      columns: {
        title: 'Columns(默effective in default render mode)',
        renderMode: 'Render Mode',
        renderModeDefault: 'Default (via TaskListColumnConfig)',
        renderModeDeclarative: 'Declarative (via TaskListColumn)',
      },
      width: {
        title: 'Width Settings',
        defaultWidth: 'Default Width',
        minWidth: 'Min Width',
        maxWidth: 'Max Width',
        pixelsModel: 'pixels (px)',
        percentageModel: 'percentage (%)',
      },
    },
    // TaskBar配置
    taskBarConfig: {
      title: 'TaskBar Configuration',
      display: {
        title: 'Display Options',
        showAvatar: 'Show Avatar',
        showTitle: 'Show Title',
        showProgress: 'Show Progress',
      },
      mistouch: {
        title: 'Mistouch Prevention',
        dragThreshold: 'Drag Threshold (px)',
        dragThresholdHint: 'Distance to trigger dragging',
        resizeHandleWidth: 'Resize Handle Width (px)',
        resizeHandleWidthHint: 'Clickable width of resize handle (5-15px)',
        enableDragDelay: 'Enable Drag Delay',
        enableDragDelayHint: 'Hold to drag after a delay',
        dragDelayTime: 'Delay Time (ms)',
        dragDelayTimeHint: 'Delay time before dragging starts',
        allowDragOnClick: 'Allow dragging and resizing of TaskBars and Milestones',
        allowDragOnClickHint: 'Controls whether to allow dragging of TaskBars and Milestones, as well as resizing the length of TaskBars',
      },
    },
    disableTaskbarFocusMode: 'Disable Focus Mode',
    dataSourceAlreadyLoaded: '{name} is already active',
    dataSourceLoadSuccess: '{name} loaded successfully',
    dataSourceLoadFailed: '{name} failed to load',
    dataSourceSwitch: {
      title: 'Data Sources',
      subtitle: 'Compare default vs. mega dataset initialization',
      loading: 'Loading data, please wait…',
      alreadyLoaded: '{name} is already active',
      loadSuccess: '{name} loaded successfully',
      loadFailed: '{name} failed to load',
      sources: {
        normal: {
          label: 'Standard Dataset',
          description: 'data.json · Full predecessor graph for feature demos',
          badge: 'data.json',
        },
        large: {
          label: 'Massive Dataset',
          description: 'data-large-1m.json · Million-level tasks to stress virtual rendering',
          badge: 'data-large-1m.json',
        },
      },
    },
    resourceView: {
      desc: 'Resource View',
      capacity: 'capacity',
      overloaded: 'overLoaded',
      duration: 'duration',
      overloadWarning: 'Overload Warning',
      conflictDuration: 'conflict duration',
      conflictWith: 'conflict with',
      conflictSuffix: '',
    },
  },
}

// 允许外部合并自定义多语言
export function setCustomMessages(locale: Locale, custom: Partial<(typeof messages)['zh-CN']>) {
  if (!messages[locale]) return

  // 使用深度合并，触发响应式更新
  messages[locale] = {
    ...messages[locale],
    ...custom,
  } as (typeof messages)['zh-CN']

  // 触发语言切换事件，强制刷新所有使用翻译的组件
  if (currentLocale.value === locale) {
    window.dispatchEvent(
      new CustomEvent('locale-changed', {
        detail: { locale },
      }),
    )
  }
}

// LocalStorage key
const LOCALE_STORAGE_KEY = 'gantt-locale'

// 从localStorage读取语言设置，如果没有则使用默认值
const getInitialLocale = (): Locale => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored && (stored === 'zh-CN' || stored === 'en-US')) {
      return stored as Locale
    }
  }
  return 'zh-CN'
}

// 当前语言状态 - 从localStorage初始化
const currentLocale = ref<Locale>(getInitialLocale())

// 多语言 Hook
export function useI18n() {
  // 获取当前语言的消息
  const t = computed(() => {
    return messages[currentLocale.value]
  })

  // 安全获取翻译文本的函数 - 支持多级键（如 'taskListConfig.title'）
  const getTranslation = (key: string, defaultValue?: string): string => {
    // 分割键路径
    const keys = key.split('.')

    // 从根对象开始递归访问
    let value: any = t.value

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        // 如果找不到，优先返回用户传入的 default，否则返回 key
        return defaultValue || key
      }
    }

    // 确保返回的是字符串
    // 1. 如果找到了值且是字符串，返回该值
    // 2. 如果值不是字符串，优先返回用户传入的 default
    // 3. 否则返回 key
    return typeof value === 'string' ? value : (defaultValue || key)
  }

  // 格式化带参数的翻译文本
  const formatTranslation = (key: string, params: Record<string, string | number>): string => {
    let text = getTranslation(key)
    Object.keys(params).forEach(param => {
      text = text.replace(new RegExp(`{${param}}`, 'g'), String(params[param]))
    })
    return text
  }

  // 切换语言
  const setLocale = (locale: Locale) => {
    currentLocale.value = locale

    // 触发全局事件，通知其他组件语言已切换
    window.dispatchEvent(
      new CustomEvent('locale-changed', {
        detail: { locale },
      }),
    )
  }

  // 获取当前语言
  const locale = computed(() => currentLocale.value)

  // 格式化年月
  const formatYearMonth = (year: number, month: number) => {
    return t.value.yearMonthFormat(year, month)
  }

  // 格式化月份
  const formatMonth = (month: number) => {
    return t.value.monthFormat(month)
  }

  return {
    t,
    getTranslation,
    formatTranslation,
    locale,
    setLocale,
    formatYearMonth,
    formatMonth,
  }
}

// 导出当前语言状态，供其他模块使用
export { currentLocale }
export { messages }

// 为了类型推断，导出 Messages 类型
export type Messages = typeof messages

import { ref, computed } from 'vue'

// 支持的语言类型
export type Locale = 'zh-CN' | 'en-US'

// 多语言配置
const messages = {
  'zh-CN': {
    // TaskList Header
    taskName: '任务名称',
    predecessor: '前置任务',
    assignee: '分配人',
    startDate: '开始日期',
    endDate: '结束日期',
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
      estimatedHours: '预计工时(hr)',
      actualHours: '实际工时(hr)',
      progress: '进度(%)',
      type: '类型',
      description: '描述',
    },

    // 日期格式
    yearMonthFormat: (year: number, month: number) =>
      `${year}年${String(month).padStart(2, '0')}月`,

    // 其他
    milestone: '里程碑',
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
    language: '中文',
    languageTooltip: '选择语言',
    lightMode: '明亮模式',
    darkMode: '暗黑模式',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    githubDocs: '查看Github文档',
    giteeDocs: '查看Gitee文档',
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
    // 新建里程碑对话框
    newMilestone: '新建里程碑',
    editMilestone: '编辑里程碑',
    cancel: '取消',

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
    noParentTask: '无上级任务',
    update: '更新',
    taskNameTooLong: '任务名称不能超过50个字符',
    predecessorPlaceholder: '请选择前置任务',
    operationFailed: '操作失败，请重试',
    taskUpdateSuccess: '任务更新成功',
    taskCreateSuccess: '任务创建成功',
    confirmDeleteTask: '确定要删除任务"{name}"吗？此操作不可撤销。',
    taskDeleteSuccess: '任务删除成功',
    taskDeleteFailed: '删除失败，请重试',
    overtime: '超',
    overdue: '逾期',
    days: '天',
  },
  'en-US': {
    // TaskList Header
    taskName: 'Task Name',
    predecessor: 'Predecessor',
    assignee: 'Assignee',
    startDate: 'Start Date',
    endDate: 'End Date',
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
      estimatedHours: 'Est. Hours',
      actualHours: 'Act. Hours',
      progress: 'Progress (%)',
      type: 'Type',
      description: 'Description',
    },

    // 日期格式
    yearMonthFormat: (year: number, month: number) => `${year}/${String(month).padStart(2, '0')}`,

    // 其他
    milestone: 'Milestone',
    today: 'Today',
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
    language: 'English',
    languageTooltip: 'Select language',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    githubDocs: 'GitHub Docs',
    giteeDocs: 'Gitee Docs',
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
    // 新建里程碑对话框
    newMilestone: 'New Milestone',
    editMilestone: 'Edit Milestone',
    cancel: 'Cancel',

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
    noParentTask: 'No Parent Task',
    update: 'Update',
    taskNameTooLong: 'Task name cannot exceed 50 characters',
    predecessorPlaceholder: 'Select predecessor',
    operationFailed: 'Operation failed, please try again',
    taskUpdateSuccess: 'Task updated successfully',
    taskCreateSuccess: 'Task created successfully',
    confirmDeleteTask:
      'Are you sure you want to delete task "{name}"? This action cannot be undone.',
    taskDeleteSuccess: 'Task deleted successfully',
    taskDeleteFailed: 'Delete failed, please try again',
    overtime: 'Over',
    overdue: 'Overdue',
    days: ' days',
  },
}

// 允许外部合并自定义多语言
export function setCustomMessages(locale: Locale, custom: Partial<(typeof messages)['zh-CN']>) {
  if (!messages[locale]) return
  Object.assign(messages[locale], custom)
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

  // 安全获取翻译文本的函数
  const getTranslation = (key: string): string => {
    const translation = t.value[key as keyof typeof t.value]
    return typeof translation === 'string' ? translation : key
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

  return {
    t,
    getTranslation,
    locale,
    setLocale,
    formatYearMonth,
  }
}

// 导出当前语言状态，供其他模块使用
export { currentLocale }
export { messages }

// 为了类型推断，导出 Messages 类型
export type Messages = typeof messages

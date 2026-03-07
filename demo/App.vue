<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, reactive } from 'vue'
// GanttChart 和 TaskListColumn 已经通过 app.use(JordiumGantt) 全局注册，无需导入
// import TaskDrawer from '../src/components/TaskDrawer.vue' // 移除
import MilestoneDialog from '../src/components/MilestoneDialog.vue'
import normalData from './data.json'
import mediumData from './data-100.json'
import largeData from './data-large-1m.json'
import resourcesData from './data-resources.json'
import largeResourcesData from './data-resources-large.json'
import packageInfo from '../package.json'
// 导入主题变量
import '../src/styles/theme-variables.css'
import VersionHistoryDrawer from './VersionHistoryDrawer.vue'
import HtmlContent from './HtmlContent.vue'
import { useMessage } from '../src/composables/useMessage'
import { useI18n } from '../src/composables/useI18n'
import { useDemoLocale } from './useDemoLocale'
import { getPredecessorIds, predecessorIdsToString } from '../src/utils/predecessorUtils'
import type { Task } from '../src/models/Task'
import type { Resource } from '../src/models/classes/Resource'
import { createResource, addTaskToResource, updateResourceUtilization } from '../src/utils/resourceUtils'
import type { TaskListConfig, TaskListColumnConfig } from '../src/models/configs/TaskListConfig'
import type { ResourceListConfig } from '../src/models/configs/ResourceListConfig'
import type { TaskBarConfig } from '../src/models/configs/TaskBarConfig'

const { showMessage } = useMessage()
const { t, formatTranslation } = useI18n()
const { locale: demoLocale, messages: demoMessages, setLocale: setDemoLocale, formatMessage, getTaskTypeName, getParentName } = useDemoLocale()

// Tool Settings 多语言
const ts = computed(() => demoMessages.value.toolSettings || {})

// TaskBar Config 多语言
const taskBarConfigMessages = computed(() => demoMessages.value.taskBarConfig || {})

// GanttChart ref
const gantt = ref<InstanceType<typeof import('../src/components/GanttChart.vue').default> | null>(null)

const tasks = ref<Task[]>([])
const milestones = ref<Task[]>([])
const resources = ref<Resource[]>([])
const viewMode = ref<'task' | 'resource'>('task')
const useDefaultDrawer = ref(true)

const rawDataSources = [
  {
    key: 'normal',
    fileName: 'data.json',
    payload: normalData,
  },
  {
    key: 'medium',
    fileName: 'data-100.json',
    payload: mediumData,
  },
  {
    key: 'large',
    fileName: 'data-large-1m.json',
    payload: largeData,
  },
] as const

type DataSourceKey = (typeof rawDataSources)[number]['key']
type RawDataSource = (typeof rawDataSources)[number]

const dataSourceOptions = computed(() => {
  const dsTranslations = t.value.dataSourceSwitch?.sources ?? {}
  return rawDataSources.map(source => {
    const optionTexts = dsTranslations[source.key as keyof typeof dsTranslations] || {}
    return {
      ...source,
      label: optionTexts.label || source.fileName,
      description: optionTexts.description || '',
      badge: optionTexts.badge || source.fileName,
    }
  })
})

const currentDataSource = ref<DataSourceKey>('medium')
const dataLoading = ref(false)

const cloneData = <T>(data: T): T => {
  const globalClone = (globalThis as unknown as { structuredClone?: <K>(value: K) => K }).structuredClone
  if (typeof globalClone === 'function') {
    return globalClone(data)
  }
  return JSON.parse(JSON.stringify(data)) as T
}

const findRawDataSource = (key: DataSourceKey) => rawDataSources.find(source => source.key === key)

const applyDataSource = (source: RawDataSource) => {
  const payload = source.payload as { tasks?: Task[]; milestones?: Task[] }
  tasks.value = cloneData(payload.tasks ?? [])
  milestones.value = cloneData(payload.milestones ?? [])

  // v1.9.0 从资源数据文件加载
  // v1.9.3 根据数据源选择对应的资源数据集
  const resourcePayload = (source.key === 'large' ? largeResourcesData : resourcesData) as { resources?: any[] }
  if (resourcePayload.resources) {
    resources.value = resourcePayload.resources.map(resData => {
      // 使用 createResource 工厂函数创建资源对象
      return createResource({
        id: resData.id,
        name: resData.name,
        type: resData.type,
        avatar: resData.avatar,
        description: resData.description,
        department: resData.department,
        skills: resData.skills,
        capacity: resData.capacity,
        color: resData.color,
        tasks: resData.tasks || []
      })
    })

    // 更新assigneeOptions，添加资源作为责任人选项
    const resourceAssigneeOptions = resources.value.map(res => ({
      value: res.id as string,
      label: res.name,
      avatar: res.avatar
    }))
    assigneeOptions.value = [...resourceAssigneeOptions]
  } else {
    // 向后兼容：如果没有独立的资源数据，从任务中生成
    const resourceMap = new Map<string, Resource>()
    tasks.value.forEach(task => {
      if (task.assignee && !resourceMap.has(task.assignee)) {
        resourceMap.set(task.assignee, createResource({
          id: task.assignee,
          name: task.assignee,
          type: 'user',
          avatar: task.assigneeAvatar || undefined,
          tasks: []
        }))
      }
    })

    // 将任务分配到对应资源
    tasks.value.forEach(task => {
      if (task.assignee) {
        const resource = resourceMap.get(task.assignee)
        if (resource) {
          addTaskToResource(resource, task)
        }
      }
    })

    // 计算每个资源的利用率
    resourceMap.forEach(resource => {
      updateResourceUtilization(resource)
    })

    resources.value = Array.from(resourceMap.values())
  }
}

const getSourceTexts = (key: DataSourceKey) => {
  const dsTranslations = t.value.dataSourceSwitch?.sources ?? {}
  return dsTranslations[key as keyof typeof dsTranslations] || { label: key }
}

const switchDataSource = async (
  key: DataSourceKey,
  options: { silent?: boolean; force?: boolean } = {},
) => {
  if (dataLoading.value) return

  const source = findRawDataSource(key)
  if (!source) return

  const sourceTexts = getSourceTexts(key)
  const displayName = sourceTexts.label || source.fileName

  if (!options.force && currentDataSource.value === key && tasks.value.length > 0) {
    showMessage(formatTranslation('dataSourceAlreadyLoaded', { name: displayName }), 'info', {
      closable: true,
    })
    return
  }

  currentDataSource.value = key
  dataLoading.value = true

  try {
    await nextTick()
    applyDataSource(source)
    if (!options.silent) {
      showMessage(formatTranslation('dataSourceLoadSuccess', { name: displayName }), 'success', {
        closable: false,
      })
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('切换数据源失败', error)
    showMessage(formatTranslation('dataSourceLoadFailed', { name: displayName }), 'error', {
      closable: true,
    })
  } finally {
    dataLoading.value = false
  }
}

// MilestoneDialog状态管理
const showMilestoneDialog = ref(false)
const currentMilestone = ref<Task | null>(null)
const isMilestoneEditMode = ref(false)

// 版本历史Drawer状态
const showVersionDrawer = ref(false)

// v1.9.7 资源编辑提示dialog状态
const resourceEditHintVisible = ref(false)
const clickedResource = ref<Resource | null>(null)

// v1.9.7 移除自动禁用useDefaultDrawer的watch
// 改为在handleTaskDoubleClick中根据对象类型判断行为
// useDefaultDrawer保持为true,确保新建任务和TaskBar双击能正常工作

const toolbarConfig = reactive({
  showAddTask: true,
  showAddMilestone: true,
  showTodayLocate: true,
  showExportCsv: true,
  showExportPdf: true,
  showLanguage: true,
  showTheme: true,
  showFullscreen: true,
  showTimeScale: true, // 控制日|周|月时间刻度按钮组的可见性
  timeScaleDimensions: ['hour', 'day', 'week', 'month', 'quarter', 'year'], // 设置时间刻度按钮的展示维度，包含所有时间维度
  defaultTimeScale: 'week',
  showExpandCollapse: true, // 显示全部展开/折叠按钮
  showViewMode: true, // 显示 Task/Resource 视图切换按钮组
})

// TaskList列渲染模式配置
const taskListColumnRenderMode = ref<'default' | 'declarative'>('default')

// TaskList列配置
const availableColumns = ref<TaskListColumnConfig[]>([
  { key: 'predecessor', label: '前置任务', visible: true },
  {
    key: 'assignee',
    label: '负责人',
    visible: true,
    width: 250,
    // 示例：使用 formatter 格式化显示（可选，如果不使用列级slot）
    // formatter: (task) => task.assignee ? `👤 ${task.assignee}` : '-'
  },
  {
    key: 'startDate',
    label: '开始日期',
    visible: true,
    // 示例：日期格式化
    formatter: (task) => {
      if (!task.startDate) return '-'
      const date = new Date(task.startDate)
      return `${date.getMonth() + 1}/${date.getDate()}`
    }
  },
  { key: 'endDate', label: '结束日期', visible: true },
  { key: 'estimatedHours', label: '预估工时', visible: true },
  { key: 'actualHours', label: '实际工时', visible: true },
  { key: 'progress', label: '进度', visible: true },
  {
    key: 'custom',
    label: '自定义列',
    visible: true,
    width: '30%',
    // 自定义列将使用 #column-custom slot 渲染
  },
])

// TaskList宽度配置
const taskListWidth = ref({
  defaultWidth: 450, // 默认宽度400px（比默认320px更宽）
  minWidth: 300, // 最小宽度300px（比默认280px略大）
  maxWidth: 1200, // 最大宽度1200px（比默认1160px略大）
})

// TaskList宽度单位配置（px 或百分比）
const widthUnit = ref<'px' | '%'>('px')
const widthPercentage = ref({
  defaultWidth: 25,
  minWidth: 15,
  maxWidth: 60,
})

const taskListConfig = computed<TaskListConfig>(() => ({
  columns: availableColumns.value,
  defaultWidth:
    widthUnit.value === '%'
      ? `${widthPercentage.value.defaultWidth}%`
      : taskListWidth.value.defaultWidth,
  minWidth:
    widthUnit.value === '%' ? `${widthPercentage.value.minWidth}%` : taskListWidth.value.minWidth,
  maxWidth:
    widthUnit.value === '%' ? `${widthPercentage.value.maxWidth}%` : taskListWidth.value.maxWidth,
}))

// TaskList 展开/收起配置
const enableTaskListCollapsible = ref(true)
const taskListVisible = ref(true)

// 资源列表配置
const resourceListConfig = computed<ResourceListConfig>(() => ({
  columns: [
    {
      key: 'name',
      label: '资源名称',
      visible: true,
      width: 200,
      formatter: (resource: Resource) => resource.name || '-',
    },
    {
      key: 'capacity',
      label: '利用率',
      visible: true,
      width: 100,
      formatter: (resource: Resource) => {
        if (resource.capacity != null) {
          return `${resource.capacity}%`
        }
        // 简单计算：基于任务数量的利用率
        const taskCount = resource.tasks?.length || 0
        const utilizationPercent = Math.min(taskCount * 20, 100) // 假设每个任务占20%
        return `${utilizationPercent}%`
      },
    },
    {
      key: 'type',
      label: '类型',
      visible: true,
      width: 100,
      formatter: (resource: Resource) => resource.type || '-',
    },
    {
      key: 'taskCount',
      label: '任务数',
      visible: true,
      width: 100,
      formatter: (resource: Resource) => resource.tasks?.length?.toString() || '0',
    },
  ],
  defaultWidth:
    widthUnit.value === '%'
      ? `${widthPercentage.value.defaultWidth}%`
      : taskListWidth.value.defaultWidth,
  minWidth:
    widthUnit.value === '%' ? `${widthPercentage.value.minWidth}%` : taskListWidth.value.minWidth,
  maxWidth:
    widthUnit.value === '%' ? `${widthPercentage.value.maxWidth}%` : taskListWidth.value.maxWidth,
}))


// 控制是否允许拖拽和拉伸
const allowDragAndResize = ref(true)

// 控制是否启用TaskRow拖拽移动
const enableTaskRowMove = ref(true)

// v1.9.0 资源视图垂直拖拽确认对话框
const resourceDragConfirmVisible = ref(false)
const resourceDragData = ref<{
  task: Task | null
  sourceResourceIndex: number
  targetResourceIndex: number
  targetResource: Resource | null
  newStartDate?: string
  newEndDate?: string
}>({
  task: null,
  sourceResourceIndex: -1,
  targetResourceIndex: -1,
  targetResource: null,
  newStartDate: undefined,
  newEndDate: undefined,
})

// 指派人员选项列表
const assigneeOptions = ref([
  { value: 'zhangsan', label: '张三' },
  { value: 'lisi', label: '李四' },
  { value: 'wangwu', label: '王五' },
  { value: 'zhaoliu', label: '赵六' },
  { value: 'qianqi', label: '钱七' },
  { key: 'user_sunba', value: 'sunba', label: '孙八' }, // 示例：使用自定义 key
  { value: 'zhoujiu', label: '周九' },
  { value: 'wushi', label: '吴十' },
])

// TaskBar配置
const taskBarOptions = ref({
  showAvatar: true,
  showTitle: true,
  showProgress: true,
  dragThreshold: 5, // 拖拽触发阈值（像素）
  resizeHandleWidth: 5, // 拉伸手柄宽度（像素），默认5px，最大15px
  enableDragDelay: false, // 是否启用拖拽延迟
  dragDelayTime: 150, // 拖拽延迟时间（毫秒）
})

// 自定义任务状态背景色
const showActualTaskBar = ref(true)
// Tooltip 自定义 Slot 演示
const useCustomTooltip = ref(true)
const pendingTaskBackgroundColor = ref('#409eff')
const delayTaskBackgroundColor = ref('#f56c6c')
const completeTaskBackgroundColor = ref('#909399')
const ongoingTaskBackgroundColor = ref('#e6a23c')

const taskBarConfig = computed<TaskBarConfig>(() => ({
  showAvatar: taskBarOptions.value.showAvatar,
  showTitle: taskBarOptions.value.showTitle,
  showProgress: taskBarOptions.value.showProgress,
  dragThreshold: taskBarOptions.value.dragThreshold,
  resizeHandleWidth: taskBarOptions.value.resizeHandleWidth,
  enableDragDelay: taskBarOptions.value.enableDragDelay,
  dragDelayTime: taskBarOptions.value.dragDelayTime,
}))

// 配置面板折叠状态
const isConfigPanelCollapsed = ref(false)
const isDataSourcePanelCollapsed = ref(false)

// TaskList 配置区域折叠状态（默认收起）
const isTaskListConfigCollapsed = ref(true)

// TaskBar 配置区域折叠状态（默认收起）
const isTaskBarConfigCollapsed = ref(true)

// Tool 设置区域折叠状态（默认展开用于演示）
const isToolSettingsCollapsed = ref(false)

// Tool 设置状态变量
const fullscreenStatus = ref(false)
const expandStatus = ref(false)
const currentLocaleStatus = ref('zh-CN')
const currentScaleStatus = ref('week')
const currentThemeStatus = ref('light')
const scrollToTaskId = ref('')
const scrollToDateValue = ref('')

// 控制模式：'expose' 使用expose方法，'props' 使用Props
const controlMode = ref<'expose' | 'props'>('expose')

// Props控制变量
const propsLocale = ref<'zh-CN' | 'en-US'>('zh-CN')
const propsTheme = ref<'light' | 'dark'>('light')
const propsTimeScale = ref<'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'>('week')
const propsFullscreen = ref(false)
const propsExpandAll = ref(false)

// 监听 propsLocale 变化，同步更新 demo 的 locale 状态和 status
watch(propsLocale, (newLocale) => {
  // 当通过 Props 控制语言时，同步更新 demo 自身的语言设置
  setDemoLocale(newLocale)
  // 同步 status 状态
  currentLocaleStatus.value = newLocale
})

// 监听 propsTheme 变化，同步 status
watch(propsTheme, (newTheme) => {
  currentThemeStatus.value = newTheme
})

// 监听 propsTimeScale 变化，同步 status
watch(propsTimeScale, (newScale) => {
  currentScaleStatus.value = newScale
})

// 监听 propsFullscreen 变化，同步 status
watch(propsFullscreen, (newFullscreen) => {
  fullscreenStatus.value = newFullscreen
})

// 监听 propsExpandAll 变化，同步 status
watch(propsExpandAll, (newExpandAll) => {
  expandStatus.value = newExpandAll
})

// TaskList 显隐 expose 方法
const handleSetTaskListVisible = (visible: boolean) => {
  gantt.value?.setTaskListVisible(visible)
}
const handleToggleTaskList = () => {
  gantt.value?.toggleTaskList()
}

// 切换配置面板折叠状态
const toggleConfigPanel = () => {
  isConfigPanelCollapsed.value = !isConfigPanelCollapsed.value
}

const toggleDataSourcePanel = () => {
  isDataSourcePanelCollapsed.value = !isDataSourcePanelCollapsed.value
}

// 切换 TaskList 配置区域
const toggleTaskListConfig = () => {
  isTaskListConfigCollapsed.value = !isTaskListConfigCollapsed.value
}

// 切换 TaskBar 配置区域
const toggleTaskBarConfig = () => {
  isTaskBarConfigCollapsed.value = !isTaskBarConfigCollapsed.value
}

// 切换 Tool 设置区域
const toggleToolSettings = () => {
  isToolSettingsCollapsed.value = !isToolSettingsCollapsed.value
}

// Tool 设置控制函数
const updateStatus = () => {
  if (gantt.value) {
    fullscreenStatus.value = gantt.value.isFullscreen()
    expandStatus.value = gantt.value.isExpandAll()
    currentLocaleStatus.value = gantt.value.currentLocale()
    currentScaleStatus.value = gantt.value.currentScale()
    currentThemeStatus.value = gantt.value.currentTheme()
  }
}

const handleEnterFullscreen = () => {
  gantt.value?.enterFullscreen()
  updateStatus()
  // 同步 Props 控制变量
  propsFullscreen.value = true
}

const handleExitFullscreen = () => {
  gantt.value?.exitFullscreen()
  updateStatus()
  // 同步 Props 控制变量
  propsFullscreen.value = false
}

const handleToggleFullscreen = () => {
  gantt.value?.toggleFullscreen()
  updateStatus()
  // 同步 Props 控制变量
  propsFullscreen.value = gantt.value?.isFullscreen() ?? false
}

const handleExpandAll = () => {
  gantt.value?.expandAll()
  updateStatus()
  // 同步 Props 控制变量
  propsExpandAll.value = true
}

const handleCollapseAll = () => {
  gantt.value?.collapseAll()
  updateStatus()
  // 同步 Props 控制变量
  propsExpandAll.value = false
}

const handleToggleExpandAll = () => {
  gantt.value?.toggleExpandAll()
  updateStatus()
  // 同步 Props 控制变量
  propsExpandAll.value = gantt.value?.isExpandAll() ?? false
}

const handleScrollToToday = () => {
  gantt.value?.scrollToToday()
  showMessage('已滚动到今天', 'success')
}

const handleScrollToTask = () => {
  if (scrollToTaskId.value.trim()) {
    gantt.value?.scrollToTask(scrollToTaskId.value)
    showMessage(`已滚动到任务: ${scrollToTaskId.value}`, 'success')
  } else {
    showMessage('请输入任务ID', 'warning')
  }
}

const handleScrollToDate = () => {
  if (scrollToDateValue.value.trim()) {
    gantt.value?.scrollToDate(scrollToDateValue.value)
    showMessage(`已滚动到日期: ${scrollToDateValue.value}`, 'success')
  } else {
    showMessage('请输入日期 (YYYY-MM-DD)', 'warning')
  }
}

const handleSetLocale = (locale: 'zh-CN' | 'en-US') => {
  // 切换语言
  setDemoLocale(locale)
  gantt.value?.setLocale(locale)
  currentLocaleStatus.value = locale
  // 同步 Props 控制变量
  propsLocale.value = locale
  const languageText = locale === 'zh-CN' ? '中文' : 'English'
  showMessage(`语言已切换为: ${languageText}`, 'info')
}

const handleSetTimeScale = (scale: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year') => {
  gantt.value?.setTimeScale(scale)
  updateStatus()
  // 同步 Props 控制变量
  propsTimeScale.value = scale
}

const handleSetTheme = (mode: 'light' | 'dark') => {
  gantt.value?.setTheme(mode)
  updateStatus()
  // 同步 Props 控制变量
  propsTheme.value = mode
  const themeText = mode === 'dark' ? 'Dark' : 'Light'
  showMessage(`Theme switched to: ${themeText}`, 'info')
}

const handleZoomIn = () => {
  gantt.value?.zoomIn()
  updateStatus()
}

const handleZoomOut = () => {
  gantt.value?.zoomOut()
  updateStatus()
}

// Task Click Dialog 状态管理
const showTaskClickDialog = ref(false)
const clickedTask = ref<Task | null>(null)

// TaskRow Move 相关（已移除确认对话框，直接显示提示消息）

// 同步语言切换
const handleLanguageChange = (lang: 'zh-CN' | 'en-US') => {
  setDemoLocale(lang)
  const languageText = lang === 'zh-CN' ? '中文' : 'English'
  showMessage(formatTranslation('languageSwitchedTo', { language: languageText }), 'info', {
    closable: true,
  })
}

// 处理任务点击事件
const handleTaskClick = (task: Task) => {
  clickedTask.value = task
  showTaskClickDialog.value = true
}

// v1.9.7 处理任务双击事件（资源视图下显示资源编辑提示）
const handleTaskDoubleClick = (taskOrResource: Task | Resource) => {
  // 使用类型守卫严格判断是否为Resource对象
  if (viewMode.value === 'resource' && isResource(taskOrResource)) {
    // 这是Resource对象，显示资源编辑提示
    // GanttChart内部通过 typeof task.id === 'number' 也会阻止打开TaskDrawer
    clickedResource.value = taskOrResource
    resourceEditHintVisible.value = true
    return
  }

  // 对于真正的Task对象，GanttChart会正常打开TaskDrawer
  // useDefaultDrawer保持为true，确保新建任务和TaskBar双击都能正常工作
}

// v1.9.7 类型守卫：判断是否为Resource对象
// Resource独有的特征：有tasks数组属性，且没有resources属性
const isResource = (obj: Task | Resource): obj is Resource => {
  return obj &&
    typeof obj === 'object' &&
    'tasks' in obj &&
    Array.isArray((obj as Resource).tasks) &&
    !('resources' in obj) // Task有resources属性，Resource没有
}

// 关闭资源编辑提示dialog
const closeResourceEditHint = () => {
  resourceEditHintVisible.value = false
  clickedResource.value = null
}

// v1.9.7 处理视图模式变化事件，同步GanttChart内部状态
const handleViewModeChanged = (newMode: 'task' | 'resource') => {
  viewMode.value = newMode
  // useDefaultDrawer会由watch(viewMode)自动更新
}

// 关闭 Task Click Dialog
const closeTaskClickDialog = () => {
  showTaskClickDialog.value = false
  clickedTask.value = null
}

// 格式化属性值用于显示
const formatPropertyValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

// 切换列显示状态
const toggleColumn = (columnKey: string, event: Event) => {
  const target = event.target as HTMLInputElement
  const visible = target?.checked ?? false

  const column = availableColumns.value.find(col => col.key === columnKey)
  if (column) {
    column.visible = visible
  }
} // 工作时间配置示例
const workingHoursConfig = {
  morning: { start: 8, end: 11 }, // 上午8:00-11:59为工作时间
  afternoon: { start: 13, end: 17 }, // 下午13:00-17:00为工作时间
  // 其他时间（12:00-12:59, 18:00-07:59）为休息时间，显示为灰色背景
}

// 自定义CSV导出处理器（可选）
const handleCustomCsvExport = () => {
  showMessage(t.value.customCsvExportCalled, 'info', { closable: true })

  // 这里可以实现自定义的CSV导出逻辑
  // 例如：添加额外的数据处理、格式化、或发送到服务器等

  // 如果不实现自定义逻辑，组件会使用内置的默认导出功能
  // return false // 返回false让组件使用默认实现

  // 示例：这里直接使用默认实现
  return false
}

// 其他工具栏事件处理器示例
const handleAddTask = () => {
  // GanttChart 内部会打开 TaskDrawer（如果 useDefaultDrawer=true）
  // 这里可以添加自定义逻辑，比如显示提示消息
  showMessage('准备新增任务...', 'info', { closable: true })
}

const handleAddMilestone = () => {
  // 打开MilestoneDialog进行新建里程碑
  currentMilestone.value = null
  isMilestoneEditMode.value = false
  showMilestoneDialog.value = true
}

// 根据任务进度返回行样式类名
// task-list-row-class-name 使用示例：
// 1. 父级节点（包含子任务） → task-row-parent (保留默认样式)
// 2. progress = 100 → task-row-success (淡绿色，已完成)
// 3. 0 < progress < 100 → task-row-warning (淡黄色，进行中)
// 4. progress <= 0 → task-row-info (灰色，未开始)
const getTaskRowClassName = (row: Task, rowIndex: number) => {
  // 如果是父级节点（包含子任务），使用默认父级样式
  if (row.children && row.children.length > 0) {
    return 'parent-task'
  }

  const progress = row.progress || 0

  // 进度 = 100：已完成，淡绿色
  if (progress === 100) {
    return 'task-row-success'
  }

  // 进度 > 0 且 < 100：进行中，淡黄色
  if (progress > 0 && progress < 100) {
    return 'task-row-warning'
  }

  // 进度 <= 0：未开始，灰色
  return 'task-row-info'
}

// 根据任务进度返回行内联样式
// task-list-row-style 使用示例（优先级高于 task-list-row-class-name）：
// 可以返回对象形式的样式，支持更灵活的样式控制
const getTaskRowStyle = (row: Task, rowIndex: number) => {
  // 父级节点保持默认样式
  if (row.children && row.children.length > 0) {
    return {}
  }

  const progress = row.progress || 0

  // 这里可以返回内联样式对象
  // 示例：根据进度值设置不同的边框颜色
  if (progress === 100) {
    return {
      borderLeft: '3px solid #67c23a',
    }
  }

  if (progress > 0 && progress < 100) {
    return {
      borderLeft: '3px solid #e6a23c',
    }
  }

  return {
    borderLeft: '3px solid #909399',
  }
}

const handleThemeChange = (isDark: boolean) => {
  const themeText = isDark ? t.value.darkModeText : t.value.lightModeText
  showMessage(formatTranslation('themeSwitchedTo', { theme: themeText }), 'info', {
    closable: true,
  })
}

// 从外部 MilestoneDialog 保存里程碑（新建里程碑按钮打开的对话框）
const handleMilestoneSaveFromDialog = (milestone: Task) => {
  // 如果是新建里程碑（没有id），生成一个临时ID
  if (!milestone.id) {
    milestone.id = Date.now()
  }

  // 确保里程碑有必要的属性
  milestone.type = 'milestone'

  // 查找是否已存在该里程碑
  const existingIndex = milestones.value.findIndex(m => m.id === milestone.id)
  if (existingIndex !== -1) {
    // 更新现有里程碑
    milestones.value.splice(existingIndex, 1, milestone)
  } else {
    // 添加新里程碑
    milestones.value.push(milestone)
  }

  // 关闭对话框
  showMilestoneDialog.value = false

  // 显示成功提示
  showMessage(`里程碑 "${milestone.name}" 已保存`, 'success', { closable: false })
}

// 里程碑保存事件处理器（新的事件驱动 API）
const handleMilestoneSaved = (milestone: Task) => {
  // 组件已自动更新 milestones 数据，这里只需处理额外的业务逻辑

  // 关闭里程碑对话框
  showMilestoneDialog.value = false

  // 可以在这里添加其他业务逻辑，如：
  // - 发送数据到服务器
  // - 显示成功提示
  // - 记录操作日志等
  showMessage(`里程碑 "${milestone.name}" 已保存`, 'success', { closable: false })
}

// 里程碑删除事件处理器（新的事件驱动 API）
const handleMilestoneDeleted = async (event: { milestoneId: number }) => {
  // 组件已自动从 milestones 中删除数据，这里只需处理额外的业务逻辑
  const { milestoneId } = event

  showMessage(t.value.milestoneDeleteSuccess, 'success', { closable: false })

  // 等待DOM更新完成
  await nextTick()

  // 触发全局事件，通知其他组件里程碑已删除
  window.dispatchEvent(
    new CustomEvent('milestone-deleted', {
      detail: { milestoneId },
    }),
  )

  // 触发强制更新事件，确保Timeline重新渲染
  window.dispatchEvent(
    new CustomEvent('milestone-data-changed', {
      detail: { milestones: milestones.value },
    }),
  )

  // 关闭里程碑对话框
  showMilestoneDialog.value = false
}

// 任务更新事件处理器
const handleTaskUpdateEvent = (e: { task: Task }) => {
  const updatedTask = e.task
  showMessage(`Demo 任务[${updatedTask.name}] 已更新`, 'success')

  // 注意：GanttChart 内部已经通过 updateTaskInTree 更新了任务
  // 这里只需要显示消息，无需再次执行更新逻辑

  // 计时信息展示（无论来源于 TaskBar/TaskRow 还是 TaskDrawer header）
  if (updatedTask.timerStartTime) {
    const msg = `任务【${updatedTask.name}】计时已更新`
    showMessage(msg, 'info', { closable: true })
  }
}

// 任务添加事件处理器
const handleTaskAddEvent = (e: { task: Task }) => {
  // 打印全部的tasks
  //console.log('当前所有任务:', tasks.value)
  const newTask = e.task
  showMessage(`Demo 任务[${newTask.name}] 已创建`, 'success')

  // 注意：GanttChart 内部已经通过 insertTask 添加了任务
  // 这里只需要显示消息，无需再次执行添加逻辑
}

// 任务删除事件处理器
const handleTaskDeleteEvent = (e: { task: Task; deleteChildren?: boolean }) => {
  const task = e.task
  const deleteChildren = e.deleteChildren

  showMessage(`Demo 任务[${task.name}] 已删除`, 'success')

  // 注意：GanttChart 内部已经通过 removeTaskFromTree 删除了任务
  // 这里只需要显示消息，无需再次执行删除逻辑
  // 如果需要在删除后清理其他数据（如 predecessor），可以在这里处理

  // 收集被删除任务的ID
  // 如果 deleteChildren 为 false，只删除父任务本身，子任务会被提升，所以不应该收集子任务ID
  // 如果 deleteChildren 为 true，删除父任务及所有子任务，需要收集所有ID
  const deletedTaskIds = deleteChildren ? collectAllTaskIds(task) : [task.id]
  // 清理predecessor依赖关系
  cleanupPredecessorReferences(deletedTaskIds)
}

// 里程碑图标变更事件处理器（新的事件驱动 API）
const handleMilestoneIconChanged = (event: { milestoneId: number; icon: string }) => {
  // 组件已自动更新 milestones 中的 icon，这里只需处理额外的业务逻辑
  const { icon } = event

  // 可以在这里添加其他业务逻辑，如：
  // - 发送更新到服务器
  // - 显示成功提示
  // - 记录操作日志等
  showMessage(`里程碑图标已更新为 ${icon}`, 'info', { closable: false })
}

// GitHub 文档处理函数
const handleGithubDocsClick = (event: Event) => {
  event.preventDefault()
  // 打开GitHub仓库的README页面
  window.open('https://github.com/nelson820125/jordium-gantt-vue3', '_blank')
}

// Gitee 文档处理函数
const handleGiteeDocsClick = (event: Event) => {
  event.preventDefault()
  // 打开Gitee仓库的README页面
  window.open('https://gitee.com/jordium/jordium-gantt-vue3.git', '_blank')
}

// 任务拖拽/拉伸/里程碑拖拽监听
function handleTaskbarDragOrResizeEnd(newTask) {
  // 注意：GanttChart 已经更新了 props.tasks，所以这里只显示更新后的信息
  showMessage(
    `任务【${newTask.name}】已更新\n` +
      `开始日期: ${newTask.startDate}\n` +
      `结束日期: ${newTask.endDate}`,
    'success',
    { closable: true },
  )
}
function handleMilestoneDragEnd(newMilestone) {
  // 注意：GanttChart 已经更新了数据
  showMessage(
    `里程碑【${newMilestone.name}】已更新\n` +
      `日期: ${newMilestone.startDate || newMilestone.endDate}`,
    'success',
    { closable: true },
  )
}

onMounted(() => {
  switchDataSource(currentDataSource.value, { silent: true, force: true })
  // 初始化Tool设置状态
  nextTick(() => {
    updateStatus()
  })

  // v1.9.7 监听资源双击事件
  //window.addEventListener('task-row-double-click', handleResourceDoubleClick as EventListener)
})

// 清理被删除任务的predecessor依赖关系
const cleanupPredecessorReferences = (deletedTaskIds: number[]) => {
  // 递归清理所有任务（包括嵌套的子任务）的predecessor
  const cleanupTaskArray = (taskArray: Task[]) => {
    taskArray.forEach(task => {
      if (task.predecessor) {
        // 使用工具函数获取前置任务ID数组
        const predecessorIds = getPredecessorIds(task.predecessor)

        // 过滤掉被删除的任务ID
        const validPredecessorIds = predecessorIds.filter(id => !deletedTaskIds.includes(id))

        // 更新predecessor属性
        if (validPredecessorIds.length === 0) {
          delete task.predecessor
        } else {
          task.predecessor = predecessorIdsToString(validPredecessorIds)
        }
      }

      // 递归处理子任务
      if (task.children && task.children.length > 0) {
        cleanupTaskArray(task.children)
      }
    })
  }

  cleanupTaskArray(tasks.value)
}

// 收集被删除任务及其所有子任务的ID
const collectAllTaskIds = (task: Task): number[] => {
  const ids = [task.id]
  if (task.children && task.children.length > 0) {
    task.children.forEach(child => {
      ids.push(...collectAllTaskIds(child))
    })
  }
  return ids
}

// Timer事件处理
function onTimerStarted(task: Task) {
  showMessage(
    `Demo 任务【${task.name}】\n开始计时：${new Date(task.timerStartTime).toLocaleString()}\n计时说明：${task.timerStartDesc ? task.timerStartDesc : ''}`,
    'info',
    { closable: true },
  )
}
function onTimerStopped(task: Task) {
  let msg = `Demo 任务【${task.name}】`
  if (task.timerStartTime) {
    msg += `\n开始计时：${new Date(task.timerStartTime).toLocaleString()}`
    msg += `\n结束计时：${new Date().toLocaleString()}`
    if (task.timerStartDesc) msg += `\n计时说明：${task.timerStartDesc}`
  } else {
    msg += `\n结束计时：${new Date().toLocaleString()}`
  }
  showMessage(msg, 'info', { closable: true })
}

function taskDebug(item: any) {
  // Placeholder for debugging
}

// TaskRow拖拽移动事件处理器
const handleTaskRowMoved = async (payload: {
  draggedTask: Task
  targetTask: Task
  position: 'after' | 'child' // 'after': 放在目标任务之后（同级）, 'child': 作为目标任务的子任务
  oldParent: Task | null
  newParent: Task | null
}) => {
  const { draggedTask, targetTask, position, oldParent, newParent } = payload

  // 【注意】组件内部已自动完成数据移动，通过对象引用修改实现 TaskList 和 Timeline 的自动同步
  // 因此监听此事件是完全可选的，仅用于：
  // 1. 显示自定义提示消息
  // 2. 调用后端API保存任务层级变更
  // 3. 记录操作日志
  // 4. 触发其他业务逻辑（如更新关联数据）

  // 构建提示消息
  const oldParentName = getParentName(oldParent)
  const newParentName = position === 'after'
    ? getParentName(newParent)
    : getParentName({ type: targetTask.type, name: targetTask.name })

  let message = ''
  const msgs = demoMessages.value.taskMoveConfirm.messages

  if (position === 'after') {
    // 算法#1: 放置在目标任务之后
    message = formatMessage(msgs.moveAfter, {
      draggedTaskType: getTaskTypeName(draggedTask.type),
      draggedTaskName: draggedTask.name,
      targetTaskType: getTaskTypeName(targetTask.type),
      targetTaskName: targetTask.name,
    })
  } else {
    // 算法#2: 作为子任务放置
    if (oldParent && oldParent.id !== targetTask.id) {
      message = formatMessage(msgs.moveAsChild, {
        draggedTaskName: draggedTask.name,
        oldParentName,
        newParentName,
      })
    } else if (!oldParent) {
      message = formatMessage(msgs.moveAsChildNoOldParent, {
        draggedTaskName: draggedTask.name,
        newParentName,
      })
    } else {
      message = formatMessage(msgs.moveAsChildSameParent, {
        draggedTaskName: draggedTask.name,
        newParentName,
      })
    }
  }

  // 显示移动成功提示
  const successMsg = demoMessages.value.taskMoveConfirm.messages.moveSuccess
  showMessage(`${successMsg}: ${message}`, 'success', { closable: true })

  // ⚠️ 注意：组件内部已通过对象引用自动完成数据移动，TaskList 和 Timeline 自动同步
  // 无需手动更新 tasks.value，因为移动操作直接修改了原始对象引用
  // 如果需要触发响应式更新，可以使用: tasks.value = [...tasks.value]

  // 调用后端API保存任务层级变更
  // try {
  //   await api.updateTaskHierarchy({
  //     taskId: draggedTask.id,
  //     targetTaskId: targetTask.id,
  //     position: position, // 'after' 或 'child'
  //     oldParentId: oldParent?.id,
  //     newParentId: newParent?.id,
  //   })
  //   console.log('任务层级已保存到后端')
  // } catch (error) {
  //   console.error('保存任务层级失败:', error)
  //   showMessage('保存失败，请刷新页面', 'error', { closable: true })
  // }
}

// v1.9.0 处理资源视图垂直拖拽结束事件
const handleResourceDragEnd = (event: {
  task: Task
  sourceResourceIndex: number
  targetResourceIndex: number
  targetResource: Resource
  newStartDate?: string
  newEndDate?: string
}) => {
  // 保存拖拽数据并显示确认对话框
  resourceDragData.value = {
    task: event.task,
    sourceResourceIndex: event.sourceResourceIndex,
    targetResourceIndex: event.targetResourceIndex,
    targetResource: event.targetResource,
    newStartDate: event.newStartDate,
    newEndDate: event.newEndDate,
  }
  resourceDragConfirmVisible.value = true
}

// 确认资源分配
const confirmResourceDrag = () => {
  const { task, sourceResourceIndex, targetResourceIndex, targetResource, newStartDate, newEndDate } = resourceDragData.value
  if (!task || !targetResource) return

  // v1.9.0 跨行拖拽时需要更新任务的日期，使任务显示在正确的时间位置
  if (newStartDate && newEndDate) {
    task.startDate = newStartDate
    task.endDate = newEndDate
  }

  // 从源资源中移除任务
  const sourceResource = resources.value[sourceResourceIndex]
  if (sourceResource && sourceResource.tasks) {
    const taskIndex = sourceResource.tasks.findIndex(t => t.id === task.id)
    if (taskIndex !== -1) {
      sourceResource.tasks.splice(taskIndex, 1)
    }
  }

  // 添加任务到目标资源
  const destResource = resources.value[targetResourceIndex]
  if (destResource) {
    if (!destResource.tasks) {
      destResource.tasks = []
    }
    destResource.tasks.push(task)
  }

  // v1.9.7 Bug修复：同步更新task.resources数组，确保资源分配信息正确显示
  if (task.resources) {
    // 移除旧的资源分配
    const oldResourceIndex = task.resources.findIndex((r: any) => String(r.id) === String(sourceResource.id))
    if (oldResourceIndex !== -1) {
      const oldCapacity = task.resources[oldResourceIndex].capacity || 100
      task.resources.splice(oldResourceIndex, 1)

      // 添加新的资源分配（保持原有的capacity）
      task.resources.push({
        id: targetResource.id,
        name: targetResource.name,
        capacity: oldCapacity,
      })
    }
  }

  // 显示资源分配和日期更新信息
  const dateInfo = newStartDate && newEndDate ? `，日期已调整为 ${newStartDate} ~ ${newEndDate}` : ''
  showMessage(`任务 "${task.name}" 已分配给资源 "${targetResource.name}"${dateInfo}`, 'success')
  resourceDragConfirmVisible.value = false

  // 重置拖拽数据
  resourceDragData.value = {
    task: null,
    sourceResourceIndex: -1,
    targetResourceIndex: -1,
    targetResource: null,
    newStartDate: undefined,
    newEndDate: undefined
  }
}

// 取消资源分配
const cancelResourceDrag = () => {
  resourceDragConfirmVisible.value = false

  // v1.9.0 通知TaskBar清除临时数据，恢复到原始位置
  window.dispatchEvent(
    new CustomEvent('resource-drag-cancel', {
      detail: {
        taskId: resourceDragData.value.task?.id
      }
    })
  )

  // 重置拖拽数据
  resourceDragData.value = {
    task: null,
    sourceResourceIndex: -1,
    targetResourceIndex: -1,
    targetResource: null,
    newStartDate: undefined,
    newEndDate: undefined
  }
}

// v1.9.7 处理资源双击事件（仅在资源视图下触发）
// const handleResourceDoubleClick = (event: CustomEvent) => {
//   // 只在资源视图下处理
//   if (viewMode.value !== 'resource') {
//     return
//   }

//   const item = event.detail
//   // 检查是否为资源（Resource类型）
//   if (item && typeof item === 'object' && 'tasks' in item) {
//     clickedResource.value = item as Resource
//     resourceEditHintVisible.value = true
//   }
// }

// 关闭资源编辑提示dialog
// const closeResourceEditHint = () => {
//   resourceEditHintVisible.value = false
//   clickedResource.value = null

//   // 重置拖拽数据
//   resourceDragData.value = {
//     task: null,
//     sourceResourceIndex: -1,
//     targetResourceIndex: -1,
//     targetResource: null,
//     newStartDate: undefined,
//     newEndDate: undefined
//   }
// }

// v1.9.7 处理资源双击事件（仅在资源视图下触发）
// const handleResourceDoubleClick = (event: CustomEvent) => {
//   // 只在资源视图下处理
//   if (viewMode.value !== 'resource') {
//     return
//   }

//   const item = event.detail
//   // 检查是否为资源（Resource类型）
//   if (item && typeof item === 'object' && 'tasks' in item) {
//     clickedResource.value = item as Resource
//     resourceEditHintVisible.value = true
//   }
// }

// // 关闭资源编辑提示dialog
// const closeResourceEditHint = () => {
//   resourceEditHintVisible.value = false
//   clickedResource.value = null
// }

// 自定义右键菜单操作处理
const handleCustomMenuAction = (action: string, task: Task) => {
  showMessage(`自定义操作: ${action} - 任务: ${task.name}`, 'info', { closable: true })
  // 菜单会自动关闭（通过点击外部或滚动）
}
</script>

<template>
  <div class="app-container">
    <h1 class="page-title">
      <div class="title-left">
        <svg class="gantt-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="4" width="20" height="2" rx="1" fill="#409eff" />
          <rect x="2" y="8" width="12" height="2" rx="1" fill="#67c23a" />
          <rect x="2" y="12" width="16" height="2" rx="1" fill="#e6a23c" />
          <rect x="2" y="16" width="8" height="2" rx="1" fill="#f56c6c" />
          <rect x="2" y="20" width="14" height="2" rx="1" fill="#909399" />
          <circle cx="22" cy="5" r="1" fill="#409eff" />
          <circle cx="16" cy="9" r="1" fill="#67c23a" />
          <circle cx="20" cy="13" r="1" fill="#e6a23c" />
          <circle cx="12" cy="17" r="1" fill="#f56c6c" />
          <circle cx="18" cy="21" r="1" fill="#909399" />
        </svg>
        Jordium Gantt Vue3 Demo
        <span class="version-badge" style="cursor: pointer" @click="showVersionDrawer = true">{{
          packageInfo.version + ' ' + demoMessages.releaseNotes
        }}</span>
      </div>
      <!-- <div class="title-center">
        <a
          :href="demoMessages.giteeBadge?.url || 'https://gitee.com/activity/2025opensource?ident=IOUNZP'"
          target="_blank"
          rel="noopener noreferrer"
          class="gitee-award-badge"
        >
          {{ demoMessages.giteeBadge?.text || '🥇 Gitee 2025 Open Source Awards 👉 Thanks for Your Vote' }}
        </a>
      </div> -->
      <div class="title-right docs-links">
        <a href="https://www.npmjs.com/package/jordium-gantt-vue3">
          <img src="https://img.shields.io/npm/v/jordium-gantt-vue3?style=flat-square" alt="npm version">
        </a>
        <a href="https://www.npmjs.com/package/jordium-gantt-vue3">
          <img src="https://img.shields.io/npm/dt/jordium-gantt-vue3?style=flat-square" alt="npm total">
        </a>
        <span class="docs-divider"></span>
        <a href="#github-docs" class="doc-link github-link" @click="handleGithubDocsClick">
          <img class="doc-icon" src="./public/github.svg" alt="GitHub" />
        </a>
        <a href='https://github.com/nelson820125/jordium-gantt-vue3/stargazers'><img src='https://img.shields.io/github/stars/nelson820125/jordium-gantt-vue3?style=social' alt='star'></img></a>
        <a href='https://github.com/nelson820125/jordium-gantt-vue3/network/members'><img src='https://img.shields.io/github/forks/nelson820125/jordium-gantt-vue3?style=social' alt='fork'></img></a>
        <span class="docs-divider"></span>
        <a href="#gitee-docs" class="doc-link gitee-link" @click="handleGiteeDocsClick">
          <img class="doc-icon" src="./public/gitee.svg" alt="Gitee" />
        </a>
        <a href='https://gitee.com/jordium/jordium-gantt-vue3/stargazers'><img src='https://gitee.com/jordium/jordium-gantt-vue3/badge/star.svg?theme=dark' alt='star'></img></a>
        <a href='https://gitee.com/jordium/jordium-gantt-vue3/members'><img src='https://gitee.com/jordium/jordium-gantt-vue3/badge/fork.svg?theme=dark' alt='fork'></img></a>
      </div>
    </h1>
    <VersionHistoryDrawer :visible="showVersionDrawer" @close="showVersionDrawer = false" />

    <div class="data-source-panel" :class="{ collapsed: isDataSourcePanelCollapsed }">
      <div class="data-source-header" @click="toggleDataSourcePanel">
        <h3 class="config-title">
          <svg
            class="data-source-icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 4h16a2 2 0 0 1 2 2v2H2V6a2 2 0 0 1 2-2zm16 6H4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10zm-5 4h4v4h-4v-4z"
              fill="currentColor"
            />
          </svg>
          {{ t.dataSourceSwitch?.title }} - {{ t.dataSourceSwitch?.subtitle }}
        </h3>
        <button class="collapse-button" :class="{ collapsed: isDataSourcePanelCollapsed }">
          <svg
            class="collapse-icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              :d="isDataSourcePanelCollapsed ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
      <transition name="config-content">
        <div v-show="!isDataSourcePanelCollapsed" class="data-source-content">
          <div class="data-source-buttons">
            <button
              v-for="source in dataSourceOptions"
              :key="source.key"
              class="data-source-button"
              :class="{ active: currentDataSource === source.key }"
              :disabled="dataLoading && currentDataSource === source.key"
              @click="switchDataSource(source.key)"
            >
              <div class="ds-label-row">
                <span class="ds-label">{{ source.label }}</span>
                <span class="ds-file">{{ source.badge }}</span>
              </div>
              <div class="ds-desc">{{ source.description }}</div>
            </button>
            <span v-if="dataLoading" class="data-loading-hint">
              {{ t.dataSourceSwitch?.loading }}
            </span>
          </div>
        </div>
      </transition>
    </div>

    <!-- 配置说明面板 - 可折叠 -->
    <div class="config-panel" :class="{ collapsed: isConfigPanelCollapsed }">
      <div class="config-header" @click="toggleConfigPanel">
        <h3 class="config-title">
          <svg
            class="config-icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
              fill="currentColor"
            />
          </svg>
          {{ t.configDemo }}
        </h3>
        <button class="collapse-button" :class="{ collapsed: isConfigPanelCollapsed }">
          <svg
            class="collapse-icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              :d="isConfigPanelCollapsed ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <!-- 可折叠内容区域 -->
      <transition name="config-content">
        <div v-show="!isConfigPanelCollapsed" class="config-content">
          <!-- TaskList 配置区域 -->
          <div class="config-section">
            <div class="section-header" @click="toggleTaskListConfig">
              <div class="section-header-title">
                <svg
                  class="section-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" fill="currentColor" />
                </svg>
                {{ t.taskListConfig.title }}
              </div>
              <button
                class="section-collapse-button"
                :class="{ collapsed: isTaskListConfigCollapsed }"
              >
                <svg
                  class="collapse-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M7 10l5 5 5-5"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>

            <!-- TaskList 配置内容 -->
            <transition name="section-content">
              <div v-show="!isTaskListConfigCollapsed" class="section-content">
                <!-- 宽度配置 -->
            <div class="subsection">
              <h5 class="subsection-title">{{ t.taskListConfig.width.title }}</h5>

              <!-- 单位切换器 -->
              <div
                class="width-unit-toggle"
                style="margin-bottom: 12px; display: flex; align-items: center; gap: 16px"
              >
                <label class="taskbar-control">
                  <input v-model="widthUnit" type="radio" value="px" />
                  <span class="taskbar-label">
                    {{ t.taskListConfig.width.pixelsModel }}
                  </span>
                </label>
                <label class="taskbar-control">
                  <input v-model="widthUnit" type="radio" value="%" />
                  <span class="taskbar-label">{{ t.taskListConfig.width.percentageModel }}</span>
                </label>
              </div>

              <!-- 像素值配置 -->
              <div v-if="widthUnit === 'px'" class="width-controls">
                <div class="width-control">
                  <label class="width-label">{{ t.taskListConfig.width.defaultWidth }}:</label>
                  <input
                    v-model.number="taskListWidth.defaultWidth"
                    type="number"
                    :min="taskListWidth.minWidth"
                    :max="taskListWidth.maxWidth"
                    step="10"
                    class="width-input"
                  />
                  <span class="width-unit">px</span>
                </div>
                <div class="width-control">
                  <label class="width-label">{{ t.taskListConfig.width.minWidth }}:</label>
                  <input
                    v-model.number="taskListWidth.minWidth"
                    type="number"
                    min="280"
                    :max="taskListWidth.defaultWidth"
                    step="10"
                    class="width-input"
                  />
                  <span class="width-unit">px</span>
                </div>
                <div class="width-control">
                  <label class="width-label">{{ t.taskListConfig.width.maxWidth }}:</label>
                  <input
                    v-model.number="taskListWidth.maxWidth"
                    type="number"
                    :min="taskListWidth.defaultWidth"
                    max="2000"
                    step="10"
                    class="width-input"
                  />
                  <span class="width-unit">px</span>
                </div>
              </div>

              <!-- 百分比配置 -->
              <div v-else class="width-controls">
                <div class="width-control">
                  <label class="width-label">{{ t.taskListConfig.width.defaultWidth }}:</label>
                  <input
                    v-model.number="widthPercentage.defaultWidth"
                    type="number"
                    :min="widthPercentage.minWidth"
                    :max="widthPercentage.maxWidth"
                    step="1"
                    class="width-input"
                  />
                  <span class="width-unit">%</span>
                </div>
                <div class="width-control">
                  <label class="width-label">{{ t.taskListConfig.width.minWidth }}:</label>
                  <input
                    v-model.number="widthPercentage.minWidth"
                    type="number"
                    min="10"
                    :max="widthPercentage.defaultWidth"
                    step="1"
                    class="width-input"
                  />
                  <span class="width-unit">%</span>
                </div>
                <div class="width-control">
                  <label class="width-label">{{ t.taskListConfig.width.maxWidth }}:</label>
                  <input
                    v-model.number="widthPercentage.maxWidth"
                    type="number"
                    :min="widthPercentage.defaultWidth"
                    max="80"
                    step="1"
                    class="width-input"
                  />
                  <span class="width-unit">%</span>
                </div>
              </div>
            </div>

            <!-- 列配置 -->
            <div class="subsection">
              <!-- 渲染模式选择 -->
              <div class="render-mode-group" style="margin-bottom: 16px;">
                <h5 class="subsection-title">{{ t.taskListConfig.columns.renderMode }}</h5>
                <div
                  class="width-unit-toggle"
                  style="margin-bottom: 12px; display: flex; align-items: center; gap: 16px"
                >
                  <label class="taskbar-control">
                    <input v-model="taskListColumnRenderMode" type="radio" value="default" />
                    <span class="taskbar-label">
                      {{ t.taskListConfig.columns.renderModeDefault }}
                    </span>
                  </label>
                  <label class="taskbar-control">
                    <input v-model="taskListColumnRenderMode" type="radio" value="declarative" />
                    <span class="taskbar-label">{{ t.taskListConfig.columns.renderModeDeclarative }}</span>
                  </label>
                </div>
              </div>
              <h5 class="subsection-title">{{ t.taskListConfig.columns.title }}</h5>
              <div class="column-controls">
                <label v-for="column in availableColumns" :key="column.key" class="column-control">
                  <input
                    type="checkbox"
                    :checked="column.visible"
                    @change="toggleColumn(column.key, $event)"
                  />
                  <span class="column-label">{{ (t as any)[column.key] || column.label }}</span>
                </label>
              </div>
            </div>

            <!-- 展开/收起控制 -->
            <div class="subsection">
              <h5 class="subsection-title">{{ (t.taskListConfig as any).collapsible.title }}</h5>
              <!-- enableTaskListCollapsible 开关 -->
              <div class="column-control" style="margin-bottom: 10px;">
                <label class="taskbar-control">
                  <input v-model="enableTaskListCollapsible" type="checkbox" />
                  <span class="taskbar-label">{{ (t.taskListConfig as any).collapsible.enableCollapsible }}</span>
                </label>
                <div class="config-hint" style="margin-top: 4px; margin-left: 20px;">
                  {{ (t.taskListConfig as any).collapsible.enableCollapsibleHint }}
                </div>
              </div>
              <!-- taskListVisible 切换（仅当 enableTaskListCollapsible=true 时展示） -->
              <transition name="section-content">
                <div v-show="enableTaskListCollapsible">
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span class="width-label" style="flex-shrink: 0;">{{ (t.taskListConfig as any).collapsible.visible }}:</span>
                    <label class="taskbar-control">
                      <input v-model="taskListVisible" type="radio" :value="true" />
                      <span class="taskbar-label">{{ (t.taskListConfig as any).collapsible.visibleExpanded }}</span>
                    </label>
                    <label class="taskbar-control">
                      <input v-model="taskListVisible" type="radio" :value="false" />
                      <span class="taskbar-label">{{ (t.taskListConfig as any).collapsible.visibleCollapsed }}</span>
                    </label>
                  </div>
                  <div class="config-hint" style="margin-top: 4px;">
                    {{ (t.taskListConfig as any).collapsible.visibleHint }}
                  </div>
                </div>
              </transition>
            </div>
              </div>
            </transition>
          </div>

          <!-- TaskBar配置区域 -->
          <div class="config-section">
            <div class="section-header" @click="toggleTaskBarConfig">
              <div class="section-header-title">
                <svg
                  class="section-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="2" y="6" width="20" height="3" rx="1.5" fill="currentColor" />
                  <rect x="2" y="11" width="15" height="3" rx="1.5" fill="currentColor" />
                  <rect x="2" y="16" width="18" height="3" rx="1.5" fill="currentColor" />
                </svg>
                {{ t.taskBarConfig.title }}
              </div>
              <button
                class="section-collapse-button"
                :class="{ collapsed: isTaskBarConfigCollapsed }"
              >
                <svg
                  class="collapse-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M7 10l5 5 5-5"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>

            <!-- TaskBar 配置内容 -->
            <transition name="section-content">
              <div v-show="!isTaskBarConfigCollapsed" class="section-content">
                <!-- 显示选项 -->
                <div class="subsection">
                  <h5 class="subsection-title">{{ t.taskBarConfig.display.title }}</h5>
                  <div class="taskbar-controls">
                    <label class="taskbar-control">
                      <input v-model="taskBarOptions.showAvatar" type="checkbox" />
                      <span class="taskbar-label">{{ t.taskBarConfig.display.showAvatar }}</span>
                    </label>
                    <label class="taskbar-control">
                      <input v-model="taskBarOptions.showTitle" type="checkbox" />
                      <span class="taskbar-label">{{ t.taskBarConfig.display.showTitle }}</span>
                    </label>
                    <label class="taskbar-control">
                      <input v-model="taskBarOptions.showProgress" type="checkbox" />
                      <span class="taskbar-label">{{ t.taskBarConfig.display.showProgress }}</span>
                    </label>
                    <label class="taskbar-control">
                      <input v-model="showActualTaskBar" type="checkbox" />
                      <span class="taskbar-label">{{ taskBarConfigMessages.display?.showActualTaskBar }}</span>
                    </label>
                    <label class="taskbar-control">
                      <input v-model="useCustomTooltip" type="checkbox" />
                      <span class="taskbar-label">🎨 自定义 Tooltip（Slot 演示）</span>
                    </label>
                  </div>

                  <!-- 自定义任务状态背景色 -->
                  <div class="color-config-group">
                    <h6 class="color-config-title">{{ taskBarConfigMessages.colorConfig?.title }}</h6>
                    <div class="color-inputs-row">
                      <div class="color-input-item">
                        <label class="color-label">{{ taskBarConfigMessages.colorConfig?.pendingTask }}</label>
                        <input
                          v-model="pendingTaskBackgroundColor"
                          type="text"
                          class="color-input"
                          placeholder="#409eff"
                        />
                      </div>
                      <div class="color-input-item">
                        <label class="color-label">{{ taskBarConfigMessages.colorConfig?.delayTask }}</label>
                        <input
                          v-model="delayTaskBackgroundColor"
                          type="text"
                          class="color-input"
                          placeholder="#f56c6c"
                        />
                      </div>
                      <div class="color-input-item">
                        <label class="color-label">{{ taskBarConfigMessages.colorConfig?.completeTask }}</label>
                        <input
                          v-model="completeTaskBackgroundColor"
                          type="text"
                          class="color-input"
                          placeholder="#909399"
                        />
                      </div>
                      <div class="color-input-item">
                        <label class="color-label">{{ taskBarConfigMessages.colorConfig?.ongoingTask }}</label>
                        <input
                          v-model="ongoingTaskBackgroundColor"
                          type="text"
                          class="color-input"
                          placeholder="#e6a23c"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 防误触配置 -->
                <div class="subsection">
                  <h5 class="subsection-title">{{ t.taskBarConfig.mistouch.title }}</h5>
                  <div class="taskbar-advanced-controls">
                    <div class="control-row">
                      <label class="taskbar-control">
                        <input v-model="allowDragAndResize" type="checkbox" />
                        <span class="taskbar-label">
                          {{ t.taskBarConfig.mistouch.allowDragOnClick }}
                        </span>
                      </label>
                      <span class="control-hint">
                        {{ t.taskBarConfig.mistouch.allowDragOnClickHint }}
                      </span>
                    </div>
                    <div class="control-row">
                      <label class="taskbar-control">
                        <input v-model="enableTaskRowMove" type="checkbox" />
                        <span class="taskbar-label">
                          {{ taskBarConfigMessages.enableTaskRowMove?.label }}
                        </span>
                      </label>
                      <span class="control-hint">
                        {{ taskBarConfigMessages.enableTaskRowMove?.hint }}
                      </span>
                    </div>
                    <div class="control-row">
                      <label class="control-label">
                        {{ t.taskBarConfig.mistouch.dragThreshold }}:
                      </label>
                      <input
                        v-model.number="taskBarOptions.dragThreshold"
                        type="number"
                        min="0"
                        max="20"
                        step="1"
                        class="control-input"
                      />
                      <span class="control-hint">
                        {{ t.taskBarConfig.mistouch.dragThresholdHint }}
                      </span>
                    </div>
                    <div class="control-row">
                      <label class="control-label">
                        {{ t.taskBarConfig.mistouch.resizeHandleWidth }}:
                      </label>
                      <input
                        v-model.number="taskBarOptions.resizeHandleWidth"
                        type="number"
                        min="5"
                        max="15"
                        step="1"
                        class="control-input"
                      />
                      <span class="control-hint">
                        {{ t.taskBarConfig.mistouch.resizeHandleWidthHint }}
                      </span>
                    </div>
                    <div class="control-row">
                      <label class="taskbar-control">
                        <input v-model="taskBarOptions.enableDragDelay" type="checkbox" />
                        <span class="taskbar-label">
                          {{ t.taskBarConfig.mistouch.enableDragDelay }}
                        </span>
                      </label>
                      <span class="control-hint">
                        {{ t.taskBarConfig.mistouch.enableDragDelayHint }}
                      </span>
                    </div>
                    <div v-if="taskBarOptions.enableDragDelay" class="control-row control-indent">
                      <label class="control-label">
                        {{ t.taskBarConfig.mistouch.dragDelayTime }}:
                      </label>
                      <input
                        v-model.number="taskBarOptions.dragDelayTime"
                        type="number"
                        min="50"
                        max="500"
                        step="50"
                        class="control-input"
                      />
                      <span class="control-hint">
                        {{ t.taskBarConfig.mistouch.dragDelayTimeHint }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </div>

          <!-- Tool 设置区域 -->
          <div class="config-section">
            <div class="section-header" @click="toggleToolSettings">
              <div class="section-header-title">
                <svg
                  class="section-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                {{ ts.title || 'Tool 设置' }} / External Control API
              </div>
              <button
                class="section-collapse-button"
                :class="{ collapsed: isToolSettingsCollapsed }"
              >
                <svg
                  class="collapse-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M7 10l5 5 5-5"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>

            <!-- Tool 设置内容 -->
            <transition name="section-content">
              <div v-show="!isToolSettingsCollapsed" class="section-content">
                <!-- 状态显示面板 -->
                <div class="subsection">
                  <h5 class="subsection-title">📊 {{ ts.currentStatus?.title || 'Current Status' }}</h5>
                  <div class="status-panel">
                    <div class="status-item">
                      <span class="status-label">{{ ts.currentStatus?.fullscreen || 'Fullscreen' }}:</span>
                      <span class="status-value" :class="{ active: fullscreenStatus }">
                        {{ fullscreenStatus ? `✅ ${ts.currentStatus?.active || 'Active'}` : `❌ ${ts.currentStatus?.inactive || 'Inactive'}` }}
                      </span>
                    </div>
                    <div class="status-item">
                      <span class="status-label">{{ ts.currentStatus?.expandAll || 'Expand All' }}:</span>
                      <span class="status-value" :class="{ active: expandStatus }">
                        {{ expandStatus ? `✅ ${ts.currentStatus?.expanded || 'Expanded'}` : `❌ ${ts.currentStatus?.collapsed || 'Collapsed'}` }}
                      </span>
                    </div>
                    <div class="status-item">
                      <span class="status-label">{{ ts.currentStatus?.locale || 'Locale' }}:</span>
                      <span class="status-value active">{{ currentLocaleStatus }}</span>
                    </div>
                    <div class="status-item">
                      <span class="status-label">{{ ts.currentStatus?.timeScale || 'TimeScale' }}:</span>
                      <span class="status-value active">{{ currentScaleStatus }}</span>
                    </div>
                    <div class="status-item">
                      <span class="status-label">{{ ts.currentStatus?.theme || 'Theme' }}:</span>
                      <span class="status-value active">{{ currentThemeStatus }}</span>
                    </div>
                    <div class="status-item">
                      <span class="status-label">{{ ts.currentStatus?.controlMode || 'Control Mode' }}:</span>
                      <span class="status-value active" :style="{ color: controlMode === 'props' ? '#67c23a' : '#409eff' }">{{ controlMode === 'props' ? '📝 Props' : '⚡ Expose' }}</span>
                    </div>
                  </div>
                </div>

                <!-- 控制模式切换 -->
                <div class="subsection">
                  <h5 class="subsection-title">🎛️ {{ ts.controlMode?.title || 'Control Mode' }}</h5>
                  <div class="control-mode-switch">
                    <button
                      class="mode-button"
                      :class="{ active: controlMode === 'expose' }"
                      @click="controlMode = 'expose'"
                    >
                      ⚡ {{ ts.controlMode?.expose || 'Expose Methods' }}
                    </button>
                    <button
                      class="mode-button"
                      :class="{ active: controlMode === 'props' }"
                      @click="controlMode = 'props'"
                    >
                      📝 {{ ts.controlMode?.props || 'Props Control' }}
                    </button>
                  </div>
                  <p class="control-mode-hint">
                    {{ controlMode === 'expose' ? (ts.controlMode?.exposeHint || '通过 ref.value.method() 调用组件方法') : (ts.controlMode?.propsHint || '通过修改 Props 控制组件状态') }}
                  </p>
                </div>

                <!-- 工具栏配置 - showViewMode -->
                <div class="subsection">
                  <h5 class="subsection-title">🔀 {{ (ts as any).showViewMode?.title || 'Task/Resource 视图切换按钮组' }}</h5>
                  <div class="column-control">
                    <label class="taskbar-control">
                      <input v-model="toolbarConfig.showViewMode" type="checkbox" />
                      <span class="taskbar-label">{{ (ts as any).showViewMode?.label || '显示视图切换按钮组' }}</span>
                    </label>
                    <div class="config-hint" style="margin-top: 4px; margin-left: 20px;">
                      {{ (ts as any).showViewMode?.hint || '关闭后工具栏不展示 Task/Resource 切换控件' }}
                    </div>
                  </div>
                </div>

                <!-- Expose Methods 控制区域 -->
                <div v-show="controlMode === 'expose'" class="subsection">
                  <h4 class="section-subtitle">⚡ {{ ts.exposeMethods?.sectionTitle || 'Expose 方法控制' }}</h4>
                  <div class="tool-control-flow">
                    <!-- Fullscreen Control -->
                    <div class="tool-control-group">
                      <h5 class="subsection-title">🖥️ {{ ts.exposeMethods?.fullscreen?.title || 'Fullscreen' }}</h5>
                      <div class="tool-button-group">
                        <button class="tool-button" @click="handleEnterFullscreen">
                          {{ ts.exposeMethods?.fullscreen?.enter || 'Enter' }}
                        </button>
                        <button class="tool-button" @click="handleExitFullscreen">
                          {{ ts.exposeMethods?.fullscreen?.exit || 'Exit' }}
                        </button>
                        <button class="tool-button primary" @click="handleToggleFullscreen">
                          {{ ts.exposeMethods?.fullscreen?.toggle || 'Toggle' }}
                        </button>
                      </div>
                    </div>

                    <div class="tool-divider"></div>

                    <!-- Expand/Collapse Control -->
                    <div class="tool-control-group">
                      <h5 class="subsection-title">📂 {{ ts.exposeMethods?.expand?.title || 'Expand' }}</h5>
                      <div class="tool-button-group">
                        <button class="tool-button" @click="handleExpandAll">{{ ts.exposeMethods?.expand?.all || 'All' }}</button>
                        <button class="tool-button" @click="handleCollapseAll">{{ ts.exposeMethods?.expand?.none || 'None' }}</button>
                        <button class="tool-button primary" @click="handleToggleExpandAll">
                          {{ ts.exposeMethods?.expand?.toggle || 'Toggle' }}
                        </button>
                      </div>
                    </div>

                    <div class="tool-divider"></div>

                    <!-- TimeScale Control -->
                    <div class="tool-control-group">
                      <h5 class="subsection-title">📏 {{ ts.exposeMethods?.timeScale?.title || 'Scale' }}</h5>
                      <div class="tool-button-group">
                        <button class="tool-button" @click="handleSetTimeScale('hour')">
                          {{ ts.exposeMethods?.timeScale?.hour || 'Hour' }}
                        </button>
                        <button class="tool-button" @click="handleSetTimeScale('day')">
                          {{ ts.exposeMethods?.timeScale?.day || 'Day' }}
                        </button>
                        <button class="tool-button" @click="handleSetTimeScale('week')">
                          {{ ts.exposeMethods?.timeScale?.week || 'Week' }}
                        </button>
                        <button class="tool-button" @click="handleSetTimeScale('month')">
                          {{ ts.exposeMethods?.timeScale?.month || 'Month' }}
                        </button>
                        <button class="tool-button" @click="handleSetTimeScale('quarter')">
                          {{ ts.exposeMethods?.timeScale?.quarter || 'Quarter' }}
                        </button>
                        <button class="tool-button" @click="handleSetTimeScale('year')">
                          {{ ts.exposeMethods?.timeScale?.year || 'Year' }}
                        </button>
                        <span style="margin: 0 4px; color: var(--gantt-border-color, #dcdfe6);">|</span>
                        <button class="tool-button primary" @click="handleZoomIn">➕</button>
                        <button class="tool-button primary" @click="handleZoomOut">➖</button>
                      </div>
                    </div>

                    <div class="tool-divider"></div>

                    <!-- Locale Control -->
                    <div class="tool-control-group">
                      <h5 class="subsection-title">🌐 {{ ts.exposeMethods?.locale?.title || 'Locale' }}</h5>
                      <div class="tool-button-group">
                        <button
                          class="tool-button"
                          :class="{ primary: currentLocaleStatus === 'zh-CN' }"
                          @click="handleSetLocale('zh-CN')"
                        >
                          {{ ts.exposeMethods?.locale?.zhCN || '中文' }}
                        </button>
                        <button
                          class="tool-button"
                          :class="{ primary: currentLocaleStatus === 'en-US' }"
                          @click="handleSetLocale('en-US')"
                        >
                          {{ ts.exposeMethods?.locale?.enUS || 'EN' }}
                        </button>
                      </div>
                    </div>

                    <div class="tool-divider"></div>

                    <!-- Theme Control -->
                    <div class="tool-control-group">
                      <h5 class="subsection-title">🎨 {{ ts.exposeMethods?.theme?.title || 'Theme' }}</h5>
                      <div class="tool-button-group">
                        <button
                          class="tool-button"
                          :class="{ primary: currentThemeStatus === 'light' }"
                          @click="handleSetTheme('light')"
                        >
                          ☀️ {{ ts.exposeMethods?.theme?.light || 'Light' }}
                        </button>
                        <button
                          class="tool-button"
                          :class="{ primary: currentThemeStatus === 'dark' }"
                          @click="handleSetTheme('dark')"
                        >
                          🌙 {{ ts.exposeMethods?.theme?.dark || 'Dark' }}
                        </button>
                      </div>
                    </div>

                    <div class="tool-divider"></div>

                    <!-- Navigation Control -->
                    <div class="tool-control-group">
                      <h5 class="subsection-title">🧭 {{ ts.exposeMethods?.navigation?.title || 'Nav' }}</h5>
                      <div class="tool-button-group">
                        <button class="tool-button primary" @click="handleScrollToToday">
                          📅
                        </button>
                        <input
                          v-model="scrollToTaskId"
                          type="text"
                          class="tool-input"
                          :placeholder="ts.exposeMethods?.navigation?.taskIdPlaceholder || 'Task ID'"
                        />
                        <button class="tool-button" @click="handleScrollToTask">{{ ts.exposeMethods?.navigation?.go || 'Go' }}</button>
                        <input
                          v-model="scrollToDateValue"
                          type="date"
                          class="tool-input"
                        />
                        <button class="tool-button" @click="handleScrollToDate">{{ ts.exposeMethods?.navigation?.go || 'Go' }}</button>
                      </div>
                    </div>

                    <div class="tool-divider"></div>

                    <!-- TaskList 显隐 Expose 控制 -->
                    <div class="tool-control-group">
                      <h5 class="subsection-title">📋 {{ (ts as any).taskListControl?.sectionTitle || 'TaskList 显隐' }}</h5>
                      <div class="tool-button-group">
                        <button class="tool-button" @click="handleSetTaskListVisible(true)">
                          ✅ {{ (ts as any).taskListControl?.show || '展开' }}
                        </button>
                        <button class="tool-button" @click="handleSetTaskListVisible(false)">
                          ❌ {{ (ts as any).taskListControl?.hide || '收起' }}
                        </button>
                        <button class="tool-button primary" @click="handleToggleTaskList">
                          🔄 {{ (ts as any).taskListControl?.toggle || '切换(动画)' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Props 控制区域 -->
                <div v-show="controlMode === 'props'" class="subsection">
                  <h4 class="section-subtitle">📝 {{ ts.propsControl?.sectionTitle || 'Props 属性控制' }}</h4>
                  <div class="tool-control-flow">
                    <!-- Locale Props Control -->
                    <div class="tool-control-group">
                      <h5 class="subsection-title">🌐 {{ ts.propsControl?.locale?.title || 'Locale Prop' }}</h5>
                      <div class="tool-button-group">
                        <button
                          class="tool-button"
                          :class="{ primary: propsLocale === 'zh-CN' }"
                          @click="propsLocale = 'zh-CN'"
                        >
                          {{ ts.exposeMethods?.locale?.zhCN || '中文' }}
                        </button>
                        <button
                          class="tool-button"
                          :class="{ primary: propsLocale === 'en-US' }"
                          @click="propsLocale = 'en-US'"
                        >
                          {{ ts.exposeMethods?.locale?.enUS || 'EN' }}
                        </button>
                      </div>
                      <p class="prop-info">:locale="{{ propsLocale }}"</p>
                    </div>

                    <div class="tool-divider"></div>

                    <!-- Theme Props Control -->
                    <div class="tool-control-group">
                      <h5 class="subsection-title">🎨 {{ ts.propsControl?.theme?.title || 'Theme Prop' }}</h5>
                      <div class="tool-button-group">
                        <button
                          class="tool-button"
                          :class="{ primary: propsTheme === 'light' }"
                          @click="propsTheme = 'light'"
                        >
                          ☀️ {{ ts.exposeMethods?.theme?.light || 'Light' }}
                        </button>
                        <button
                          class="tool-button"
                          :class="{ primary: propsTheme === 'dark' }"
                          @click="propsTheme = 'dark'"
                        >
                          🌙 {{ ts.exposeMethods?.theme?.dark || 'Dark' }}
                        </button>
                      </div>
                      <p class="prop-info">:theme="{{ propsTheme }}"</p>
                    </div>

                    <div class="tool-divider"></div>

                    <!-- TimeScale Props Control -->
                    <div class="tool-control-group">
                      <h5 class="subsection-title">📅 {{ ts.propsControl?.timeScale?.title || 'TimeScale Prop' }}</h5>
                      <div class="tool-button-group">
                        <button
                          class="tool-button"
                          :class="{ primary: propsTimeScale === 'hour' }"
                          @click="propsTimeScale = 'hour'"
                        >
                          {{ ts.exposeMethods?.timeScale?.hour || 'Hour' }}
                        </button>
                        <button
                          class="tool-button"
                          :class="{ primary: propsTimeScale === 'day' }"
                          @click="propsTimeScale = 'day'"
                        >
                          {{ ts.exposeMethods?.timeScale?.day || 'Day' }}
                        </button>
                        <button
                          class="tool-button"
                          :class="{ primary: propsTimeScale === 'week' }"
                          @click="propsTimeScale = 'week'"
                        >
                          {{ ts.exposeMethods?.timeScale?.week || 'Week' }}
                        </button>
                        <button
                          class="tool-button"
                          :class="{ primary: propsTimeScale === 'month' }"
                          @click="propsTimeScale = 'month'"
                        >
                          {{ ts.exposeMethods?.timeScale?.month || 'Month' }}
                        </button>
                        <button
                          class="tool-button"
                          :class="{ primary: propsTimeScale === 'quarter' }"
                          @click="propsTimeScale = 'quarter'"
                        >
                          {{ ts.exposeMethods?.timeScale?.quarter || 'Quarter' }}
                        </button>
                        <button
                          class="tool-button"
                          :class="{ primary: propsTimeScale === 'year' }"
                          @click="propsTimeScale = 'year'"
                        >
                          {{ ts.exposeMethods?.timeScale?.year || 'Year' }}
                        </button>
                      </div>
                      <p class="prop-info">:time-scale="{{ propsTimeScale }}"</p>
                    </div>

                    <div class="tool-divider"></div>

                    <!-- Fullscreen Props Control -->
                    <div class="tool-control-group">
                      <h5 class="subsection-title">🖥️ {{ ts.propsControl?.fullscreen?.title || 'Fullscreen Prop' }}</h5>
                      <div class="tool-button-group">
                        <button
                          class="tool-button"
                          :class="{ primary: propsFullscreen === true }"
                          @click="propsFullscreen = true"
                        >
                          ✅ {{ ts.propsControl?.fullscreen?.true || 'True' }}
                        </button>
                        <button
                          class="tool-button"
                          :class="{ primary: propsFullscreen === false }"
                          @click="propsFullscreen = false"
                        >
                          ❌ {{ ts.propsControl?.fullscreen?.false || 'False' }}
                        </button>
                      </div>
                      <p class="prop-info">:fullscreen="{{ propsFullscreen }}"</p>
                    </div>

                    <div class="tool-divider"></div>

                    <!-- ExpandAll Props Control -->
                    <div class="tool-control-group">
                      <h5 class="subsection-title">📂 {{ ts.propsControl?.expandAll?.title || 'ExpandAll Prop' }}</h5>
                      <div class="tool-button-group">
                        <button
                          class="tool-button"
                          :class="{ primary: propsExpandAll === true }"
                          @click="propsExpandAll = true"
                        >
                          ✅ {{ ts.propsControl?.expandAll?.true || 'True' }}
                        </button>
                        <button
                          class="tool-button"
                          :class="{ primary: propsExpandAll === false }"
                          @click="propsExpandAll = false"
                        >
                          ❌ {{ ts.propsControl?.expandAll?.false || 'False' }}
                        </button>
                      </div>
                      <p class="prop-info">:expand-all="{{ propsExpandAll }}"</p>
                    </div>

                    <div class="tool-divider"></div>

                    <!-- TaskList 控制 Props -->
                    <div class="tool-control-group">
                      <h5 class="subsection-title">📋 {{ (ts as any).taskListControl?.sectionTitle || 'TaskList 可折叠控制' }}</h5>
                      <!-- enableTaskListCollapsible -->
                      <div class="tool-button-group">
                          <button
                            class="tool-button"
                            :class="{ primary: enableTaskListCollapsible === true }"
                            @click="enableTaskListCollapsible = true"
                          >
                            ✅ {{ (ts as any).taskListControl?.true || '开启' }}
                          </button>
                          <button
                            class="tool-button"
                            :class="{ primary: enableTaskListCollapsible === false }"
                            @click="enableTaskListCollapsible = false"
                          >
                            ❌ {{ (ts as any).taskListControl?.false || '关闭' }}
                          </button>
                      </div>
                      <p class="prop-info">:enable-task-list-collapsible="{{ enableTaskListCollapsible }}"</p>
                    </div>

                    <div class="tool-divider"></div>

                    <div class="tool-control-group">
                      <h5 class="subsection-title">📋 {{ (ts as any).taskListControl?.sectionTitle1 || 'TaskList 显隐控制' }}</h5>
                      <!-- taskListVisible -->
                      <div class="tool-button-group">
                        <button
                          class="tool-button"
                          :class="{ primary: taskListVisible === true }"
                          :disabled="!enableTaskListCollapsible"
                          @click="taskListVisible = true"
                        >
                          ✅ {{ (ts as any).taskListControl?.show || '展开' }}
                        </button>
                        <button
                          class="tool-button"
                          :class="{ primary: taskListVisible === false }"
                          :disabled="!enableTaskListCollapsible"
                          @click="taskListVisible = false"
                        >
                          ❌ {{ (ts as any).taskListControl?.hide || '收起' }}
                        </button>
                      </div>
                      <p class="prop-info">:task-list-visible="{{ taskListVisible }}"</p>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </transition>
    </div>

    <div class="gantt-wrapper">
      <GanttChart
        ref="gantt"
        :tasks="tasks"
        :milestones="milestones"
        :resources="resources"
        :view-mode="viewMode"
        :resource-list-config="resourceListConfig"
        :locale="controlMode === 'props' ? propsLocale : undefined"
        :time-scale="controlMode === 'props' ? propsTimeScale : undefined"
        :fullscreen="controlMode === 'props' ? propsFullscreen : undefined"
        :expand-all="controlMode === 'props' ? propsExpandAll : undefined"
        :toolbar-config="toolbarConfig"
        :task-list-config="taskListConfig"
        :enable-task-list-collapsible="enableTaskListCollapsible"
        :task-list-visible="enableTaskListCollapsible ? taskListVisible : undefined"
        :task-bar-config="taskBarConfig"
        :working-hours="workingHoursConfig"
        :use-default-milestone-dialog="true"
        :allow-drag-and-resize="allowDragAndResize"
        :enable-task-row-move="enableTaskRowMove"
        :assignee-options="assigneeOptions"
        :on-export-csv="handleCustomCsvExport"
        :on-language-change="handleLanguageChange"
        :on-theme-change="handleThemeChange"
        :task-list-column-render-mode="taskListColumnRenderMode"
        :show-actual-taskbar="showActualTaskBar"
        :enable-task-bar-tooltip="true"
        :pending-task-background-color="pendingTaskBackgroundColor"
        :delay-task-background-color="delayTaskBackgroundColor"
        :complete-task-background-color="completeTaskBackgroundColor"
        :ongoing-task-background-color="ongoingTaskBackgroundColor"
        :use-default-drawer="useDefaultDrawer"
        :enable-task-drawer-auto-close="false"
        @milestone-saved="handleMilestoneSaved"
        @milestone-deleted="handleMilestoneDeleted"
        @milestone-icon-changed="handleMilestoneIconChanged"
        @add-task="handleAddTask"
        @taskbar-drag-end="handleTaskbarDragOrResizeEnd"
        @taskbar-resize-end="handleTaskbarDragOrResizeEnd"
        @milestone-drag-end="handleMilestoneDragEnd"
        @task-click="handleTaskClick"
        @task-double-click="handleTaskDoubleClick"
        @view-mode-changed="handleViewModeChanged"
        @edit-task="task => showMessage(`进入任务编辑：${task.name}`)"
        @close="() => showMessage('已关闭任务编辑', 'info')"
        @timer-started="onTimerStarted"
        @timer-stopped="onTimerStopped"
        @predecessor-added="
          e =>
            showMessage(`Demo 任务[${e.targetTask.name}] 添加前置任务 [${e.newTask.name}]`, 'info')
        "
        @successor-added="
          e =>
            showMessage(`Demo 任务[${e.targetTask.name}] 添加后置任务 [${e.newTask.name}]`, 'info')
        "
        @task-deleted="handleTaskDeleteEvent"
        @task-added="handleTaskAddEvent"
        @task-updated="handleTaskUpdateEvent"
        @task-row-moved="handleTaskRowMoved"
        @resource-drag-end="handleResourceDragEnd"
      >
        <!-- 自定义任务名称内容 (TaskRow 和 TaskBar) -->
        <template #custom-task-content="item">
          <HtmlContent
            :item="taskDebug(item)"
            :task="item.task"
            :type="item.type"
            :style="item.dynamicStyles"
          />
        </template>

        <!-- 列级 Slot 示例：'name'列的渲染 -->
         <template #header-name>
          <div style="display: flex; align-items: center; gap: 6px;">
            <img src="https://foruda.gitee.com/avatar/1764902889653058860/565633_nelson820125_1764902889.png!avatar200" width="32" height="32" style="border-radius: 50%;" />
            <strong style="font-size: 14px;">{{ viewMode === 'task' ? t.taskName : t.resourceName }}</strong>
          </div>
         </template>
         <template #column-name="{ task, column, value }">
          <div style="display: flex; align-items: center; gap: 6px;">
            <img src="https://foruda.gitee.com/avatar/1764902889653058860/565633_nelson820125_1764902889.png!avatar200" width="20" height="20" style="border-radius: 50%;" />
            <span v-html="value"></span>
            <span
              v-if="task.priority"
              style="
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
                color: white;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 11px;
                font-weight: 600;
                white-space: nowrap;
              "
            >
              P-{{ task.priority }}
            </span>
          </div>
        </template>

        <!-- 列级 Slot 示例：自定义 'custom' 列的渲染 -->
        <template #column-custom="{ task, column, value }">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span
              v-if="typeof value === 'number'"
              style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
              "
            >
              💰 {{ value.toLocaleString() }}
            </span>
            <span
              v-else-if="typeof value === 'string'"
              style="
                background: #e8f5e9;
                color: #2e7d32;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 12px;
                border: 1px solid #81c784;
              "
            >
              📝 {{ value }}
            </span>
            <span v-else style="color: #999;">-</span>
          </div>
        </template>

        <!-- 使用 TaskListColumn 组件自定义列 声明式模式 -->
        <TaskListColumn prop="name" :label="viewMode === 'task' ? t.taskName : t.resourceName" width="300" align="center">
          <template #header>
            <img src="https://foruda.gitee.com/avatar/1764902889653058860/565633_nelson820125_1764902889.png!avatar200" width="32" height="32" style="border-radius: 50%;" />
            <strong style="font-size: 14px;">{{ viewMode === 'task' ? t.taskName : t.resourceName }}</strong>
          </template>
          <template #default="scope">
            <div style="display: flex; align-items: center; gap: 6px;">
              <!-- 里程碑分组图标 - 使用菱形图标 -->
              <svg
                v-if="scope.row.type === 'milestone-group'"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="milestone-group-icon"
              >
                <polygon points="12,2 22,12 12,22 2,12" />
              </svg>
              <img
                v-if="scope.row.avatar && scope.row.type === 'task'"
                :src="scope.row.avatar"
                width="20"
                height="20"
                style="border-radius: 50%;"
              />
              <span v-html="scope.row.name"></span>
            </div>
          </template>
        </TaskListColumn>
        <TaskListColumn prop="startDate" :label="t.startDate" width="200" align="center" />
        <TaskListColumn prop="endDate" :label="t.endDate" width="200" align="center" />

        <!-- 使用声明式的 TaskListContextMenu 组件 - 推荐方式 -->
        <TaskListContextMenu :task-type="['task']">
          <template #default="scope">
            <div class="custom-menu">
              <div class="custom-menu-header">声明式 TaskList 菜单</div>
              <div class="custom-menu-item" @click="handleCustomMenuAction('extend', scope.row)">
                ➡️ 延长任务
              </div>
              <div class="custom-menu-item" @click="handleCustomMenuAction('move', scope.row)">
                📅 移动任务
              </div>
              <div class="custom-menu-divider"></div>
              <div class="custom-menu-item" @click="handleCustomMenuAction('copy', scope.row)">
                📄 复制任务
              </div>
            </div>
          </template>
        </TaskListContextMenu>

        <!-- 使用声明式的 TaskBarContextMenu 组件 - 推荐方式 -->
        <!-- <TaskBarContextMenu>
          <template #default="scope">
            <div class="custom-menu">
              <div class="custom-menu-header">声明式 TaskBar 菜单</div>
              <div class="custom-menu-item" @click="handleCustomMenuAction('extend', scope.row)">
                ➡️ 延长任务
              </div>
              <div class="custom-menu-item" @click="handleCustomMenuAction('move', scope.row)">
                📅 移动任务
              </div>
              <div class="custom-menu-divider"></div>
              <div class="custom-menu-item" @click="handleCustomMenuAction('copy', scope.row)">
                📄 复制任务
              </div>
            </div>
          </template>
        </TaskBarContextMenu> -->

        <!-- ✨ #taskbar-tooltip Slot 示例：自定义悬浮 Tooltip -->
        <!-- 此 slot 完全替换内置 Tooltip，通过 useCustomTooltip 开关切换两种样式 -->
        <template #taskbar-tooltip="{ task, taskStatus, resourcePercent }">
          <!-- 默认复刻样式（slot 接管，保持内置风格） -->
          <template v-if="!useCustomTooltip">
            <div
              :style="{
                position: 'absolute',
                left: '50%',
                bottom: '-5px',
                transform: 'translateX(-50%)',
                width: '0',
                height: '0',
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: `6px solid ${taskStatus.color}`,
                borderBottom: '0',
              }"
            />
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 4px;">
                {{ task.name }}
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; font-size: 11px;">
                <span style="opacity: 0.9;">📅 开始：</span>
                <span style="font-weight: 500;">{{ task.startDate?.slice(0, 10) ?? '-' }}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; font-size: 11px;">
                <span style="opacity: 0.9;">🏁 结束：</span>
                <span style="font-weight: 500;">{{ task.endDate?.slice(0, 10) ?? '-' }}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; font-size: 11px;">
                <span style="opacity: 0.9;">📊 进度：</span>
                <span style="font-weight: 500;">{{ task.progress ?? 0 }}%</span>
              </div>
              <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                <span
                  style="
                    background: rgba(255,255,255,0.25);
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 10px;
                    font-weight: 600;
                    border: 1px solid rgba(255,255,255,0.4);
                  "
                >
                  {{ taskStatus.label }}
                </span>
                <span style="opacity: 0.7; font-size: 10px; margin-left: 4px;">● Slot 接管（默认风格）</span>
              </div>
            </div>
          </template>

          <!-- 🎨 自定义富文本样式（完全重设计） -->
          <template v-else>
            <div
              style="
                min-width: 230px;
                margin: -10px -14px;
                border-radius: 6px;
                overflow: hidden;
                background: #fff;
                color: #333;
                box-shadow: 0 8px 24px rgba(0,0,0,0.18);
              "
            >
              <!-- 彩色顶栏 -->
              <div
                :style="{
                  background: `linear-gradient(135deg, ${taskStatus.color} 0%, ${taskStatus.color}cc 100%)`,
                  padding: '12px 14px 10px',
                  color: 'white',
                }"
              >
                <div style="display: flex; align-items: center; gap: 8px;">
                  <img
                    v-if="task.avatar && typeof task.avatar === 'string'"
                    :src="task.avatar"
                    width="28"
                    height="28"
                    style="border-radius: 50%; border: 2px solid rgba(255,255,255,0.6); flex-shrink: 0;"
                  />
                  <div
                    v-else
                    :style="{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: 'rgba(255,255,255,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', flexShrink: '0',
                    }"
                  >📋</div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 700; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{{ task.name }}</div>
                    <div style="font-size: 10px; opacity: 0.85; margin-top: 2px;">{{ task.assigneeName ?? '未分配' }}</div>
                  </div>
                  <span
                    style="
                      background: rgba(255,255,255,0.25);
                      padding: 2px 8px;
                      border-radius: 10px;
                      font-size: 10px;
                      font-weight: 600;
                      white-space: nowrap;
                      border: 1px solid rgba(255,255,255,0.5);
                    "
                  >{{ taskStatus.label }}</span>
                </div>
              </div>

              <!-- 主体内容 -->
              <div style="padding: 10px 14px; display: flex; flex-direction: column; gap: 8px;">
                <!-- 进度条 -->
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px; color: #555; margin-bottom: 4px;">
                    <span>完成进度</span>
                    <span style="font-weight: 600;" :style="{ color: taskStatus.color }">{{ task.progress ?? 0 }}%</span>
                  </div>
                  <div style="height: 6px; background: #eee; border-radius: 3px; overflow: hidden;">
                    <div
                      :style="{
                        height: '100%',
                        width: `${task.progress ?? 0}%`,
                        background: `linear-gradient(90deg, ${taskStatus.color} 0%, ${taskStatus.color}99 100%)`,
                        borderRadius: '3px',
                        transition: 'width 0.3s',
                      }"
                    />
                  </div>
                </div>

                <!-- 资源利用率（资源视图时） -->
                <div v-if="resourcePercent !== 100">
                  <div style="display: flex; justify-content: space-between; font-size: 11px; color: #555; margin-bottom: 4px;">
                    <span>资源占用</span>
                    <span
                      style="font-weight: 600;"
                      :style="{ color: resourcePercent > 100 ? '#f56c6c' : '#67c23a' }"
                    >{{ resourcePercent }}%</span>
                  </div>
                  <div style="height: 6px; background: #eee; border-radius: 3px; overflow: hidden;">
                    <div
                      :style="{
                        height: '100%',
                        width: `${Math.min(resourcePercent, 100)}%`,
                        background: resourcePercent > 100 ? '#f56c6c' : '#67c23a',
                        borderRadius: '3px',
                      }"
                    />
                  </div>
                </div>

                <!-- 日期信息 -->
                <div style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                  <div style="display: flex; justify-content: space-between; color: #666;">
                    <span>📅 计划开始</span>
                    <span style="color: #333; font-weight: 500;">{{ task.startDate?.slice(0, 10) ?? '-' }}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; color: #666;">
                    <span>🏁 计划结束</span>
                    <span style="color: #333; font-weight: 500;">{{ task.endDate?.slice(0, 10) ?? '-' }}</span>
                  </div>
                  <template v-if="task.actualStartDate || task.actualEndDate">
                    <div style="border-top: 1px solid #f0f0f0; margin: 2px 0;"/>
                    <div v-if="task.actualStartDate" style="display: flex; justify-content: space-between; color: #888;">
                      <span>✅ 实际开始</span>
                      <span style="color: #555; font-weight: 500;">{{ task.actualStartDate?.slice(0, 10) }}</span>
                    </div>
                    <div v-if="task.actualEndDate" style="display: flex; justify-content: space-between; color: #888;">
                      <span>✅ 实际结束</span>
                      <span style="color: #555; font-weight: 500;">{{ task.actualEndDate?.slice(0, 10) }}</span>
                    </div>
                  </template>
                </div>

                <!-- 底部标签 -->
                <div
                  style="
                    margin-top: 2px;
                    padding-top: 6px;
                    border-top: 1px solid #f0f0f0;
                    font-size: 10px;
                    color: #999;
                    text-align: right;
                  "
                >✨ 自定义 Slot Tooltip</div>
              </div>
            </div>
          </template>
        </template>
      </GanttChart>
    </div>

    <div class="license-info">
      <span>MIT License @ 2025 JORDIUM.COM</span>
      <a href="https://opensource.org/licenses/MIT">
        <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License">
      </a>
      <a href="https://vuejs.org/">
        <img src="https://img.shields.io/badge/Vue.js->=3.5.13-4FC08D?style=flat-square&logo=vue.js&logoColor=white" alt="Vue.js">
      </a>
      <a href="https://www.typescriptlang.org/">
        <img src="https://img.shields.io/badge/TypeScript->=5.8.3-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
      </a>
      <a href="https://nodejs.org/">
        <img src="https://img.shields.io/badge/Node.js->=16.0.0-339933?style=flat-square&logo=node.js&logoColor=white" alt="Nodejs">
      </a>
    </div>

    <!-- MilestoneDialog用于新建/编辑里程碑 -->
    <MilestoneDialog
      :visible="showMilestoneDialog"
      :milestone="currentMilestone"
      @update:visible="showMilestoneDialog = $event"
      @save="handleMilestoneSaveFromDialog"
      @delete="handleMilestoneDeleted"
      @close="showMilestoneDialog = false"
    />

    <!-- Task Click Dialog - 显示任务详细信息 -->
    <div v-if="showTaskClickDialog" class="task-click-dialog-overlay" @click="closeTaskClickDialog">
      <div class="task-click-dialog" @click.stop>
        <div class="task-click-dialog-header">
          <h3>Task</h3>
          <button class="close-button" @click="closeTaskClickDialog">×</button>
        </div>
        <div class="task-click-dialog-content">
          <div v-if="clickedTask" class="task-properties">
            <div
              v-for="[key, value] in Object.entries(clickedTask)"
              :key="key"
              class="property-row"
            >
              <span class="property-key">{{ key }}:</span>
              <span class="property-value">{{ formatPropertyValue(value) }}</span>
            </div>
          </div>
        </div>
        <div class="task-click-dialog-footer">
          <button class="confirm-button" @click="closeTaskClickDialog">确认</button>
        </div>
      </div>
    </div>

    <!-- v1.9.7 资源编辑提示对话框 -->
    <div v-if="resourceEditHintVisible" class="modal-overlay" @click.self="closeResourceEditHint">
      <div class="resource-drag-dialog">
        <div class="resource-drag-dialog-header">
          <h3>{{ demoMessages.resourceEditHint?.title || '资源编辑提示' }}</h3>
        </div>
        <div class="resource-drag-dialog-body">
          <p style="white-space: pre-line; line-height: 1.6;">
            {{ (demoMessages.resourceEditHint?.message || '').replace('{resourceName}', clickedResource?.name || '') }}
          </p>
        </div>
        <div class="resource-drag-dialog-footer">
          <button class="confirm-button" @click="closeResourceEditHint">
            {{ demoMessages.resourceEditHint?.confirmText || '知道了' }}
          </button>
        </div>
      </div>
    </div>

    <!-- v1.9.0 资源拖拽确认对话框 -->
    <div v-if="resourceDragConfirmVisible" class="modal-overlay" @click.self="cancelResourceDrag">
      <div class="resource-drag-dialog">
        <div class="resource-drag-dialog-header">
          <h3>确认资源分配</h3>
        </div>
        <div class="resource-drag-dialog-body">
          <p v-if="resourceDragData.task && resourceDragData.targetResource">
            将任务 <strong>"{{ resourceDragData.task.name }}"</strong> 分配给资源
            <strong>"{{ resourceDragData.targetResource.name }}"</strong>？
          </p>
          <div v-if="resourceDragData.task" class="task-info">
            <p>原开始日期：{{ resourceDragData.task.startDate }}</p>
            <p>原结束日期：{{ resourceDragData.task.endDate }}</p>
            <template v-if="resourceDragData.newStartDate && resourceDragData.newEndDate">
              <p style="color: #409eff; font-weight: 600; margin-top: 8px;">新开始日期：{{ resourceDragData.newStartDate }}</p>
              <p style="color: #409eff; font-weight: 600;">新结束日期：{{ resourceDragData.newEndDate }}</p>
            </template>
          </div>
        </div>
        <div class="resource-drag-dialog-footer">
          <button class="cancel-button" @click="cancelResourceDrag">取消</button>
          <button class="confirm-button" @click="confirmResourceDrag">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 蒙版层 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

/* 资源拖拽确认对话框 */
.resource-drag-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 400px;
  max-width: 500px;
  overflow: hidden;
}

.resource-drag-dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ed;
  background: #f5f7fa;
}

.resource-drag-dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.resource-drag-dialog-body {
  padding: 20px;
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
}

.resource-drag-dialog-body p {
  margin: 0 0 12px 0;
}

.resource-drag-dialog-body strong {
  color: #303133;
  font-weight: 600;
}

.resource-drag-dialog-body .task-info {
  margin-top: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.resource-drag-dialog-body .task-info p {
  margin: 4px 0;
  font-size: 13px;
}

.resource-drag-dialog-footer {
  padding: 12px 20px;
  border-top: 1px solid #e4e7ed;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.resource-drag-dialog-footer button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-button {
  background: #fff;
  border: 1px solid #dcdfe6;
  color: #606266;
}

.cancel-button:hover {
  background: #f5f7fa;
  border-color: #c0c4cc;
}

.confirm-button {
  background: #409eff;
  color: white;
}

.confirm-button:hover {
  background: #66b1ff;
}

.app-container {
  width: 100%;
  min-width: 1200px;
  min-height: 100vh;
  padding: 0;
  box-sizing: border-box;
  background: var(--gantt-bg-secondary, #f0f2f5);
  display: flex;
  flex-direction: column;
}

.data-source-panel {
  background: var(--gantt-bg-primary, #ffffff);
  border: 1px solid var(--gantt-border-color, #e4e7ed);
  border-radius: 8px;
  padding: 16px;
  margin: 20px 10px 20px 10px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.data-source-panel.collapsed {
  padding-bottom: 12px;
}

.data-source-header {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-size: 14px;
  justify-content: space-between;
}

.data-source-icon {
  width: 16px;
  height: 16px;
  color: var(--gantt-primary-color, #409eff);
}

.data-source-content {
  padding-top: 4px;
}

.data-source-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.data-source-button {
  flex: 1 1 220px;
  min-width: 200px;
  border: 1px solid var(--gantt-border-color, #e4e7ed);
  border-radius: 8px;
  padding: 12px 16px;
  background: var(--gantt-bg-secondary, #f9fafc);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.data-source-button:hover {
  border-color: var(--gantt-primary-color, #409eff);
  box-shadow: 0 2px 10px rgba(64, 158, 255, 0.15);
}

.data-source-button.active {
  border-color: var(--gantt-primary-color, #409eff);
  background: rgba(64, 158, 255, 0.08);
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.25);
}

.data-source-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.ds-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.ds-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--gantt-text-primary, #333);
}

.ds-file {
  font-size: 12px;
  color: var(--gantt-text-muted, #909399);
}

.ds-desc {
  font-size: 13px;
  color: var(--gantt-text-secondary, #666);
  line-height: 1.4;
}

.data-loading-hint {
  font-size: 13px;
  color: var(--gantt-primary-color, #409eff);
  font-weight: 500;
}

/* TaskList列配置面板样式 - 可折叠 */
.config-panel {
  background: var(--gantt-bg-primary, #ffffff);
  border: 1px solid var(--gantt-border-color, #e4e7ed);
  border-radius: 8px;
  margin: 0 10px 20px 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  overflow: visible;
}

.config-panel:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.config-panel.collapsed {
  border-radius: 8px;
}

.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid var(--gantt-border-color, #e4e7ed);
  gap: 12px;
}

.config-panel.collapsed .config-header {
  border-bottom: none;
}

.config-header:hover {
  background-color: var(--gantt-hover-bg, #f8f9fa);
}

.config-content {
  padding: 0 16px 16px;
  overflow: visible;
}

.collapse-button {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: var(--gantt-text-secondary, #666);
}

.collapse-button.collapsed {
  transform: rotate(90deg);
}

.collapse-button:hover {
  background-color: var(--gantt-hover-bg, #e8f4fd);
  color: var(--gantt-primary-color, #409eff);
}

.collapse-icon {
  width: 20px;
  height: 20px;
  transition: transform 0.3s ease;
}

/* 过渡动画 */
.config-content-enter-active,
.config-content-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.config-content-enter-from,
.config-content-leave-to {
  height: 0;
  opacity: 0;
}

.config-content-enter-to,
.config-content-leave-from {
  opacity: 1;
}

.config-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--gantt-text-primary, #333);
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.config-icon {
  width: 20px;
  height: 20px;
  color: var(--gantt-primary-color, #409eff);
}

.config-section {
  margin-bottom: 16px;
}

/* 折叠区域样式 */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 8px 0;
  margin-bottom: 16px;
  background-color: transparent;
  border-bottom: 2px solid var(--gantt-primary-color, #409eff);
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
}

.section-header:hover {
  border-bottom-color: var(--gantt-primary-color-light, #66b3ff);
}

.section-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--gantt-text-primary, #333);
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.section-collapse-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gantt-text-secondary, #666);
  transition: transform 0.3s ease, color 0.2s ease;
}

.section-collapse-button:hover {
  color: var(--gantt-primary-color, #409eff);
}

.section-collapse-button.collapsed {
  transform: rotate(-90deg);
}

.section-content-enter-active,
.section-content-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.section-content-enter-from,
.section-content-leave-to {
  max-height: 0;
  opacity: 0;
  margin-bottom: 0;
}

.section-content-enter-to,
.section-content-leave-from {
  max-height: 2000px;
  opacity: 1;
  margin-bottom: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--gantt-text-primary, #333);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--gantt-primary-color, #409eff);
}

.section-icon {
  width: 18px;
  height: 18px;
  color: var(--gantt-primary-color, #409eff);
}

/* 子区域样式 */
.subsection {
  margin-bottom: 12px;
  padding-left: 12px;
  border-left: 2px solid var(--gantt-border-color, #e4e7ed);
}

.subsection-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--gantt-text-secondary, #666);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-subtitle {
  font-size: 15px;
  font-weight: 700;
  color: var(--gantt-primary-color, #409eff);
  margin: 12px 0;
  padding: 8px 12px;
  background: var(--gantt-primary-light, #ecf5ff);
  border-radius: 6px;
  border-left: 4px solid var(--gantt-primary-color, #409eff);
  display: flex;
  align-items: center;
  gap: 8px;
}

.subsection-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--gantt-primary-color, #409eff);
}

.width-controls {
  display: flex;
  flex-direction: row;
  gap: 12px;
}

.width-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.width-label {
  flex: 0 0 100px;
  font-size: 13px;
  color: var(--text-secondary);
}

.width-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-background, #fff);
  color: var(--text-primary);
  font-size: 13px;
  max-width: 100px;
}

.width-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.width-unit {
  flex: 0 0 20px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.column-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.column-control {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.2s ease;
  background: var(--gantt-bg-secondary, #f8f9fa);
  border: 1px solid transparent;
}

.column-control:hover {
  background: var(--gantt-hover-bg, #e8f4fd);
  border-color: var(--gantt-primary-color, #409eff);
}

.column-control input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--gantt-primary-color, #409eff);
}

.column-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--gantt-text-primary, #333);
  user-select: none;
  transition: color 0.2s ease;
}

.column-control:hover .column-label {
  color: var(--gantt-primary-color, #409eff);
}

/* TaskBar配置样式 */
.taskbar-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
}

.taskbar-control {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.2s ease;
  background: var(--gantt-bg-secondary, #f8f9fa);
  border: 1px solid transparent;
}

.taskbar-control:hover {
  background: var(--gantt-hover-bg, #e8f4fd);
  border-color: var(--gantt-primary-color, #409eff);
}

.taskbar-control input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--gantt-primary-color, #409eff);
}

.taskbar-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--gantt-text-primary, #333);
  user-select: none;
  transition: color 0.2s ease;
}

.taskbar-control:hover .taskbar-label {
  color: var(--gantt-primary-color, #409eff);
}

/* 自定义颜色配置组 */
.color-config-group {
  margin-top: 16px;
  padding: 12px;
  background: var(--gantt-bg-tertiary, #fafafa);
  border-radius: 8px;
  border: 1px solid var(--gantt-border-color, #e4e7ed);
}

.color-config-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--gantt-text-secondary, #606266);
  margin: 0 0 12px 0;
}

.color-inputs-row {
  display: flex;
  gap: 12px;
  flex-wrap: nowrap;
}

.color-input-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.color-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--gantt-text-secondary, #606266);
}

.color-input {
  padding: 6px 10px;
  font-size: 13px;
  border: 1px solid var(--gantt-border-color, #dcdfe6);
  border-radius: 4px;
  background: var(--gantt-bg-primary, #ffffff);
  color: var(--gantt-text-primary, #333);
  transition: all 0.2s ease;
}

.color-input:focus {
  outline: none;
  border-color: var(--gantt-primary-color, #409eff);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.color-input::placeholder {
  color: var(--gantt-text-placeholder, #c0c4cc);
}

/* TaskBar 高级配置样式 */
.taskbar-advanced-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--gantt-bg-secondary, #f8f9fa);
  border-radius: 6px;
  border: 1px solid var(--gantt-border-color, #e4e7ed);
}

.control-indent {
  margin-left: 24px;
}

.control-label {
  flex: 0 0 140px;
  font-size: 13px;
  font-weight: 500;
  color: var(--gantt-text-secondary, #666);
}

.control-input {
  flex: 0 0 80px;
  padding: 4px 8px;
  border: 1px solid var(--gantt-border-color, #e4e7ed);
  border-radius: 4px;
  background: var(--gantt-bg-primary, #fff);
  color: var(--gantt-text-primary, #333);
  font-size: 13px;
  transition: all 0.2s ease;
}

.control-input:focus {
  outline: none;
  border-color: var(--gantt-primary-color, #409eff);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.control-hint {
  flex: 1;
  font-size: 12px;
  color: var(--gantt-text-muted, #999);
  font-style: italic;
}

.taskbar-field-control {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--gantt-bg-secondary, #f8f9fa);
  border: 1px solid var(--gantt-border-color, #e4e7ed);
  min-width: 300px;
}

.field-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--gantt-text-secondary, #666);
  white-space: nowrap;
}

.field-select {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--gantt-border-color, #e4e7ed);
  border-radius: 4px;
  background: var(--gantt-bg-primary, #fff);
  color: var(--gantt-text-primary, #333);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.field-select:focus {
  outline: none;
  border-color: var(--gantt-primary-color, #409eff);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.page-title {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--gantt-bg-secondary, #f0f2f5);
  margin: 0;
  padding: 20px 10px;
  font-size: 1.8rem;
  font-weight: 600;
  color: var(--gantt-text-primary, #333);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.title-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.title-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.title-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: flex-end;
}

.gitee-award-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, rgba(199, 29, 35, 0.08) 0%, rgba(255, 107, 53, 0.08) 100%);
  color: #C71D23;
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: none;
  border: 1.5px solid rgba(199, 29, 35, 0.2);
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}

.gitee-award-badge::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.15), transparent);
  transition: left 0.5s ease;
}

.gitee-award-badge:hover {
  transform: translateY(-1px);
  background: linear-gradient(135deg, rgba(199, 29, 35, 0.12) 0%, rgba(255, 107, 53, 0.12) 100%);
  border-color: rgba(199, 29, 35, 0.4);
  box-shadow: 0 4px 16px rgba(199, 29, 35, 0.15);
  color: #E32329;
}

.gitee-award-badge:hover::before {
  left: 100%;
}

@keyframes pulse-glow {
  0%, 100% {
    border-color: rgba(199, 29, 35, 0.2);
  }
  50% {
    border-color: rgba(255, 215, 0, 0.4);
  }
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .gitee-award-badge {
    font-size: 0.75rem;
    padding: 7px 16px;
  }
}

@media (max-width: 1200px) {
  .page-title {
    flex-wrap: wrap;
  }

  .title-center {
    order: 3;
    flex: 1 0 100%;
    margin-top: 10px;
    justify-content: center;
  }

  .gitee-award-badge {
    width: auto;
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .gitee-award-badge {
    font-size: 0.7rem;
    padding: 6px 14px;
  }
}

.gantt-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.gantt-icon:hover {
  transform: scale(1.05);
}

.version-badge {
  display: inline-block;
  background: linear-gradient(135deg, #409eff 0%, #36d1dc 50%, #667eea 100%);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  padding: 6px 12px;
  border-radius: 16px;
  line-height: 1;
  margin-left: 8px;
  position: relative;
  overflow: hidden;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 0 20px rgba(64, 158, 255, 0.3),
    0 4px 15px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.version-badge::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.6s ease;
}

.version-badge:hover {
  transform: scale(1.05) translateY(-1px);
  box-shadow:
    0 0 30px rgba(64, 158, 255, 0.5),
    0 8px 25px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  background: linear-gradient(135deg, #4dabf7 0%, #40c9ff 50%, #74c0fc 100%);
}

.version-badge:hover::before {
  left: 100%;
}

/* 科技感呼吸动画 */
@keyframes glow-pulse {
  0%,
  100% {
    box-shadow:
      0 0 20px rgba(64, 158, 255, 0.3),
      0 4px 15px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  50% {
    box-shadow:
      0 0 30px rgba(64, 158, 255, 0.5),
      0 4px 15px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
}

.gantt-wrapper {
  max-height: 60vh;
  margin: 0 10px 20px 10px;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

.license-info {
  text-align: center;
  color: var(--gantt-text-muted, #c0c4cc);
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60px;
  gap: 8px;
}

/* 全局暗色主题支持 */
:global(.gantt-root[data-theme='dark']) {
  background: #1e1e1e !important;
}

:global(.gantt-root[data-theme='dark']) body {
  background: #1e1e1e !important;
  color: #e5e5e5 !important;
}

/* 暗色主题下的页面标题 */
:global(.gantt-root[data-theme='dark']) .page-title {
  background: #1e1e1e;
  color: #e5e5e5;
}

/* 暗色主题下的配置面板样式 */
:global(.gantt-root[data-theme='dark']) .config-panel {
  background: var(--gantt-bg-primary, #2d3748);
  border-color: var(--gantt-border-color, #4a5568);
}

:global(.gantt-root[data-theme='dark']) .data-source-panel {
  background: var(--gantt-bg-primary, #2d3748);
  border-color: var(--gantt-border-color, #4a5568);
  box-shadow: none;
}

:global(.gantt-root[data-theme='dark']) .data-source-sub {
  color: var(--gantt-text-secondary, #a0aec0);
}

:global(.gantt-root[data-theme='dark']) .data-source-button {
  background: var(--gantt-bg-secondary, #1a202c);
  border-color: var(--gantt-border-color, #4a5568);
}

:global(.gantt-root[data-theme='dark']) .data-source-button.active {
  background: rgba(64, 158, 255, 0.18);
  border-color: var(--gantt-primary-color, #66b3ff);
}

:global(.gantt-root[data-theme='dark']) .ds-label,
:global(.gantt-root[data-theme='dark']) .ds-desc,
:global(.gantt-root[data-theme='dark']) .ds-file {
  color: var(--gantt-text-primary, #e2e8f0);
}

:global(.gantt-root[data-theme='dark']) .ds-file {
  color: var(--gantt-text-muted, #a0aec0);
}

:global(.gantt-root[data-theme='dark']) .config-title {
  color: var(--gantt-text-primary, #e2e8f0);
}

:global(.gantt-root[data-theme='dark']) .section-title {
  color: var(--gantt-text-primary, #e2e8f0);
  border-bottom-color: var(--gantt-primary-color, #66b3ff);
}

:global(.gantt-root[data-theme='dark']) .section-header {
  border-bottom-color: var(--gantt-primary-color, #66b3ff);
}

:global(.gantt-root[data-theme='dark']) .section-header:hover {
  border-bottom-color: var(--gantt-primary-color-light, #74c0fc);
}

:global(.gantt-root[data-theme='dark']) .section-header-title {
  color: var(--gantt-text-primary, #e2e8f0);
}

:global(.gantt-root[data-theme='dark']) .section-collapse-button {
  color: var(--gantt-text-secondary, #a0aec0);
}

:global(.gantt-root[data-theme='dark']) .section-collapse-button:hover {
  color: var(--gantt-primary-color, #66b3ff);
}

:global(.gantt-root[data-theme='dark']) .section-icon {
  color: var(--gantt-primary-color, #66b3ff);
}

:global(.gantt-root[data-theme='dark']) .subsection {
  border-left-color: var(--gantt-border-color, #4a5568);
}

:global(.gantt-root[data-theme='dark']) .subsection-title {
  color: var(--gantt-text-secondary, #a0aec0);
}

:global(.gantt-root[data-theme='dark']) .section-subtitle {
  color: var(--gantt-primary-color, #66b3ff);
  background: rgba(102, 179, 255, 0.15);
  border-left-color: var(--gantt-primary-color, #66b3ff);
}

:global(.gantt-root[data-theme='dark']) .subsection-title::before {
  background-color: var(--gantt-primary-color, #66b3ff);
}

:global(.gantt-root[data-theme='dark']) .column-control {
  background: var(--gantt-bg-secondary, #1a202c);
}

:global(.gantt-root[data-theme='dark']) .column-control:hover {
  background: var(--gantt-hover-bg, #2d3748);
}

:global(.gantt-root[data-theme='dark']) .column-label {
  color: var(--gantt-text-primary, #e2e8f0);
}

:global(.gantt-root[data-theme='dark']) .column-control:hover .column-label {
  color: var(--gantt-primary-color, #66b3ff);
}

/* 暗色主题下的TaskBar配置样式 */
:global(.gantt-root[data-theme='dark']) .taskbar-control {
  background: var(--gantt-bg-secondary, #1a202c);
}

:global(.gantt-root[data-theme='dark']) .taskbar-control:hover {
  background: var(--gantt-hover-bg, #2d3748);
}

:global(.gantt-root[data-theme='dark']) .taskbar-label {
  color: var(--gantt-text-primary, #e2e8f0);
}

:global(.gantt-root[data-theme='dark']) .taskbar-control:hover .taskbar-label {
  color: var(--gantt-primary-color, #66b3ff);
}

/* 暗色主题下的 TaskBar 高级配置 */
:global(.gantt-root[data-theme='dark']) .control-row {
  background: var(--gantt-bg-secondary, #1a202c);
  border-color: var(--gantt-border-color, #4a5568);
}

:global(.gantt-root[data-theme='dark']) .control-label {
  color: var(--gantt-text-secondary, #a0aec0);
}

:global(.gantt-root[data-theme='dark']) .control-input {
  background: var(--gantt-bg-primary, #2d3748);
  color: var(--gantt-text-primary, #e2e8f0);
  border-color: var(--gantt-border-color, #4a5568);
}

:global(.gantt-root[data-theme='dark']) .control-hint {
  color: var(--gantt-text-muted, #718096);
}

:global(.gantt-root[data-theme='dark']) .taskbar-field-control {
  background: var(--gantt-bg-secondary, #1a202c);
  border-color: var(--gantt-border-color, #4a5568);
}

:global(.gantt-root[data-theme='dark']) .field-label {
  color: var(--gantt-text-secondary, #a0aec0);
}

:global(.gantt-root[data-theme='dark']) .field-select {
  background: var(--gantt-bg-primary, #2d3748);
  color: var(--gantt-text-primary, #e2e8f0);
  border-color: var(--gantt-border-color, #4a5568);
}

/* 暗色主题下的折叠面板样式 */
:global(.gantt-root[data-theme='dark']) .config-header {
  border-bottom-color: var(--gantt-border-color, #4a5568);
}

:global(.gantt-root[data-theme='dark']) .config-header:hover {
  background-color: var(--gantt-hover-bg, #2d3748);
}

:global(.gantt-root[data-theme='dark']) .collapse-button {
  color: var(--gantt-text-secondary, #a0aec0);
}

:global(.gantt-root[data-theme='dark']) .collapse-button:hover {
  background-color: var(--gantt-hover-bg, #2d3748);
  color: var(--gantt-primary-color, #66b3ff);
}

/* 暗黑模式下的版本标签 */
:global(.gantt-root[data-theme='dark']) .version-badge {
  background: linear-gradient(135deg, #1a73e8 0%, #00bcd4 50%, #3f51b5 100%);
  box-shadow:
    0 0 25px rgba(102, 177, 255, 0.4),
    0 4px 15px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

:global(.gantt-root[data-theme='dark']) .version-badge:hover {
  background: linear-gradient(135deg, #2196f3 0%, #00e5ff 50%, #5c6bc0 100%);
  box-shadow:
    0 0 35px rgba(102, 177, 255, 0.6),
    0 8px 25px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  border-color: rgba(102, 177, 255, 0.5);
}

/* 暗黑模式的呼吸动画 */
@keyframes glow-pulse-dark {
  0%,
  100% {
    box-shadow:
      0 0 25px rgba(102, 177, 255, 0.4),
      0 4px 15px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }
  50% {
    box-shadow:
      0 0 35px rgba(102, 177, 255, 0.6),
      0 4px 15px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }
}

.docs-links {
  display: flex;
  align-items: center;
  gap: 8px;
}
.docs-divider {
  display: inline-block;
  width: 1px;
  height: 24px;
  border-left: 1.5px dashed #bbb;
  margin: 0 8px;
  background: none;
}

.doc-link {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--gantt-text-primary, #333333);
  text-decoration: none;
  font-size: 1rem;
  font-weight: 500;
  transition: color 0.2s ease;
  padding: 4px 8px;
  border-radius: 4px;
}

.doc-link:hover {
  color: var(--gantt-text-primary, #333333);
  background-color: rgba(0, 0, 0, 0.1);
}

.doc-link:nth-child(2) {
  color: #c71d23;
}

.doc-link:nth-child(2):hover {
  color: #a91b1b;
  background-color: rgba(199, 29, 35, 0.1);
}

.doc-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  transition: filter 0.2s ease;
}

/* GitHub 图标样式 - 黑色 */
.github-link .doc-icon {
  filter: brightness(0) saturate(100%);
}

.github-link:hover .doc-icon {
  filter: brightness(0) saturate(100%) invert(20%) sepia(15%) saturate(1500%) hue-rotate(200deg);
}

/* Gitee 图标样式 - 红色 */
.gitee-link .doc-icon {
  filter: brightness(0) saturate(100%) invert(20%) sepia(100%) saturate(2000%) hue-rotate(350deg)
    brightness(0.8);
}

.gitee-link:hover .doc-icon {
  filter: brightness(0) saturate(100%) invert(15%) sepia(100%) saturate(2500%) hue-rotate(350deg)
    brightness(0.7);
}

/* 里程碑分组图标样式 - 统一使用红色并添加发光效果 */
.milestone-group-icon {
  color: var(--gantt-danger, #f56c6c);
  fill: var(--gantt-danger, #f56c6c);
  opacity: 0.9;
  filter: drop-shadow(0 0 6px var(--gantt-danger, #f56c6c));
  animation: milestone-icon-glow 2.5s ease-in-out infinite alternate;
}

/* 里程碑图标悬停效果 */
.task-row:hover .milestone-group-icon {
  filter: drop-shadow(0 0 10px var(--gantt-danger, #f56c6c))
    drop-shadow(0 0 16px rgba(245, 108, 108, 0.4));
  animation: milestone-icon-glow-intense 1.8s ease-in-out infinite alternate;
}

/* 移除旧的基于 SVG color 的样式，现在使用 filter */

/* 暗黑模式下覆盖所有链接样式 */
:global(.gantt-root[data-theme='dark']) .doc-link {
  color: #ffffff;
}

:global(.gantt-root[data-theme='dark']) .doc-link:hover {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.1);
}

:global(.gantt-root[data-theme='dark']) .doc-link:nth-child(2) {
  color: #ffffff !important;
}

:global(.gantt-root[data-theme='dark']) .doc-link:nth-child(2):hover {
  color: #ffffff !important;
  background-color: rgba(199, 29, 35, 0.1);
}

/* 暗黑模式下图标样式 */
:global(.gantt-root[data-theme='dark']) .github-link .doc-icon {
  filter: brightness(0) saturate(100%) invert(100%);
}

:global(.gantt-root[data-theme='dark']) .github-link:hover .doc-icon {
  filter: brightness(0) saturate(100%) invert(70%) sepia(50%) saturate(2000%) hue-rotate(190deg)
    brightness(1.2);
}

:global(.gantt-root[data-theme='dark']) .gitee-link .doc-icon {
  filter: brightness(0) saturate(100%) invert(45%) sepia(100%) saturate(1500%) hue-rotate(340deg)
    brightness(1.1);
}

:global(.gantt-root[data-theme='dark']) .gitee-link:hover .doc-icon {
  filter: brightness(0) saturate(100%) invert(50%) sepia(100%) saturate(1800%) hue-rotate(340deg)
    brightness(1.2);
}

/* 暗黑模式下的里程碑图标发光效果 */
:global(.gantt-root[data-theme='dark']) .milestone-group-icon {
  color: var(--gantt-danger, #f67c7c);
  fill: var(--gantt-danger, #f67c7c);
  filter: drop-shadow(0 0 6px var(--gantt-danger, #f67c7c));
  animation: milestone-icon-glow-dark 2.5s ease-in-out infinite alternate;
}

:global(.gantt-root[data-theme='dark']) .task-row:hover .milestone-group-icon {
  filter: drop-shadow(0 0 10px var(--gantt-danger, #f67c7c))
    drop-shadow(0 0 16px rgba(246, 124, 124, 0.4));
  animation: milestone-icon-glow-intense-dark 1.8s ease-in-out infinite alternate;
}

/* Task Click Dialog 样式 */
.task-click-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.task-click-dialog {
  background: var(--gantt-bg-primary, #ffffff);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.task-click-dialog-header {
  padding: 20px;
  border-bottom: 1px solid var(--gantt-border-color, #e4e7ed);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-click-dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--gantt-text-primary, #303133);
}

.close-button {
  background: none;
  border: none;
  font-size: 28px;
  color: var(--gantt-text-secondary, #909399);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.3s;
}

.close-button:hover {
  background: var(--gantt-bg-hover, #f5f7fa);
  color: var(--gantt-text-primary, #303133);
}

.task-click-dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.task-properties {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.property-row {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--gantt-border-light, #f0f0f0);
}

.property-row:last-child {
  border-bottom: none;
}

.property-key {
  font-weight: 600;
  color: var(--gantt-text-secondary, #606266);
  word-break: break-word;
}

.property-value {
  color: var(--gantt-text-primary, #303133);
  word-break: break-all;
  white-space: pre-wrap;
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.task-click-dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--gantt-border-color, #e4e7ed);
  display: flex;
  justify-content: flex-end;
}

.confirm-button {
  padding: 8px 20px;
  background: var(--gantt-primary-color, #409eff);
  color: #ffffff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
}

.confirm-button:hover {
  background: var(--gantt-primary-color-hover, #66b1ff);
}

.confirm-button:active {
  background: var(--gantt-primary-color-active, #3a8ee6);
}

/* v1.9.0 资源拖拽确认对话框样式 */
.resource-drag-dialog {
  position: relative;
  width: 500px;
  max-width: 90vw;
  background: var(--gantt-bg-primary, #ffffff);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.resource-drag-dialog-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--gantt-border-color, #e4e7ed);
}

.resource-drag-dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--gantt-text-primary, #303133);
}

.resource-drag-dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.resource-drag-dialog-body p {
  margin: 0 0 12px 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--gantt-text-primary, #303133);
}

.resource-drag-dialog-body .task-info {
  margin-top: 16px;
  padding: 12px;
  background: var(--gantt-bg-secondary, #f5f7fa);
  border-radius: 4px;
}

.resource-drag-dialog-body .task-info p {
  margin: 4px 0;
  font-size: 13px;
  color: var(--gantt-text-secondary, #606266);
}

.resource-drag-dialog-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--gantt-border-color, #e4e7ed);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-button {
  padding: 8px 20px;
  background: transparent;
  color: var(--gantt-text-primary, #303133);
  border: 1px solid var(--gantt-border-color, #dcdfe6);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
}

.cancel-button:hover {
  color: var(--gantt-primary-color, #409eff);
  border-color: var(--gantt-primary-color, #409eff);
  background: var(--gantt-primary-light-9, #ecf5ff);
}

/* 暗黑模式适配 */
:global(.gantt-root[data-theme='dark']) .task-click-dialog {
  background: var(--gantt-bg-primary, #1a1a1a);
}

:global(.gantt-root[data-theme='dark']) .task-click-dialog-header h3 {
  color: var(--gantt-text-primary, #e0e0e0);
}

:global(.gantt-root[data-theme='dark']) .close-button {
  color: var(--gantt-text-secondary, #b0b0b0);
}

:global(.gantt-root[data-theme='dark']) .close-button:hover {
  background: var(--gantt-bg-hover, #2a2a2a);
  color: var(--gantt-text-primary, #e0e0e0);
}

:global(.gantt-root[data-theme='dark']) .property-key {
  color: var(--gantt-text-secondary, #b0b0b0);
}

:global(.gantt-root[data-theme='dark']) .property-value {
  color: var(--gantt-text-primary, #e0e0e0);
}

/* 任务行根据进度值的自定义样式 */
/* 父级节点 (task-row-parent) 保留默认样式，不做特殊处理 */

/* 已完成 (progress = 100) - 淡绿色，参考 Element Plus success */
:deep(.task-row-success) {
  background-color: #f0f9ff !important;
  background: linear-gradient(90deg, #f0f9ff 0%, #e8f5e9 100%) !important;
  height: 100px;
}

:deep(.task-row-success:hover) {
  background: linear-gradient(90deg, #e1f5fe 0%, #c8e6c9 100%) !important;
}

/* 进行中 (0 < progress < 100) - 淡黄色，参考 Element Plus warning */
:deep(.task-row-warning) {
  background-color: #fdf6ec !important;
  background: linear-gradient(90deg, #fdf6ec 0%, #fff3e0 100%) !important;
}

:deep(.task-row-warning:hover) {
  background: linear-gradient(90deg, #faecd8 0%, #ffe0b2 100%) !important;
}

/* 未开始 (progress <= 0) - 灰色，参考 Element Plus info */
:deep(.task-row-info) {
  background-color: #f4f4f5 !important;
  background: linear-gradient(90deg, #f4f4f5 0%, #f5f5f5 100%) !important;
}

:deep(.task-row-info:hover) {
  background: linear-gradient(90deg, #e9e9eb 0%, #eeeeee 100%) !important;
}

/* 暗黑模式下的任务行样式 */
:global(.gantt-root[data-theme='dark']) :deep(.task-row-success) {
  background: linear-gradient(90deg, #0a3a2a 0%, #1b4d3e 100%) !important;
}

:global(.gantt-root[data-theme='dark']) :deep(.task-row-success:hover) {
  background: linear-gradient(90deg, #0f4d35 0%, #276749 100%) !important;
}

:global(.gantt-root[data-theme='dark']) :deep(.task-row-warning) {
  background: linear-gradient(90deg, #3d2f1f 0%, #4d3b2a 100%) !important;
}

:global(.gantt-root[data-theme='dark']) :deep(.task-row-warning:hover) {
  background: linear-gradient(90deg, #4d3b26 0%, #5d4a35 100%) !important;
}

:global(.gantt-root[data-theme='dark']) :deep(.task-row-info) {
  background: linear-gradient(90deg, #2a2a2a 0%, #333333 100%) !important;
}

:global(.gantt-root[data-theme='dark']) :deep(.task-row-info:hover) {
  background: linear-gradient(90deg, #353535 0%, #3d3d3d 100%) !important;
}

/* 自定义右键菜单样式 */
.custom-menu {
  position: fixed;
  z-index: 999999 !important;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  padding: 8px 0;
  font-size: 14px;
}

.custom-menu-header {
  padding: 10px 16px;
  font-weight: bold;
  color: #333;
  background: #f8f8f8;
  border-bottom: 1px solid #eee;
  margin-bottom: 4px;
}

.custom-menu-item {
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
  user-select: none;
}

.custom-menu-item:hover {
  background: #f0f0f0;
}

.custom-menu-item.danger {
  color: #ff4d4f;
}

.custom-menu-item.danger:hover {
  background: #fff1f0;
}

.custom-menu-divider {
  height: 1px;
  background: #eee;
  margin: 4px 0;
}

/* 暗色主题下的自定义菜单 */
:global(.gantt-root[data-theme='dark']) .custom-menu {
  background: #2a2a2a;
  border-color: #444;
}

:global(.gantt-root[data-theme='dark']) .custom-menu-header {
  background: #1e1e1e;
  color: #e0e0e0;
  border-bottom-color: #444;
}

:global(.gantt-root[data-theme='dark']) .custom-menu-item {
  color: #e0e0e0;
}

:global(.gantt-root[data-theme='dark']) .custom-menu-item:hover {
  background: #353535;
}

:global(.gantt-root[data-theme='dark']) .custom-menu-item.danger {
  color: #ff6b6b;
}

:global(.gantt-root[data-theme='dark']) .custom-menu-item.danger:hover {
  background: #3a2020;
}

:global(.gantt-root[data-theme='dark']) .custom-menu-divider {
  background: #444;
}

/* Tool 设置样式 */
.status-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  padding: 12px;
  background: var(--gantt-bg-secondary, #f8f9fa);
  border-radius: 8px;
  border: 1px solid var(--gantt-border-color, #e4e7ed);
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-label {
  font-size: 12px;
  color: var(--gantt-text-secondary, #909399);
  font-weight: 500;
}

.status-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--gantt-text-primary, #303133);
  padding: 4px 8px;
  background: var(--gantt-bg-secondary, #f8f9fa);
  border-radius: 4px;
  border: 1px solid var(--gantt-border-color, #e4e7ed);
}

.status-value.active {
  color: var(--gantt-primary-color, #409eff);
  border-color: var(--gantt-primary-color, #409eff);
  background: var(--gantt-primary-light, #ecf5ff);
}

/* Control Mode Switch */
.control-mode-switch {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.mode-button {
  flex: 1;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 6px;
  border: 2px solid var(--gantt-border-color, #dcdfe6);
  background: var(--gantt-bg-secondary, #f8f9fa);
  color: var(--gantt-text-secondary, #909399);
  cursor: pointer;
  transition: all 0.3s;
}

.mode-button:hover {
  border-color: var(--gantt-primary-color, #409eff);
  color: var(--gantt-primary-color, #409eff);
}

.mode-button.active {
  background: var(--gantt-primary-color, #409eff);
  border-color: var(--gantt-primary-color, #409eff);
  color: white;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}

.control-mode-hint {
  margin: 0;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--gantt-text-secondary, #909399);
  background: var(--gantt-bg-secondary, #f8f9fa);
  border-radius: 4px;
  border-left: 3px solid var(--gantt-primary-color, #409eff);
}

.prop-info {
  margin: 4px 0 0 0;
  padding: 4px 8px;
  font-size: 11px;
  font-family: 'Courier New', monospace;
  color: var(--gantt-text-secondary, #909399);
  background: var(--gantt-bg-secondary, #f8f9fa);
  border-radius: 3px;
  border: 1px dashed var(--gantt-border-color, #e4e7ed);
}

/* Tool控制行布局 - 并排两个控制区域 */
.tool-control-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.tool-control-item {
  flex: 1;
  min-width: 0;
}

.tool-control-item .subsection-title {
  margin-bottom: 8px;
}

/* 4个控制区域单行布局 */
.tool-control-row-full {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.tool-control-item-quarter {
  flex: 1;
  min-width: 0;
}

.tool-control-item-quarter .subsection-title {
  margin-bottom: 8px;
  font-size: 13px;
}

/* 5个控制区域单行布局 */
.tool-control-row-five {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.tool-control-item-fifth {
  flex: 1;
  min-width: 0;
}

.tool-control-item-fifth .subsection-title {
  margin-bottom: 6px;
  font-size: 12px;
}

/* 流式布局 */
.tool-control-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.tool-control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-control-group .subsection-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

/* 分隔线 */
.tool-divider {
  width: 1px;
  height: 40px;
  background: var(--gantt-border-color, #dcdfe6);
  margin: 0 4px;
  align-self: center;
}

/* 导航控制单行布局 */
.tool-nav-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.tool-button-group {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  align-items: center;
}

.tool-button {
  padding: 5px 12px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid var(--gantt-border-color, #dcdfe6);
  background: var(--gantt-bg-secondary, #f8f9fa);
  color: var(--gantt-text-primary, #606266);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.tool-button:hover {
  background: var(--gantt-background-hover, #e8f4fd);
  border-color: var(--gantt-primary-color, #409eff);
  color: var(--gantt-primary-color, #409eff);
}

.tool-button.primary {
  background: var(--gantt-primary-color, #409eff);
  border-color: var(--gantt-primary-color, #409eff);
  color: white;
}

.tool-button.primary:hover {
  background: var(--gantt-primary-hover, #66b1ff);
  border-color: var(--gantt-primary-hover, #66b1ff);
}

.tool-button.small {
  padding: 4px 10px;
  font-size: 11px;
}

.tool-button.tiny {
  padding: 3px 8px;
  font-size: 10px;
}

.tool-button.compact {
  padding: 4px 10px;
  font-size: 11px;
}

.tool-input-group {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.tool-label {
  font-size: 12px;
  color: var(--gantt-text-primary, #606266);
  font-weight: 500;
  min-width: 100px;
  white-space: nowrap;
  flex-shrink: 0;
}

.tool-label.compact {
  min-width: auto;
  font-size: 11px;
}

.tool-input {
  flex: 1;
  min-width: 120px;
  padding: 5px 10px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid var(--gantt-border-color, #dcdfe6);
  background: var(--gantt-bg-secondary, #f8f9fa);
  color: var(--gantt-text-primary, #606266);
  transition: border-color 0.2s;
}

.tool-input.small {
  min-width: 80px;
  padding: 4px 10px;
  font-size: 11px;
}

.tool-input.compact {
  min-width: 80px;
  padding: 4px 8px;
  font-size: 11px;
}

.tool-input.tiny {
  min-width: 60px;
  padding: 3px 6px;
  font-size: 10px;
}

.tool-input:focus {
  outline: none;
  border-color: var(--gantt-primary-color, #409eff);
}

.tool-input::placeholder {
  color: var(--gantt-text-placeholder, #c0c4cc);
}

.tool-note {
  padding: 12px;
  font-size: 13px;
  color: var(--gantt-text-secondary, #909399);
  background: var(--gantt-background-secondary, #f9fafb);
  border-left: 3px solid var(--gantt-primary-color, #409eff);
  border-radius: 4px;
  line-height: 1.6;
}

/* 暗色主题支持 */
:global(.gantt-root[data-theme='dark']) .status-panel {
  background: var(--gantt-bg-secondary, #1a202c);
  border-color: var(--gantt-border-color, #4a5568);
}

:global(.gantt-root[data-theme='dark']) .status-value {
  background: var(--gantt-bg-secondary, #1a202c);
  color: var(--gantt-text-primary, #e2e8f0);
  border-color: var(--gantt-border-color, #4a5568);
}

:global(.gantt-root[data-theme='dark']) .status-value.active {
  background: rgba(64, 158, 255, 0.15);
  border-color: var(--gantt-primary-color, #66b3ff);
  color: var(--gantt-primary-color, #66b3ff);
}

:global(.gantt-root[data-theme='dark']) .tool-button {
  background: var(--gantt-bg-secondary, #1a202c);
  color: var(--gantt-text-primary, #e2e8f0);
  border-color: var(--gantt-border-color, #4a5568);
}

:global(.gantt-root[data-theme='dark']) .tool-button:hover {
  background: var(--gantt-hover-bg, #2d3748);
  border-color: var(--gantt-primary-color, #66b3ff);
  color: var(--gantt-primary-color, #66b3ff);
}

:global(.gantt-root[data-theme='dark']) .tool-button.primary {
  background: var(--gantt-primary-color, #409eff);
  border-color: var(--gantt-primary-color, #409eff);
  color: white;
}

:global(.gantt-root[data-theme='dark']) .tool-button.primary:hover {
  background: var(--gantt-primary-hover, #66b1ff);
  border-color: var(--gantt-primary-hover, #66b1ff);
}

:global(.gantt-root[data-theme='dark']) .tool-divider {
  background: var(--gantt-border-color, #4a5568);
}

:global(.gantt-root[data-theme='dark']) .tool-input {
  background: var(--gantt-bg-primary, #2d3748);
  color: var(--gantt-text-primary, #e2e8f0);
  border-color: var(--gantt-border-color, #4a5568);
}

:global(.gantt-root[data-theme='dark']) .tool-label {
  color: var(--gantt-text-secondary, #a0aec0);
}

:global(.gantt-root[data-theme='dark']) .tool-note {
  background: var(--gantt-bg-secondary, #1a202c);
  color: var(--gantt-text-secondary, #a0aec0);
  border-left-color: var(--gantt-primary-color, #66b3ff);
}
</style>


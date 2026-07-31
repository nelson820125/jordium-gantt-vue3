<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { GanttChart, Task } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'

// GanttChart ref
const ganttRef = ref(null)

// 控制模式：'expose' 使用expose方法，'props' 使用Props
const controlMode = ref<'expose' | 'props'>('expose')

// 状态变量
const fullscreenStatus = ref(false)
const expandStatus = ref(false)
const currentLocaleStatus = ref<'zh-CN' | 'en-US'>('zh-CN')
const currentScaleStatus = ref<'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'>('week')
const currentThemeStatus = ref<'light' | 'dark'>('light')

// Props控制变量
const propsLocale = ref<'zh-CN' | 'en-US'>('zh-CN')
const propsTheme = ref<'light' | 'dark'>('light')
const propsTimeScale = ref<'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'>('week')
const propsFullscreen = ref(false)
const propsExpandAll = ref(false)

// 监听 Props 变化，同步 status
watch(propsLocale, newLocale => {
  currentLocaleStatus.value = newLocale
})
watch(propsTheme, newTheme => {
  currentThemeStatus.value = newTheme
})
watch(propsTimeScale, newScale => {
  currentScaleStatus.value = newScale
})
watch(propsFullscreen, newFullscreen => {
  fullscreenStatus.value = newFullscreen
})
watch(propsExpandAll, newExpandAll => {
  expandStatus.value = newExpandAll
})

// 更新状态函数
const updateStatus = () => {
  if (ganttRef.value) {
    fullscreenStatus.value = ganttRef.value.isFullscreen()
    expandStatus.value = ganttRef.value.isExpandAll()
    currentLocaleStatus.value = ganttRef.value.currentLocale()
    currentScaleStatus.value = ganttRef.value.currentScale()
    currentThemeStatus.value = ganttRef.value.currentTheme()
  }
}

// Expose 方法处理器
const handleToggleFullscreen = () => {
  ganttRef.value?.toggleFullscreen()
  updateStatus()
  propsFullscreen.value = ganttRef.value?.isFullscreen() ?? false
}

const handleToggleExpandAll = () => {
  ganttRef.value?.toggleExpandAll()
  updateStatus()
  propsExpandAll.value = ganttRef.value?.isExpandAll() ?? false
}

const handleSetLocale = (locale: 'zh-CN' | 'en-US') => {
  ganttRef.value?.setLocale(locale)
  currentLocaleStatus.value = locale
  propsLocale.value = locale
}

const handleSetTimeScale = (scale: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year') => {
  ganttRef.value?.setTimeScale(scale)
  updateStatus()
  propsTimeScale.value = scale
}

const handleSetTheme = (mode: 'light' | 'dark') => {
  ganttRef.value?.setTheme(mode)
  updateStatus()
  propsTheme.value = mode
}

// 定义类型接口
interface TaskListColumnConfig {
  key: string
  label: string
  visible: boolean
  width?: number
}

interface ToolbarConfig {
  showAddTask?: boolean
  showAddMilestone?: boolean
  showTodayLocate?: boolean
  showExportCsv?: boolean
  showExportPdf?: boolean
  showLanguage?: boolean
  showTheme?: boolean
  showFullscreen?: boolean
  showTimeScale?: boolean
  timeScaleDimensions?: string[]
  defaultTimeScale?: string
  showExpandCollapse?: boolean
}

const tasks = ref([
  {
    id: 1,
    name: '项目启动',
    startDate: '2025-10-30',
    endDate: '2025-11-5',
    progress: 100,
    department: '管理部',
    departmentCode: 'D001',
    type: 'task',
    assignee: '',
    assigneeName: '',
  },
])

const milestones = ref([
  {
    id: 101,
    name: '项目立项',
    startDate: '2025-10-29',
    type: 'milestone',
    icon: 'diamond',
  },
])

// 资源数据源 - 按照Resource类型结构定义
const resources = ref([
  {
    id: 'R001',
    name: '张三',
    type: '开发工程师',
    avatar: 'https://i.pravatar.cc/150?img=1',
    description: '前端开发专家，擅长Vue.js和React',
    department: '技术部',
    skills: ['Vue.js', 'React', 'TypeScript', 'Node.js'],
    capacity: 85,
    color: '#1890ff',
    tasks: [
      {
        id: 1000,
        name: '前端框架搭建',
        startDate: '2025-11-01',
        endDate: '2025-11-05',
        progress: 80,
        type: 'task',
      },
      {
        id: 1001,
        name: '组件库开发',
        startDate: '2025-11-06',
        endDate: '2025-11-15',
        progress: 50,
        type: 'task',
      },
      {
        id: 1002,
        name: '页面开发',
        startDate: '2025-11-16',
        endDate: '2025-11-25',
        progress: 20,
        type: 'task',
      },
    ],
  },
  {
    id: 'R002',
    name: '李四',
    type: '后端工程师',
    avatar: 'https://i.pravatar.cc/150?img=2',
    description: 'Java后端开发，熟悉Spring全家桶',
    department: '技术部',
    skills: ['Java', 'Spring Boot', 'MySQL', 'Redis'],
    capacity: 85,
    color: '#52c41a',
    tasks: [
      {
        id: 1003,
        name: '数据库设计',
        startDate: '2025-11-01',
        endDate: '2025-11-03',
        progress: 100,
        type: 'task',
      },
      {
        id: 1004,
        name: 'API接口开发',
        startDate: '2025-11-04',
        endDate: '2025-11-12',
        progress: 60,
        type: 'task',
      },
      {
        id: 1005,
        name: '性能优化',
        startDate: '2025-11-20',
        endDate: '2025-11-28',
        progress: 0,
        type: 'task',
      },
    ],
  },
  {
    id: 'R003',
    name: '王五',
    type: 'UI设计师',
    avatar: 'https://i.pravatar.cc/150?img=3',
    description: '资深UI/UX设计师',
    department: '设计部',
    skills: ['Figma', 'Sketch', 'Photoshop', 'Illustrator'],
    capacity: 8,
    color: '#faad14',
    tasks: [
      {
        id: 1006,
        name: 'UI原型设计',
        startDate: '2025-10-28',
        endDate: '2025-11-02',
        progress: 100,
        type: 'task',
      },
      {
        id: 1007,
        name: '视觉规范制定',
        startDate: '2025-11-03',
        endDate: '2025-11-08',
        progress: 90,
        type: 'task',
      },
      {
        id: 1008,
        name: '界面设计',
        startDate: '2025-11-09',
        endDate: '2025-11-18',
        progress: 40,
        type: 'task',
      },
    ],
  },
  {
    id: 'R004',
    name: '赵六',
    type: '测试工程师',
    avatar: 'https://i.pravatar.cc/150?img=4',
    description: '软件测试专家，自动化测试经验丰富',
    department: '质量部',
    skills: ['Selenium', 'Jest', 'Cypress', 'JMeter'],
    capacity: 8,
    color: '#f5222d',
    tasks: [
      {
        id: 1009,
        name: '测试计划编写',
        startDate: '2025-11-10',
        endDate: '2025-11-12',
        progress: 70,
        type: 'task',
      },
      {
        id: 1010,
        name: '自动化测试脚本',
        startDate: '2025-11-13',
        endDate: '2025-11-20',
        progress: 30,
        type: 'task',
      },
      {
        id: 1011,
        name: '功能测试',
        startDate: '2025-11-21',
        endDate: '2025-11-30',
        progress: 0,
        type: 'task',
      },
    ],
  },
  {
    id: 'R005',
    name: '钱七',
    type: '产品经理',
    avatar: 'https://i.pravatar.cc/150?img=5',
    description: '5年产品经验，擅长用户需求分析',
    department: '产品部',
    skills: ['需求分析', 'Axure', 'PRD撰写', '用户研究'],
    capacity: 8,
    color: '#722ed1',
    tasks: [
      {
        id: 1012,
        name: '需求调研',
        startDate: '2025-10-25',
        endDate: '2025-10-30',
        progress: 100,
        type: 'task',
      },
      {
        id: 1013,
        name: 'PRD文档编写',
        startDate: '2025-10-31',
        endDate: '2025-11-05',
        progress: 85,
        type: 'task',
      },
      {
        id: 1014,
        name: '产品验收',
        startDate: '2025-11-25',
        endDate: '2025-11-30',
        progress: 0,
        type: 'task',
      },
    ],
  },
  {
    id: 'R006',
    name: '孙八',
    type: '全栈工程师',
    avatar: 'https://i.pravatar.cc/150?img=6',
    description: '全栈开发，前后端通吃',
    department: '技术部',
    skills: ['Vue.js', 'Node.js', 'Python', 'Docker'],
    capacity: 8,
    color: '#13c2c2',
    tasks: [
      {
        id: 1015,
        name: '服务器部署',
        startDate: '2025-11-01',
        endDate: '2025-11-04',
        progress: 100,
        type: 'task',
      },
      {
        id: 1016,
        name: 'CI/CD配置',
        startDate: '2025-11-05',
        endDate: '2025-11-10',
        progress: 75,
        type: 'task',
      },
      {
        id: 1017,
        name: '微服务架构',
        startDate: '2025-11-11',
        endDate: '2025-11-22',
        progress: 35,
        type: 'task',
      },
    ],
  },
])

const customMessages = {
  'zh-CN': {
    department: '部门',
    departmentCode: '部门编号',
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
    department: 'Department',
    departmentCode: 'Department Code',
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
// const tasks = ref([])

// const milestones = ref([])
const showAddTaskDrawer = ref(false)
const showAddMilestoneDialog = ref(false)

// 定义可动态配置的列
const availableColumns = ref<TaskListColumnConfig[]>([
  { key: 'startDate', label: '开始日期', visible: true },
  { key: 'endDate', label: '结束日期', visible: true },
  { key: 'progress', label: '进度', visible: true },
  { key: 'department', label: '部门', visible: true, width: 120 },
  { key: 'departmentCode', label: '部门编号', visible: true },
  { key: 'assigneeName', label: '负责人', visible: true },
])

// 自定义负责人列表
const assigneeOptions = ref([
  { value: 'zhangsan', label: '张三' },
  { value: 'lisi', label: '李四' },
  { value: 'wangwu', label: '王五' },
])

// TaskList宽度配置示例
const taskListConfig = {
  defaultWidth: '50%', // 默认展开宽度50%
  minWidth: '300px', // 最小宽度300px（默认280px）
  maxWidth: '1200px', // 最大宽度1200px（默认1160px）
  columns: availableColumns.value,
}

// toolbar配置示例
const toolbarConfig: ToolbarConfig = {
  showAddTask: true, // 显示添加任务按钮
  showAddMilestone: true, // 显示添加里程碑按钮
  showTodayLocate: true, // 显示定位到今天按钮
  showExportCsv: true, // 显示导出CSV按钮
  showExportPdf: true, // 显示导出PDF按钮
  showLanguage: true, // 显示语言切换按钮
  showTheme: true, // 显示主题切换按钮
  showFullscreen: true, // 显示全屏按钮
  showTimeScale: true, // 显示时间刻度按钮组
  timeScaleDimensions: [
    // 显示所有时间刻度维度
    'hour',
    'day',
    'week',
    'month',
    'quarter',
    'year',
  ],
  defaultTimeScale: 'week', // 默认选中周视图
  showExpandCollapse: false, // 显示展开/折叠按钮
}

const newTask = ref({
  name: '',
  startDate: '',
  endDate: '',
})

const addTask = () => {
  tasks.value.push({
    id: tasks.value.length + 1,
    name: newTask.value.name,
    startDate: newTask.value.startDate,
    endDate: newTask.value.endDate,
    progress: 0,
    department: '未分配',
    departmentCode: 'D000',
    assignee: '',
    assigneeName: '',
    type: 'task',
  })
  newTask.value = { name: '', startDate: '', endDate: '' }
  showAddTaskDrawer.value = false
}

const addMilestone = () => {
  milestones.value.push({
    id: milestones.value.length + 101,
    name: newTask.value.name,
    startDate: newTask.value.startDate,
    type: 'milestone',
    icon: 'diamond',
  })
  console.log('milestones: ', milestones.value)
  newTask.value = { name: '', startDate: '', endDate: '' }
  showAddMilestoneDialog.value = false
}

const onTaskDblclick = (task: any) => {
  alert(`双击任务: ${task.name}`)
}
const onTaskClick = (task: any) => {
  alert(`单击任务: ${task.name}`)
}
const onMilestoneDblclick = (milestone: any) => {
  alert(`双击里程碑: ${milestone.name}`)
}

// 任务行拖拽完成事件
const handleTaskRowMoved = (payload: {
  draggedTask: Task
  targetTask: Task
  position: 'after' | 'child'
}) => {
  const { draggedTask, targetTask, position } = payload

  alert(
    `任务 [${draggedTask.name}] 被拖拽到任务 [${targetTask.name}] ${position === 'after' ? '之后' : '下方作为子任务'}`
  )

  // 组件已自动更新任务的层级关系和位置
  // position === 'after': 任务被放置在目标任务之后（同级）
  // position === 'child': 任务被放置为目标任务的子任务（第一个子任务位置）

  // 这里可以：
  // 1. 显示确认对话框，让用户确认是否移动
  // 2. 调用后端 API 保存新的任务层级关系
  // 3. 更新相关的依赖关系

  // 示例：调用后端 API
  // await api.updateTaskHierarchy({
  //   taskId: draggedTask.id,
  //   targetTaskId: targetTask.id,
  //   position: position
  // })
}

// 任务添加后回调
const onTaskAdded = res => {
  const addedTask = tasks.value.find(t => t.id === res.task.id)
  if (addedTask) {
    // 使用addedTask.assignee去查找assigneeOptions的label进行赋值
    const assigneeOption = assigneeOptions.value.find(option => option.value === addedTask.assignee)
    if (assigneeOption) {
      addedTask.assigneeName = assigneeOption.label
    }
  } else {
    // 使用addedTask.assignee去查找assigneeOptions的label进行赋值
    const assigneeOption = assigneeOptions.value.find(option => option.value === res.task.assignee)
    if (assigneeOption) {
      res.task.assigneeName = assigneeOption.label
    }
    tasks.value.push(res.task)
  }
}
</script>
<template>
  <div>
    <!-- 工具设置面板 -->
    <div class="tool-settings-panel">
      <h3>🔧 External Control Demo</h3>

      <!-- 当前状态显示 -->
      <div class="status-section">
        <div class="status-item">
          <span class="status-label">Fullscreen:</span>
          <span :class="['status-value', { active: fullscreenStatus }]">
            {{ fullscreenStatus ? '✓ Yes' : '✗ No' }}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">Expand All:</span>
          <span :class="['status-value', { active: expandStatus }]">
            {{ expandStatus ? '✓ Yes' : '✗ No' }}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">Locale:</span>
          <span class="status-value active">{{ currentLocaleStatus }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Time Scale:</span>
          <span class="status-value active">{{ currentScaleStatus }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Theme:</span>
          <span class="status-value active">{{ currentThemeStatus }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Control Mode:</span>
          <span
            class="status-value active"
            :style="{ color: controlMode === 'props' ? '#67c23a' : '#409eff' }"
          >
            {{ controlMode === 'props' ? '📝 Props' : '⚡ Expose' }}
          </span>
        </div>
      </div>

      <!-- 控制模式切换 -->
      <div class="control-mode-section">
        <h4>🎛️ Control Mode</h4>
        <div class="button-group">
          <button
            class="mode-button"
            :class="{ active: controlMode === 'expose' }"
            @click="controlMode = 'expose'"
          >
            ⚡ Expose Methods
          </button>
          <button
            class="mode-button"
            :class="{ active: controlMode === 'props' }"
            @click="controlMode = 'props'"
          >
            📝 Props Control
          </button>
        </div>
      </div>

      <!-- Expose 方法控制 -->
      <div v-show="controlMode === 'expose'" class="control-section">
        <h4>⚡ Expose Methods Control</h4>

        <div class="controls-flow">
          <div class="control-group">
            <label>Fullscreen:</label>
            <button class="control-btn" @click="handleToggleFullscreen">Toggle Fullscreen</button>
          </div>

          <div class="control-group">
            <label>Expand All:</label>
            <button class="control-btn" @click="handleToggleExpandAll">Toggle Expand All</button>
          </div>

          <div class="control-group">
            <label>Locale:</label>
            <div class="button-group">
              <button class="control-btn" @click="handleSetLocale('zh-CN')">中文</button>
              <button class="control-btn" @click="handleSetLocale('en-US')">English</button>
            </div>
          </div>

          <div class="control-group">
            <label>Time Scale:</label>
            <div class="button-group">
              <button class="control-btn" @click="handleSetTimeScale('day')">Day</button>
              <button class="control-btn" @click="handleSetTimeScale('week')">Week</button>
              <button class="control-btn" @click="handleSetTimeScale('month')">Month</button>
            </div>
          </div>

          <div class="control-group">
            <label>Theme:</label>
            <div class="button-group">
              <button class="control-btn" @click="handleSetTheme('light')">☀️ Light</button>
              <button class="control-btn" @click="handleSetTheme('dark')">🌙 Dark</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Props 控制 -->
      <div v-show="controlMode === 'props'" class="control-section">
        <h4>📝 Props Control</h4>

        <div class="controls-flow">
          <div class="control-group">
            <label>Locale Prop:</label>
            <div class="button-group">
              <button
                class="control-btn"
                :class="{ primary: propsLocale === 'zh-CN' }"
                @click="propsLocale = 'zh-CN'"
              >
                中文
              </button>
              <button
                class="control-btn"
                :class="{ primary: propsLocale === 'en-US' }"
                @click="propsLocale = 'en-US'"
              >
                English
              </button>
            </div>
            <p class="prop-info">:locale="{{ propsLocale }}"</p>
          </div>

          <div class="control-group">
            <label>Theme Prop:</label>
            <div class="button-group">
              <button
                class="control-btn"
                :class="{ primary: propsTheme === 'light' }"
                @click="propsTheme = 'light'"
              >
                ☀️ Light
              </button>
              <button
                class="control-btn"
                :class="{ primary: propsTheme === 'dark' }"
                @click="propsTheme = 'dark'"
              >
                🌙 Dark
              </button>
            </div>
            <p class="prop-info">:theme="{{ propsTheme }}"</p>
          </div>

          <div class="control-group">
            <label>Time Scale Prop:</label>
            <div class="button-group">
              <button
                class="control-btn"
                :class="{ primary: propsTimeScale === 'day' }"
                @click="propsTimeScale = 'day'"
              >
                Day
              </button>
              <button
                class="control-btn"
                :class="{ primary: propsTimeScale === 'week' }"
                @click="propsTimeScale = 'week'"
              >
                Week
              </button>
              <button
                class="control-btn"
                :class="{ primary: propsTimeScale === 'month' }"
                @click="propsTimeScale = 'month'"
              >
                Month
              </button>
            </div>
            <p class="prop-info">:time-scale="{{ propsTimeScale }}"</p>
          </div>

          <div class="control-group">
            <label>Fullscreen Prop:</label>
            <div class="button-group">
              <button
                class="control-btn"
                :class="{ primary: propsFullscreen }"
                @click="propsFullscreen = true"
              >
                ✓ True
              </button>
              <button
                class="control-btn"
                :class="{ primary: !propsFullscreen }"
                @click="propsFullscreen = false"
              >
                ✗ False
              </button>
            </div>
            <p class="prop-info">:fullscreen="{{ propsFullscreen }}"</p>
          </div>

          <div class="control-group">
            <label>Expand All Prop:</label>
            <div class="button-group">
              <button
                class="control-btn"
                :class="{ primary: propsExpandAll }"
                @click="propsExpandAll = true"
              >
                ✓ True
              </button>
              <button
                class="control-btn"
                :class="{ primary: !propsExpandAll }"
                @click="propsExpandAll = false"
              >
                ✗ False
              </button>
            </div>
            <p class="prop-info">:expand-all="{{ propsExpandAll }}"</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Gantt Chart -->
    <div style="height: 600px; margin-top: 20px">
      <GanttChart
        ref="ganttRef"
        :tasks="tasks"
        :milestones="milestones"
        :resources="resources"
        :locale="controlMode === 'props' ? propsLocale : undefined"
        :theme="controlMode === 'props' ? propsTheme : undefined"
        :time-scale="controlMode === 'props' ? propsTimeScale : undefined"
        :fullscreen="controlMode === 'props' ? propsFullscreen : undefined"
        :expand-all="controlMode === 'props' ? propsExpandAll : undefined"
        :task-list-config="taskListConfig"
        :toolbar-config="toolbarConfig"
        :use-default-drawer="false"
        :use-default-milestone-dialog="false"
        :locale-messages="customMessages"
        :allow-drag-and-resize="true"
        :enable-task-row-move="true"
        :assignee-options="assigneeOptions"
        @task-row-moved="handleTaskRowMoved"
        @add-task="showAddTaskDrawer = true"
        @add-milestone="showAddMilestoneDialog = true"
        @task-double-click="onTaskDblclick"
        @task-click="onTaskClick"
        @milestone-double-click="onMilestoneDblclick"
        @task-added="onTaskAdded"
      >
      </GanttChart>
    </div>
    <!-- 自定义添加任务按钮 -->
    <div>
      <button class="gantt-btn gantt-btn-primary" @click="showAddTaskDrawer = true">
        添加任务
      </button>
      <button class="gantt-btn gantt-btn-primary" @click="showAddMilestoneDialog = true">
        添加里程碑
      </button>
    </div>

    <!-- 自定义抽屉组件 (原生HTML替代 el-drawer) -->
    <div v-if="showAddTaskDrawer" class="drawer-overlay" @click="showAddTaskDrawer = false">
      <div class="drawer-container" @click.stop>
        <div class="drawer-header">
          <h3>自定义添加任务组件</h3>
          <button class="close-btn" @click="showAddTaskDrawer = false">×</button>
        </div>

        <div class="drawer-body">
          <div class="form-item">
            <label>任务名称:</label>
            <input v-model="newTask.name" type="text" placeholder="请输入任务名称" />
          </div>

          <div class="form-item">
            <label>开始日期:</label>
            <input v-model="newTask.startDate" type="date" />
          </div>

          <div class="form-item">
            <label>结束日期:</label>
            <input v-model="newTask.endDate" type="date" />
          </div>
        </div>

        <div class="drawer-footer">
          <button class="gantt-btn gantt-btn-primary" @click="addTask">确定</button>
          <button class="gantt-btn gantt-btn-default" @click="showAddTaskDrawer = false">
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- 自定义Dialog组件基于element plus -->
    <el-dialog
      title="自定义添加里程碑组件 - Element Plus"
      v-model="showAddMilestoneDialog"
      width="400px"
      @close="newTask = { name: '', startDate: '', endDate: '' }"
    >
      <template #default>
        <div class="form-item">
          <label>任务名称:</label>
          <el-input v-model="newTask.name" placeholder="请输入任务名称" />
        </div>

        <div class="form-item">
          <label>日期:</label>
          <el-date-picker v-model="newTask.startDate" type="date" value-format="YYYY-MM-DD" />
        </div>
      </template>

      <template #footer>
        <el-button @click="addMilestone">确定</el-button>
        <el-button @click="showAddMilestoneDialog = false">取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 工具设置面板 */
.tool-settings-panel {
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.tool-settings-panel h3 {
  margin: 0 0 15px 0;
  font-size: 18px;
  color: #303133;
}

.tool-settings-panel h4 {
  margin: 15px 0 10px 0;
  font-size: 14px;
  color: #606266;
  font-weight: 600;
}

/* 状态显示区域 */
.status-section {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px;
  background: white;
  border-radius: 6px;
  margin-bottom: 15px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 13px;
}

.status-label {
  color: #909399;
  font-weight: 500;
}

.status-value {
  color: #606266;
  font-weight: 600;
}

.status-value.active {
  color: #409eff;
}

/* 控制模式区域 */
.control-mode-section {
  margin-bottom: 15px;
}

.mode-button {
  padding: 8px 20px;
  border: 1px solid #dcdfe6;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.3s;
}

.mode-button:hover {
  border-color: #409eff;
  color: #409eff;
}

.mode-button.active {
  background: #409eff;
  color: white;
  border-color: #409eff;
}

/* 控制区域 */
.control-section {
  background: white;
  padding: 15px;
  border-radius: 6px;
}

/* 控制项流式布局容器 */
.controls-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  align-items: flex-start;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-group label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
  white-space: nowrap;
}

.button-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.control-btn {
  padding: 6px 16px;
  border: 1px solid #dcdfe6;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s;
}

.control-btn:hover {
  border-color: #409eff;
  color: #409eff;
}

.control-btn.primary {
  background: #67c23a;
  color: white;
  border-color: #67c23a;
}

.prop-info {
  margin: 5px 0 0 0;
  font-size: 11px;
  color: #909399;
  font-family: 'Courier New', monospace;
}

/* 暗色主题 */
:global(html[data-theme='dark']) .tool-settings-panel {
  background: #1e1e1e;
  border-color: #3a3a3a;
}

:global(html[data-theme='dark']) .tool-settings-panel h3,
:global(html[data-theme='dark']) .tool-settings-panel h4 {
  color: #e0e0e0;
}

:global(html[data-theme='dark']) .status-section {
  background: #2a2a2a;
}

:global(html[data-theme='dark']) .status-item {
  background: #1e1e1e;
}

:global(html[data-theme='dark']) .control-section {
  background: #2a2a2a;
}

:global(html[data-theme='dark']) .mode-button,
:global(html[data-theme='dark']) .control-btn {
  background: #2a2a2a;
  border-color: #3a3a3a;
  color: #e0e0e0;
}

:global(html[data-theme='dark']) .mode-button:hover,
:global(html[data-theme='dark']) .control-btn:hover {
  border-color: #409eff;
}

:global(html[data-theme='dark']) .mode-button.active {
  background: #409eff;
}

/* 抽屉遮罩层 */
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
  animation: fadeIn 0.3s;
}

/* 抽屉容器 */
.drawer-container {
  width: 400px;
  max-width: 90%;
  background: white;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s;
}

/* 抽屉头部 */
.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e8e8e8;
}

.drawer-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: #f5f5f5;
  color: #333;
}

/* 抽屉主体 */
.drawer-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

/* 表单项 */
.form-item {
  margin-bottom: 20px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.form-item input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
  transition: border-color 0.3s;
}

.form-item input:focus {
  outline: none;
  border-color: #409eff;
}

/* 抽屉底部 */
.drawer-footer {
  padding: 16px 20px;
  border-top: 1px solid #e8e8e8;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

/* 按钮样式 */
.btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  transition: all 0.3s;
}

.gantt-btn-primary {
  background: #409eff;
  color: white;
  border-color: #409eff;
}

.gantt-btn-primary:hover {
  background: #66b1ff;
  border-color: #66b1ff;
}

.gantt-btn-default {
  background: white;
  color: #606266;
}

.gantt-btn-default:hover {
  color: #409eff;
  border-color: #409eff;
}

/* 动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
</style>

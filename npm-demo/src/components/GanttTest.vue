<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from 'jordium-gantt-vue3'
import 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'

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
  }
])

const milestones = ref([
  {
    id: 101,
    name: '项目立项',
    startDate: '2025-10-29',
    type: 'milestone',
    icon: 'diamond'
  }
])

const customMessages = {
  'zh-CN': {
    department: '部门',
    departmentCode: '部门编号',
    // 其他文本
    days: '天111',
    hours: '小时111',
    overtime: '超时111',
    overdue: '逾期111',
  },
  'en-US': {
    department: 'Department',
    departmentCode: 'Department Code',
    // 其他文本
    days: 'Day111',
    hours: 'Hour111',
    overtime: 'OverTime111',
    overdue: 'OverDue111',
  }
}
// const tasks = ref([])

// const milestones = ref([])

const showAddTaskDrawer = ref(false);
const showAddMilestoneDialog = ref(false);

// 定义可动态配置的列
const availableColumns = ref<TaskListColumnConfig[]>([
  { key: 'startDate', label: '开始日期', visible: true },
  { key: 'endDate', label: '结束日期', visible: true },
  { key: 'progress', label: '进度', visible: true },
  { key: 'department', label: '部门', visible: true, width: 200 },
  { key: 'departmentCode', label: '部门编号', visible: true },
  { key: 'assigneeName', label: '负责人', visible: true },
])

// 使用内置TaskDrawer组件的时候，可以传入负责人选项
// 请先设置GanttChart组件属性use-default-drawer="true"
const assigneeOptions = ref([
  { value: 'zhangsan', label: '张三' },
  { value: 'lisi', label: '李四' },
  { value: 'wangwu', label: '王五' },
])

// TaskList宽度配置示例
const taskListConfig = {
  defaultWidth: '50%',  // 默认展开宽度50%
  minWidth: '300px',      // 最小宽度300px（默认280px）
  maxWidth: '1200px',      // 最大宽度1200px（默认1160px）
  columns: availableColumns.value
}

// toolbar配置示例
const toolbarConfig: ToolbarConfig = {
  showAddTask: true,               // 显示添加任务按钮
  showAddMilestone: true,          // 显示添加里程碑按钮
  showTodayLocate: true,           // 显示定位到今天按钮
  showExportCsv: true,             // 显示导出CSV按钮
  showExportPdf: true,             // 显示导出PDF按钮
  showLanguage: true,              // 显示语言切换按钮
  showTheme: true,                 // 显示主题切换按钮
  showFullscreen: true,            // 显示全屏按钮
  showTimeScale: true,             // 显示时间刻度按钮组
  timeScaleDimensions: [           // 显示所有时间刻度维度
    'hour', 'day', 'week', 'month', 'quarter', 'year'
  ],
  defaultTimeScale: 'week',        // 默认选中周视图
  showExpandCollapse: false         // 显示展开/折叠按钮
}


const newTask = ref({
  name: '',
  startDate: '',
  endDate: ''
});

const addTask = () => {
  tasks.value.push({
    id: tasks.value.length + 1,
    name: newTask.value.name,
    startDate: newTask.value.startDate,
    endDate: newTask.value.endDate,
    progress: 0,
  });
  newTask.value = { name: '', startDate: '', endDate: '' };
  showAddTaskDrawer.value = false;
};

const addMilestone = () => {
  milestones.value.push({
    id: milestones.value.length + 1,
    name: newTask.value.name,
    startDate: newTask.value.startDate,
    progress: 0,
    type: 'milestone',
    icon: 'diamond',
  });
  newTask.value = { name: '', startDate: '', endDate: '' };
  showAddMilestoneDialog.value = false;
}

const onTaskDblclick = (task) => {
  alert(`双击任务: ${task.name}`)
}
const onTaskClick = (task) => {
  alert(`单击任务: ${task.name}`)
}
const onMilestoneDblclick = (milestone) => {
  alert(`双击里程碑: ${milestone.name}`)
}

// 任务行拖拽完成事件（可选）
const handleTaskRowMoved = async (payload: {
  draggedTask: Task
  targetTask: Task
  position: 'after' | 'child'
  oldParent: Task | null
  newParent: Task | null
}) => {
  const { draggedTask, targetTask, position, oldParent, newParent } = payload

  // 组件已自动完成任务移动、parentId更新和TaskList/Timeline同步
  // 监听此事件为完全可选，仅用于：

  // 1. 显示自定义提示消息
  const oldParentName = oldParent?.name || '根目录'
  const newParentName = newParent?.name || '根目录'
  const positionText = position === 'after' ? '在目标任务之后' : '作为目标任务的子任务'
  alert(`任务 [${draggedTask.name}] 已从 [${oldParentName}] 移动到 [${newParentName}] (${positionText})`, 'success')

  // 2. 调用后端 API 保存新的任务层级关系
  try {
    await api.updateTaskHierarchy({
      taskId: draggedTask.id,
      targetTaskId: targetTask.id,
      position: position,
      oldParentId: oldParent?.id,
      newParentId: newParent?.id,
    })
  } catch (error) {
    console.error('保存任务层级失败:', error)
    alert('保存失败，请刷新页面')
  }

  // 3. 触发其他业务逻辑（如更新关联数据、记录操作日志等）
  // ...
}

// 任务添加后回调
const onTaskAdded = (res) => {
  const addedTask = tasks.value.find(t => t.id === res.task.id);
  if (addedTask) {
    // 使用addedTask.assignee去查找assigneeOptions的label进行赋值
    const assigneeOption = assigneeOptions.value.find(option => option.value === addedTask.assignee);
    if (assigneeOption) {
      addedTask.assigneeName = assigneeOption.label;
    }
  } else {
    // 使用addedTask.assignee去查找assigneeOptions的label进行赋值
    const assigneeOption = assigneeOptions.value.find(option => option.value === res.task.assignee);
    if (assigneeOption) {
      res.task.assigneeName = assigneeOption.label;
    }
    tasks.value.push(res.task);
  }
};
</script>

<template>
  <div>
    <div style="height: 600px;">
      <GanttChart
        :tasks="tasks"
        :milestones="milestones"
        :task-list-config="taskListConfig"
        :toolbar-config="toolbarConfig"
        :use-default-drawer="false"
        :use-default-milestone-dialog="false"
        :locale-messages="customMessages"
        :allow-drag-and-resize="true"
        :enable-task-row-move="true"
        :assignee-options="assigneeOptions"
        @task-row-moved="handleTaskRowMoved"
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
      <button class="btn btn-primary" @click="showAddTaskDrawer = true">添加任务</button>
      <button class="btn btn-primary" @click="showAddMilestoneDialog = true">添加里程碑</button>
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
          <button class="gantt-btn gantt-btn-default" @click="showAddTaskDrawer = false">取消</button>
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
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
</style>

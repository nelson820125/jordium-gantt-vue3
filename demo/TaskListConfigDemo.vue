<script setup lang="ts">
import { ref, reactive } from 'vue'
import { GanttChart } from '../src/index'
import type { Task } from '../src/models/classes/Task'
import type { TaskListConfig, TaskListColumnConfig } from '../src/models/configs/TaskListConfig'

// 示例任务数据
const tasks = ref<Task[]>([
  {
    id: 1,
    name: '项目启动',
    startDate: '2024-01-15',
    endDate: '2024-01-20',
    progress: 100,
    assignee: '张三',
    estimatedHours: 40,
    actualHours: 35,
    predecessor: null,
    type: 'task',
  },
  {
    id: 2,
    name: '需求分析',
    startDate: '2024-01-21',
    endDate: '2024-01-30',
    progress: 80,
    assignee: '李四',
    estimatedHours: 80,
    actualHours: 75,
    predecessor: [1],
    type: 'task',
  },
  {
    id: 3,
    name: '系统设计',
    startDate: '2024-02-01',
    endDate: '2024-02-15',
    progress: 60,
    assignee: '王五',
    estimatedHours: 120,
    actualHours: 90,
    predecessor: [3],
    type: 'task',
  },
  {
    id: 4,
    name: '开发实现',
    startDate: '2024-02-16',
    endDate: '2024-03-30',
    progress: 30,
    assignee: '赵六',
    estimatedHours: 200,
    actualHours: 80,
    predecessor: [3],
    type: 'task',
  },
] as Task[])

// 可用的列配置
const availableColumns = reactive<TaskListColumnConfig[]>([
  { key: 'predecessor', label: '前置任务', visible: true },
  { key: 'assignee', label: '负责人', visible: true },
  { key: 'startDate', label: '开始日期', visible: true },
  { key: 'endDate', label: '结束日期', visible: true },
  { key: 'estimatedHours', label: '预估工时', visible: true },
  { key: 'actualHours', label: '实际工时', visible: true },
  { key: 'progress', label: '进度', visible: true },
])

// 任务列表配置
const taskListConfig = reactive<TaskListConfig>({
  columns: availableColumns,
})

// 切换列显示状态
const toggleColumn = (columnKey: string, visible: boolean) => {
  const column = availableColumns.find(col => col.key === columnKey)
  if (column) {
    column.visible = visible
  }
}
</script>

<template>
  <div class="demo-container">
    <h1>TaskList 列配置演示</h1>
    <div class="config-section">
      <h3>列配置:</h3>
      <div class="column-controls">
        <label v-for="column in availableColumns" :key="column.key" class="column-control">
          <input
            type="checkbox"
            :checked="column.visible"
            @change="toggleColumn(column.key, $event.target.checked)"
          />
          {{ column.label }}
        </label>
      </div>
    </div>

    <div class="gantt-container">
      <GanttChart
        :tasks="tasks"
        :task-list-config="taskListConfig"
        :show-toolbar="false"
      />
    </div>
  </div>
</template>
import { ref, reactive } from 'vue'
import { GanttChart } from '../src/index'
import type { Task } from '../src/models/classes/Task'
import type { TaskListConfig, TaskListColumnConfig } from '../src/models/configs/TaskListConfig'

// 示例任务数据
const tasks = ref<Task[]>([
  {
    id: 1,
    name: '项目启动',
    startDate: '2024-01-15',
    endDate: '2024-01-20',
    progress: 100,
    assignee: '张三',
    estimatedHours: 40,
    actualHours: 35,
    predecessor: null,
    type: 'task'
  },
  {
    id: 2,
    name: '需求分析',
    startDate: '2024-01-21',
    endDate: '2024-01-30',
    progress: 80,
    assignee: '李四',
    estimatedHours: 80,
    actualHours: 75,
    predecessor: [1],
    type: 'task'
  },
  {
    id: 3,
    name: '系统设计',
    startDate: '2024-02-01',
    endDate: '2024-02-15',
    progress: 60,
    assignee: '王五',
    estimatedHours: 120,
    actualHours: 90,
    predecessor: [2],
    type: 'task'
  },
  {
    id: 4,
    name: '开发实现',
    startDate: '2024-02-16',
    endDate: '2024-03-30',
    progress: 30,
    assignee: '赵六',
    estimatedHours: 200,
    actualHours: 80,
    predecessor: [3],
    type: 'task'
  }
] as Task[])

// 可用的列配置
const availableColumns = reactive<TaskListColumnConfig[]>([
  { key: 'predecessor', label: '前置任务', visible: true },
  { key: 'assignee', label: '负责人', visible: true },
  { key: 'startDate', label: '开始日期', visible: true },
  { key: 'endDate', label: '结束日期', visible: true },
  { key: 'estimatedHours', label: '预估工时', visible: true },
  { key: 'actualHours', label: '实际工时', visible: true },
  { key: 'progress', label: '进度', visible: true }
])

// 任务列表配置
const taskListConfig = reactive<TaskListConfig>({
  columns: availableColumns
})

// 切换列显示状态
const toggleColumn = (columnKey: string, visible: boolean) => {
  const column = availableColumns.find(col => col.key === columnKey)
  if (column) {
    column.visible = visible
  }
}
</script>

<style scoped>
.demo-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.config-section {
  background: #f5f5f5;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.column-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.column-control {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.column-control input[type="checkbox"] {
  cursor: pointer;
}

.gantt-container {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  height: 400px;
}

h1 {
  color: #333;
  margin-bottom: 20px;
}

h3 {
  color: #666;
  margin: 0 0 10px 0;
}
</style>

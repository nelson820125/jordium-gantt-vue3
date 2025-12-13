<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart } from '../src/index'
import type { Task } from '../src/models/classes/Task'

// 示例任务数据
const tasks = ref<Task[]>([
  {
    id: 1,
    name: '项目规划',
    type: 'story',
    startDate: '2024-01-01',
    endDate: '2024-01-15',
    progress: 100,
    assignee: '张三',
    collapsed: false,
    children: [
      {
        id: 11,
        name: '需求分析',
        type: 'task',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 100,
        assignee: '李四',
      },
      {
        id: 12,
        name: '技术方案设计',
        type: 'task',
        startDate: '2024-01-06',
        endDate: '2024-01-15',
        progress: 100,
        assignee: '王五',
      },
    ],
  },
  {
    id: 2,
    name: '开发阶段',
    type: 'story',
    startDate: '2024-01-16',
    endDate: '2024-02-28',
    progress: 65,
    assignee: '张三',
    collapsed: false,
    children: [
      {
        id: 21,
        name: '前端开发',
        type: 'task',
        startDate: '2024-01-16',
        endDate: '2024-02-15',
        progress: 80,
        assignee: '赵六',
      },
      {
        id: 22,
        name: '后端开发',
        type: 'task',
        startDate: '2024-01-16',
        endDate: '2024-02-20',
        progress: 70,
        assignee: '孙七',
      },
      {
        id: 23,
        name: '数据库设计',
        type: 'task',
        startDate: '2024-01-20',
        endDate: '2024-02-10',
        progress: 50,
        assignee: '周八',
      },
    ],
  },
  {
    id: 3,
    name: '测试上线',
    type: 'story',
    startDate: '2024-03-01',
    endDate: '2024-03-15',
    progress: 30,
    assignee: '张三',
    collapsed: false,
    children: [
      {
        id: 31,
        name: '功能测试',
        type: 'task',
        startDate: '2024-03-01',
        endDate: '2024-03-08',
        progress: 40,
        assignee: '吴九',
      },
      {
        id: 32,
        name: '性能优化',
        type: 'task',
        startDate: '2024-03-05',
        endDate: '2024-03-12',
        progress: 20,
        assignee: '郑十',
      },
      {
        id: 33,
        name: '生产部署',
        type: 'task',
        startDate: '2024-03-13',
        endDate: '2024-03-15',
        progress: 0,
        assignee: '钱十一',
      },
    ],
  },
])

const milestones = ref<Task[]>([])

// Helper function for progress bar background
const getProgressColor = (progress: number) => {
  if (progress >= 100) return '#67c23a'
  if (progress >= 50) return '#409eff'
  return '#e6a23c'
}
</script>

<template>
  <div class="declarative-demo">
    <h1>声明式列定义演示 (Declarative Columns Demo)</h1>

    <div class="demo-section">
      <h2>示例 1: 基础声明式列</h2>
      <GanttChart
        :tasks="tasks"
        :milestones="milestones"
        task-list-column-render-mode="declarative"
        :show-toolbar="false"
        style="height: 400px"
      >
      <TaskListColumn prop="assignee" label="负责人" width="120" align="center" />
        <TaskListColumn prop="name" label="任务名称" width="300" />

        <TaskListColumn prop="startDate" label="开始日期" width="140" />
        <TaskListColumn prop="endDate" label="结束日期" width="140" />
        <TaskListColumn prop="progress" label="进度" width="100" align="center" />
      </GanttChart>
    </div>

    <div class="demo-section">
      <h2>示例 2: 使用默认 Slot 自定义列内容</h2>
      <GanttChart
        :tasks="tasks"
        :milestones="milestones"
        task-list-column-render-mode="declarative"
        :show-toolbar="false"
        style="height: 400px"
      >
        <TaskListColumn prop="name" label="任务名称" width="300" />

        <!-- 自定义负责人列显示 -->
        <TaskListColumn prop="assignee" label="负责人" width="150" align="center">
          <template #default="scope">
            <div class="assignee-cell">
              <div class="avatar">
                {{ scope.row.assignee ? scope.row.assignee.charAt(0).toUpperCase() : '?' }}
              </div>
              <span>{{ scope.row.assignee || '未分配' }}</span>
            </div>
          </template>
        </TaskListColumn>

        <!-- 自定义进度列显示 -->
        <TaskListColumn prop="progress" label="进度" width="150" align="center">
          <template #default="scope">
            <div class="progress-cell">
              <div class="progress-bar-container">
                <div
                  class="progress-bar"
                  :style="{
                    width: `${scope.row.progress || 0}%`,
                    background: getProgressColor(scope.row.progress || 0),
                  }"
                ></div>
              </div>
              <span class="progress-text">{{ scope.row.progress || 0 }}%</span>
            </div>
          </template>
        </TaskListColumn>

        <TaskListColumn prop="startDate" label="开始" width="120" />
        <TaskListColumn prop="endDate" label="结束" width="120" />
      </GanttChart>
    </div>

    <div class="demo-section">
      <h2>示例 3: 自定义表头</h2>
      <GanttChart
        :tasks="tasks"
        :milestones="milestones"
        task-list-column-render-mode="declarative"
        :show-toolbar="false"
        style="height: 400px"
      >
        <TaskListColumn prop="name" width="300">
          <template #header>
            <div class="header-with-icon">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              <span class="header-title">任务信息</span>
            </div>
          </template>
        </TaskListColumn>

        <TaskListColumn prop="assignee" width="150">
          <template #header>
            <div class="header-success">👤 负责人</div>
          </template>
        </TaskListColumn>

        <TaskListColumn prop="progress" width="150">
          <template #header>
            <div class="header-warning">📊 完成度</div>
          </template>
          <template #default="scope">
            <span :class="scope.row.progress >= 100 ? 'text-success' : 'text-warning'">
              {{ scope.row.progress || 0 }}%
            </span>
          </template>
        </TaskListColumn>

        <TaskListColumn prop="startDate" label="开始日期" width="140" />
        <TaskListColumn prop="endDate" label="结束日期" width="140" />
      </GanttChart>
    </div>
  </div>
</template>

<style scoped>
.declarative-demo {
  padding: 20px;
  background: #f5f5f5;
  min-height: 100vh;
}

h1 {
  color: #333;
  margin-bottom: 30px;
}

.demo-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.demo-section h2 {
  color: #409eff;
  margin-bottom: 15px;
  font-size: 18px;
}

.assignee-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #409eff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.progress-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar-container {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  transition: width 0.3s;
}

.progress-text {
  min-width: 40px;
  text-align: right;
}

.header-with-icon {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #409eff;
}

.header-title {
  font-weight: bold;
}

.header-success {
  color: #67c23a;
  font-weight: bold;
}

.header-warning {
  color: #e6a23c;
  font-weight: bold;
}

.text-success {
  color: #67c23a;
}

.text-warning {
  color: #e6a23c;
}
</style>


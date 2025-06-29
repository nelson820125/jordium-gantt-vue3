<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import GanttChart from '../src/components/GanttChart.vue'
import TaskDrawer from '../src/components/TaskDrawer.vue'
import MilestoneDialog from '../src/components/MilestoneDialog.vue'
import demoData from './data.json'
import packageInfo from '../package.json'
// 导入主题变量
import '../src/styles/theme-variables.css'
import VersionHistoryDrawer from './VersionHistoryDrawer.vue'
import { useMessage } from '../src/composables/useMessage'
import type { Task } from '../src/models/Task'

const { showMessage } = useMessage()

const tasks = ref<Task[]>([])
const milestones = ref<Task[]>([])

// TaskDrawer状态管理
const showTaskDrawer = ref(false)
const currentTask = ref<Task | null>(null)
const isEditMode = ref(false)

// MilestoneDialog状态管理
const showMilestoneDialog = ref(false)
const currentMilestone = ref<Task | null>(null)
const isMilestoneEditMode = ref(false)

// 版本历史Drawer状态
const showVersionDrawer = ref(false)

const toolbarConfig = {
  showAddTask: true,
  showAddMilestone: true,
  showTodayLocate: true,
  showExportCsv: true,
  showExportPdf: true,
  showLanguage: true,
  showTheme: true,
  showFullscreen: true,
}

// 自定义CSV导出处理器（可选）
const handleCustomCsvExport = () => {
  showMessage('自定义CSV导出被调用', 'info', { closable: true })

  // 这里可以实现自定义的CSV导出逻辑
  // 例如：添加额外的数据处理、格式化、或发送到服务器等

  // 如果不实现自定义逻辑，组件会使用内置的默认导出功能
  // return false // 返回false让组件使用默认实现

  // 示例：这里直接使用默认实现
  return false
}

// 其他工具栏事件处理器示例
const handleAddTask = () => {
  // 打开TaskDrawer进行新建任务
  currentTask.value = null
  isEditMode.value = false
  showTaskDrawer.value = true
}

const handleAddMilestone = () => {
  // 打开MilestoneDialog进行新建里程碑
  currentMilestone.value = null
  isMilestoneEditMode.value = false
  showMilestoneDialog.value = true
}

const handleLanguageChange = (lang: 'zh' | 'en') => {
  showMessage(`语言切换到：${lang}`, 'info', { closable: true })
}

const handleThemeChange = (isDark: boolean) => {
  showMessage(`主题切换到：${isDark ? '暗黑模式' : '明亮模式'}`, 'info', { closable: true })
}

// 里程碑保存处理器示例
const handleMilestoneSave = (milestone: Task) => {
  // 更新本地里程碑数据
  const milestoneIndex = milestones.value.findIndex(m => m.id === milestone.id)
  if (milestoneIndex !== -1) {
    // 更新现有里程碑
    milestones.value[milestoneIndex] = { ...milestone }
  } else {
    // 新增里程碑
    const newMilestone = {
      ...milestone,
      id: Date.now(), // 生成临时ID
      type: 'milestone',
    }
    milestones.value.push(newMilestone)
  }

  // 关闭里程碑对话框
  showMilestoneDialog.value = false
}

// 里程碑删除处理器
const handleMilestoneDelete = async (milestoneId: number) => {
  // 从里程碑数据中删除
  const milestoneIndex = milestones.value.findIndex(m => m.id === milestoneId)
  if (milestoneIndex !== -1) {
    milestones.value.splice(milestoneIndex, 1)
    showMessage('里程碑删除成功', 'success', { closable: false })

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
  }

  // 关闭里程碑对话框
  showMilestoneDialog.value = false
}

// 任务更新处理器
const handleTaskUpdate = (updatedTask: Task) => {
  // 先找到原任务，检查parentId是否改变了
  const findOriginalTask = (taskArray: Task[]): Task | null => {
    for (const task of taskArray) {
      if (task.id === updatedTask.id) {
        return task
      }
      if (task.children && task.children.length > 0) {
        const found = findOriginalTask(task.children)
        if (found) return found
      }
    }
    return null
  }

  const originalTask = findOriginalTask(tasks.value)
  if (!originalTask) {
    showMessage(`未找到要更新的任务，ID： ${updatedTask.id}`, 'warning', { closable: true })
    return
  }

  // 检查parentId是否改变了
  const parentIdChanged = originalTask.parentId !== updatedTask.parentId

  if (parentIdChanged) {
    // parentId改变了，需要移除任务并重新添加到新位置
    const removeTaskFromArray = (taskArray: Task[]): Task | null => {
      for (let i = 0; i < taskArray.length; i++) {
        if (taskArray[i].id === updatedTask.id) {
          const removedTask = taskArray.splice(i, 1)[0]
          return removedTask
        }

        if (taskArray[i].children && taskArray[i].children.length > 0) {
          const removedTask = removeTaskFromArray(taskArray[i].children!)
          if (removedTask) {
            if (taskArray[i].children!.length === 0) {
              delete taskArray[i].children
              taskArray[i].isParent = taskArray[i].type === 'story'
            }
            return removedTask
          }
        }
      }
      return null
    }

    const removedTask = removeTaskFromArray(tasks.value)
    if (!removedTask) return

    const taskToAdd = {
      ...updatedTask,
      isParent:
        updatedTask.type === 'story' || (updatedTask.children && updatedTask.children.length > 0),
    }

    // 重新添加到新位置
    if (taskToAdd.parentId) {
      const addToParentChildren = (taskArray: Task[]): boolean => {
        for (const task of taskArray) {
          if (task.id === taskToAdd.parentId) {
            if (!task.children) task.children = []
            task.children.push(taskToAdd)
            task.isParent = true
            return true
          }
          if (task.children && task.children.length > 0) {
            if (addToParentChildren(task.children)) return true
          }
        }
        return false
      }

      if (!addToParentChildren(tasks.value)) {
        showMessage(`未找到新父任务，ID： ${taskToAdd.parentId}，将作为顶级任务添加`, 'warning', {
          closable: true,
        })
        tasks.value.push(taskToAdd)
      }
    } else {
      tasks.value.push(taskToAdd)
    }
  } else {
    // parentId没有改变，只是就地更新任务数据
    const updateTaskInPlace = (taskArray: Task[]): boolean => {
      for (let i = 0; i < taskArray.length; i++) {
        if (taskArray[i].id === updatedTask.id) {
          // 保持原有的children和层级关系
          taskArray[i] = {
            ...updatedTask,
            children: taskArray[i].children, // 保持原有的children
            isParent:
              updatedTask.type === 'story' ||
              (taskArray[i].children && taskArray[i].children.length > 0),
          }
          return true
        }

        if (taskArray[i].children && taskArray[i].children.length > 0) {
          if (updateTaskInPlace(taskArray[i].children!)) {
            return true
          }
        }
      }
      return false
    }

    if (!updateTaskInPlace(tasks.value)) {
      showMessage(`就地更新失败，未找到任务，ID： ${updatedTask.id}`, 'warning', { closable: true })
    }
  }

  showMessage('任务更新完成', 'success', { closable: false })
}

// 任务添加处理器
const handleTaskAdd = (newTask: Task) => {
  // 为新任务生成ID（如果没有的话）
  if (!newTask.id) {
    // 找到当前最大的ID，然后+1
    const maxId = Math.max(
      ...tasks.value.map(t => t.id || 0),
      ...milestones.value.map(m => m.id || 0),
      0,
    )
    newTask.id = maxId + 1
  }

  // 设置isParent属性
  newTask.isParent = newTask.type === 'story' || (newTask.children && newTask.children.length > 0)

  // 处理父子关系
  if (newTask.parentId) {
    // 如果有上级任务，需要将子任务添加到父任务的children中
    const addToParentChildren = (taskArray: Task[]): boolean => {
      for (const task of taskArray) {
        if (task.id === newTask.parentId) {
          // 找到父任务
          if (!task.children) {
            // 如果父任务没有children属性，创建一个
            task.children = []
          }
          // 将新任务添加到父任务的children中
          task.children.push({ ...newTask })
          return true
        }
        // 递归查找父任务（支持多层嵌套）
        if (task.children && task.children.length > 0) {
          if (addToParentChildren(task.children)) {
            return true
          }
        }
      }
      return false
    }

    // 尝试添加到父任务的children中
    if (!addToParentChildren(tasks.value)) {
      console.warn('未找到父任务，ID：', newTask.parentId, '，将作为顶级任务添加')
      // 如果没找到父任务，作为顶级任务添加
      tasks.value.push({ ...newTask })
    }
  } else {
    // 没有父任务，作为顶级任务添加
    tasks.value.push({ ...newTask })
  }
}

// 任务删除处理器
const handleTaskDelete = (taskToDelete: Task) => {
  // 递归查找和删除任务（支持嵌套结构）
  const deleteTaskFromArray = (taskArray: Task[]): boolean => {
    for (let i = 0; i < taskArray.length; i++) {
      if (taskArray[i].id === taskToDelete.id) {
        // 找到任务，删除它
        taskArray.splice(i, 1)
        showMessage('已删除任务', 'success', { closable: false })
        return true
      }

      // 如果有子任务，递归查找
      if (taskArray[i].children && taskArray[i].children.length > 0) {
        if (deleteTaskFromArray(taskArray[i].children!)) {
          return true
        }
      }
    }
    return false
  }

  if (!deleteTaskFromArray(tasks.value)) {
    showMessage(`未找到要删除的任务，ID： ${taskToDelete.id}`, 'warning', { closable: true })
  }
}

// 里程碑图标变更处理器
const handleMilestoneIconChange = (milestoneId: number, icon: string) => {
  const milestoneIndex = milestones.value.findIndex(m => m.id === milestoneId)
  if (milestoneIndex !== -1) {
    milestones.value[milestoneIndex].icon = icon
  } else {
    showMessage(`未找到要更新图标的里程碑，ID： ${milestoneId}`, 'warning', { closable: true })
  }
}

// TaskDrawer事件处理器
const handleTaskDrawerSubmit = (task: Task) => {
  if (isEditMode.value) {
    // 编辑模式：更新任务
    handleTaskUpdate(task)
  } else {
    // 新建模式：添加任务
    handleTaskAdd(task)
  }
  showTaskDrawer.value = false
}

const handleTaskDrawerClose = () => {
  showTaskDrawer.value = false
  currentTask.value = null
  isEditMode.value = false
}

const handleTaskDrawerDelete = (taskId: number) => {
  const taskToDelete = tasks.value.find(t => t.id === taskId)
  if (taskToDelete) {
    handleTaskDelete(taskToDelete)
  }
  showTaskDrawer.value = false
}

// GitHub 文档处理函数
const handleGithubDocsClick = (event: Event) => {
  event.preventDefault()
  // 打开GitHub仓库的README页面
  window.open('https://github.com/jordium-gantt/jordium-gantt-vue3#readme', '_blank')
}

// Gitee 文档处理函数
const handleGiteeDocsClick = (event: Event) => {
  event.preventDefault()
  // 打开Gitee仓库的README页面
  window.open('https://gitee.com/jordium-gantt/jordium-gantt-vue3#readme', '_blank')
}

// 任务拖拽/拉伸/里程碑拖拽监听
function handleTaskbarDragOrResizeEnd(newTask) {
  const oldTask = findTaskDeep(tasks.value, newTask.id)
  if (!oldTask) return
  showMessage(
    `任务【${newTask.name}】\n` +
      `开始: ${oldTask.startDate} → ${newTask.startDate}\n` +
      `结束: ${oldTask.endDate} → ${newTask.endDate}`,
    'info',
    { closable: true },
  )
}
function handleMilestoneDragEnd(newMilestone) {
  const oldMilestone = findTaskDeep(milestones.value, newMilestone.id)
  if (!oldMilestone) return
  showMessage(
    `里程碑【${newMilestone.name}】\n` +
      `开始: ${oldMilestone.endDate} → ${newMilestone.startDate}`,
    'info',
    { closable: true },
  )
}

onMounted(() => {
  tasks.value = demoData.tasks as Task[]
  milestones.value = demoData.milestones as Task[]
})

// 递归查找任务/里程碑，因为原始结构一致
function findTaskDeep(taskArray: Task[], id: number): Task | null {
  for (const task of taskArray) {
    if (task.id === id) return task
    if (task.children && task.children.length > 0) {
      const found = findTaskDeep(task.children, id)
      if (found) return found
    }
  }
  return null
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
          packageInfo.version
        }}</span>
      </div>
      <div class="docs-links">
        <a href="#github-docs" class="doc-link github-link" @click="handleGithubDocsClick">
          <img class="doc-icon" src="./public/github.svg" alt="GitHub" />
        </a>
        <span class="docs-divider"></span>
        <a href="#gitee-docs" class="doc-link gitee-link" @click="handleGiteeDocsClick">
          <img class="doc-icon" src="./public/gitee.svg" alt="Gitee" />
        </a>
      </div>
    </h1>
    <VersionHistoryDrawer :visible="showVersionDrawer" @close="showVersionDrawer = false" />
    <div class="gantt-wrapper">
      <GanttChart
        :tasks="tasks"
        :milestones="milestones"
        :toolbar-config="toolbarConfig"
        :on-add-task="handleAddTask"
        :on-add-milestone="handleAddMilestone"
        :on-export-csv="handleCustomCsvExport"
        :on-language-change="handleLanguageChange"
        :on-theme-change="handleThemeChange"
        :on-milestone-save="handleMilestoneSave"
        :on-milestone-delete="handleMilestoneDelete"
        :on-task-update="handleTaskUpdate"
        :on-task-add="handleTaskAdd"
        :on-task-delete="handleTaskDelete"
        :on-milestone-icon-change="handleMilestoneIconChange"
        @taskbar-drag-end="handleTaskbarDragOrResizeEnd"
        @taskbar-resize-end="handleTaskbarDragOrResizeEnd"
        @milestone-drag-end="handleMilestoneDragEnd"
      />
    </div>
    <div class="license-info">
      <p>MIT License @JORDIUM.COM</p>
    </div>

    <!-- TaskDrawer用于新建/编辑任务 -->
    <TaskDrawer
      v-model:visible="showTaskDrawer"
      :task="currentTask"
      :is-edit="isEditMode"
      @submit="handleTaskDrawerSubmit"
      @close="handleTaskDrawerClose"
      @delete="handleTaskDrawerDelete"
    />

    <!-- MilestoneDialog用于新建/编辑里程碑 -->
    <MilestoneDialog
      :visible="showMilestoneDialog"
      :milestone="currentMilestone"
      @update:visible="showMilestoneDialog = $event"
      @save="handleMilestoneSave"
      @delete="handleMilestoneDelete"
      @close="showMilestoneDialog = false"
    />
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
  background: var(--gantt-bg-secondary, #f0f2f5);
  display: flex;
  flex-direction: column;
}

.page-title {
  margin: 20px 0;
  font-size: 1.8rem;
  font-weight: 600;
  color: var(--gantt-text-primary, #333);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 12px;
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
  flex: 1 1 0%;
  min-height: 0;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  margin-bottom: 24px;
}

.license-info {
  text-align: center;
  color: var(--gantt-text-muted, #c0c4cc);
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0.5px;
}

/* 全局暗色主题支持 */
:global(html[data-theme='dark']) {
  background: #1e1e1e !important;
}

:global(html[data-theme='dark']) body {
  background: #1e1e1e !important;
  color: #e5e5e5 !important;
}

/* 暗黑模式下的版本标签 */
:global(html[data-theme='dark']) .version-badge {
  background: linear-gradient(135deg, #1a73e8 0%, #00bcd4 50%, #3f51b5 100%);
  box-shadow:
    0 0 25px rgba(102, 177, 255, 0.4),
    0 4px 15px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

:global(html[data-theme='dark']) .version-badge:hover {
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

/* 移除旧的基于 SVG color 的样式，现在使用 filter */

/* 暗黑模式下覆盖所有链接样式 */
:global(html[data-theme='dark']) .doc-link {
  color: #ffffff;
}

:global(html[data-theme='dark']) .doc-link:hover {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.1);
}

:global(html[data-theme='dark']) .doc-link:nth-child(2) {
  color: #ffffff !important;
}

:global(html[data-theme='dark']) .doc-link:nth-child(2):hover {
  color: #ffffff !important;
  background-color: rgba(199, 29, 35, 0.1);
}

/* 暗黑模式下图标样式 */
:global(html[data-theme='dark']) .github-link .doc-icon {
  filter: brightness(0) saturate(100%) invert(100%);
}

:global(html[data-theme='dark']) .github-link:hover .doc-icon {
  filter: brightness(0) saturate(100%) invert(70%) sepia(50%) saturate(2000%) hue-rotate(190deg)
    brightness(1.2);
}

:global(html[data-theme='dark']) .gitee-link .doc-icon {
  filter: brightness(0) saturate(100%) invert(45%) sepia(100%) saturate(1500%) hue-rotate(340deg)
    brightness(1.1);
}

:global(html[data-theme='dark']) .gitee-link:hover .doc-icon {
  filter: brightness(0) saturate(100%) invert(50%) sepia(100%) saturate(1800%) hue-rotate(340deg)
    brightness(1.2);
}
</style>

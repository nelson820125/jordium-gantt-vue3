<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { useI18n } from '../composables/useI18n'
import type { Task } from '../models/classes/Task'
import ConfirmTimerDialog from './ConfirmTimerDialog.vue'
import GanttConfirmDialog from './GanttConfirmDialog.vue'

// 定义Props接口
interface Props {
  visible: boolean
  position: {
    x: number
    y: number
  }
  task: Task | null
}

const props = defineProps<Props>()

const emit = defineEmits([
  'start-timer',
  'stop-timer',
  'add-predecessor',
  'add-successor',
  'delete', // 新增delete事件
  'close',
])

// 多语言支持
const { t } = useI18n()

// 菜单容器ref
const menuRef = ref<HTMLElement | null>(null)

// 调整菜单位置，确保不会超出视窗
const adjustedPosition = ref({
  x: 0,
  y: 0,
})

// 箭头位置和方向
const arrowStyle = ref({
  display: 'none', // 初始不显示
  left: '50%',
  top: '-8px',
  transform: 'rotate(0deg)',
})

// 确认对话框相关
const showTimerConfirm = ref(false)
const timerDesc = ref('')

// 删除确认相关
const showDeleteConfirm = ref(false)

// 根据任务类型确定dialog类型
const dialogType = computed(() => {
  return props.task?.type === 'story' ? 'yes-no-cancel' : 'confirm-cancel'
})

// 根据任务类型确定dialog消息
const dialogMessage = computed(() => {
  if (props.task?.type === 'story') {
    return t.value.confirmDeleteStory.replace('{name}', props.task?.name || '')
  }
  return t.value.confirmDeleteTask.replace('{name}', props.task?.name || '')
})

// 打开确认对话框
function openTimerConfirm() {
  timerDesc.value = props.task?.name || ''
  showTimerConfirm.value = true
}

// 取消确认
function cancelTimerConfirm() {
  showTimerConfirm.value = false
}

// 确认计时
function confirmTimer(desc: string) {
  showTimerConfirm.value = false
  if (props.task && typeof props.task === 'object') {
    emit('close')
    // 记录当前时间为开始时间
    const now = Date.now()
    Object.assign(props.task, {
      timerStartDesc: desc || '',
      isTimerRunning: true,
      timerStartTime: now,
      timerElapsedTime: 0, // 每次从0秒开始
    })
    emit('start-timer', props.task)
  }
}

// 处理删除任务点击
function handleDeleteClick() {
  showDeleteConfirm.value = true
}

const confirmDelete = () => {
  showDeleteConfirm.value = false
  if (props.task) {
    emit('delete', props.task)
    emit('close')
  }
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
}

// Story删除：选择"是" - 删除story及其所有子任务
const handleDeleteYes = () => {
  showDeleteConfirm.value = false
  if (props.task) {
    // 传递true表示删除所有子任务
    emit('delete', props.task, true) // 传递true表示删除所有子任务
    closeMenu()
  }
}

// Story删除：选择"否" - 仅删除story，保留子任务
const handleDeleteNo = () => {
  showDeleteConfirm.value = false
  if (props.task) {
    // 传递false表示仅删除story
    emit('delete', props.task, false) // 传递false表示仅删除story
    closeMenu()
  }
}

// 新增：是否显示计时菜单项（非story类型才显示）
const showTimerMenu = computed(() => props.task?.type !== 'story')

// 监听菜单可见状态和位置变化
watch(
  [() => props.visible, () => props.position],
  ([visible, newPosition]) => {
    // 仅在菜单可见且位置有效时调整位置
    if (visible && newPosition) {
      nextTick(() => {
        if (menuRef.value) {
          // 获取视窗和菜单尺寸
          const viewportWidth = window.innerWidth
          const viewportHeight = window.innerHeight
          const menuWidth = menuRef.value.offsetWidth
          const menuHeight = menuRef.value.offsetHeight

          // 初始位置：菜单位于鼠标指针下方，箭头指向上方
          let adjustedX = newPosition.x - menuWidth / 2 // 居中对齐
          let adjustedY = newPosition.y + 10 // 鼠标下方10px
          let arrowLeft = '50%' // 箭头默认居中
          let arrowTop = '-8px' // 箭头在菜单顶部
          let arrowTransform = 'rotate(0deg)' // 箭头指向上方

          // 检查右边界
          if (adjustedX + menuWidth > viewportWidth) {
            const overflow = adjustedX + menuWidth - viewportWidth + 5
            adjustedX -= overflow
            // 调整箭头位置
            arrowLeft = `calc(50% + ${overflow}px)`
          }

          // 检查左边界
          if (adjustedX < 5) {
            const overflow = 5 - adjustedX
            adjustedX = 5
            // 调整箭头位置
            arrowLeft = `calc(50% - ${overflow}px)`
          }

          // 检查下边界 - 如果超出，将菜单放在鼠标上方
          if (adjustedY + menuHeight > viewportHeight) {
            adjustedY = newPosition.y - menuHeight - 10
            arrowTop = '100%' // 箭头在菜单底部
            arrowTransform = 'rotate(180deg)' // 箭头指向下方
          }

          // 更新位置和箭头样式
          adjustedPosition.value = {
            x: adjustedX,
            y: adjustedY,
          }

          arrowStyle.value = {
            display: 'block',
            left: arrowLeft,
            top: arrowTop,
            transform: arrowTransform,
          }
        }
      })
    }
  },
  { immediate: true, deep: true },
)

// 关闭菜单的方法
const closeMenu = () => {
  emit('close')
}

// 处理菜单项点击
const handleStartTimer = () => {
  if (props.task?.isTimerRunning) {
    emit('close')
    // 统一格式，补充 timerEndTime 以便 formatTimerStopMessage 能正确显示周期
    Object.assign(props.task, {
      isTimerRunning: false,
      timerEndTime: Date.now(),
      timerElapsedTime:
        (props.task.timerElapsedTime || 0) +
        (Date.now() - (props.task.timerStartTime || Date.now())),
    })
    emit('stop-timer', props.task)
  } else {
    // 未计时，弹出确认弹窗
    openTimerConfirm()
  }
}

const handleAddPredecessor = () => {
  if (props.task) {
    // 先关闭菜单，再触发事件
    emit('close')

    nextTick(() => {
      emit('add-predecessor', props.task)
    })
  }
}

const handleAddSuccessor = () => {
  if (props.task) {
    // 先关闭菜单，再触发事件
    emit('close')

    nextTick(() => {
      emit('add-successor', props.task)
    })
  }
}

// 处理点击其他地方关闭菜单
const handleClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    closeMenu()
  }
}

// 处理ESC键关闭菜单
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeMenu()
  }
}

onMounted(() => {
  // 添加全局点击和按键事件监听
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  // 移除事件监听
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <teleport to="body">
    <div
      v-if="visible"
      ref="menuRef"
      class="task-context-menu"
      :style="{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        zIndex: 3000,
        position: 'fixed',
      }"
    >
      <!-- 气泡箭头 -->
      <div
        class="menu-arrow"
        :style="{
          display: arrowStyle.display,
          left: arrowStyle.left,
          top: arrowStyle.top,
          transform: arrowStyle.transform,
        }"
      ></div>
      <div v-if="showTimerMenu" class="menu-item" @click="handleStartTimer">
        <div class="icon-wrapper">
          <i class="menu-icon" :class="props.task?.isTimerRunning ? 'stop-icon' : 'timer-icon'"></i>
        </div>
        {{ props.task?.isTimerRunning ? t.stopTimer : t.startTimer }}
      </div>
      <div class="menu-item" @click="handleAddPredecessor">
        <div class="icon-wrapper">
          <i class="menu-icon predecessor-icon"></i>
        </div>
        {{ t.addPredecessor }}
      </div>
      <div class="menu-item" @click="handleAddSuccessor">
        <div class="icon-wrapper">
          <i class="menu-icon successor-icon"></i>
        </div>
        {{ t.addSuccessor }}
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item menu-item-danger" @click="handleDeleteClick">
        <div class="icon-wrapper">
          <i class="menu-icon delete-icon"></i>
        </div>
        {{ t.delete }}
      </div>
      <!-- 删除确认弹窗 -->
      <GanttConfirmDialog
        :visible="showDeleteConfirm"
        :title="t.delete"
        :type="dialogType"
        :message="dialogMessage"
        :confirm-text="t.confirm"
        :cancel-text="t.cancel"
        :yes-text="t.storyDeleteYes"
        :no-text="t.storyDeleteNo"
        @confirm="confirmDelete"
        @yes="handleDeleteYes"
        @no="handleDeleteNo"
        @cancel="cancelDelete"
      />
      <!-- 确认计时对话框 -->
      <ConfirmTimerDialog
        v-if="showTimerConfirm"
        :visible="showTimerConfirm"
        :title="'确认开始计时'"
        :message="`即将为任务${props.task?.name}计时，若有特殊说明请完善下面的描述`"
        :default-desc="props.task?.name || ''"
        @confirm="confirmTimer"
        @cancel="cancelTimerConfirm"
      />
    </div>
  </teleport>
</template>

<style scoped>
.task-context-menu {
  position: fixed;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  width: 180px; /* 调整固定宽度，确保文本不会被截断 */
  z-index: 1000;
  user-select: none;
  animation: fadeIn 0.15s ease-out;
  border: 1px solid #e4e7ed;
}

.menu-item {
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  font-size: 14px;
  transition: all 0.2s ease;
  color: #333;
  gap: 10px; /* 增加图标与文本之间的间距 */
  height: 36px; /* 保持高度以适应32px的图标 */
}

.menu-item:hover {
  background-color: #f5f7fa;
  color: #409eff;
}

.icon-wrapper {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.menu-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0; /* 防止图标被压缩 */
  border-radius: 2px;
  overflow: visible;
}

/* 计时图标保持32px，前置后置任务图标使用20px */
.timer-icon,
.stop-icon {
  width: 32px;
  height: 32px;
}

.predecessor-icon,
.successor-icon {
  width: 20px;
  height: 20px;
}

.timer-icon::before {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border: 2px solid currentColor;
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
}

/* 右箭头样式 */
.timer-icon::after {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-left: 8px solid currentColor;
  top: 50%;
  left: 50%;
  transform: translate(-30%, -50%);
}

.predecessor-icon::before {
  content: '';
  position: absolute;
  width: 12px;
  height: 2px;
  background-color: currentColor;
  top: 50%;
  left: 50%;
  transform: translate(-35%, -50%);
}

.predecessor-icon::after {
  content: '';
  position: absolute;
  width: 5px;
  height: 5px;
  border-left: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  top: 50%;
  left: 50%;
  transform: translate(-120%, -50%) rotate(45deg);
}

.successor-icon::before {
  content: '';
  position: absolute;
  width: 12px;
  height: 2px;
  background-color: currentColor;
  top: 50%;
  left: 50%;
  transform: translate(-65%, -50%);
}

.successor-icon::after {
  content: '';
  position: absolute;
  width: 5px;
  height: 5px;
  border-right: 2px solid currentColor;
  border-top: 2px solid currentColor;
  top: 50%;
  left: 50%;
  transform: translate(20%, -50%) rotate(45deg);
}

/* 停止计时图标 */
.stop-icon::before {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border: 2px solid currentColor;
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
}

.stop-icon::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: currentColor;
  border-radius: 0;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 菜单气泡箭头 */
.menu-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 8px solid #fff; /* 匹配菜单背景色 */
  transform-origin: center;
  filter: drop-shadow(0 -1px 2px rgba(0, 0, 0, 0.1)); /* 为箭头添加阴影效果 */
  z-index: 1001;
  pointer-events: none; /* 确保箭头不会干扰鼠标事件 */
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 暗色主题支持 */
:global(html[data-theme='dark']) .task-context-menu {
  background-color: #2c2c2c;
  border-color: #444444;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}

:global(html[data-theme='dark']) .menu-item {
  color: #e5e5e5;
}

:global(html[data-theme='dark']) .menu-item:hover {
  background-color: #3a3a3a;
  color: #409eff;
}

/* 暗色主题下箭头颜色 */
:global(html[data-theme='dark']) .menu-arrow {
  border-bottom-color: #2c2c2c; /* 匹配暗色菜单背景色 */
  filter: drop-shadow(0 -1px 2px rgba(0, 0, 0, 0.25));
}
.menu-item-danger {
  color: #e74c3c;
}
.menu-item-danger:hover {
  background-color: #faeaea;
  color: #c0392b;
}
.menu-icon.delete-icon {
  width: 20px;
  height: 20px;
  display: inline-block;
  background: none;
  position: relative;
}
.menu-icon.delete-icon::before {
  content: '';
  display: block;
  width: 16px;
  height: 16px;
  margin: 2px auto;
  background: url('data:image/svg+xml;utf8,<svg fill="%23e74c3c" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="%23e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>')
    no-repeat center center;
  background-size: contain;
}

.menu-divider {
  height: 1px;
  background: #ececec;
  margin: 4px 0;
  width: 92%;
  margin-left: 4%;
}
</style>

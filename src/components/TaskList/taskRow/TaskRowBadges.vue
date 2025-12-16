<script setup lang="ts">
interface Props {
  formattedTimer: string
  isTimerRunning: boolean
  timerElapsedTime?: number
  isOvertime: boolean
  overdueDays: number
  overtimeText: string
  overdueText: string
  daysText: string
}

defineProps<Props>()
</script>

<template>
  <!-- 计时器显示 -->
  <span
    v-if="isTimerRunning || timerElapsedTime"
    class="timer-badge"
    :class="{ 'timer-active': isTimerRunning }"
  >
    <span v-if="isTimerRunning" class="timer-dot"></span>
    {{ formattedTimer }}
  </span>
  <span v-if="isOvertime" class="status-badge overtime">{{ overtimeText }}</span>
  <span v-if="overdueDays > 0" class="status-badge overdue">
    {{ overdueText }}{{ overdueDays > 0 ? overdueDays + daysText : '' }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: bold;
  margin-left: 6px;
  color: white;
}

.status-badge.overtime {
  background-color: transparent;
  border: 1px solid var(--gantt-danger);
  color: var(--gantt-danger);
}

.status-badge.overdue {
  background-color: var(--gantt-danger);
}

.timer-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: bold;
  margin-left: 6px;
  background-color: var(--gantt-info, #909399);
  color: white;
}

.timer-badge.timer-active {
  background-color: var(--gantt-success, #67c23a);
}

.timer-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: white;
  margin-right: 4px;
  animation: timer-pulse 1.5s ease-in-out infinite;
}

@keyframes timer-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}
</style>

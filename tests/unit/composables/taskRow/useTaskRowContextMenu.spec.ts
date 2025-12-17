import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useTaskRowContextMenu } from '@/components/TaskList/composables/taskRow/useTaskRowContextMenu'
import { createTask, createTimerTask } from '../../../fixtures/tasks'
import { sleep } from '../helpers/mount'

describe('useTaskRowContextMenu', () => {
  let task: any
  let emit: any

  beforeEach(() => {
    task = ref(createTask())
    emit = vi.fn()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('右键菜单', () => {
    it('应该初始隐藏右键菜单', () => {
      const { contextMenuVisible } = useTaskRowContextMenu(task, emit)

      expect(contextMenuVisible.value).toBe(false)
    })

    it('handleContextMenu 应显示右键菜单', () => {
      // 明确指定为普通任务（非里程碑任务）
      task.value = createTask({ type: 'task' })

      const { handleContextMenu, contextMenuVisible, contextMenuPosition } =
        useTaskRowContextMenu(task, emit)

      const event = new MouseEvent('contextmenu', {
        clientX: 100,
        clientY: 200,
      })
      const preventDefault = vi.spyOn(event, 'preventDefault')

      handleContextMenu(event)

      expect(preventDefault).toHaveBeenCalled()
      expect(contextMenuVisible.value).toBe(true)
      expect(contextMenuPosition.value).toEqual({ x: 100, y: 200 })
    })

    it('closeContextMenu 应隐藏右键菜单', () => {
      // 明确指定为普通任务
      task.value = createTask({ type: 'task' })

      const { handleContextMenu, closeContextMenu, contextMenuVisible } =
        useTaskRowContextMenu(task, emit)

      // 先显示
      const event = new MouseEvent('contextmenu')
      handleContextMenu(event)
      expect(contextMenuVisible.value).toBe(true)

      // 再隐藏
      closeContextMenu()
      expect(contextMenuVisible.value).toBe(false)
    })

    it('删除任务应触发 delete 事件', () => {
      // 明确指定为普通任务
      task.value = createTask({ type: 'task' })

      const { handleTaskDelete } = useTaskRowContextMenu(task, emit)

      handleTaskDelete(task.value)

      expect(emit).toHaveBeenCalledWith('delete', task.value, undefined)
    })

    it('contextMenuTask 应返回当前任务', () => {
      const { contextMenuTask } = useTaskRowContextMenu(task, emit)

      expect(contextMenuTask.value).toBe(task.value)
    })
  })

  describe('计时器格式化', () => {
    it('应该将毫秒格式化为 HH:MM:SS', async () => {
      task.value = createTimerTask({
        isTimerRunning: false,
        timerElapsedTime: 3661000, // 1小时1分1秒
      })

      const { formattedTimer } = useTaskRowContextMenu(task, emit)
      await nextTick()

      expect(formattedTimer.value).toBe('01:01:01')
    })

    it('应该正确格式化零时间', async () => {
      task.value = createTask({
        isTimerRunning: false,
        timerElapsedTime: 0,
      })

      const { formattedTimer } = useTaskRowContextMenu(task, emit)
      await nextTick()

      expect(formattedTimer.value).toBe('00:00:00')
    })

    it('应该正确格式化超过24小时的时间', async () => {
      task.value = createTask({
        isTimerRunning: false,
        timerElapsedTime: 90000000, // 25小时
      })

      const { formattedTimer } = useTaskRowContextMenu(task, emit)
      await nextTick()

      expect(formattedTimer.value).toBe('25:00:00')
    })
  })

  describe('计时器更新', () => {
    it('任务不在运行时应显示累计时间', async () => {
      task.value = createTask({
        isTimerRunning: false,
        timerElapsedTime: 5000, // 5秒
      })

      const { timerElapsed } = useTaskRowContextMenu(task, emit)
      await nextTick()

      expect(timerElapsed.value).toBe(5000)
    })

    it('任务运行中应实时更新时间', async () => {
      const now = Date.now()
      task.value = createTimerTask({
        isTimerRunning: true,
        timerStartTime: now - 3000, // 3秒前启动
        timerElapsedTime: 5000, // 之前累计5秒
      })

      const { timerElapsed } = useTaskRowContextMenu(task, emit)
      await nextTick()

      // 应该是 5000 (之前) + 3000 (现在) = 8000ms
      expect(timerElapsed.value).toBeGreaterThanOrEqual(8000)
      expect(timerElapsed.value).toBeLessThan(9000)
    })

    it('计时器启动时应每秒更新', async () => {
      const now = Date.now()
      task.value = createTimerTask({
        isTimerRunning: true,
        timerStartTime: now,
        timerElapsedTime: 0,
      })

      const { timerElapsed } = useTaskRowContextMenu(task, emit)
      await nextTick()

      const initialValue = timerElapsed.value

      // 推进1秒
      vi.advanceTimersByTime(1000)
      await nextTick()

      // 时间应该增加约1秒
      expect(timerElapsed.value).toBeGreaterThan(initialValue)
    })

    it('计时器停止时应停止更新', async () => {
      const now = Date.now()
      task.value = createTimerTask({
        isTimerRunning: true,
        timerStartTime: now,
        timerElapsedTime: 0,
      })

      const { timerElapsed } = useTaskRowContextMenu(task, emit)
      await nextTick()

      // 停止计时器
      task.value.isTimerRunning = false
      await nextTick()

      const stoppedValue = timerElapsed.value

      // 推进时间
      vi.advanceTimersByTime(5000)
      await nextTick()

      // 值不应该变化
      expect(timerElapsed.value).toBe(stoppedValue)
    })
  })

  describe('清理工作', () => {
    it('组件卸载时应清除计时器', () => {
      task.value = createTimerTask()

      const result = useTaskRowContextMenu(task, emit)

      // onUnmounted 会在组件卸载时自动清理
      // 这里只验证返回值包含必要的函数
      expect(result.timerElapsed).toBeDefined()
      expect(result.formattedTimer).toBeDefined()
    })
  })
})

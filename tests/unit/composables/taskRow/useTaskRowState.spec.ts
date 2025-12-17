import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useTaskRowState } from '@/components/TaskList/composables/taskRow/useTaskRowState'
import { createTask, createParentTask, createMilestone, createOvertimeTask, createOverdueTask } from '../../../fixtures/tasks'

describe('useTaskRowState', () => {
  describe('taskState - 基础状态计算', () => {
    it('应该正确计算普通任务的缩进', () => {
      const task = ref(createTask())
      const level = ref(0)
      const { indent } = useTaskRowState(task, level)

      expect(indent.value).toBe('10px')
    })

    it('应该根据层级计算正确的缩进', () => {
      const task = ref(createTask())
      const level = ref(2)
      const { indent } = useTaskRowState(task, level)

      // 10 + 2 * 20 = 50px
      expect(indent.value).toBe('50px')
    })

    it('应该识别父任务（有子任务）', () => {
      const task = ref(createParentTask({ children: [createTask()] }))
      const level = ref(0)
      const { isParentTask, hasChildren } = useTaskRowState(task, level)

      expect(isParentTask.value).toBe(true)
      expect(hasChildren.value).toBe(true)
    })

    it('应该识别 story 类型任务为父任务', () => {
      const task = ref(createTask({ type: 'story' }))
      const level = ref(0)
      const { isStoryTask, isParentTask } = useTaskRowState(task, level)

      expect(isStoryTask.value).toBe(true)
      expect(isParentTask.value).toBe(true)
    })

    it('应该识别里程碑分组任务', () => {
      const task = ref(createTask({ type: 'milestone-group' }))
      const level = ref(0)
      const { isMilestoneGroup, isParentTask } = useTaskRowState(task, level)

      expect(isMilestoneGroup.value).toBe(true)
      expect(isParentTask.value).toBe(true)
    })

    it('应该识别里程碑任务', () => {
      const task = ref(createMilestone())
      const level = ref(0)
      const { isMilestoneTask } = useTaskRowState(task, level)

      expect(isMilestoneTask.value).toBe(true)
    })
  })

  describe('progressClass - 进度状态', () => {
    it('应该为新任务（进度0）返回空类名', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const task = ref(createTask({
        progress: 0,
        endDate: tomorrow.toISOString().split('T')[0]
      }))
      const level = ref(0)
      const { progressClass } = useTaskRowState(task, level)

      expect(progressClass.value).toBe('')
    })

    it('应该为进行中的任务返回 warning 类名', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const task = ref(createTask({
        progress: 50,
        endDate: tomorrow.toISOString().split('T')[0]
      }))
      const level = ref(0)
      const { progressClass } = useTaskRowState(task, level)

      expect(progressClass.value).toBe('progress-warning')
    })

    it('应该为完成的任务返回 success 类名', () => {
      const task = ref(createTask({ progress: 100 }))
      const level = ref(0)
      const { progressClass } = useTaskRowState(task, level)

      expect(progressClass.value).toBe('progress-success')
    })

    it('应该为逾期未完成的任务返回 danger 类名', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const task = ref(createTask({
        progress: 50,
        endDate: yesterday.toISOString().split('T')[0]
      }))
      const level = ref(0)
      const { progressClass } = useTaskRowState(task, level)

      expect(progressClass.value).toBe('progress-danger')
    })

    it('逾期但已完成的任务应返回 success 类名', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const task = ref(createTask({
        progress: 100,
        endDate: yesterday.toISOString().split('T')[0]
      }))
      const level = ref(0)
      const { progressClass } = useTaskRowState(task, level)

      expect(progressClass.value).toBe('progress-success')
    })
  })

  describe('isOvertime - 超时判断', () => {
    it('应该识别超时任务', () => {
      const task = ref(createOvertimeTask())
      const level = ref(0)
      const { isOvertime } = useTaskRowState(task, level)

      expect(isOvertime()).toBe(true)
    })

    it('未超时任务应返回 false', () => {
      const task = ref(createTask({
        estimatedHours: 40,
        actualHours: 30
      }))
      const level = ref(0)
      const { isOvertime } = useTaskRowState(task, level)

      expect(isOvertime()).toBe(false)
    })

    it('缺少工时数据应返回 undefined', () => {
      const task = ref(createTask())
      const level = ref(0)
      const { isOvertime } = useTaskRowState(task, level)

      expect(isOvertime()).toBeUndefined()
    })
  })

  describe('overdueDays - 逾期天数', () => {
    it('应该正确计算逾期天数', () => {
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

      const task = ref(createTask({
        progress: 50,
        endDate: threeDaysAgo.toISOString().split('T')[0]
      }))
      const level = ref(0)
      const { overdueDays } = useTaskRowState(task, level)

      expect(overdueDays()).toBe(3)
    })

    it('未逾期任务应返回 0', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const task = ref(createTask({
        progress: 50,
        endDate: tomorrow.toISOString().split('T')[0]
      }))
      const level = ref(0)
      const { overdueDays } = useTaskRowState(task, level)

      expect(overdueDays()).toBe(0)
    })

    it('已完成任务即使逾期也应返回 0', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const task = ref(createTask({
        progress: 100,
        endDate: yesterday.toISOString().split('T')[0]
      }))
      const level = ref(0)
      const { overdueDays } = useTaskRowState(task, level)

      expect(overdueDays()).toBe(0)
    })
  })

  describe('customRowClass - 自定义行类名', () => {
    it('未配置时应返回空字符串', () => {
      const task = ref(createTask())
      const level = ref(0)
      const { customRowClass } = useTaskRowState(task, level)

      expect(customRowClass.value).toBe('')
    })

    it('应该支持字符串类名', () => {
      const task = ref(createTask())
      const level = ref(0)
      const rowIndex = ref(0)
      const taskListRowClassName = ref('custom-class')

      const { customRowClass } = useTaskRowState(
        task,
        level,
        rowIndex,
        taskListRowClassName
      )

      expect(customRowClass.value).toBe('custom-class')
    })

    it('应该支持函数类名', () => {
      const task = ref(createTask({ id: 5 }))
      const level = ref(0)
      const rowIndex = ref(2)
      const taskListRowClassName = ref((row: any, index: number) => {
        return `task-${row.id}-row-${index}`
      })

      const { customRowClass } = useTaskRowState(
        task,
        level,
        rowIndex,
        taskListRowClassName
      )

      expect(customRowClass.value).toBe('task-5-row-2')
    })
  })

  describe('customRowStyle - 自定义行样式', () => {
    it('未配置时应返回空对象', () => {
      const task = ref(createTask())
      const level = ref(0)
      const { customRowStyle } = useTaskRowState(task, level)

      expect(customRowStyle.value).toEqual({})
    })

    it('应该支持对象样式', () => {
      const task = ref(createTask())
      const level = ref(0)
      const rowIndex = ref(0)
      const taskListRowStyle = ref({ backgroundColor: 'red' })

      const { customRowStyle } = useTaskRowState(
        task,
        level,
        rowIndex,
        undefined,
        taskListRowStyle
      )

      expect(customRowStyle.value).toEqual({ backgroundColor: 'red' })
    })

    it('应该支持函数样式', () => {
      const task = ref(createTask({ progress: 100 }))
      const level = ref(0)
      const rowIndex = ref(0)
      const taskListRowStyle = ref((row: any) => {
        return { backgroundColor: row.progress === 100 ? 'green' : 'yellow' }
      })

      const { customRowStyle } = useTaskRowState(
        task,
        level,
        rowIndex,
        undefined,
        taskListRowStyle
      )

      expect(customRowStyle.value).toEqual({ backgroundColor: 'green' })
    })
  })
})

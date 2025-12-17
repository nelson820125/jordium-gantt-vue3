import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useTaskRowEventHandlers } from '@/components/TaskList/composables/taskRow/useTaskRowEventHandlers'
import { createTask, createParentTask } from '../../../fixtures/tasks'

describe('useTaskRowEventHandlers', () => {
  let task: any
  let isStoryTask: any
  let hasChildren: any
  let isMilestoneGroup: any
  let isSplitterDragging: any
  let taskRowRef: any
  let enableDrag: any
  let onHover: any
  let emit: any
  let dragStart: any
  let dragOver: any

  beforeEach(() => {
    task = ref(createTask())
    isStoryTask = ref(false)
    hasChildren = ref(false)
    isMilestoneGroup = ref(false)
    isSplitterDragging = ref(false)
    taskRowRef = ref(null)
    enableDrag = ref(true)
    onHover = vi.fn()
    emit = vi.fn()
    dragStart = vi.fn()
    dragOver = vi.fn()
  })

  describe('handleToggle', () => {
    it('应该触发 toggle 事件', () => {
      const { handleToggle } = useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit
      )

      handleToggle()

      expect(emit).toHaveBeenCalledWith('toggle', task.value)
    })

    it('未传入 emit 时不应报错', () => {
      const { handleToggle } = useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover
      )

      expect(() => handleToggle()).not.toThrow()
    })
  })

  describe('handleRowClick', () => {
    it('点击有子任务的行应触发 toggle', () => {
      hasChildren.value = true

      const { handleRowClick } = useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit
      )

      handleRowClick()

      expect(emit).toHaveBeenCalledWith('toggle', task.value)
    })

    it('点击 story 类型任务应触发 toggle', () => {
      isStoryTask.value = true

      const { handleRowClick } = useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit
      )

      handleRowClick()

      expect(emit).toHaveBeenCalledWith('toggle', task.value)
    })

    it('点击里程碑分组不应触发 toggle', () => {
      isMilestoneGroup.value = true
      hasChildren.value = true

      const { handleRowClick } = useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit
      )

      handleRowClick()

      expect(emit).not.toHaveBeenCalled()
    })

    it('点击普通任务不应触发 toggle', () => {
      const { handleRowClick } = useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit
      )

      handleRowClick()

      expect(emit).not.toHaveBeenCalled()
    })
  })

  describe('handleTaskRowDoubleClick', () => {
    it('应该触发 dblclick 事件', () => {
      const { handleTaskRowDoubleClick } = useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit
      )

      const event = new MouseEvent('dblclick', { bubbles: true })
      const stopPropagation = vi.spyOn(event, 'stopPropagation')

      handleTaskRowDoubleClick(event)

      expect(stopPropagation).toHaveBeenCalled()
      expect(emit).toHaveBeenCalledWith('dblclick', task.value)
    })
  })

  describe('handleMouseEnter / handleMouseLeave', () => {
    it('鼠标进入应调用 onHover 并传入任务ID', () => {
      task.value.id = 123

      const { handleMouseEnter } = useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit
      )

      handleMouseEnter()

      expect(onHover).toHaveBeenCalledWith(123)
    })

    it('鼠标离开应调用 onHover 并传入 null', () => {
      const { handleMouseLeave } = useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit
      )

      handleMouseLeave()

      expect(onHover).toHaveBeenCalledWith(null)
    })

    it('Splitter 拖拽时应忽略鼠标进入事件', () => {
      isSplitterDragging.value = true

      const { handleMouseEnter } = useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit
      )

      handleMouseEnter()

      expect(onHover).not.toHaveBeenCalled()
    })

    it('Splitter 拖拽时应忽略鼠标离开事件', () => {
      isSplitterDragging.value = true

      const { handleMouseLeave } = useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit
      )

      handleMouseLeave()

      expect(onHover).not.toHaveBeenCalled()
    })
  })

  describe('handleMouseDown - 拖拽', () => {
    it('enableDrag 为 false 时不应启动拖拽', () => {
      enableDrag.value = false
      taskRowRef.value = document.createElement('div')

      const { handleMouseDown } = useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit,
        dragStart,
        dragOver
      )

      const event = new MouseEvent('mousedown')
      handleMouseDown(event)

      expect(dragStart).not.toHaveBeenCalled()
    })

    it('enableDrag 为 true 时应启动拖拽', () => {
      enableDrag.value = true
      const mockElement = document.createElement('div')
      taskRowRef.value = mockElement

      const { handleMouseDown } = useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit,
        dragStart,
        dragOver
      )

      const mockDiv = document.createElement('div')
      const event = new MouseEvent('mousedown', { bubbles: true })
      Object.defineProperty(event, 'target', { value: mockDiv, enumerable: true })

      handleMouseDown(event)

      expect(dragStart).toHaveBeenCalledWith(task.value, mockElement, event)
    })

    it('taskRowRef 为 null 时不应启动拖拽', () => {
      enableDrag.value = true
      taskRowRef.value = null

      const { handleMouseDown } = useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit,
        dragStart,
        dragOver
      )

      const mockDiv = document.createElement('div')
      const event = new MouseEvent('mousedown', { bubbles: true })
      Object.defineProperty(event, 'target', { value: mockDiv, enumerable: true })

      handleMouseDown(event)

      expect(dragStart).not.toHaveBeenCalled()
    })
  })

  describe('Splitter 拖拽状态', () => {
    // 注意：Splitter 拖拽事件是通过 window 事件监听器注册的（onMounted 中）
    // 在单元测试中无法直接测试，需要通过组件集成测试来验证
    it.skip('handleSplitterDragStart 通过 window 事件触发', () => {
      useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit
      )

      // 触发 window 事件
      window.dispatchEvent(new Event('splitter-drag-start'))

      expect(isSplitterDragging.value).toBe(true)
    })

    it.skip('handleSplitterDragEnd 通过 window 事件触发', () => {
      isSplitterDragging.value = true

      useTaskRowEventHandlers(
        task,
        isStoryTask,
        hasChildren,
        isMilestoneGroup,
        isSplitterDragging,
        taskRowRef,
        enableDrag,
        onHover,
        emit
      )

      // 触发 window 事件
      window.dispatchEvent(new Event('splitter-drag-end'))

      expect(isSplitterDragging.value).toBe(false)
    })
  })
})

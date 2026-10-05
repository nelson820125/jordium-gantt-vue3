/**
 * useTaskRowDrag.spec.ts - 任务行拖拽放置位置（行内分带判定）行为测试
 *
 * 覆盖：
 * 1. 叶子目标：中部带给出 'child'（拖拽可建立首个子级——旧行为叶子恒 'after'，无法建立）
 * 2. 叶子目标：上/下边缘给出 'after'
 * 3. 父级目标：分带同样生效（旧行为恒 'child'，边缘现在= 插到该父级之后同级）
 * 4. 自身后代目标被拒绝（不产生放置目标，防环）
 */

import { describe, it, expect, vi } from 'vitest'
import { useTaskRowDrag } from '../../../src/composables/useTaskRowDrag'
import type { Task } from '../../../src/models/classes/Task'

function makeTask(id: number, overrides: Partial<Task> = {}): Task {
  return { id, type: 'task', name: `task-${id}`, children: [], ...overrides } as unknown as Task
}

// 行元素：可用 mock 的 getBoundingClientRect 控制行高与 top
function makeRow(top = 0, height = 36): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({
      top,
      bottom: top + height,
      height,
      left: 0,
      right: 400,
      width: 400,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect
  return el
}

function makeEvent(clientY: number): MouseEvent {
  return {
    clientY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as MouseEvent
}

describe('useTaskRowDrag handleDragOver 放置位置（行内分带）', () => {
  function setup() {
    const onDragOver = vi.fn()
    const onDrop = vi.fn()
    const { dragState, handleDragOver } = useTaskRowDrag({ enabled: true, onDragOver, onDrop })
    return { dragState, handleDragOver, onDragOver, onDrop }
  }

  function beginDrag(state: { value: { isDragging: boolean; draggedTask: Task | null } }, dragged: Task) {
    state.value.isDragging = true
    state.value.draggedTask = dragged
  }

  it('叶子目标：中部带（25%~75%）= child，可拖拽建立首个子级', () => {
    const { dragState, handleDragOver, onDragOver } = setup()
    beginDrag(dragState, makeTask(1))
    const leaf = makeTask(2)
    handleDragOver(leaf, makeRow(0, 36), makeEvent(18))
    expect(dragState.value.dropPosition).toBe('child')
    expect(onDragOver).toHaveBeenCalledWith(leaf, 'child')
  })

  it('叶子目标：上/下边缘 = after', () => {
    const { dragState, handleDragOver, onDragOver } = setup()
    beginDrag(dragState, makeTask(1))
    const leaf = makeTask(2)
    handleDragOver(leaf, makeRow(0, 36), makeEvent(3)) // 顶部边缘
    expect(dragState.value.dropPosition).toBe('after')
    handleDragOver(leaf, makeRow(0, 36), makeEvent(34)) // 底部边缘
    expect(onDragOver).toHaveBeenLastCalledWith(leaf, 'after')
  })

  it('父级目标：分带同样生效（中部 child / 边缘 after；旧行为恒 child）', () => {
    const { dragState, handleDragOver } = setup()
    beginDrag(dragState, makeTask(1))
    const parent = makeTask(2, { children: [makeTask(9)] })
    handleDragOver(parent, makeRow(0, 36), makeEvent(18))
    expect(dragState.value.dropPosition).toBe('child')
    handleDragOver(parent, makeRow(0, 36), makeEvent(35))
    expect(dragState.value.dropPosition).toBe('after')
  })

  it('自身后代目标被拒绝：不产生放置目标，也不回调 onDragOver', () => {
    const { dragState, handleDragOver, onDragOver } = setup()
    const dragged = makeTask(1, { children: [makeTask(2)] })
    beginDrag(dragState, dragged)
    handleDragOver((dragged.children as Task[])[0], makeRow(0, 36), makeEvent(18))
    expect(dragState.value.dropTargetTask).toBeNull()
    expect(dragState.value.dropPosition).toBeNull()
    expect(onDragOver).not.toHaveBeenCalled()
  })
})

/**
 * taskLayoutUtils.spec.ts - 资源视图任务换行布局单元测试
 *
 * 重点覆盖 v1.13.5 修复：hasTimeOverlap 对"endDate 显式带 time 部分"的
 * 场景需要先经 getEffectiveEndDateOnly 修正，避免本不重叠的任务被错误换行
 * （详见 .ai/.claude/requirments/v1.13.5.md 第9节）
 */

import { describe, it, expect } from 'vitest'
import { hasTimeOverlap } from '../../../src/utils/taskLayoutUtils'
import type { Task } from '../../../src/models/classes/Task'

describe('taskLayoutUtils', () => {
  describe('hasTimeOverlap', () => {
    it('纯日期任务：结束日与另一任务开始日相同应视为重叠（endDate 含当天）', () => {
      const taskA: Task = {
        id: 1,
        name: 'A',
        startDate: '2025-01-28',
        endDate: '2025-01-29',
      } as Task
      const taskB: Task = {
        id: 2,
        name: 'B',
        startDate: '2025-01-29',
        endDate: '2025-01-30',
      } as Task

      expect(hasTimeOverlap(taskA, taskB)).toBe(true)
    })

    it('v1.13.5：TaskA.endDate=次日00:00（TaskDrawer 编辑保存后写入），TaskB 同日开始，不应判定为重叠', () => {
      // 对应用户反馈场景：TaskA endDate='2025-08-01 00:00'（语义上是7月31日结束），
      // TaskB startDate='2025-08-01 00:00' 或 '2025-08-01'，二者不应换行
      const taskA: Task = {
        id: 1,
        name: 'A',
        startDate: '2025-07-25',
        endDate: '2025-08-01 00:00',
      } as Task
      const taskB1: Task = {
        id: 2,
        name: 'B1',
        startDate: '2025-08-01 00:00',
        endDate: '2025-08-05',
      } as Task
      const taskB2: Task = {
        id: 3,
        name: 'B2',
        startDate: '2025-08-01',
        endDate: '2025-08-05',
      } as Task

      expect(hasTimeOverlap(taskA, taskB1)).toBe(false)
      expect(hasTimeOverlap(taskA, taskB2)).toBe(false)
    })

    it('endDate 带非00:00的显式时间部分，仍应视为占用当天', () => {
      const taskA: Task = {
        id: 1,
        name: 'A',
        startDate: '2025-01-28',
        endDate: '2025-01-29 14:30',
      } as Task
      const taskB: Task = {
        id: 2,
        name: 'B',
        startDate: '2025-01-29',
        endDate: '2025-01-30',
      } as Task

      expect(hasTimeOverlap(taskA, taskB)).toBe(true)
    })

    it('小时视图：按15分钟精度判断，不受日期边界规则影响', () => {
      const taskA: Task = {
        id: 1,
        name: 'A',
        startDate: '2025-01-29 08:00',
        endDate: '2025-01-29 10:00',
      } as Task
      const taskB: Task = {
        id: 2,
        name: 'B',
        startDate: '2025-01-29 10:00',
        endDate: '2025-01-29 12:00',
      } as Task

      expect(hasTimeOverlap(taskA, taskB, 'hour')).toBe(false)
    })

    it('缺少日期信息应返回 false', () => {
      const taskA: Task = { id: 1, name: 'A' } as Task
      const taskB: Task = {
        id: 2,
        name: 'B',
        startDate: '2025-01-01',
        endDate: '2025-01-05',
      } as Task

      expect(hasTimeOverlap(taskA, taskB)).toBe(false)
    })
  })
})

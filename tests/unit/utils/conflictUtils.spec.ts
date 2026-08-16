/**
 * conflictUtils.spec.ts - 资源冲突检测工具单元测试
 */

import { describe, it, expect } from 'vitest'
import {
  detectConflicts,
  getTimeIntersection,
  getConflictLevel,
  type ConflictZone,
} from '../../../src/utils/conflictUtils'
import type { Task } from '../../../src/models/classes/Task'

describe('conflictUtils', () => {
  describe('getConflictLevel', () => {
    it('应该返回 light 等级（100%-120%）', () => {
      expect(getConflictLevel(100)).toBe('light')
      expect(getConflictLevel(110)).toBe('light')
      expect(getConflictLevel(120)).toBe('light')
    })

    it('应该返回 medium 等级（120%-150%）', () => {
      expect(getConflictLevel(121)).toBe('medium')
      expect(getConflictLevel(130)).toBe('medium')
      expect(getConflictLevel(150)).toBe('medium')
    })

    it('应该返回 severe 等级（>150%）', () => {
      expect(getConflictLevel(151)).toBe('severe')
      expect(getConflictLevel(200)).toBe('severe')
      expect(getConflictLevel(300)).toBe('severe')
    })
  })

  describe('getTimeIntersection', () => {
    it('应该正确计算两个任务的时间交集', () => {
      const task1: Task = {
        id: 1,
        name: '任务1',
        startDate: '2026-01-10',
        endDate: '2026-01-15',
      } as Task

      const task2: Task = {
        id: 2,
        name: '任务2',
        startDate: '2026-01-12',
        endDate: '2026-01-20',
      } as Task

      const intersection = getTimeIntersection(task1, task2)

      expect(intersection).not.toBeNull()
      expect(intersection?.start).toEqual(new Date(2026, 0, 12))
      expect(intersection?.end).toEqual(new Date(2026, 0, 15))
    })

    it('应该在无交集时返回null', () => {
      const task1: Task = {
        id: 1,
        name: '任务1',
        startDate: '2026-01-10',
        endDate: '2026-01-15',
      } as Task

      const task2: Task = {
        id: 2,
        name: '任务2',
        startDate: '2026-01-20',
        endDate: '2026-01-25',
      } as Task

      const intersection = getTimeIntersection(task1, task2)

      expect(intersection).toBeNull()
    })

    it('v1.13.5：纯日期边界相接（task1结束当天=task2开始当天）应算作交集', () => {
      // 修正前：此用例曾断言"边界相接不算交集"，实际是 isExactDayStart 特判引入的
      // bug（详见 .ai/.claude/requirments/v1.13.5.md 第9节）——纯日期 endDate 按
      // 规则b应视为"包含当天"，与同一天开始的任务理应判定为存在交集。
      const task1: Task = {
        id: 1,
        name: '任务1',
        startDate: '2026-01-10',
        endDate: '2026-01-15',
      } as Task

      const task2: Task = {
        id: 2,
        name: '任务2',
        startDate: '2026-01-15',
        endDate: '2026-01-20',
      } as Task

      const intersection = getTimeIntersection(task1, task2)

      expect(intersection).not.toBeNull()
      expect(intersection?.start).toEqual(new Date(2026, 0, 15))
      expect(intersection?.end).toEqual(new Date(2026, 0, 15))
    })

    it('应该处理完全包含的情况', () => {
      const task1: Task = {
        id: 1,
        name: '任务1',
        startDate: '2026-01-10',
        endDate: '2026-01-25',
      } as Task

      const task2: Task = {
        id: 2,
        name: '任务2',
        startDate: '2026-01-15',
        endDate: '2026-01-20',
      } as Task

      const intersection = getTimeIntersection(task1, task2)

      expect(intersection).not.toBeNull()
      expect(intersection?.start).toEqual(new Date(2026, 0, 15))
      expect(intersection?.end).toEqual(new Date(2026, 0, 20))
    })

    it('应该处理缺少日期的情况', () => {
      const task1: Task = {
        id: 1,
        name: '任务1',
        startDate: '2026-01-10',
      } as Task

      const task2: Task = {
        id: 2,
        name: '任务2',
        startDate: '2026-01-15',
        endDate: '2026-01-20',
      } as Task

      const intersection = getTimeIntersection(task1, task2)

      expect(intersection).toBeNull()
    })

    it('应该正确处理带具体时分的跨天边界（不应因时分漂移而误判为交集）', () => {
      // 任务1 结束于 01-15 14:30，任务2 开始于 01-16 08:00 —— 是两个不同的自然日
      // 修复前：+1天直接加到原始时间戳上，导致边界变成"01-16 14:30"，
      // 误判 01-16 08:00 与之存在交集（甚至产生 start > end 的非法区间）
      const task1: Task = {
        id: 1,
        name: '任务1',
        startDate: '2026-01-10 09:00',
        endDate: '2026-01-15 14:30',
      } as Task

      const task2: Task = {
        id: 2,
        name: '任务2',
        startDate: '2026-01-16 08:00',
        endDate: '2026-01-20 18:00',
      } as Task

      const intersection = getTimeIntersection(task1, task2)

      expect(intersection).toBeNull()
    })

    it('同一天内即使具体时分不重叠，也应视为交集（day视图按天粒度判定）', () => {
      const task1: Task = {
        id: 1,
        name: '任务1',
        startDate: '2026-01-15 08:00',
        endDate: '2026-01-15 10:00',
      } as Task

      const task2: Task = {
        id: 2,
        name: '任务2',
        startDate: '2026-01-15 14:00',
        endDate: '2026-01-15 18:00',
      } as Task

      const intersection = getTimeIntersection(task1, task2)

      expect(intersection).not.toBeNull()
    })

    it('任务endDate恰好为次日0点，与另一任务当天更晚开始不应判定为交集', () => {
      // A 在 2025-07-02 00:00 结束（即真实结束时刻就是这一天的起点，未占用当天）
      // B 在 2025-07-02 03:00 才开始，二者实际并不重叠
      const task1: Task = {
        id: 1,
        name: '任务A',
        startDate: '2025-07-01 09:00',
        endDate: '2025-07-02 00:00',
      } as Task

      const task2: Task = {
        id: 2,
        name: '任务B',
        startDate: '2025-07-02 03:00',
        endDate: '2025-07-02 18:00',
      } as Task

      const intersection = getTimeIntersection(task1, task2)

      expect(intersection).toBeNull()
    })

    it('v1.13.5：两个纯日期任务在同一天首尾相接（如A结束于7/31，B同样从7/31开始）应判定为交集', () => {
      // 回归测试：此前的 isExactDayStart 特判会把"纯日期解析出的00:00"和"显式录入的
      // 00:00"一视同仁地跳过 +1天，导致纯日期场景下同一天相接的任务被误判为无交集。
      // 修复后应统一改用 getInclusiveEndBoundary(rawEndDate, ...) 按是否显式带 time
      // 部分区分处理，纯日期场景应保持原有"包含当天"语义，判定为存在交集。
      const task1: Task = {
        id: 1,
        name: '任务A',
        startDate: '2025-07-01',
        endDate: '2025-07-31',
      } as Task

      const task2: Task = {
        id: 2,
        name: '任务B',
        startDate: '2025-07-31',
        endDate: '2025-08-05',
      } as Task

      const intersection = getTimeIntersection(task1, task2)

      expect(intersection).not.toBeNull()
    })

    it('v1.13.5：TaskDrawer 编辑保存后 endDate 变为次日00:00，应与原纯日期语义等价（不多算一天）', () => {
      // 对应 .ai/.claude/requirments/v1.13.5.md 第9节场景：任务 A 原始 endDate='2025-07-31'
      // （纯日期），经 TaskDrawer 编辑未修改直接保存后变为 '2025-08-01 00:00'。
      // 修复后，A 与 8/1 才开始的任务 B 不应再被误判为存在交集。
      const task1: Task = {
        id: 1,
        name: '任务A',
        startDate: '2025-07-01',
        endDate: '2025-08-01 00:00',
      } as Task

      const task2: Task = {
        id: 2,
        name: '任务B',
        startDate: '2025-08-01',
        endDate: '2025-08-05',
      } as Task

      const intersection = getTimeIntersection(task1, task2)

      expect(intersection).toBeNull()
    })
  })

  describe('detectConflicts', () => {
    it('应该检测不出无冲突场景', () => {
      const tasks: Task[] = [
        {
          id: 1,
          name: '任务1',
          startDate: '2026-01-10',
          endDate: '2026-01-15',
          resources: [{ id: 'r1', capacity: 50 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-20',
          endDate: '2026-01-25',
          resources: [{ id: 'r1', capacity: 60 }],
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      expect(conflicts).toHaveLength(0)
    })

    it('endDate恰好为次日0点、另一任务同一天更晚开始，不应检测出冲突', () => {
      const tasks: Task[] = [
        {
          id: 1,
          name: '任务A',
          startDate: '2025-07-01 09:00',
          endDate: '2025-07-02 00:00',
          resources: [{ id: 'r1', capacity: 80 }],
        } as Task,
        {
          id: 2,
          name: '任务B',
          startDate: '2025-07-02 03:00',
          endDate: '2025-07-02 18:00',
          resources: [{ id: 'r1', capacity: 80 }],
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      expect(conflicts).toHaveLength(0)
    })

    it('v1.13.5：两个纯日期任务在同一天首尾相接，容量超100%时应检测出冲突', () => {
      const tasks: Task[] = [
        {
          id: 1,
          name: '任务A',
          startDate: '2025-07-01',
          endDate: '2025-07-31',
          resources: [{ id: 'r1', capacity: 60 }],
        } as Task,
        {
          id: 2,
          name: '任务B',
          startDate: '2025-07-31',
          endDate: '2025-08-05',
          resources: [{ id: 'r1', capacity: 60 }],
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      expect(conflicts.length).toBeGreaterThan(0)
    })

    it('应该检测出轻度冲突（总占比100%-120%）', () => {
      const tasks: Task[] = [
        {
          id: 1,
          name: '任务1',
          startDate: '2026-01-10',
          endDate: '2026-01-15',
          resources: [{ id: 'r1', capacity: 60 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-20',
          resources: [{ id: 'r1', capacity: 50 }],
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].level).toBe('light')
      expect(conflicts[0].totalPercent).toBe(110)
      expect(conflicts[0].tasks).toHaveLength(2)
    })

    it('应该检测出中度冲突（总占比120%-150%）', () => {
      const tasks: Task[] = [
        {
          id: 1,
          name: '任务1',
          startDate: '2026-01-10',
          endDate: '2026-01-15',
          resources: [{ id: 'r1', capacity: 70 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-20',
          resources: [{ id: 'r1', capacity: 65 }],
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].level).toBe('medium')
      expect(conflicts[0].totalPercent).toBe(135)
    })

    it('应该检测出严重冲突（总占比>150%）', () => {
      const tasks: Task[] = [
        {
          id: 1,
          name: '任务1',
          startDate: '2026-01-10',
          endDate: '2026-01-15',
          resources: [{ id: 'r1', capacity: 80 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-20',
          resources: [{ id: 'r1', capacity: 90 }],
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].level).toBe('severe')
      expect(conflicts[0].totalPercent).toBe(170)
    })

    it('应该检测出多任务冲突', () => {
      const tasks: Task[] = [
        {
          id: 1,
          name: '任务1',
          startDate: '2026-01-10',
          endDate: '2026-01-20',
          resources: [{ id: 'r1', capacity: 40 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-18',
          resources: [{ id: 'r1', capacity: 50 }],
        } as Task,
        {
          id: 3,
          name: '任务3',
          startDate: '2026-01-15',
          endDate: '2026-01-25',
          resources: [{ id: 'r1', capacity: 30 }],
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      expect(conflicts.length).toBeGreaterThan(0)
      expect(conflicts[0].tasks.length).toBeGreaterThanOrEqual(2)
      expect(conflicts[0].totalPercent).toBeGreaterThan(100)
    })

    it('应该正确过滤指定资源的任务', () => {
      const tasks: Task[] = [
        {
          id: 1,
          name: '任务1',
          startDate: '2026-01-10',
          endDate: '2026-01-15',
          resources: [{ id: 'r1', capacity: 60 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-20',
          resources: [{ id: 'r2', capacity: 80 }], // 不同资源
        } as Task,
        {
          id: 3,
          name: '任务3',
          startDate: '2026-01-12',
          endDate: '2026-01-20',
          resources: [{ id: 'r1', capacity: 50 }],
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      // 应该只检测r1的冲突，不包含r2的任务
      expect(conflicts).toHaveLength(1)
      expect(
        conflicts[0].tasks.every(t =>
          tasks.find(task => task.id === t.id)?.resources?.some(r => r.id === 'r1')
        )
      ).toBe(true)
    })

    it('应该处理没有资源的任务', () => {
      const tasks: Task[] = [
        {
          id: 1,
          name: '任务1',
          startDate: '2026-01-10',
          endDate: '2026-01-15',
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-20',
          resources: [{ id: 'r1', capacity: 50 }],
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      expect(conflicts).toHaveLength(0)
    })

    it('应该处理占比未超载的情况（<=100%）', () => {
      const tasks: Task[] = [
        {
          id: 1,
          name: '任务1',
          startDate: '2026-01-10',
          endDate: '2026-01-15',
          resources: [{ id: 'r1', capacity: 40 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-20',
          resources: [{ id: 'r1', capacity: 50 }],
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      // 总占比90%，未超载，不应检测出冲突
      expect(conflicts).toHaveLength(0)
    })

    it('应该处理单个任务的情况', () => {
      const tasks: Task[] = [
        {
          id: 1,
          name: '任务1',
          startDate: '2026-01-10',
          endDate: '2026-01-15',
          resources: [{ id: 'r1', capacity: 120 }], // 单个任务占比>100%也不算冲突
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      expect(conflicts).toHaveLength(0)
    })

    it('应该合并重叠的冲突区域', () => {
      const tasks: Task[] = [
        {
          id: 1,
          name: '任务1',
          startDate: '2026-01-10',
          endDate: '2026-01-20',
          resources: [{ id: 'r1', capacity: 60 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-18',
          resources: [{ id: 'r1', capacity: 50 }],
        } as Task,
        {
          id: 3,
          name: '任务3',
          startDate: '2026-01-15',
          endDate: '2026-01-25',
          resources: [{ id: 'r1', capacity: 55 }],
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      // 应该将连续重叠的区域合并
      expect(conflicts.length).toBeGreaterThan(0)
      expect(conflicts.length).toBeLessThanOrEqual(2)
    })
  })
})

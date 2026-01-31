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

    it('应该处理边界相接的情况（不算交集）', () => {
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

      // 边界相接不算交集
      expect(intersection).toBeNull()
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
  })

  describe('detectConflicts', () => {
    it('应该检测不出无冲突场景', () => {
      const tasks: Task[] = [
        {
          id: 1,
          name: '任务1',
          startDate: '2026-01-10',
          endDate: '2026-01-15',
          resources: [{ id: 'r1', percent: 50 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-20',
          endDate: '2026-01-25',
          resources: [{ id: 'r1', percent: 60 }],
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      expect(conflicts).toHaveLength(0)
    })

    it('应该检测出轻度冲突（总占比100%-120%）', () => {
      const tasks: Task[] = [
        {
          id: 1,
          name: '任务1',
          startDate: '2026-01-10',
          endDate: '2026-01-15',
          resources: [{ id: 'r1', percent: 60 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-20',
          resources: [{ id: 'r1', percent: 50 }],
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
          resources: [{ id: 'r1', percent: 70 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-20',
          resources: [{ id: 'r1', percent: 65 }],
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
          resources: [{ id: 'r1', percent: 80 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-20',
          resources: [{ id: 'r1', percent: 90 }],
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
          resources: [{ id: 'r1', percent: 40 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-18',
          resources: [{ id: 'r1', percent: 50 }],
        } as Task,
        {
          id: 3,
          name: '任务3',
          startDate: '2026-01-15',
          endDate: '2026-01-25',
          resources: [{ id: 'r1', percent: 30 }],
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
          resources: [{ id: 'r1', percent: 60 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-20',
          resources: [{ id: 'r2', percent: 80 }], // 不同资源
        } as Task,
        {
          id: 3,
          name: '任务3',
          startDate: '2026-01-12',
          endDate: '2026-01-20',
          resources: [{ id: 'r1', percent: 50 }],
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      // 应该只检测r1的冲突，不包含r2的任务
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].tasks.every(t =>
        tasks.find(task => task.id === t.id)?.resources?.some(r => r.id === 'r1')
      )).toBe(true)
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
          resources: [{ id: 'r1', percent: 50 }],
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
          resources: [{ id: 'r1', percent: 40 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-20',
          resources: [{ id: 'r1', percent: 50 }],
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
          resources: [{ id: 'r1', percent: 120 }], // 单个任务占比>100%也不算冲突
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
          resources: [{ id: 'r1', percent: 60 }],
        } as Task,
        {
          id: 2,
          name: '任务2',
          startDate: '2026-01-12',
          endDate: '2026-01-18',
          resources: [{ id: 'r1', percent: 50 }],
        } as Task,
        {
          id: 3,
          name: '任务3',
          startDate: '2026-01-15',
          endDate: '2026-01-25',
          resources: [{ id: 'r1', percent: 55 }],
        } as Task,
      ]

      const conflicts = detectConflicts(tasks, 'r1')

      // 应该将连续重叠的区域合并
      expect(conflicts.length).toBeGreaterThan(0)
      expect(conflicts.length).toBeLessThanOrEqual(2)
    })
  })
})

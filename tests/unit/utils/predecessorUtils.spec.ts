/**
 * predecessorUtils.spec.ts - 前置任务工具函数单元测试
 *
 * 该文件补全 src/utils/predecessorUtils.ts 缺失的单元测试（此前无任何测试覆盖），
 * 覆盖：日期解析、前置任务 ID 解析（数组/字符串/混合/脏数据）、格式互转、
 * 增删前置任务、存在性判断与展示文本生成等核心逻辑，保证重构与后续改动不引入回归。
 */

import { describe, it, expect } from 'vitest'
import {
  createLocalDate,
  getPredecessorIds,
  predecessorIdsToArray,
  predecessorIdsToString,
  predecessorStringToArray,
  hasPredecessor,
  addPredecessor,
  removePredecessor,
  formatPredecessorDisplay,
} from '../../../src/utils/predecessorUtils'

describe('predecessorUtils', () => {
  describe('createLocalDate', () => {
    it('空字符串 / undefined / null 应返回 null', () => {
      expect(createLocalDate('')).toBeNull()
      expect(createLocalDate(undefined as unknown as string)).toBeNull()
      expect(createLocalDate(null as unknown as string)).toBeNull()
    })

    it('应解析为本地时间（避免 UTC 偏移）', () => {
      const d = createLocalDate('2025-04-15')
      expect(d).not.toBeNull()
      expect(d!.getFullYear()).toBe(2025)
      expect(d!.getMonth()).toBe(3) // 0-based
      expect(d!.getDate()).toBe(15)
      expect(d!.getHours()).toBe(0)
      expect(d!.getMinutes()).toBe(0)
    })

    it('非日期字符串应返回 null', () => {
      expect(createLocalDate('not-a-date')).toBeNull()
      expect(createLocalDate('2025/04/15')).toBeNull()
    })

    it('非法但数值化的日期（JS 会自动进位）应返回 null 而非 Invalid Date', () => {
      expect(createLocalDate('2025-13-45')).toBeNull()
      expect(createLocalDate('2025-02-30')).toBeNull()
      expect(createLocalDate('2025-04-15 10:30')).toBeNull()
    })
  })

  describe('getPredecessorIds', () => {
    it('falsy 输入应返回空数组', () => {
      expect(getPredecessorIds(undefined)).toEqual([])
      expect(getPredecessorIds(null as unknown as number[])).toEqual([])
      expect(getPredecessorIds('')).toEqual([])
    })

    it('空数组应返回空数组', () => {
      expect(getPredecessorIds([])).toEqual([])
    })

    it('number[] 应原样返回', () => {
      expect(getPredecessorIds([1, 2, 3])).toEqual([1, 2, 3])
      expect(getPredecessorIds([0])).toEqual([0])
    })

    it('string[] 应解析为 number[]', () => {
      expect(getPredecessorIds(['1', '2', '3'])).toEqual([1, 2, 3])
      expect(getPredecessorIds([' 4 ', '5'])).toEqual([4, 5])
    })

    it('逗号分隔字符串应解析为 number[]', () => {
      expect(getPredecessorIds('1,2,3')).toEqual([1, 2, 3])
      expect(getPredecessorIds('1, 2 , 3')).toEqual([1, 2, 3])
      expect(getPredecessorIds('  7 ')).toEqual([7])
    })

    it('含非数字片段应过滤掉 NaN', () => {
      expect(getPredecessorIds('1,abc,2')).toEqual([1, 2])
      expect(getPredecessorIds(['x', '9'])).toEqual([9])
      expect(getPredecessorIds('foo')).toEqual([])
    })
  })

  describe('predecessorIdsToArray', () => {
    it('应保留大于 0 的 ID', () => {
      expect(predecessorIdsToArray([1, 2, 3])).toEqual([1, 2, 3])
    })

    it('应过滤掉 0 与负数', () => {
      expect(predecessorIdsToArray([0, 1, -2, 3])).toEqual([1, 3])
    })

    it('空数组应返回空数组', () => {
      expect(predecessorIdsToArray([])).toEqual([])
    })
  })

  describe('predecessorIdsToString', () => {
    it('number[] 应转为逗号分隔字符串', () => {
      expect(predecessorIdsToString([1, 2])).toBe('1,2')
    })

    it('应过滤掉 0 与负数', () => {
      expect(predecessorIdsToString([0, 1, -2])).toBe('1')
    })

    it('空数组应返回空字符串', () => {
      expect(predecessorIdsToString([])).toBe('')
    })
  })

  describe('predecessorStringToArray', () => {
    it('undefined 应返回空数组', () => {
      expect(predecessorStringToArray(undefined)).toEqual([])
    })

    it('应返回去空格后的字符串片段', () => {
      expect(predecessorStringToArray('1,2')).toEqual(['1', '2'])
      expect(predecessorStringToArray('1, 2 , 3')).toEqual(['1', '2', '3'])
    })

    it('空字符串应返回空数组', () => {
      expect(predecessorStringToArray('')).toEqual([])
      expect(predecessorStringToArray('   ')).toEqual([])
    })
  })

  describe('hasPredecessor', () => {
    it('number[] 前置任务应正确判断存在性', () => {
      expect(hasPredecessor({ predecessor: [1, 2] }, 1)).toBe(true)
      expect(hasPredecessor({ predecessor: [1, 2] }, 3)).toBe(false)
    })

    it('字符串前置任务应正确判断存在性', () => {
      expect(hasPredecessor({ predecessor: '1,2' }, 2)).toBe(true)
      expect(hasPredecessor({ predecessor: '1,2' }, 9)).toBe(false)
    })

    it('无前置任务字段应返回 false', () => {
      expect(hasPredecessor({}, 1)).toBe(false)
    })
  })

  describe('addPredecessor', () => {
    it('空任务添加前置任务应生成 number[]', () => {
      const task: { predecessor?: number[] } = {}
      addPredecessor(task, 5)
      expect(task.predecessor).toEqual([5])
    })

    it('已存在前置任务应追加且不重复', () => {
      const task: { predecessor?: number[] } = { predecessor: [1] }
      addPredecessor(task, 2)
      expect(task.predecessor).toEqual([1, 2])
      addPredecessor(task, 1)
      expect(task.predecessor).toEqual([1, 2])
    })

    it('字符串前置任务追加后应转为 number[] 并去重', () => {
      const task: { predecessor?: number[] } = { predecessor: '1' as unknown as number[] }
      addPredecessor(task, 2)
      expect(task.predecessor).toEqual([1, 2])
      addPredecessor(task, 1)
      expect(task.predecessor).toEqual([1, 2])
    })
  })

  describe('removePredecessor', () => {
    it('移除存在的 ID 应返回剩余数组', () => {
      const task: { predecessor?: number[] } = { predecessor: [1, 2] }
      removePredecessor(task, 1)
      expect(task.predecessor).toEqual([2])
    })

    it('移除唯一 ID 后应置为 undefined', () => {
      const task: { predecessor?: number[] } = { predecessor: [1] }
      removePredecessor(task, 1)
      expect(task.predecessor).toBeUndefined()
    })

    it('移除不存在的 ID 应保持不变', () => {
      const task: { predecessor?: number[] } = { predecessor: [1, 2] }
      removePredecessor(task, 9)
      expect(task.predecessor).toEqual([1, 2])
    })

    it('字符串前置任务移除后应转为 number[]', () => {
      const task: { predecessor?: number[] } = { predecessor: '1,2' as unknown as number[] }
      removePredecessor(task, 1)
      expect(task.predecessor).toEqual([2])
    })
  })

  describe('formatPredecessorDisplay', () => {
    it('多个 ID 应以逗号+空格展示', () => {
      expect(formatPredecessorDisplay([1, 2])).toBe('1, 2')
    })

    it('单个 ID 应直接展示', () => {
      expect(formatPredecessorDisplay([1])).toBe('1')
    })

    it('空 / undefined 应展示占位符 -', () => {
      expect(formatPredecessorDisplay([])).toBe('-')
      expect(formatPredecessorDisplay(undefined)).toBe('-')
    })
  })
})

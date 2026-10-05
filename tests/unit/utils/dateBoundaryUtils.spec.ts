/**
 * dateBoundaryUtils.spec.ts - endDate 有效日期边界计算单元测试
 *
 * 覆盖 .ai/.claude/requirments/v1.13.5.md 第9节的 a/b/c 规则：
 * a. startDate 无论是否带 time 部分 → 渲染起点 = 日期部分（不在本文件测试范围）
 * b. endDate 不带 time 部分 → 有效结束日期 = 日期部分本身
 * c. endDate 带 time 部分 → 有效结束日期 = (endDateTime − 15分钟) 的日期部分
 */

import { describe, it, expect } from 'vitest'
import { hasExplicitTimePart, getEffectiveEndDateOnly } from '../../../src/utils/dateBoundaryUtils'

describe('dateBoundaryUtils', () => {
  describe('hasExplicitTimePart', () => {
    it('纯日期字符串应返回 false', () => {
      expect(hasExplicitTimePart('2025-07-31')).toBe(false)
    })

    it('带时间部分的字符串应返回 true', () => {
      expect(hasExplicitTimePart('2025-07-31 00:00')).toBe(true)
      expect(hasExplicitTimePart('2025-07-31 14:30')).toBe(true)
    })

    it('Date 对象 / undefined / null 应返回 false', () => {
      expect(hasExplicitTimePart(new Date())).toBe(false)
      expect(hasExplicitTimePart(undefined)).toBe(false)
      expect(hasExplicitTimePart(null)).toBe(false)
    })
  })

  describe('getEffectiveEndDateOnly', () => {
    it('规则b：纯日期 endDate 直接返回其日期部分，不做调整', () => {
      const parsed = new Date(2025, 6, 31) // 2025-07-31
      const result = getEffectiveEndDateOnly('2025-07-31', parsed)
      expect(result).toEqual(new Date(2025, 6, 31))
    })

    it('规则c：endDate 恰好是次日00:00（TaskDrawer自动转换场景）应回退到前一天', () => {
      // 对应本次修复的核心 bug 场景：TaskDrawer 把纯日期 '2025-07-31' 自动转换为
      // '2025-08-01 00:00' 后原样保存，渲染时应正确识别为"覆盖到7月31日"
      const parsed = new Date(2025, 7, 1) // 2025-08-01 00:00
      const result = getEffectiveEndDateOnly('2025-08-01 00:00', parsed)
      expect(result).toEqual(new Date(2025, 6, 31))
    })

    it('规则c：endDate 带非00:00的显式时间部分，应保持在当天', () => {
      const parsed = new Date(2025, 6, 31, 14, 30) // 2025-07-31 14:30
      const result = getEffectiveEndDateOnly('2025-07-31 14:30', parsed)
      expect(result).toEqual(new Date(2025, 6, 31))
    })

    it('规则c：endDate 带00:15（网格上最早的非零时刻），应保持在当天', () => {
      const parsed = new Date(2025, 6, 31, 0, 15)
      const result = getEffectiveEndDateOnly('2025-07-31 00:15', parsed)
      expect(result).toEqual(new Date(2025, 6, 31))
    })
  })
})

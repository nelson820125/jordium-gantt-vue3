/**
 * workCalendarDisplayOverride.spec.ts - resolveWorkCalendarDisplayOverride 单元测试
 *
 * 覆盖 v1.14.1 表头周末灰色展示覆盖判断规则：
 * - 仅"全天 + 公司级（未指定 resourceIds）"例外影响展示；
 * - 半天/部分时段例外、资源级例外均不改变展示（返回 undefined，交由调用方回退默认规则）；
 * - 多条全天例外重叠时，按数组顺序取最后一条命中记录。
 */

import { describe, it, expect } from 'vitest'
import { resolveWorkCalendarDisplayOverride } from '../../../src/utils/workCalendarUtils'
import type { WorkCalendarException } from '../../../src/models/types/ResourceUsageTypes'

describe('resolveWorkCalendarDisplayOverride', () => {
  it('未提供例外时返回 undefined', () => {
    expect(resolveWorkCalendarDisplayOverride(new Date(2026, 0, 5), undefined)).toBeUndefined()
    expect(resolveWorkCalendarDisplayOverride(new Date(2026, 0, 5), [])).toBeUndefined()
  })

  it('全天 + 公司级法定节假日：working=false 应返回 true（按非工作日展示）', () => {
    const exceptions: WorkCalendarException[] = [
      { start: '2026-01-05', end: '2026-01-05', working: false },
    ]
    expect(resolveWorkCalendarDisplayOverride(new Date(2026, 0, 5), exceptions)).toBe(true)
    // 未命中的其他日期不受影响
    expect(resolveWorkCalendarDisplayOverride(new Date(2026, 0, 6), exceptions)).toBeUndefined()
  })

  it('全天 + 公司级调休补班：周末 working=true 应返回 false（按工作日展示）', () => {
    const exceptions: WorkCalendarException[] = [
      { start: '2026-01-03', end: '2026-01-03', working: true }, // 周六调休补班
    ]
    expect(resolveWorkCalendarDisplayOverride(new Date(2026, 0, 3), exceptions)).toBe(false)
  })

  it('半天/部分时段例外（带具体时间部分）不影响展示，返回 undefined', () => {
    const exceptions: WorkCalendarException[] = [
      { start: '2026-01-05 08:00', end: '2026-01-05 12:00', working: false },
    ]
    expect(resolveWorkCalendarDisplayOverride(new Date(2026, 0, 5), exceptions)).toBeUndefined()
  })

  it('跨天区间例外，若首尾任一端带具体时间部分，也不影响展示', () => {
    const exceptions: WorkCalendarException[] = [
      { start: '2026-01-05 08:00', end: '2026-01-07 12:00', working: false },
    ]
    expect(resolveWorkCalendarDisplayOverride(new Date(2026, 0, 6), exceptions)).toBeUndefined()
  })

  it('资源级例外（指定 resourceIds）不影响共享表头展示，返回 undefined', () => {
    const exceptions: WorkCalendarException[] = [
      { start: '2026-01-05', end: '2026-01-05', working: false, resourceIds: ['A'] },
    ]
    expect(resolveWorkCalendarDisplayOverride(new Date(2026, 0, 5), exceptions)).toBeUndefined()
  })

  it('多条全天例外重叠时，按数组顺序取最后一条命中记录', () => {
    const exceptions: WorkCalendarException[] = [
      { start: '2026-01-05', end: '2026-01-05', working: false },
      { start: '2026-01-05', end: '2026-01-05', working: true },
    ]
    expect(resolveWorkCalendarDisplayOverride(new Date(2026, 0, 5), exceptions)).toBe(false)
  })

  it('跨天全天例外覆盖多天，每天都应命中并返回相同展示结果', () => {
    const exceptions: WorkCalendarException[] = [
      { start: '2026-01-05', end: '2026-01-07', working: false },
    ]
    expect(resolveWorkCalendarDisplayOverride(new Date(2026, 0, 5), exceptions)).toBe(true)
    expect(resolveWorkCalendarDisplayOverride(new Date(2026, 0, 6), exceptions)).toBe(true)
    expect(resolveWorkCalendarDisplayOverride(new Date(2026, 0, 7), exceptions)).toBe(true)
    expect(resolveWorkCalendarDisplayOverride(new Date(2026, 0, 8), exceptions)).toBeUndefined()
  })
})

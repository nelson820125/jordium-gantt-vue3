/**
 * workCalendarUtils.spec.ts - createWorkCalendarResolver 单元测试
 *
 * 覆盖 .ai/.claude/requirements/v1.13.6.md 第8节的3个用例（全天/半天/跨天例外）
 * + 资源级别覆盖 + 默认行为（无例外时与升级前 isWeekend() 等价）。
 */

import { describe, it, expect } from 'vitest'
import { createWorkCalendarResolver } from '../../../src/utils/workCalendarUtils'
import type { WorkCalendarException } from '../../../src/models/types/ResourceUsageTypes'
import type { Resource } from '../../../src/models/classes/Resource'

const resourceA: Resource = { id: 'A', name: '资源A', tasks: [] }
const resourceB: Resource = { id: 'B', name: '资源B', tasks: [] }

/** 调用 resolver 查询单个自然日（0点~次日0点）的有效工作分钟数 */
function minutesOfDay(
  resolver: ReturnType<typeof createWorkCalendarResolver>,
  dateStr: string,
  resource: Resource = resourceA
): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + 1)
  return resolver(start, end, resource)
}

describe('createWorkCalendarResolver', () => {
  it('无例外时：weekday 返回整天(1440)，weekend 返回 0，与升级前 isWeekend() 等价', () => {
    const resolver = createWorkCalendarResolver([])
    expect(minutesOfDay(resolver, '2026-01-05')).toBe(1440) // 周一
    expect(minutesOfDay(resolver, '2026-01-03')).toBe(0) // 周六
    expect(minutesOfDay(resolver, '2026-01-04')).toBe(0) // 周日
  })

  it('用例1：全天法定节假日（不带时间部分）应返回 0', () => {
    const exceptions: WorkCalendarException[] = [
      { start: '2026-01-05', end: '2026-01-05', working: false },
    ]
    const resolver = createWorkCalendarResolver(exceptions)
    expect(minutesOfDay(resolver, '2026-01-05')).toBe(0)
    // 未命中例外的其他工作日不受影响
    expect(minutesOfDay(resolver, '2026-01-06')).toBe(1440)
  })

  it('用例2：半天例外（仅上午请假）按与 workingHours 的重叠比例折算', () => {
    const exceptions: WorkCalendarException[] = [
      { start: '2026-01-05 08:00', end: '2026-01-05 12:00', working: false },
    ]
    const resolver = createWorkCalendarResolver(exceptions)
    // 默认 workingHours：上午8-11(180min)+下午13-17(240min)=420min；
    // 08:00-12:00 与上午段完全重叠(180min)，与下午段无重叠 → ratio=180/420
    const expected = 1440 - (180 / 420) * 1440
    expect(minutesOfDay(resolver, '2026-01-05')).toBeCloseTo(expected, 5)
  })

  it('用例3：跨天区间例外，首尾按具体时刻截断，中间整天生效', () => {
    const exceptions: WorkCalendarException[] = [
      { start: '2026-01-05 08:00', end: '2026-01-07 12:00', working: false },
    ]
    const resolver = createWorkCalendarResolver(exceptions)
    // 首日：08:00起，与上午段(8-11)全部重叠(180min)+下午段(13-17)全部重叠(240min)=420min → ratio=1 → 0
    expect(minutesOfDay(resolver, '2026-01-05')).toBe(0)
    // 中间日（01-06）：例外覆盖全天 → 0
    expect(minutesOfDay(resolver, '2026-01-06')).toBe(0)
    // 末日：至12:00，仅与上午段(8-11)全部重叠(180min) → ratio=180/420
    const expectedLastDay = 1440 - (180 / 420) * 1440
    expect(minutesOfDay(resolver, '2026-01-07')).toBeCloseTo(expectedLastDay, 5)
  })

  it('调休补班：周末 working=true 全天例外应折算为满工作日(1440)', () => {
    const exceptions: WorkCalendarException[] = [
      { start: '2026-01-03', end: '2026-01-03', working: true }, // 周六调休补班
    ]
    const resolver = createWorkCalendarResolver(exceptions)
    expect(minutesOfDay(resolver, '2026-01-03')).toBe(1440)
  })

  it('working=true 且指定 timeRanges 时，按显式时段折算而非整段 workingHours', () => {
    const exceptions: WorkCalendarException[] = [
      {
        start: '2026-01-03',
        end: '2026-01-03',
        working: true,
        timeRanges: [{ start: '09:00', end: '11:00' }], // 仅加班2小时
      },
    ]
    const resolver = createWorkCalendarResolver(exceptions)
    // 2小时 / 420分钟基准 * 1440 ≈ 411.43
    const expected = (120 / 420) * 1440
    expect(minutesOfDay(resolver, '2026-01-03')).toBeCloseTo(expected, 5)
  })

  it('resourceIds 限定：例外仅对指定资源生效，其余资源不受影响', () => {
    const exceptions: WorkCalendarException[] = [
      { start: '2026-01-05', end: '2026-01-05', working: false, resourceIds: ['A'] },
    ]
    const resolver = createWorkCalendarResolver(exceptions)
    expect(minutesOfDay(resolver, '2026-01-05', resourceA)).toBe(0)
    expect(minutesOfDay(resolver, '2026-01-05', resourceB)).toBe(1440)
  })

  it('多天范围一次性查询：结果等于逐日折算之和', () => {
    const exceptions: WorkCalendarException[] = [
      { start: '2026-01-05', end: '2026-01-05', working: false },
    ]
    const resolver = createWorkCalendarResolver(exceptions)
    const start = new Date(2026, 0, 5)
    const end = new Date(2026, 0, 8) // 01-05(holiday,0) + 01-06(1440) + 01-07(1440)
    expect(resolver(start, end, resourceA)).toBe(0 + 1440 + 1440)
  })
})

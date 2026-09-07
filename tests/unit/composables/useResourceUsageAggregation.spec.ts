/**
 * useResourceUsageAggregation.spec.ts - 工作日/工时可配置化(v1.14.0)回归与新增行为测试
 *
 * 覆盖：
 * 1. 向后兼容：不传 resolveWorkingMinutes/dailyCapacityHours 时，结果与升级前硬编码行为完全一致
 * 2. dailyCapacityHours 按资源函数差异化（设备 24 小时）
 * 3. workCalendarExceptions 全天假期使某天工时清零，总工时相应减少
 * 4. resourceOffOrLeaveLevel：资源专属全天请假标记为 'full'，与公司级共享周末(isWeekend)互斥
 */

import { describe, it, expect } from 'vitest'
import { ref, computed } from 'vue'
import { useResourceUsageAggregation } from '../../../src/composables/useResourceUsageAggregation'
import { createWorkCalendarResolver } from '../../../src/utils/workCalendarUtils'
import type { Resource } from '../../../src/models/classes/Resource'

// 2026-01-05(周一) ~ 2026-01-09(周五)：5个工作日
function buildResource(estimatedHours: number): Resource {
  return {
    id: 'R1',
    name: '资源R1',
    tasks: [
      {
        id: 'T1',
        name: '任务1',
        startDate: '2026-01-05',
        endDate: '2026-01-09',
        estimatedHours,
      } as unknown as Resource['tasks'][number],
    ],
  }
}

describe('useResourceUsageAggregation - v1.14.0 工作日/工时可配置化', () => {
  it('不传新配置时，5个工作日均摊40小时任务 = 每日8小时，与升级前行为一致', () => {
    const resources = ref<Resource[]>([buildResource(40)])
    const { cellsByResource } = useResourceUsageAggregation({
      resources,
      scale: ref('day'),
      dateRange: ref({ start: new Date(2026, 0, 5), end: new Date(2026, 0, 9) }),
    })
    const cells = cellsByResource.value.get('R1')!
    expect(cells).toHaveLength(5)
    for (const cell of cells) {
      expect(cell.totalHours).toBeCloseTo(8, 5)
      expect(cell.totalPercent).toBeCloseTo(100, 5)
    }
  })

  it('dailyCapacityHours 按资源函数返回 24（设备资源），周期分母随之变化', () => {
    const resources = ref<Resource[]>([buildResource(0)]) // 无 estimatedHours，走 ratio*capacityHours*weight 分支
    const { cellsByResource } = useResourceUsageAggregation({
      resources,
      scale: ref('day'),
      dateRange: ref({ start: new Date(2026, 0, 5), end: new Date(2026, 0, 9) }),
      dailyCapacityHours: computed(() => () => 24),
    })
    const cells = cellsByResource.value.get('R1')!
    for (const cell of cells) {
      expect(cell.totalHours).toBeCloseTo(24, 5)
      expect(cell.totalPercent).toBeCloseTo(100, 5)
    }
  })

  it('workCalendarExceptions 全天假期使当天工时清零，任务总工时按剩余工作日重新分摊', () => {
    const resources = ref<Resource[]>([buildResource(40)])
    const resolver = createWorkCalendarResolver([
      { start: '2026-01-07', end: '2026-01-07', working: false }, // 周三请假
    ])
    const { cellsByResource } = useResourceUsageAggregation({
      resources,
      scale: ref('day'),
      dateRange: ref({ start: new Date(2026, 0, 5), end: new Date(2026, 0, 9) }),
      resolveWorkingMinutes: computed(() => resolver),
    })
    const cells = cellsByResource.value.get('R1')!
    const byDate = new Map(cells.map(c => [c.periodStart.getDate(), c]))
    expect(byDate.get(7)!.totalHours).toBe(0)
    // 40小时按剩余4个工作日(权重相同)均摊 = 10小时/天
    expect(byDate.get(5)!.totalHours).toBeCloseTo(10, 5)
    expect(byDate.get(6)!.totalHours).toBeCloseTo(10, 5)
    expect(byDate.get(8)!.totalHours).toBeCloseTo(10, 5)
    expect(byDate.get(9)!.totalHours).toBeCloseTo(10, 5)
  })

  it('resourceOffOrLeaveLevel: 资源专属全天请假标记为 full，与公司级共享周末(isWeekend)互斥', () => {
    const resources = ref<Resource[]>([buildResource(40)])
    const resolver = createWorkCalendarResolver([
      { start: '2026-01-07', end: '2026-01-07', working: false, resourceIds: ['R1'] }, // 资源专属请假
    ])
    const { cellsByResource } = useResourceUsageAggregation({
      resources,
      scale: ref('day'),
      // 2026-01-05(周一) ~ 2026-01-11(周日)：含普通工作日、资源专属请假日、公司级共享周末
      dateRange: ref({ start: new Date(2026, 0, 5), end: new Date(2026, 0, 11) }),
      resolveWorkingMinutes: computed(() => resolver),
    })
    const cells = cellsByResource.value.get('R1')!
    const byDate = new Map(cells.map(c => [c.periodStart.getDate(), c]))

    // 资源专属请假日：ratio=0 且非公司级周末 → 标记为 'full'
    expect(byDate.get(7)!.isWeekend).toBe(false)
    expect(byDate.get(7)!.resourceOffOrLeaveLevel).toBe('full')

    // 普通工作日：ratio>0，不标记
    expect(byDate.get(5)!.resourceOffOrLeaveLevel).toBeUndefined()

    // 公司级共享周末（周六1/10、周日1/11）：即使 ratio 同样为 0，也不重复标记（与 isWeekend 互斥）
    expect(byDate.get(10)!.isWeekend).toBe(true)
    expect(byDate.get(10)!.resourceOffOrLeaveLevel).toBeUndefined()
    expect(byDate.get(11)!.isWeekend).toBe(true)
    expect(byDate.get(11)!.resourceOffOrLeaveLevel).toBeUndefined()
  })

  it('resourceOffOrLeaveLevel: 非 day 粒度（如 week）恒为 undefined', () => {
    const resources = ref<Resource[]>([buildResource(40)])
    const resolver = createWorkCalendarResolver([
      { start: '2026-01-07', end: '2026-01-07', working: false, resourceIds: ['R1'] },
    ])
    const { cellsByResource } = useResourceUsageAggregation({
      resources,
      scale: ref('week'),
      dateRange: ref({ start: new Date(2026, 0, 5), end: new Date(2026, 0, 11) }),
      resolveWorkingMinutes: computed(() => resolver),
    })
    const cells = cellsByResource.value.get('R1')!
    for (const cell of cells) {
      expect(cell.resourceOffOrLeaveLevel).toBeUndefined()
    }
  })
})

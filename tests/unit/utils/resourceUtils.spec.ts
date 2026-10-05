/**
 * resourceUtils.spec.ts - 资源工厂函数单元测试
 * 覆盖 v1.13.5 Resource.type → title 字段拆分改动
 */

import { describe, it, expect } from 'vitest'
import { createResource } from '../../../src/utils/resourceUtils'

describe('createResource', () => {
  it('应该正确设置 title 字段（原 type 字段迁移至此，表示职务/头衔）', () => {
    const resource = createResource({
      id: 'dev-001',
      name: '张三',
      title: 'developer',
      type: 'Human',
    })

    expect(resource.title).toBe('developer')
    expect(resource.type).toBe('Human')
  })

  it('未显式设置 type 时应默认赋值为 Human（缺省值兜底）', () => {
    const resource = createResource({
      id: 'dev-002',
      name: '李四',
      title: 'designer',
    })

    expect(resource.type).toBe('Human')
  })

  it('显式设置 type 为 Device/Others 时应保留原值，不被兜底覆盖', () => {
    const device = createResource({ id: 'dev-003', name: '打印机', type: 'Device' })
    const others = createResource({ id: 'dev-004', name: '外部顾问', type: 'Others' })

    expect(device.type).toBe('Device')
    expect(others.type).toBe('Others')
  })

  it('未设置 title 时应为 undefined，不影响其他字段', () => {
    const resource = createResource({
      id: 'dev-005',
      name: '王五',
    })

    expect(resource.title).toBeUndefined()
    expect(resource.type).toBe('Human')
    expect(resource.name).toBe('王五')
  })
})

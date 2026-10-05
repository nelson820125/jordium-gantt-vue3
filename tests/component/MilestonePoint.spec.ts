import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MilestonePoint from '@/components/MilestonePoint.vue'
import { createMilestone } from '../fixtures/tasks'

describe('MilestonePoint Component', () => {
  const baseProps = () => ({
    date: '2024-01-15',
    milestone: createMilestone(),
    task: createMilestone(),
    name: 'Milestone',
    rowHeight: 32,
    dayWidth: 20,
    startDate: new Date('2024-01-01'),
    timelineStart: new Date('2024-01-01'),
    timelineEnd: new Date('2024-01-31'),
    periodWidth: 20,
    allowDragAndResize: true,
  })

  it('未使用 slot 时，默认渲染 SVG 图标 + 标签', () => {
    const wrapper = mount(MilestonePoint, {
      props: baseProps(),
    })

    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('.milestone-label').exists()).toBe(true)
    expect(wrapper.text()).toContain('Milestone')
  })

  it('传入 custom-milestone-content slot 时，slot 内容完整替换图标和标签', () => {
    const wrapper = mount(MilestonePoint, {
      props: baseProps(),
      slots: {
        'custom-milestone-content': `<template #default="{ milestone, task, rowHeight, dayWidth }">
          <div class="my-custom-milestone">{{ milestone.name }}-{{ task.name }}-{{ rowHeight }}-{{ dayWidth }}</div>
        </template>`,
      },
    })

    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.find('.milestone-label').exists()).toBe(false)
    expect(wrapper.find('.my-custom-milestone').exists()).toBe(true)
    expect(wrapper.find('.my-custom-milestone').text()).toBe('Milestone-Milestone-32-20')
  })

  it('点击、双击、拖拽事件监听器绑定在最外层 .milestone 容器上', async () => {
    const wrapper = mount(MilestonePoint, {
      props: baseProps(),
    })

    const milestoneEl = wrapper.find('.milestone')
    await milestoneEl.trigger('dblclick')
    expect(wrapper.emitted('milestone-double-click')).toBeTruthy()
  })

  it.each([
    ['left', 'milestone-label-position-left'],
    ['top', 'milestone-label-position-top'],
    ['bottom', 'milestone-label-position-bottom'],
    ['right', 'milestone-label-position-right'],
  ])('labelPosition=%s 时容器带有 %s 类', (labelPosition, expectedClass) => {
    const wrapper = mount(MilestonePoint, {
      props: {
        ...baseProps(),
        labelPosition: labelPosition as 'left' | 'top' | 'right' | 'bottom',
      },
    })

    expect(wrapper.find('.milestone').classes()).toContain(expectedClass)
    expect(wrapper.find('.milestone-label').classes()).toContain(`milestone-label-${labelPosition}`)
  })

  it('不传 labelPosition 时默认等价于 right（向后兼容现状）', () => {
    const wrapper = mount(MilestonePoint, {
      props: baseProps(),
    })

    expect(wrapper.find('.milestone').classes()).toContain('milestone-label-position-right')
    expect(wrapper.find('.milestone-label').classes()).toContain('milestone-label-right')
  })
})

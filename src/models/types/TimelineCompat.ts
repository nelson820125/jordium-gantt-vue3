/**
 * 时间轴数据类型兼容性定义
 * 用于处理现有代码的类型兼容问题
 */

// 简化的通用时间轴数据类型，用于向下兼容
export type LegacyTimelineData = Array<Record<string, any>>

// 类型守卫函数
export function isTimelineMonth(item: any): item is Record<string, any> {
  return item && typeof item === 'object' && 'year' in item && 'month' in item
}

export function isTimelineYear(item: any): item is Record<string, any> {
  return item && typeof item === 'object' && 'year' in item && 'yearLabel' in item
}

export function isTimelineDay(item: any): item is Record<string, any> {
  return item && typeof item === 'object' && 'year' in item && 'day' in item
}

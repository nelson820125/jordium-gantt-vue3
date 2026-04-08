/**
 * 位置计算缓存工具类
 * 优化TaskBar位置计算性能：O(n) → O(1)
 *
 * 核心思路：
 * 1. 预计算所有日期的位置映射表（一次性O(n)遍历）
 * 2. 后续查询直接O(1)查表，避免重复遍历timelineData
 * 3. timelineData变化时自动重建缓存
 *
 * @author AI Frontend Engineer
 * @date 2026-02-01
 */

import type { TimelineMonth, TimelineYear, TimelineDay } from '../models/types/TimelineDataTypes'
import { TimelineScale, SCALE_CONFIGS } from '../models/types/TimelineScale'

type TimelineData = TimelineMonth | TimelineYear | TimelineDay

export class PositionCache {
  // 位置缓存表：key格式为 "scale-year-month-day"
  private cache: Map<string, number> = new Map()

  // timelineData的哈希值，用于判断是否需要重建缓存
  private timelineDataHash = ''

  /**
   * 构建缓存key
   */
  private getCacheKey(date: Date, timeScale: string): string {
    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDate()
    return `${timeScale}-${year}-${month}-${day}`
  }

  /**
   * 计算timelineData的hash值
   * 包含时间刻度、日期范围、数据长度以及当前视图的cellWidth，
   * 确保修改 SCALE_CONFIGS 后（例如热更新）能正确重建缓存。
   */
  private computeHash(
    timelineData: TimelineData[],
    timeScale: string,
    cellWidths?: Partial<Record<string, number>>
  ): string {
    if (timelineData.length === 0) return ''

    const first = timelineData[0]
    const last = timelineData[timelineData.length - 1]

    // 处理不同数据结构：TimelineDay 使用 date，其他使用 startDate/endDate
    let firstDate: Date
    let lastDate: Date

    if ('date' in first) {
      // TimelineDay (小时视图)
      firstDate = first.date
    } else if ('startDate' in first) {
      // TimelineMonth, TimelineYear (其他视图)
      firstDate = first.startDate
    } else {
      // 兜底：返回空hash
      return ''
    }

    if ('date' in last) {
      // TimelineDay (小时视图)
      lastDate = last.date
    } else if ('endDate' in last) {
      // TimelineMonth, TimelineYear (其他视图)
      lastDate = last.endDate
    } else {
      // 兜底：返回空hash
      return ''
    }

    // 将当前视图对应的 cellWidth 加入 hash，防止 cellWidth 变化后缓存不更新
    const cellWidth =
      cellWidths?.[timeScale] ??
      SCALE_CONFIGS[timeScale as keyof typeof SCALE_CONFIGS]?.cellWidth ??
      0

    return `${timeScale}-${firstDate.getTime()}-${lastDate.getTime()}-${timelineData.length}-cw${cellWidth}`
  }

  /**
   * 预计算所有日期的位置映射表
   * 在Timeline层调用，所有TaskBar共享缓存
   *
   * @param timelineData 时间轴数据数组
   * @param timeScale 当前时间刻度
   * @param cellWidths 各刻度实际 cellWidth（effectiveScaleConfigs），覆盖内置默认值
   */
  buildCache(
    timelineData: TimelineData[],
    timeScale: string,
    cellWidths?: Partial<Record<string, number>>
  ): void {
    const newHash = this.computeHash(timelineData, timeScale, cellWidths)

    // 如果timelineData没变化，复用现有缓存
    if (newHash === this.timelineDataHash && this.cache.size > 0) {
      return
    }

    // 清空旧缓存，开始重建
    this.cache.clear()
    this.timelineDataHash = newHash

    // 获取实际 cellWidth 的辅助函数（优先使用传入的 cellWidths，回退到内置默认值）
    const getW = (scale: string): number =>
      cellWidths?.[scale] ?? SCALE_CONFIGS[scale as keyof typeof SCALE_CONFIGS]?.cellWidth ?? 60

    let cumulativePosition = 0

    // ⚠️ 关键优化：一次性遍历timelineData，构建完整的日期→位置映射表
    for (const periodData of timelineData) {
      if (timeScale === TimelineScale.HOUR) {
        // 小时视图：遍历每天的所有小时
        const hours = (periodData as TimelineDay).hours || []
        const hourCellW = getW('hour')

        for (let i = 0; i < hours.length; i++) {
          const hourData = hours[i]
          const date = hourData.date ? new Date(hourData.date) : new Date()
          const key = this.getCacheKey(date, timeScale)
          const position = cumulativePosition + i * hourCellW
          this.cache.set(key, position)
        }

        cumulativePosition += hours.length * hourCellW
      } else if (timeScale === TimelineScale.DAY) {
        // 日视图：遍历每个月的所有天数
        const days = (periodData as TimelineMonth).days || []
        const dayCellW = getW('day')

        for (let i = 0; i < days.length; i++) {
          const dayData = days[i]
          const date = new Date(dayData.date)
          const key = this.getCacheKey(date, timeScale)
          const position = cumulativePosition + i * dayCellW
          this.cache.set(key, position)
        }

        cumulativePosition += days.length * dayCellW
      } else if (timeScale === TimelineScale.WEEK) {
        // 周视图：遍历每个月的所有周
        const weeks = (periodData as TimelineMonth).weeks || []
        const weekCellW = getW('week')
        const dayWidth = weekCellW / 7

        for (const week of weeks) {
          const subDays = week.subDays || []

          for (let i = 0; i < subDays.length; i++) {
            const subDay = subDays[i]
            const date = new Date(subDay.date)
            const key = this.getCacheKey(date, timeScale)
            const position = cumulativePosition + i * dayWidth
            this.cache.set(key, position)
          }

          cumulativePosition += weekCellW
        }
      } else if (timeScale === TimelineScale.MONTH) {
        // 月视图：为每个月的每一天建立映射
        const startDate = new Date((periodData as TimelineMonth).startDate)
        const endDate = new Date((periodData as TimelineMonth).endDate)
        const daysInMonth = (periodData as TimelineMonth).monthData?.dayCount || 30
        const monthCellW = getW('month')
        const dayWidth = monthCellW / daysInMonth

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(startDate.getFullYear(), startDate.getMonth(), day)
          // 确保日期在当前月范围内
          if (date <= endDate) {
            const key = this.getCacheKey(date, timeScale)
            const position = cumulativePosition + (day - 1) * dayWidth
            this.cache.set(key, position)
          }
        }

        cumulativePosition += monthCellW
      } else if (timeScale === TimelineScale.QUARTER) {
        // 季度视图：遍历每年的所有季度
        const quarters = (periodData as TimelineYear).quarters || []
        const quarterCellW = getW('quarter')

        for (const quarter of quarters) {
          const quarterStart = new Date(quarter.startDate)
          const quarterEnd = new Date(quarter.endDate)

          // 计算季度的日历天数（+1 包含端点日，避免某季最后一天超出单元格边界）
          const daysInQuarter =
            Math.round((quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          const dayWidth = quarterCellW / daysInQuarter

          // 为季度中的每一天建立映射
          for (let dayOffset = 0; dayOffset < daysInQuarter; dayOffset++) {
            const date = new Date(quarterStart)
            date.setDate(quarterStart.getDate() + dayOffset)

            if (date <= quarterEnd) {
              const key = this.getCacheKey(date, timeScale)
              const position = cumulativePosition + dayOffset * dayWidth
              this.cache.set(key, position)
            }
          }

          cumulativePosition += quarterCellW
        }
      } else if (timeScale === TimelineScale.YEAR) {
        // 年视图：遍历每年的两个半年
        const halfYears = (periodData as TimelineYear).halfYears || []
        const halfYearCellW = getW('year')

        for (const halfYear of halfYears) {
          const halfYearStart = new Date(halfYear.startDate)
          const halfYearEnd = new Date(halfYear.endDate)
          const halfYearWidth = halfYearCellW

          // 计算半年的日历天数（+1 包含端点日，避免半年最后一天超出单元格边界）
          const daysInHalfYear =
            Math.round((halfYearEnd.getTime() - halfYearStart.getTime()) / (1000 * 60 * 60 * 24)) +
            1
          const dayWidth = halfYearWidth / daysInHalfYear

          // 为半年中的每一天建立映射
          for (let dayOffset = 0; dayOffset < daysInHalfYear; dayOffset++) {
            const date = new Date(halfYearStart)
            date.setDate(halfYearStart.getDate() + dayOffset)

            if (date <= halfYearEnd) {
              const key = this.getCacheKey(date, timeScale)
              const position = cumulativePosition + dayOffset * dayWidth
              this.cache.set(key, position)
            }
          }

          cumulativePosition += halfYearCellW
        }
      }
    }
  }

  /**
   * O(1)查找日期对应的位置
   *
   * @param date 目标日期
   * @param timeScale 当前时间刻度
   * @returns 位置(px)，如果未找到返回null
   */
  getPosition(date: Date, timeScale: string): number | null {
    const key = this.getCacheKey(date, timeScale)
    const position = this.cache.get(key)

    if (position === undefined) {
      // 缓存未命中，可能是日期在timelineData范围外
      return null
    }

    return position
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear()
    this.timelineDataHash = ''
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; hash: string } {
    return {
      size: this.cache.size,
      hash: this.timelineDataHash,
    }
  }
}

// 导出单例实例
export const positionCache = new PositionCache()

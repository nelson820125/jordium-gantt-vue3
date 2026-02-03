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
import { TimelineScale } from '../models/types/TimelineScale'

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
   * 简化方案：使用时间刻度 + 第一个日期 + 最后一个日期 + 数据长度
   */
  private computeHash(timelineData: TimelineData[], timeScale: string): string {
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

    return `${timeScale}-${firstDate.getTime()}-${lastDate.getTime()}-${timelineData.length}`
  }

  /**
   * 预计算所有日期的位置映射表
   * 在Timeline层调用，所有TaskBar共享缓存
   *
   * @param timelineData 时间轴数据数组
   * @param timeScale 当前时间刻度
   */
  buildCache(timelineData: TimelineData[], timeScale: string): void {
    const newHash = this.computeHash(timelineData, timeScale)

    // 如果timelineData没变化，复用现有缓存
    if (newHash === this.timelineDataHash && this.cache.size > 0) {
      return
    }

    // 清空旧缓存，开始重建
    this.cache.clear()
    this.timelineDataHash = newHash

    let cumulativePosition = 0

    // ⚠️ 关键优化：一次性遍历timelineData，构建完整的日期→位置映射表
    for (const periodData of timelineData) {
      if (timeScale === TimelineScale.HOUR) {
        // 小时视图：遍历每天的所有小时
        const hours = (periodData as TimelineDay).hours || []

        for (let i = 0; i < hours.length; i++) {
          const hourData = hours[i]
          const date = hourData.date ? new Date(hourData.date) : new Date()
          const key = this.getCacheKey(date, timeScale)
          const position = cumulativePosition + i * 30 // 小时视图每小时30px
          this.cache.set(key, position)
        }

        cumulativePosition += hours.length * 30
      } else if (timeScale === TimelineScale.DAY) {
        // 日视图：遍历每个月的所有天数
        const days = (periodData as TimelineMonth).days || []

        for (let i = 0; i < days.length; i++) {
          const dayData = days[i]
          const date = new Date(dayData.date)
          const key = this.getCacheKey(date, timeScale)
          const position = cumulativePosition + i * 30 // 日视图每天30px
          this.cache.set(key, position)
        }

        cumulativePosition += days.length * 30
      } else if (timeScale === TimelineScale.WEEK) {
        // 周视图：遍历每个月的所有周
        const weeks = (periodData as TimelineMonth).weeks || []

        for (const week of weeks) {
          const subDays = week.subDays || []
          const weekWidth = 60
          const dayWidth = weekWidth / 7

          for (let i = 0; i < subDays.length; i++) {
            const subDay = subDays[i]
            const date = new Date(subDay.date)
            const key = this.getCacheKey(date, timeScale)
            const position = cumulativePosition + i * dayWidth
            this.cache.set(key, position)
          }

          cumulativePosition += 60
        }
      } else if (timeScale === TimelineScale.MONTH) {
        // 月视图：为每个月的每一天建立映射
        const startDate = new Date((periodData as TimelineMonth).startDate)
        const endDate = new Date((periodData as TimelineMonth).endDate)
        const daysInMonth = (periodData as TimelineMonth).monthData?.dayCount || 30
        const monthWidth = 60
        const dayWidth = monthWidth / daysInMonth

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(startDate.getFullYear(), startDate.getMonth(), day)
          // 确保日期在当前月范围内
          if (date <= endDate) {
            const key = this.getCacheKey(date, timeScale)
            const position = cumulativePosition + (day - 1) * dayWidth
            this.cache.set(key, position)
          }
        }

        cumulativePosition += 60
      } else if (timeScale === TimelineScale.QUARTER) {
        // 季度视图：遍历每年的所有季度
        const quarters = (periodData as TimelineYear).quarters || []

        for (const quarter of quarters) {
          const quarterStart = new Date(quarter.startDate)
          const quarterEnd = new Date(quarter.endDate)
          const quarterWidth = 60

          // 计算季度的天数
          const daysInQuarter =
            Math.ceil(
              (quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24),
            ) + 1
          const dayWidth = quarterWidth / daysInQuarter

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

          cumulativePosition += 60
        }
      } else if (timeScale === TimelineScale.YEAR) {
        // 年视图：遍历每年的两个半年
        const halfYears = (periodData as TimelineYear).halfYears || []

        for (const halfYear of halfYears) {
          const halfYearStart = new Date(halfYear.startDate)
          const halfYearEnd = new Date(halfYear.endDate)
          const halfYearWidth = 180 // 年视图每半年180px

          // 计算半年的天数
          const daysInHalfYear =
            Math.ceil(
              (halfYearEnd.getTime() - halfYearStart.getTime()) / (1000 * 60 * 60 * 24),
            ) + 1
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

          cumulativePosition += 180
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

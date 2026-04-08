/**
 * 任务条逻辑坐标计算工具
 *
 * 核心思路（持久化坐标方案）：
 *   GanttLinks 关系线的端点坐标使用两层机制：
 *   1. 逻辑种子坐标：通过 timelineData + positionCache 纯数学计算所有任务（含视口外）的像素位置，
 *      在空闲帧（requestIdleCallback）中异步填充，不阻塞主线程。
 *   2. DOM 精确坐标：TaskBar 挂载后上报的 DOM getBoundingClientRect 值，覆盖同任务的种子坐标。
 *
 *   坐标存入 allBarPositions（持久化，滚出视口不删除），确保关系线两端节点坐标始终可用。
 *
 * 覆盖范围：所有视图（DAY / WEEK / MONTH / QUARTER / YEAR 用 positionCache O(1) 查表；
 *           HOUR 视图用分钟级公式直接计算）
 *
 * @author AI Frontend Engineer
 */

import type { PositionCache } from './positionCache'
import { TimelineScale } from '../models/types/TimelineScale'

/** 任务视图每行高度（px），与 Timeline.vue 中的 ROW_HEIGHT 保持一致 */
const ROW_HEIGHT = 51
/** TaskBar 高度 = ROW_HEIGHT - 10 */
const TASK_BAR_HEIGHT = ROW_HEIGHT - 10 // 41
/** TaskBar 边框宽度（border: 2px solid，无 box-sizing: border-box） */
const TASK_BAR_BORDER_WIDTH = 2
/** TaskBar 在行内的顶部偏移（考虑 border 的实际渲染高度） */
const TASK_BAR_TOP_OFFSET = Math.floor(
  (ROW_HEIGHT - TASK_BAR_HEIGHT - TASK_BAR_BORDER_WIDTH * 2) / 2
) // 3

/** 根据 dayWidth 计算小时视图每分钟像素数（dayWidth = hourCellWidth * 24） */
function getPixelPerMinute(dayWidth: number): number {
  return dayWidth / (24 * 60)
}

export interface LogicalBarPosition {
  left: number
  top: number
  width: number
  height: number
}

/**
 * 解析日期字符串 / Date 为本地 Date 对象。
 * 与 TaskBar.vue 中的 createLocalDate() 逻辑完全一致，确保坐标一致性。
 */
export function parseTaskDate(dateString: string | Date | undefined | null): Date | null {
  if (!dateString) return null
  if (dateString instanceof Date) return dateString

  if (typeof dateString === 'string') {
    // 纯日期格式 YYYY-MM-DD → 使用本地时间，避免时区偏移
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number)
      return new Date(year, month - 1, day)
    }
    // 带时间格式 YYYY-MM-DD HH:mm
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dateString)) {
      const [datePart, timePart] = dateString.split(' ')
      const [year, month, day] = datePart.split('-').map(Number)
      const [hour, minute] = timePart.split(':').map(Number)
      return new Date(year, month - 1, day, hour, minute)
    }
  }

  const d = new Date(dateString as string)
  return isNaN(d.getTime()) ? null : d
}

/** 将 Date 截断到当日零时（忽略时分秒） */
function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * 计算任务视图中单个任务条的逻辑坐标。
 * 与 TaskBar.vue 的 taskBarStyle computed 算法保持一致，确保像素值吻合。
 *
 * @param task           任务对象（只需 startDate / endDate）
 * @param rowIndex       任务在 tasks 数组中的索引（0-based），用于计算 top
 * @param timeScale      当前时间刻度
 * @param cache          positionCache 实例（Timeline.vue provide）
 * @param dayWidth       当前刻度下每天的像素宽度（用于 cache miss 时的估算）
 * @param baseStartDate  时间线基准开始日期（HOUR 视图必须传入，其他视图可省略）
 * @returns              逻辑坐标，若无法计算（日期缺失或范围外）则返回 null
 */
export function computeTaskViewLogicalPosition(
  task: { startDate?: string | Date | null; endDate?: string | Date | null },
  rowIndex: number,
  timeScale: TimelineScale,
  cache: PositionCache | null,
  dayWidth: number,
  baseStartDate?: Date | null
): LogicalBarPosition | null {
  const top = rowIndex * ROW_HEIGHT + TASK_BAR_TOP_OFFSET

  // ── HOUR 视图：分钟级精确计算（与 TaskBar.vue HOUR 分支完全一致）──────────────
  if (timeScale === TimelineScale.HOUR) {
    if (!baseStartDate) return null

    const startD = parseTaskDate(task.startDate || task.endDate)
    const endD = parseTaskDate(task.endDate || task.startDate)
    if (!startD || !endD) return null

    // 时间线当天零点作为像素 0 的基准
    const dayZero = new Date(baseStartDate)
    dayZero.setHours(0, 0, 0, 0)

    // 纯日期字符串（无时间部分）按 TaskBar.vue 规则处理：
    //   startDate 无时间 → 当日 00:00
    //   endDate   无时间 → 次日 00:00
    const origStart = task.startDate
    const origEnd = task.endDate
    let adjStart = startD
    let adjEnd = endD

    if (typeof origStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(origStart)) {
      adjStart = new Date(startD)
      adjStart.setHours(0, 0, 0, 0)
    }
    if (typeof origEnd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(origEnd)) {
      adjEnd = new Date(endD)
      adjEnd.setDate(adjEnd.getDate() + 1)
      adjEnd.setHours(0, 0, 0, 0)
    }

    const startMins = (adjStart.getTime() - dayZero.getTime()) / (1000 * 60)
    const endMins = (adjEnd.getTime() - dayZero.getTime()) / (1000 * 60)

    const pixelPerMinute = getPixelPerMinute(dayWidth)
    const left = Math.max(0, startMins * pixelPerMinute)
    const width = Math.max(4, (endMins - startMins) * pixelPerMinute)

    return { left, top, width, height: TASK_BAR_HEIGHT }
  }

  // ── 其他视图：使用 positionCache O(1) 查表 ─────────────────────────────────
  const startD = parseTaskDate(task.startDate || task.endDate)
  const endD = parseTaskDate(task.endDate || task.startDate)
  if (!startD || !endD) return null

  const startOnly = toDateOnly(startD)
  const endOnly = toDateOnly(endD)

  const left = cache ? cache.getPosition(startOnly, timeScale) : null
  if (left === null) return null // 任务日期在时间线范围外

  // 计算结束位置（取 endDate + 1 天，与 TaskBar.vue 逻辑一致）
  const nextDay = new Date(endOnly)
  nextDay.setDate(nextDay.getDate() + 1)
  const endPos = cache ? cache.getPosition(nextDay, timeScale) : null

  let width: number
  if (endPos !== null) {
    width = Math.max(4, endPos - left)
  } else {
    // endDate+1 超出时间线范围：用 endDate 位置 + 1 天宽度估算
    const endDatePos = cache ? cache.getPosition(endOnly, timeScale) : null
    width =
      endDatePos !== null
        ? Math.max(4, endDatePos - left + dayWidth)
        : Math.max(
            4,
            (Math.max(0, Math.round((endOnly.getTime() - startD.getTime()) / 86400000)) + 1) *
              dayWidth
          )
  }

  return { left, top, width, height: TASK_BAR_HEIGHT }
}

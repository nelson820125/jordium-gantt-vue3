/**
 * 性能监控工具
 */

let lastLogTime = 0
const LOG_THROTTLE = 100 // 最多每 100ms 输出一次日志

// FPS 监控相关
let fpsFrameCount = 0
let fpsLastTime = performance.now()
let fpsValues: number[] = []
let fpsMonitorEnabled = false
let fpsRafId: number | null = null

// 绘制性能统计
interface DrawStats {
  totalDraws: number
  totalDuration: number
  minDuration: number
  maxDuration: number
  avgDuration: number
  recentDraws: Array<{ timestamp: number; duration: number; details?: unknown }>
}

const drawStats: DrawStats = {
  totalDraws: 0,
  totalDuration: 0,
  minDuration: Infinity,
  maxDuration: 0,
  avgDuration: 0,
  recentDraws: [],
}

const MAX_RECENT_DRAWS = 100 // 保留最近 100 次绘制记录

export const perfMonitor = {
  /**
   * 记录性能日志（自动节流）
   */
  log(tag: string, data: unknown) {
    const now = Date.now()
    if (now - lastLogTime < LOG_THROTTLE) {
      return
    }
    lastLogTime = now

    // eslint-disable-next-line no-console
    console.log(`[Perf] ${tag}:`, data)
  },

  /**
   * 测量函数执行时间
   */
  measure<T>(tag: string, fn: () => T): T {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    const duration = end - start

    if (duration > 5) {
      // 只记录耗时超过 5ms 的操作
      // eslint-disable-next-line no-console
      console.log(`[Perf] ${tag}: ${duration.toFixed(2)}ms`)
    }

    return result
  },

  /**
   * 启动 FPS 监控
   * @param intervalMs 刷新间隔（毫秒），默认 1000ms
   */
  startFpsMonitor(intervalMs = 1000) {
    if (fpsMonitorEnabled) {
      // eslint-disable-next-line no-console
      console.warn('[Perf] FPS 监控已在运行中')
      return
    }

    fpsMonitorEnabled = true
    fpsFrameCount = 0
    fpsLastTime = performance.now()
    fpsValues = []

    // eslint-disable-next-line no-console
    console.log('[Perf] FPS 监控已启动')

    const updateFps = () => {
      if (!fpsMonitorEnabled) return

      fpsFrameCount++
      const currentTime = performance.now()
      const elapsed = currentTime - fpsLastTime

      if (elapsed >= intervalMs) {
        const fps = Math.round((fpsFrameCount * 1000) / elapsed)
        fpsValues.push(fps)

        // 保留最近 60 个 FPS 值用于计算平均值
        if (fpsValues.length > 60) {
          fpsValues.shift()
        }

        const avgFps = Math.round(fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length)
        const minFps = Math.min(...fpsValues)
        const maxFps = Math.max(...fpsValues)

        // 根据 FPS 设置不同颜色
        const color = fps >= 55 ? '#67c23a' : fps >= 30 ? '#e6a23c' : '#f56c6c'

        // eslint-disable-next-line no-console
        console.log(
          `%c[Perf] FPS: ${fps} | 平均: ${avgFps} | 最小: ${minFps} | 最大: ${maxFps}`,
          `color: ${color}; font-weight: bold;`,
        )

        fpsFrameCount = 0
        fpsLastTime = currentTime
      }

      fpsRafId = requestAnimationFrame(updateFps)
    }

    fpsRafId = requestAnimationFrame(updateFps)
  },

  /**
   * 停止 FPS 监控
   */
  stopFpsMonitor() {
    if (!fpsMonitorEnabled) {
      // eslint-disable-next-line no-console
      console.warn('[Perf] FPS 监控未运行')
      return
    }

    fpsMonitorEnabled = false
    if (fpsRafId !== null) {
      cancelAnimationFrame(fpsRafId)
      fpsRafId = null
    }

    // 输出最终统计
    if (fpsValues.length > 0) {
      const avgFps = Math.round(fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length)
      const minFps = Math.min(...fpsValues)
      const maxFps = Math.max(...fpsValues)

      // eslint-disable-next-line no-console
      console.log(
        `%c[Perf] FPS 监控已停止 | 总采样: ${fpsValues.length} | 平均: ${avgFps} | 最小: ${minFps} | 最大: ${maxFps}`,
        'color: #909399; font-weight: bold;',
      )
    }

    fpsValues = []
  },

  /**
   * 记录绘制性能
   * @param duration 绘制耗时（毫秒）
   * @param details 额外的详细信息
   */
  recordDraw(duration: number, details?: unknown) {
    drawStats.totalDraws++
    drawStats.totalDuration += duration
    drawStats.minDuration = Math.min(drawStats.minDuration, duration)
    drawStats.maxDuration = Math.max(drawStats.maxDuration, duration)
    drawStats.avgDuration = drawStats.totalDuration / drawStats.totalDraws

    // 记录最近的绘制
    drawStats.recentDraws.push({
      timestamp: Date.now(),
      duration,
      details,
    })

    // 保持数组大小在限制内
    if (drawStats.recentDraws.length > MAX_RECENT_DRAWS) {
      drawStats.recentDraws.shift()
    }
  },

  /**
   * 获取绘制统计信息
   */
  getDrawStats() {
    return {
      ...drawStats,
      recentDraws: drawStats.recentDraws.slice(-10), // 只返回最近 10 次
    }
  },

  /**
   * 打印绘制统计信息
   */
  printDrawStats() {
    if (drawStats.totalDraws === 0) {
      // eslint-disable-next-line no-console
      console.log('[Perf] 暂无绘制数据')
      return
    }

    const recent10 = drawStats.recentDraws.slice(-10)
    const recent10Avg =
      recent10.reduce((sum, item) => sum + item.duration, 0) / recent10.length

    // eslint-disable-next-line no-console
    console.log(
      '%c[Perf] Canvas 绘制统计',
      'color: #409eff; font-weight: bold; font-size: 14px;',
    )
    // eslint-disable-next-line no-console
    console.table({
      总绘制次数: drawStats.totalDraws,
      平均耗时: `${drawStats.avgDuration.toFixed(2)}ms`,
      最小耗时: `${drawStats.minDuration.toFixed(2)}ms`,
      最大耗时: `${drawStats.maxDuration.toFixed(2)}ms`,
      最近10次平均: `${recent10Avg.toFixed(2)}ms`,
    })
  },

  /**
   * 重置绘制统计
   */
  resetDrawStats() {
    drawStats.totalDraws = 0
    drawStats.totalDuration = 0
    drawStats.minDuration = Infinity
    drawStats.maxDuration = 0
    drawStats.avgDuration = 0
    drawStats.recentDraws = []

    // eslint-disable-next-line no-console
    console.log('[Perf] 绘制统计已重置')
  },

  /**
   * 开始完整的性能测试（FPS + 绘制统计）
   * @param durationMs 测试持续时间（毫秒），默认 10000ms (10秒)
   */
  startPerformanceTest(durationMs = 10000) {
    // eslint-disable-next-line no-console
    console.log(
      `%c[Perf] 性能测试开始（持续 ${durationMs / 1000} 秒）`,
      'color: #409eff; font-weight: bold; font-size: 16px;',
    )

    this.resetDrawStats()
    this.startFpsMonitor()

    setTimeout(() => {
      this.stopFpsMonitor()
      this.printDrawStats()

      // eslint-disable-next-line no-console
      console.log(
        '%c[Perf] 性能测试完成',
        'color: #67c23a; font-weight: bold; font-size: 16px;',
      )
    }, durationMs)
  },
}

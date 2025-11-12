/**
 * 性能监控工具
 */

let lastLogTime = 0
const LOG_THROTTLE = 100 // 最多每 100ms 输出一次日志

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
}

/**
 * 性能监控工具 - 用于诊断大数据集性能问题
 *
 * @author AI Frontend Engineer
 * @date 2026-02-01
 */

class PerformanceMonitor {
  private marks: Map<string, number> = new Map()
  private measures: Array<{ name: string; duration: number; timestamp: number }> = []

  /**
   * 开始计时
   */
  start(name: string): void {
    this.marks.set(name, performance.now())
    console.log(`[⏱️ START] ${name}`)
  }

  /**
   * 结束计时并记录
   */
  end(name: string): number {
    const startTime = this.marks.get(name)
    if (!startTime) {
      console.warn(`[⏱️ WARN] No start mark found for: ${name}`)
      return 0
    }

    const duration = performance.now() - startTime
    this.measures.push({
      name,
      duration,
      timestamp: Date.now(),
    })

    // 根据耗时使用不同颜色
    let icon = '✅'
    if (duration > 1000) icon = '🔴'
    else if (duration > 500) icon = '🟠'
    else if (duration > 100) icon = '🟡'

    console.log(`[⏱️ END] ${icon} ${name}: ${duration.toFixed(2)}ms`)
    this.marks.delete(name)
    return duration
  }

  /**
   * 记录中间点
   */
  checkpoint(name: string, message: string): void {
    const startTime = this.marks.get(name)
    if (!startTime) {
      console.warn(`[⏱️ WARN] No start mark found for checkpoint: ${name}`)
      return
    }

    const elapsed = performance.now() - startTime
    console.log(`[⏱️ CHECKPOINT] ${name} - ${message}: ${elapsed.toFixed(2)}ms`)
  }

  /**
   * 获取最近的性能记录
   */
  getRecentMeasures(count = 10): Array<{ name: string; duration: number }> {
    return this.measures
      .slice(-count)
      .map(m => ({ name: m.name, duration: m.duration }))
  }

  /**
   * 清空所有记录
   */
  clear(): void {
    this.marks.clear()
    this.measures = []
  }

  /**
   * 生成性能报告
   */
  report(): void {
    console.group('📊 Performance Report')

    // 按名称分组统计
    const stats = new Map<string, { count: number; total: number; avg: number; max: number }>()

    this.measures.forEach(m => {
      if (!stats.has(m.name)) {
        stats.set(m.name, { count: 0, total: 0, avg: 0, max: 0 })
      }
      const stat = stats.get(m.name)!
      stat.count++
      stat.total += m.duration
      stat.max = Math.max(stat.max, m.duration)
    })

    // 计算平均值
    stats.forEach(stat => {
      stat.avg = stat.total / stat.count
    })

    // 按平均耗时排序
    const sorted = Array.from(stats.entries())
      .sort((a, b) => b[1].avg - a[1].avg)

    console.table(
      sorted.map(([name, stat]) => ({
        Name: name,
        Count: stat.count,
        'Avg (ms)': stat.avg.toFixed(2),
        'Max (ms)': stat.max.toFixed(2),
        'Total (ms)': stat.total.toFixed(2),
      }))
    )

    console.groupEnd()
  }
}

// 导出单例
export const perfMonitor2 = new PerformanceMonitor()

// 暴露到全局window对象，方便在控制台调用
if (typeof window !== 'undefined') {
  (window as any).perfMonitor2 = perfMonitor2
}

// 时间轴表头格式化工具（v1.13.0 抽取，供 Timeline / ResourceUsageView 共用，确保两者表头格式逻辑保持一致）

/**
 * 计算日期的 ISO 周数（applyTimelineFormat 的 W token 使用）
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayOfWeek = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/**
 * 将格式字符串应用于指定日期，返回格式化后的标签字符串。
 * 支持 token：yyyy, MM, M, dd, d, HH, mm, Q（季度数字1-4）, W（ISO周数）
 * 特殊 pattern：'AAA|BBB' —— 月份 < 6（1-6月, index 0-5）时返回 AAA，否则返回 BBB
 */
export function applyTimelineFormat(formatStr: string, date: Date): string {
  if (formatStr.includes('|')) {
    const parts = formatStr.split('|')
    return date.getMonth() < 6 ? parts[0] : (parts[1] ?? parts[0])
  }
  const yyyy = date.getFullYear().toString()
  const MM = String(date.getMonth() + 1).padStart(2, '0')
  const M = String(date.getMonth() + 1)
  const dd = String(date.getDate()).padStart(2, '0')
  const d = String(date.getDate())
  const HH = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const Q = String(Math.ceil((date.getMonth() + 1) / 3))
  const W = getISOWeekNumber(date).toString()
  // 注意替换顺序：多字符 token 优先，避免单字符 token 误替换
  return formatStr
    .replace('yyyy', yyyy)
    .replace('MM', MM)
    .replace('dd', dd)
    .replace('HH', HH)
    .replace('mm', mm)
    .replace('M', M)
    .replace('d', d)
    .replace('Q', Q)
    .replace('W', W)
}

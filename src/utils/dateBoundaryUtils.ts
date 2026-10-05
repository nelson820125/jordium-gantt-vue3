/**
 * dateBoundaryUtils.ts - 非小时视图下"含时间部分 endDate"的整天粒度边界计算
 *
 * 背景（详见 .ai/.claude/requirments/v1.13.5.md 第9节）：
 * 日/周/月/季度/年视图按整天粒度渲染任务条、计算资源冲突边界，历史约定
 * endDate 表示"包含当天"（inclusive），需要 +1 天才能得到渲染/判断用的排他性
 * 边界（exclusive boundary）。但当 endDate 带有具体 time 部分时（例如 TaskDrawer
 * 编辑时为配合 datetime-local 输入框自动转换出的"次日 00:00"，或用户在任意
 * 视图下手动录入的精确时间），直接截断时间部分再 +1 天会产生二次偏移
 * （渲染位置/冲突判断多算一天）。
 *
 * 规则：
 * - endDate 不带 time 部分（纯 YYYY-MM-DD）→ 有效日期部分 = endDate 本身的日期部分
 * - endDate 带 time 部分 → 有效日期部分 = (endDateTime − 15分钟) 的日期部分
 *   （插件全局最小时间刻度为 15 分钟，减去 15 分钟再截断，可以把"恰好落在
 *   某天 00:00 的结束时刻"正确归到前一天，从而实现真正的排他性边界语义，
 *   且不影响其他任何合法的 15 分钟网格取值）
 */

const DATE_WITH_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/

/** 插件全局最小时间刻度（分钟），用于 endDate 边界回退计算 */
export const MIN_TIME_GRANULARITY_MINUTES = 15

/** 判断原始 endDate 取值是否显式带有 time 部分（"YYYY-MM-DD HH:mm"格式） */
export function hasExplicitTimePart(rawDate: string | Date | undefined | null): boolean {
  return typeof rawDate === 'string' && DATE_WITH_TIME_PATTERN.test(rawDate.trim())
}

/**
 * 计算非小时视图下渲染/冲突判断用的"有效结束日期"（日期部分，本地时区安全）。
 *
 * @param rawEndDate 原始 endDate 取值，仅用于判断是否显式带 time 部分
 * @param parsedEndDate 已解析好的 Date 对象（需保留原始时分，避免重复解析）
 */
export function getEffectiveEndDateOnly(
  rawEndDate: string | Date | undefined | null,
  parsedEndDate: Date
): Date {
  const effective = hasExplicitTimePart(rawEndDate)
    ? new Date(parsedEndDate.getTime() - MIN_TIME_GRANULARITY_MINUTES * 60 * 1000)
    : parsedEndDate
  return new Date(effective.getFullYear(), effective.getMonth(), effective.getDate())
}

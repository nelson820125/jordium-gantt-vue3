import { TaskListColumnConfig } from '@/models/configs/TaskListConfig'

/**
 * 创建基础列配置
 */
export function createColumn(
  overrides: Partial<TaskListColumnConfig> = {},
): TaskListColumnConfig {
  return {
    key: 'name',
    label: 'Task Name',
    width: 200,
    visible: true,
    ...overrides,
  }
}

/**
 * 创建名称列配置
 */
export function createNameColumn(
  overrides: Partial<TaskListColumnConfig> = {},
): TaskListColumnConfig {
  return {
    type: 'name',
    key: 'name',
    label: 'Name',
    width: 200,
    visible: true,
    ...overrides,
  }
}

/**
 * 创建前置任务列配置
 */
export function createPredecessorColumn(
  overrides: Partial<TaskListColumnConfig> = {},
): TaskListColumnConfig {
  return {
    type: 'predecessor',
    key: 'predecessor',
    label: 'Predecessor',
    width: 120,
    visible: true,
    ...overrides,
  }
}

/**
 * 创建负责人列配置
 */
export function createAssigneeColumn(
  overrides: Partial<TaskListColumnConfig> = {},
): TaskListColumnConfig {
  return {
    type: 'assignee',
    key: 'assignee',
    label: 'Assignee',
    width: 120,
    visible: true,
    ...overrides,
  }
}

/**
 * 创建开始日期列配置
 */
export function createStartDateColumn(
  overrides: Partial<TaskListColumnConfig> = {},
): TaskListColumnConfig {
  return {
    type: 'startDate',
    key: 'startDate',
    label: 'Start Date',
    width: 110,
    visible: true,
    ...overrides,
  }
}

/**
 * 创建结束日期列配置
 */
export function createEndDateColumn(
  overrides: Partial<TaskListColumnConfig> = {},
): TaskListColumnConfig {
  return {
    type: 'endDate',
    key: 'endDate',
    label: 'End Date',
    width: 110,
    visible: true,
    ...overrides,
  }
}

/**
 * 创建进度列配置
 */
export function createProgressColumn(
  overrides: Partial<TaskListColumnConfig> = {},
): TaskListColumnConfig {
  return {
    type: 'progress',
    key: 'progress',
    label: 'Progress',
    width: 100,
    visible: true,
    ...overrides,
  }
}

/**
 * 创建自定义列配置
 */
export function createCustomColumn(
  overrides: Partial<TaskListColumnConfig> = {},
): TaskListColumnConfig {
  return {
    key: 'customField',
    label: 'Custom Field',
    width: 150,
    visible: true,
    ...overrides,
  }
}

/**
 * 创建带格式化函数的列配置
 */
export function createColumnWithFormatter(
  overrides: Partial<TaskListColumnConfig> = {},
): TaskListColumnConfig {
  return {
    key: 'formatted',
    label: 'Formatted Column',
    width: 150,
    visible: true,
    formatter: (task) => `Formatted: ${task.name}`,
    ...overrides,
  }
}

/**
 * 创建默认列配置列表
 */
export function createDefaultColumns(): TaskListColumnConfig[] {
  return [
    createNameColumn({ width: 200 }),
    createPredecessorColumn({ width: 120 }),
    createAssigneeColumn({ width: 120 }),
    createStartDateColumn({ width: 110 }),
    createEndDateColumn({ width: 110 }),
    createProgressColumn({ width: 100 }),
  ]
}

/**
 * 创建部分可见的列配置列表
 */
export function createPartialVisibleColumns(): TaskListColumnConfig[] {
  return [
    createNameColumn({ visible: true }),
    createPredecessorColumn({ visible: false }),
    createAssigneeColumn({ visible: true }),
    createStartDateColumn({ visible: true }),
    createEndDateColumn({ visible: false }),
    createProgressColumn({ visible: true }),
  ]
}

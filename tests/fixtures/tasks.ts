import { Task } from '@/models/classes/Task'

/**
 * 创建基础任务数据
 */
export function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    name: 'Test Task',
    startDate: '2024-01-01',
    endDate: '2024-01-10',
    progress: 50,
    ...overrides,
  }
}

/**
 * 创建父任务数据
 */
export function createParentTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    name: 'Parent Task',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    progress: 30,
    isParent: true,
    children: [],
    collapsed: false,
    ...overrides,
  }
}

/**
 * 创建子任务数据
 */
export function createChildTask(
  parentId: number,
  overrides: Partial<Task> = {},
): Task {
  return {
    id: 2,
    name: 'Child Task',
    startDate: '2024-01-05',
    endDate: '2024-01-15',
    progress: 60,
    parentId,
    level: 1,
    ...overrides,
  }
}

/**
 * 创建里程碑任务
 */
export function createMilestone(overrides: Partial<Task> = {}): Task {
  return {
    id: 3,
    name: 'Milestone',
    startDate: '2024-01-15',
    endDate: '2024-01-15',
    type: 'milestone',
    progress: 100,
    ...overrides,
  }
}

/**
 * 创建带前置任务的任务
 */
export function createTaskWithPredecessor(overrides: Partial<Task> = {}): Task {
  return {
    id: 4,
    name: 'Task with Predecessor',
    startDate: '2024-01-16',
    endDate: '2024-01-20',
    progress: 0,
    predecessor: [3],
    ...overrides,
  }
}

/**
 * 创建正在计时的任务
 */
export function createTimerTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 5,
    name: 'Timer Task',
    startDate: '2024-01-01',
    endDate: '2024-01-10',
    progress: 20,
    isTimerRunning: true,
    timerStartTime: Date.now() - 3600000, // 1小时前开始
    timerElapsedTime: 7200000, // 已累计2小时
    timerStartDesc: '开始任务',
    ...overrides,
  }
}

/**
 * 创建超时任务
 */
export function createOvertimeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 6,
    name: 'Overtime Task',
    startDate: '2024-01-01',
    endDate: '2024-01-10',
    progress: 80,
    estimatedHours: 40,
    actualHours: 50, // 超时10小时
    ...overrides,
  }
}

/**
 * 创建逾期任务
 */
export function createOverdueTask(overrides: Partial<Task> = {}): Task {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  return {
    id: 7,
    name: 'Overdue Task',
    startDate: '2024-01-01',
    endDate: yesterday.toISOString().split('T')[0],
    progress: 60,
    ...overrides,
  }
}

/**
 * 创建不可编辑任务
 */
export function createReadonlyTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 8,
    name: 'Readonly Task',
    startDate: '2024-01-01',
    endDate: '2024-01-10',
    progress: 100,
    isEditable: false,
    ...overrides,
  }
}

/**
 * 创建带自定义属性的任务
 */
export function createCustomTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 9,
    name: 'Custom Task',
    startDate: '2024-01-01',
    endDate: '2024-01-10',
    progress: 50,
    customField1: 'Custom Value 1',
    customField2: 123,
    customField3: true,
    ...overrides,
  }
}

/**
 * 创建任务树结构
 */
export function createTaskTree(): Task[] {
  const parent = createParentTask({
    id: 1,
    name: 'Parent Task',
  })

  const child1 = createChildTask(1, {
    id: 2,
    name: 'Child Task 1',
    level: 1,
  })

  const child2 = createChildTask(1, {
    id: 3,
    name: 'Child Task 2',
    level: 1,
  })

  const grandchild = createChildTask(2, {
    id: 4,
    name: 'Grandchild Task',
    parentId: 2,
    level: 2,
  })

  parent.children = [child1, child2]
  child1.children = [grandchild]

  return [parent]
}

/**
 * 创建扁平任务列表
 */
export function createFlatTaskList(count = 10): Task[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Task ${index + 1}`,
    startDate: '2024-01-01',
    endDate: '2024-01-10',
    progress: Math.floor(Math.random() * 100),
  }))
}

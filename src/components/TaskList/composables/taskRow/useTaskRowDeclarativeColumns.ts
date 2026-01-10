import { type Ref, h } from 'vue'
import type { Task } from '../../../../models/classes/Task'
import type { DeclarativeColumnConfig } from '../taskList/useTaskListColumns'

/**
 * TaskRow 声明式列渲染逻辑
 * 处理声明式模式下的列渲染
 */
export function useTaskRowDeclarativeColumns(
  task: Ref<Task>,
  isParentTask: Ref<boolean>,
  isMilestoneGroup: Ref<boolean>,
  isStoryTask: Ref<boolean>,
  hasChildren: Ref<boolean>,
  showTaskIcon: Ref<boolean | undefined>,
  rowIndex: Ref<number | undefined>,
) {
  // 判断是否是第一列
  const isFirstColumn = (index: number) => index === 0

  // 获取声明式列的对齐样式
  const getDeclarativeColumnAlign = (column: DeclarativeColumnConfig) => {
    return {
      justifyContent:
        column.align === 'center' ? 'center' : column.align === 'right' ? 'flex-end' : 'flex-start',
      textAlign: column.align || 'left',
    }
  }

  // 渲染声明式列的内容
  const renderDeclarativeColumn = (column: DeclarativeColumnConfig, index: number) => {
    // 第一列特殊处理：需要显示折叠按钮、图标等
    if (isFirstColumn(index)) {
      // 获取列对应的值（使用 prop 或默认为 name）
      const columnValue = column.prop
        ? (task.value as Record<string, unknown>)[column.prop]
        : task.value.name

      // 如果有自定义 slot
      if (column.defaultSlot) {
        return h('div', { class: 'task-name-content' }, [
          // 自定义内容
          h(
            'span',
            {
              class: ['task-name-text', { 'parent-task': isParentTask.value }],
              title: columnValue,
            },
            [column.defaultSlot({
              row: task.value,
              $index: rowIndex.value ?? -1,
            })],
          ),
        ])
      }

      // 默认显示列的值（使用 prop）
      return h('div', { class: 'task-name-content' }, [
        // 任务图标
        showTaskIcon.value !== false
          ? h(
            'span',
            { class: 'task-icon' },
            isMilestoneGroup.value
              ? h(
                'svg',
                {
                  width: 16,
                  height: 16,
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  'stroke-width': 2,
                  class: 'milestone-group-icon',
                },
                h('polygon', { points: '12,2 22,12 12,22 2,12' }),
              )
              : isStoryTask.value || hasChildren.value
                ? h(
                  'svg',
                  {
                    width: 16,
                    height: 16,
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': 2,
                  },
                  h('path', {
                    d: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z',
                  }),
                )
                : h(
                  'svg',
                  {
                    width: 16,
                    height: 16,
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': 2,
                  },
                  [
                    h('path', {
                      d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z',
                    }),
                    h('polyline', { points: '14,2 14,8 20,8' }),
                    h('line', { x1: 16, y1: 13, x2: 8, y2: 13 }),
                    h('line', { x1: 16, y1: 17, x2: 8, y2: 17 }),
                    h('polyline', { points: '10,9 9,9 8,9' }),
                  ],
                ),
          )
          : null,
        // 列的值（使用 prop 或默认 name）
        h(
          'span',
          {
            class: ['task-name-text', { 'parent-task': isParentTask.value }],
            title: String(columnValue),
          },
          String(columnValue || '-'),
        ),
      ])
    }

    // 其他列：正常处理
    // 如果有自定义 slot，使用 slot
    if (column.defaultSlot) {
      return column.defaultSlot({
        row: task.value,
        $index: rowIndex.value ?? -1,
      })
    }

    // 否则使用 prop 访问任务数据
    if (column.prop) {
      const value = (task.value as Record<string, unknown>)[column.prop]
      return value !== undefined && value !== null ? value : '-'
    }

    return '-'
  }

  return {
    isFirstColumn,
    getDeclarativeColumnAlign,
    renderDeclarativeColumn,
  }
}

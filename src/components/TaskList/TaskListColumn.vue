<script setup lang="ts">
/**
 * TaskListColumn 声明式列组件
 * 用于在 GanttChart 中声明式定义任务列表的列
 * 类似于 Element Plus 的 el-table-column
 */

// 显式定义组件名称，用于识别
defineOptions({
  name: 'TaskListColumn',
})

withDefaults(defineProps<Props>(), {
  align: 'left',
})

// 定义 slot
defineSlots<{
  // 列头部插槽
  header?:() => any
  // 列内容默认插槽，接收 scope 对象 { row: Task, $index: number }
  default?: (scope: { row: any; $index: number }) => any
}>()

interface Props {
  // 列的属性名（用于访问任务数据）
  prop?: string
  // 列的显示标签
  label?: string
  // 列宽度，支持像素数字或百分比字符串
  width?: number | string
  // 列对齐方式
  align?: 'left' | 'center' | 'right'
  // CSS 类名
  cssClass?: string
}

// 注意：此组件不渲染任何内容，仅用于声明列配置
// 实际渲染由 TaskList 和 TaskRow 处理
</script>

<template>
  <!-- 此组件不渲染内容 -->
</template>

<script setup lang="ts">
/**
 * TaskBarContextMenu 声明式右键菜单组件
 * 用于在 GanttChart 中声明式定义 TaskBar 的右键菜单
 */

// 显式定义组件名称，用于识别
defineOptions({
  name: 'TaskBarContextMenu',
})

interface Props {
  // 指定哪些任务类型显示此右键菜单
  // 不设置时遵循现有逻辑，设置后仅对指定类型任务显示
  taskType?: string | string[]
}

defineProps<Props>()

// 定义 slot
defineSlots<{
  // 默认插槽，接收菜单上下文对象
  default?: (scope: {
    row: any
    $index: number
  }) => any
}>()

// 注意：此组件不渲染任何内容，仅用于声明菜单配置
// 实际渲染由 TaskBar 处理，菜单定位和显示状态由内部自动管理
// 菜单会在点击外部或滚动时自动关闭
</script>

<template>
  <!-- 此组件不渲染内容 -->
</template>

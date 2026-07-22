import { defineComponent, type VNodeChild } from 'vue'

/**
 * 稳定的动态渲染包装组件（module 级单例）。
 *
 * 用于替代模板中直接 `<component :is="() => xxx()" />` 的写法：后者每次组件重渲染
 * （例如鼠标悬停导致的 isHovered 变化）都会在模板求值时创建一个全新的匿名函数引用，
 * Vue 会将其视为一个全新的组件类型，从而把整棵子树卸载后重新挂载（含其中的 <img> 头像），
 * 表现为声明式列 / 列级 slot 渲染的资源名称列头像在悬停时"重新加载"般闪烁。
 *
 * 固定 `:is` 指向本模块导出的同一个组件类型，实际渲染内容通过 `render` prop 传入，
 * Vue 只需按普通的 prop 更新 + patch 流程处理，不再整体重挂载子树。
 */
export const DynamicRenderer = defineComponent({
  name: 'TaskListDynamicRenderer',
  props: {
    render: {
      type: Function as unknown as () => () => VNodeChild,
      required: true,
    },
  },
  render() {
    return this.render()
  },
})

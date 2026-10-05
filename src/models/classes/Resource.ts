import type { Task } from '../classes/Task'

/**
 * 资源类别预设值（人力/设备/其他）
 * @version 1.13.5
 * @description 字符串类型，不做强枚举校验，允许业务方自定义扩展第四类及以上
 */
export type ResourceType = 'Human' | 'Device' | 'Others' | (string & {})

/**
 * 资源类别下拉选项（TaskDrawer 资源分配行"类别"下拉的可选项）
 * @version 1.13.5
 * @description 用于通过 GanttChart 的 `resourceTypeOptions` 属性外部自定义资源类别集合
 *   （替换内置的 Human/Device/Others），`label` 完全由外部提供，可用于实现多语言或自定义类别文案
 */
export interface ResourceTypeOption {
  /** 类别取值，写入 resource.type / task.resources[].type */
  value: ResourceType
  /** 下拉中展示的文案，由外部完全控制 */
  label: string
}

/**
 * 资源接口 (Resource Interface)
 * 用于资源计划视图，代表可分配的人力或设备资源
 *
 * @version 1.9.0
 * @version 2.0.0 - 从 class 重构为 interface，方法迁移至 resourceUtils.ts
 * @version 1.13.5 - Breaking Change：原 `type` 字段（自由文本）改名为 `title`（职务/头衔），
 *   `type` 字段语义调整为资源类别（预设 'Human'/'Device'/'Others'，默认 'Human'）
 * @description 支持资源视图的核心数据模型，每个资源可以关联多个任务
 */
export interface Resource {
  id: string | number
  name: string
  /** 资源职务/头衔（如 '前端工程师'、'项目经理'），自由文本。@version 1.13.5 */
  title?: string
  /** 资源类别，用于区分人力/设备/其他资源，默认 'Human'。@version 1.13.5（原 type 字段改为此语义） */
  type?: ResourceType
  avatar?: string
  description?: string
  department?: string
  skills?: string[]
  capacity?: number
  color?: string // 自定义资源行左边框颜色，如 '#ff5733'，若不设置则使用默认颜色方案
  tasks: Task[]
  [key: string]: unknown
}

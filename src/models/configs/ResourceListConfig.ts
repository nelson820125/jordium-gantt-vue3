import type { Resource } from '../classes/Resource'

/**
 * 资源列表列类型枚举
 */
export type ResourceListColumnType =
  | 'name'
  | 'type'
  | 'department'
  | 'capacity'
  | 'taskCount'

/**
 * 资源列格式化函数类型
 * @param resource 当前资源对象
 * @param column 当前列配置
 * @returns 格式化后的字符串
 */
export type ResourceColumnFormatter = (
  resource: Resource,
  column: ResourceListColumnConfig,
) => string

/**
 * 资源列表列配置接口
 */
export interface ResourceListColumnConfig {
  type?: ResourceListColumnType
  key: string // 用于国际化的key，也可以作为识别符
  label?: string // 显示标签
  cssClass?: string // CSS类名
  width?: number | string // 列宽度，支持像素（120）或百分比（'15%'）
  visible?: boolean // 是否显示，默认true
  formatter?: ResourceColumnFormatter // 自定义格式化函数（优先级低于 slot）
}

/**
 * 资源列表配置接口
 */
export interface ResourceListConfig {
  columns?: ResourceListColumnConfig[]
  showAllColumns?: boolean // 是否显示所有列，默认true
  defaultWidth?: number | string // 默认展开宽度，支持像素数字（如 320）或百分比字符串（如 '30%'），默认320px
  minWidth?: number | string // 最小宽度，支持像素数字（如 280）或百分比字符串（如 '20%'），默认280px
  maxWidth?: number | string // 最大宽度，支持像素数字（如 1160）或百分比字符串（如 '80%'），默认1160px
}

/**
 * 默认资源列表列配置
 */
export const DEFAULT_RESOURCE_LIST_COLUMNS: ResourceListColumnConfig[] = [
  {
    type: 'name',
    key: 'resourceName',
    label: '资源名称',
    cssClass: 'col-name',
    visible: true,
  },
  {
    type: 'type',
    key: 'resourceType',
    label: '资源类型',
    cssClass: 'col-type',
    visible: true,
  },
  {
    type: 'department',
    key: 'department',
    label: '部门',
    cssClass: 'col-department',
    visible: true,
  },
  {
    type: 'capacity',
    key: 'capacity',
    label: '利用率',
    cssClass: 'col-capacity',
    visible: true,
  },
]

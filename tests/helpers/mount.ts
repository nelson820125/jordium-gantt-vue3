import { mount, VueWrapper } from '@vue/test-utils'
import type { ComponentPublicInstance } from 'vue'

/**
 * 挂载组件的辅助函数
 * @param component 要挂载的组件
 * @param options 挂载选项
 */
export function mountComponent<T extends ComponentPublicInstance>(
  component: any,
  options = {},
): VueWrapper<T> {
  return mount(component, {
    global: {
      stubs: {
        // 默认 stub 一些复杂组件
        Teleport: true,
        TaskContextMenu: true,
      },
      mocks: {
        // Mock i18n
        $t: (key: string) => key,
      },
    },
    ...options,
  })
}

/**
 * 等待 DOM 更新
 */
export async function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

/**
 * 等待指定时间
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 触发鼠标事件的辅助函数
 */
export function triggerMouseEvent(
  element: Element,
  eventType: string,
  options: MouseEventInit = {},
) {
  const event = new MouseEvent(eventType, {
    bubbles: true,
    cancelable: true,
    view: window,
    ...options,
  })
  element.dispatchEvent(event)
}

/**
 * 获取组件的 computed 属性值
 */
export function getComputed<T>(wrapper: VueWrapper, name: string): T {
  return (wrapper.vm as any)[name]
}

/**
 * 检查元素是否包含指定 class
 */
export function hasClass(element: Element, className: string): boolean {
  return element.classList.contains(className)
}

/**
 * 获取元素的内联样式
 */
export function getStyle(element: HTMLElement, property: string): string {
  return element.style.getPropertyValue(property)
}

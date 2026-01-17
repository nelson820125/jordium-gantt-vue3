import { ref, computed } from 'vue'
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'

export type LocaleKey = 'zh-CN' | 'en-US'

interface LocaleMessages {
  taskMoveConfirm: {
    title: string
    confirmText: string
    cancelText: string
    messages: {
      moveAfter: string
      moveAsChild: string
      moveAsChildNoOldParent: string
      moveAsChildSameParent: string
      moveCanceled: string
      moveSuccess: string
    }
    taskTypes: {
      story: string
      task: string
    }
    parentNames: {
      root: string
      story: string
      task: string
    }
  }
  taskBarConfig: {
    display: {
      showActualTaskBar: string
    }
    colorConfig: {
      title: string
      pendingTask: string
      delayTask: string
      completeTask: string
      ongoingTask: string
    }
    enableTaskRowMove: {
      label: string
      hint: string
    }
  }
  toolSettings: {
    title: string
    currentStatus: {
      title: string
      fullscreen: string
      expandAll: string
      locale: string
      timeScale: string
      theme: string
      controlMode: string
      active: string
      inactive: string
      expanded: string
      collapsed: string
    }
    controlMode: {
      title: string
      expose: string
      props: string
      exposeHint: string
      propsHint: string
    }
    exposeMethods: {
      sectionTitle: string
      fullscreen: {
        title: string
        enter: string
        exit: string
        toggle: string
      }
      expand: {
        title: string
        all: string
        none: string
        toggle: string
      }
      timeScale: {
        title: string
        hour: string
        day: string
        week: string
        month: string
        quarter: string
        year: string
        zoomIn: string
        zoomOut: string
      }
      locale: {
        title: string
        zhCN: string
        enUS: string
      }
      theme: {
        title: string
        light: string
        dark: string
      }
      navigation: {
        title: string
        today: string
        taskIdPlaceholder: string
        go: string
      }
    }
    propsControl: {
      sectionTitle: string
      locale: {
        title: string
      }
      theme: {
        title: string
      }
      timeScale: {
        title: string
      }
      fullscreen: {
        title: string
        true: string
        false: string
      }
      expandAll: {
        title: string
        true: string
        false: string
      }
    }
  }
}

const localeMessages: Record<LocaleKey, LocaleMessages> = {
  'zh-CN': zhCN as any,
  'en-US': enUS as any,
}

const currentLocale = ref<LocaleKey>('zh-CN')

export function useDemoLocale() {
  const locale = computed(() => currentLocale.value)

  const messages = computed(() => localeMessages[currentLocale.value])

  const setLocale = (newLocale: LocaleKey) => {
    currentLocale.value = newLocale
  }

  /**
   * 格式化消息，替换占位符
   */
  const formatMessage = (template: string | undefined, params: Record<string, string>) => {
    if (!template) return ''
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] || match
    })
  }

  /**
   * 获取任务类型名称
   */
  const getTaskTypeName = (type: string) => {
    return messages.value.taskMoveConfirm.taskTypes[type as 'story' | 'task'] || type
  }

  /**
   * 获取父任务名称
   */
  const getParentName = (parent: { type: string; name: string } | null) => {
    if (!parent) {
      return messages.value.taskMoveConfirm.parentNames.root
    }

    const template = messages.value.taskMoveConfirm.parentNames[parent.type as 'story' | 'task']
    // 如果找不到模板，直接返回任务名称
    if (!template) {
      return parent.name
    }
    return formatMessage(template, { name: parent.name })
  }

  return {
    locale,
    messages,
    setLocale,
    formatMessage,
    getTaskTypeName,
    getParentName,
  }
}

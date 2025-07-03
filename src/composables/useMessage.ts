// src/composables/useMessage.ts
export type MessageType = 'success' | 'error' | 'warning' | 'info'

// 消息类型对应的颜色，参考 element plus
const typeColorMap: Record<MessageType, string> = {
  success: '#67c23a', // 绿色
  warning: '#e6a23c', // 黄色
  error: '#f56c6c', // 红色
  info: '#909399', // 灰色
}

// 全局消息容器
let container: HTMLDivElement | null = null
function getContainer() {
  if (!container) {
    container = document.createElement('div')
    container.className = 'message-container'
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
      pointer-events: none;
    `
    document.body.appendChild(container)
  }
  return container
}

// 防重复消息队列，存储最近的消息内容和时间
const recentMessages = new Map<string, number>()
const DUPLICATE_THRESHOLD = 1000 // 1秒内相同消息视为重复

export function useMessage() {
  /**
   * @param message 消息内容
   * @param type 消息类型
   * @param options 可选项：
   *   - duration: 自动关闭的毫秒数（默认3000，0表示不自动关闭）
   *   - closable: 是否显示关闭按钮（true=手动关闭，false=自动关闭）
   *   - allowDuplicate: 是否允许重复消息（默认false）
   */
  const showMessage = (
    message: string,
    type: MessageType = 'success',
    options?: { duration?: number; closable?: boolean; allowDuplicate?: boolean },
  ) => {
    // 防重复检查
    const now = Date.now()
    const messageKey = `${type}:${message}`
    const lastTime = recentMessages.get(messageKey)

    if (!options?.allowDuplicate && lastTime && now - lastTime < DUPLICATE_THRESHOLD) {
      // 重复消息，忽略
      return
    }

    // 记录消息时间
    recentMessages.set(messageKey, now)

    // 清理过期的消息记录
    for (const [key, time] of recentMessages.entries()) {
      if (now - time > DUPLICATE_THRESHOLD * 2) {
        recentMessages.delete(key)
      }
    }
    const messageEl = document.createElement('div')
    messageEl.className = `message ${type}`
    messageEl.textContent = message
    messageEl.style.cssText = `
      min-width: 180px;
      max-width: 360px;
      margin: 0;
      padding: 12px 20px 12px 20px;
      border-radius: 4px;
      color: white;
      font-size: 14px;
      background: ${typeColorMap[type]};
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
      pointer-events: auto;
      opacity: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      transform: translateY(-20px);
      transition: opacity 0.25s, transform 0.25s;
      position: relative;
    `
    let closed = false
    // 关闭按钮
    const closable = options?.closable ?? false
    if (closable) {
      const closeBtn = document.createElement('button')
      closeBtn.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
      closeBtn.style.cssText = `
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        margin-left: 8px;
        padding: 0;
        display: flex;
        align-items: center;
        opacity: 0.7;
        transition: opacity 0.2s;
      `
      closeBtn.onmouseenter = () => (closeBtn.style.opacity = '1')
      closeBtn.onmouseleave = () => (closeBtn.style.opacity = '0.7')
      closeBtn.onclick = () => close()
      messageEl.appendChild(closeBtn)
    }
    // 插入到容器（始终插入到末尾，保证新消息在下方）
    const parent = getContainer()
    parent.appendChild(messageEl)
    // 入场动画
    setTimeout(() => {
      messageEl.style.opacity = '0.98'
      messageEl.style.transform = 'translateY(0)'
    }, 10)
    // 自动关闭
    const duration = options?.duration ?? (closable ? 0 : 3000)
    let timer: number | undefined
    if (!closable && duration > 0) {
      timer = window.setTimeout(() => close(), duration)
    }
    // 关闭逻辑，带动画
    function close() {
      if (closed) return
      closed = true
      messageEl.style.opacity = '0'
      messageEl.style.transform = 'translateY(-20px)'
      if (timer) clearTimeout(timer)
      setTimeout(() => {
        if (messageEl.parentNode) {
          parent.removeChild(messageEl)
          // 关闭后自动上移（flex布局已保证）
          // 若无消息，移除容器
          if (parent.childElementCount === 0) {
            parent.remove()
            container = null
          }
        }
      }, 250)
    }
  }
  return { showMessage }
}

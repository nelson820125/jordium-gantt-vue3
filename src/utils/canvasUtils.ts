/**
 * Canvas 工具函数 - 支持 uni-app 和 Web 环境
 */

// uni-app 类型声明
declare global {
  interface Window {
    uni?: {
      createCanvasContext: (canvasId: string) => CanvasRenderingContext2D & { draw?: () => void }
    }
  }
}

/**
 * Canvas 上下文类型（兼容 uni-app 和 Web）
 */
export type CanvasContext = CanvasRenderingContext2D & { draw?: () => void }

/**
 * Canvas 初始化配置
 */
export interface CanvasInitOptions {
  /** Canvas 元素引用（Web 环境） */
  canvas: HTMLCanvasElement | null
  /** Canvas ID（uni-app 环境） */
  canvasId: string
  /** 显示宽度 */
  width: number
  /** 显示高度 */
  height: number
  /** Canvas 上下文配置（仅 Web 环境） */
  contextOptions?: CanvasRenderingContext2DSettings
}

/**
 * Canvas 缓存管理器
 */
export class CanvasContextManager {
  private cachedCtx: CanvasContext | null = null
  private cachedWidth = 0
  private cachedHeight = 0
  private isUniApp = false

  constructor() {
    // 判断是否在 uni-app 环境中
    this.isUniApp = typeof window !== 'undefined' && !!window.uni
  }

  /**
   * 检测是否在 uni-app 环境
   */
  get isUniAppEnvironment(): boolean {
    return this.isUniApp
  }

  /**
   * 获取或初始化 Canvas 上下文
   * @param options 初始化配置
   * @returns Canvas 上下文，失败返回 null
   */
  getContext(options: CanvasInitOptions): CanvasContext | null {
    const { canvas, canvasId, width, height, contextOptions } = options

    // 只在尺寸变化时重新初始化
    if (!this.cachedCtx || this.cachedWidth !== width || this.cachedHeight !== height) {
      let ctx: CanvasContext | null = null

      if (this.isUniApp && window.uni) {
        // uni-app 环境：使用 uni.createCanvasContext
        ctx = window.uni.createCanvasContext(canvasId)
      } else {
        // Web 环境：使用标准 Canvas API
        if (!canvas) return null

        const dpr = window.devicePixelRatio || 1
        ctx = canvas.getContext('2d', contextOptions || { alpha: true }) as CanvasContext

        if (!ctx) return null

        const pixelWidth = width * dpr
        const pixelHeight = height * dpr

        canvas.width = pixelWidth
        canvas.height = pixelHeight
        ctx.scale(dpr, dpr)
      }

      if (!ctx) return null

      this.cachedCtx = ctx
      this.cachedWidth = width
      this.cachedHeight = height
    }

    return this.cachedCtx
  }

  /**
   * 清空画布
   */
  clear(width: number, height: number): void {
    if (!this.cachedCtx) return
    this.cachedCtx.clearRect(0, 0, width, height)
  }

  /**
   * 触发 uni-app 画布渲染（仅 uni-app 环境需要）
   */
  draw(): void {
    if (this.isUniApp && this.cachedCtx?.draw) {
      this.cachedCtx.draw()
    }
  }

  /**
   * 重置缓存（例如 Canvas 元素被销毁时）
   */
  reset(): void {
    this.cachedCtx = null
    this.cachedWidth = 0
    this.cachedHeight = 0
  }
}

/**
 * 检测是否在 uni-app 环境
 */
export function isUniAppEnvironment(): boolean {
  return typeof window !== 'undefined' && !!window.uni
}

/**
 * 创建 Canvas 上下文（简化版 API）
 */
export function createCanvasContext(
  canvas: HTMLCanvasElement | null,
  canvasId: string,
  width: number,
  height: number,
  contextOptions?: CanvasRenderingContext2DSettings,
): CanvasContext | null {
  const isUniApp = isUniAppEnvironment()

  if (isUniApp && window.uni) {
    // uni-app 环境
    return window.uni.createCanvasContext(canvasId)
  } else {
    // Web 环境
    if (!canvas) return null

    const dpr = window.devicePixelRatio || 1
    const ctx = canvas.getContext('2d', contextOptions || { alpha: true }) as CanvasContext

    if (!ctx) return null

    const pixelWidth = width * dpr
    const pixelHeight = height * dpr

    canvas.width = pixelWidth
    canvas.height = pixelHeight
    ctx.scale(dpr, dpr)

    return ctx
  }
}

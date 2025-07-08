<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from '../composables/useI18n'
import type { ToolbarConfig } from '../models/configs/ToolbarConfig'
import { TimelineScale } from '../models/types/TimelineScale'
import '../styles/app.css'

// 语言定义 - 使用多语言系统的类型
type Language = 'zh' | 'en'

const props = withDefaults(defineProps<Props>(), {
  config: () => ({}),
  onAddTask: undefined,
  onAddMilestone: undefined,
  onTodayLocate: undefined,
  onExportCsv: undefined,
  onExportPdf: undefined,
  onLanguageChange: undefined,
  onThemeChange: undefined,
  onFullscreenChange: undefined,
  onSettingsConfirm: undefined,
  onTimeScaleChange: undefined,
})

const emit = defineEmits<{
  'add-task': []
  'add-milestone': []
  'today-locate': []
  'export-csv': []
  'export-pdf': []
  'language-change': [lang: 'zh-CN' | 'en-US']
  'theme-change': [isDark: boolean]
  'fullscreen-change': [isFullscreen: boolean]
  'time-scale-change': [scale: TimelineScale]
}>()

// LocalStorage keys
const THEME_STORAGE_KEY = 'gantt-theme'
const LANGUAGE_STORAGE_KEY = 'gantt-locale'

// 保留原始类型以兼容外部API
const localeMap: Record<Language, 'zh-CN' | 'en-US'> = {
  zh: 'zh-CN',
  en: 'en-US',
}

interface Props {
  config?: ToolbarConfig
  // 自定义事件处理器
  onAddTask?: () => void
  onAddMilestone?: () => void
  onTodayLocate?: () => void
  onExportCsv?: () => void
  onExportPdf?: () => void
  onLanguageChange?: (lang: 'zh-CN' | 'en-US') => void
  onThemeChange?: (isDark: boolean) => void
  onFullscreenChange?: (isFullscreen: boolean) => void
  onTimeScaleChange?: (scale: TimelineScale) => void
  // 外部确认接口
  onSettingsConfirm?: (
    type: 'theme' | 'language',
    value: string | boolean | Language
  ) => Promise<boolean> | boolean
}

// 从localStorage读取主题设置
const getInitialTheme = (): boolean => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored !== null) {
      return stored === 'dark'
    }
    // 如果没有存储的设置，检查系统偏好
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
}

// 状态管理 - 直接使用 useI18n 的响应式翻译
const { locale, setLocale, getTranslation } = useI18n()
const currentLanguage = ref<Language>('zh')
const isDarkMode = ref(getInitialTheme())
const isFullscreen = ref(false)
const showLanguageDropdown = ref(false)
const currentTimeScale = ref<TimelineScale>(TimelineScale.DAY)

// 翻译函数 - 使用 useI18n 提供的 getTranslation 函数
const t = (key: string): string => {
  return getTranslation(key)
}

// 计算当前语言的显示名称
const currentLanguageDisplay = computed(() => {
  return t('language')
})

// 确认对话框相关状态
const showConfirmDialog = ref(false)
const confirmAction = ref<'theme' | 'language' | null>(null)
const pendingValue = ref<string | boolean | Language | null>(null)

// 事件处理器
const handleAddTask = () => {
  if (props.onAddTask && typeof props.onAddTask === 'function') {
    props.onAddTask()
  } else {
    emit('add-task')
  }
}

const handleAddMilestone = () => {
  if (props.onAddMilestone && typeof props.onAddMilestone === 'function') {
    props.onAddMilestone()
  } else {
    emit('add-milestone')
  }
}

const handleTodayLocate = () => {
  if (props.onTodayLocate && typeof props.onTodayLocate === 'function') {
    props.onTodayLocate()
  } else {
    emit('today-locate')
  }
}

const handleExportCsv = () => {
  if (props.onExportCsv && typeof props.onExportCsv === 'function') {
    props.onExportCsv()
  } else {
    emit('export-csv')
  }
}

const handleExportPdf = () => {
  if (props.onExportPdf && typeof props.onExportPdf === 'function') {
    props.onExportPdf()
  } else {
    emit('export-pdf')
  }
}

// 语言下拉菜单控制
const toggleLanguageDropdown = () => {
  showLanguageDropdown.value = !showLanguageDropdown.value
}

const selectLanguage = (lang: Language) => {
  // 立即应用语言变化
  currentLanguage.value = lang
  showLanguageDropdown.value = false

  // 同步到多语言系统
  const newLocale = localeMap[currentLanguage.value]
  setLocale(newLocale)

  // 立即触发语言变化事件
  if (props.onLanguageChange && typeof props.onLanguageChange === 'function') {
    props.onLanguageChange(newLocale)
  } else {
    emit('language-change', newLocale)
  }

  // 显示确认对话框询问是否保存设置
  pendingValue.value = newLocale
  confirmAction.value = 'language'
  showConfirmDialog.value = true
}

// 确认保存设置到localStorage
const confirmSaveSettings = async () => {
  // 检查confirmAction是否有效
  if (!confirmAction.value || pendingValue.value === null) {
    // 确认操作类型为空或待保存值为空
    closeConfirmDialog()
    return
  }

  // 如果有外部确认接口，先调用外部接口
  if (props.onSettingsConfirm && typeof props.onSettingsConfirm === 'function') {
    try {
      const shouldSave = await props.onSettingsConfirm(confirmAction.value, pendingValue.value)
      if (!shouldSave) {
        closeConfirmDialog()
        return
      }
    } catch {
      // 外部确认接口调用失败 - 静默处理错误并关闭对话框
      closeConfirmDialog()
      return
    }
  }

  // 保存到localStorage
  if (confirmAction.value === 'theme') {
    saveThemeToStorage()
  } else if (confirmAction.value === 'language') {
    saveLanguageToStorage()
  }

  closeConfirmDialog()
}

// 保存主题设置到localStorage
const saveThemeToStorage = () => {
  if (typeof window !== 'undefined' && typeof pendingValue.value === 'boolean') {
    localStorage.setItem(THEME_STORAGE_KEY, pendingValue.value ? 'dark' : 'light')
  }
}

// 保存语言设置到localStorage
const saveLanguageToStorage = () => {
  if (typeof window !== 'undefined' && typeof pendingValue.value === 'string') {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, pendingValue.value)
  }
}

// 取消保存设置（不影响已生效的主题/语言，只是不保存到localStorage）
const cancelSaveSettings = () => {
  // 不恢复设置，主题/语言保持已切换的状态
  // 只是不保存到localStorage
  closeConfirmDialog()
}

// 关闭确认对话框
const closeConfirmDialog = () => {
  showConfirmDialog.value = false
  confirmAction.value = null
  pendingValue.value = null
}

const handleThemeToggle = () => {
  const newTheme = !isDarkMode.value

  // 立即应用主题变化
  isDarkMode.value = newTheme
  document.documentElement.setAttribute('data-theme', newTheme ? 'dark' : 'light')

  // 立即触发主题变化事件
  if (props.onThemeChange && typeof props.onThemeChange === 'function') {
    props.onThemeChange(newTheme)
  } else {
    emit('theme-change', newTheme)
  }

  // 显示确认对话框询问是否保存设置
  pendingValue.value = newTheme
  confirmAction.value = 'theme'
  showConfirmDialog.value = true
}

const handleFullscreenToggle = () => {
  isFullscreen.value = !isFullscreen.value

  // 触发全局事件，通知GanttChart组件切换全屏状态
  window.dispatchEvent(
    new CustomEvent('fullscreen-toggle', {
      detail: isFullscreen.value,
    }),
  )

  if (props.onFullscreenChange && typeof props.onFullscreenChange === 'function') {
    props.onFullscreenChange(isFullscreen.value)
  } else {
    emit('fullscreen-change', isFullscreen.value)
  }
}

// 时间刻度切换处理
const handleTimeScaleChange = (scale: TimelineScale) => {
  currentTimeScale.value = scale

  if (props.onTimeScaleChange && typeof props.onTimeScaleChange === 'function') {
    props.onTimeScaleChange(scale)
  } else {
    emit('time-scale-change', scale)
  }
}

// 计算分段控制器滑块位置
const getThumbStyle = () => {
  const scaleIndex = {
    [TimelineScale.MONTH]: 0,
    [TimelineScale.WEEK]: 1,
    [TimelineScale.DAY]: 2,
  }

  const index = scaleIndex[currentTimeScale.value] || 0
  const translateX = index * 100 // 每个选项占33.33%，所以移动100%的倍数

  return {
    transform: `translateX(${translateX}%)`,
  }
}

// 点击外部关闭下拉菜单
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const dropdown = target.closest('.language-dropdown')
  if (!dropdown && showLanguageDropdown.value) {
    showLanguageDropdown.value = false
  }
}

// 生命周期
onMounted(() => {
  // 初始化语言状态，从多语言系统获取当前语言
  const currentLocale = locale.value
  currentLanguage.value = currentLocale === 'zh-CN' ? 'zh' : 'en'

  // 初始化主题状态并应用到DOM
  document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light')

  // 添加点击外部关闭下拉菜单的监听
  document.addEventListener('click', handleClickOutside)

  // 监听系统主题变化（仅在用户未手动设置时）
  if (
    window.matchMedia &&
    typeof window !== 'undefined' &&
    !localStorage.getItem(THEME_STORAGE_KEY)
  ) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      isDarkMode.value = e.matches
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
    })
  }
})

onUnmounted(() => {
  // 清理事件监听
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="gantt-toolbar">
    <!-- 左侧操作区 -->
    <div class="toolbar-left">
      <!-- 新增按钮组 -->
      <div
        v-if="config.showAddTask !== false || config.showAddMilestone !== false"
        class="btn-group add-btn-group"
      >
        <button
          v-if="config.showAddTask !== false"
          class="btn-group-item"
          :title="t('addTask')"
          @click="handleAddTask"
        >
          <svg
            class="btn-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          {{ t('addTask') }}
        </button>
        <button
          v-if="config.showAddMilestone !== false"
          class="btn-group-item"
          :title="t('addMilestone')"
          @click="handleAddMilestone"
        >
          <svg
            class="btn-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <g transform="rotate(45 12 12)">
              <rect
                x="4"
                y="4"
                width="16"
                height="16"
                rx="4"
                ry="4"
                fill="none"
                stroke="currentColor"
              />
            </g>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          {{ t('addMilestone') }}
        </button>
      </div>

      <!-- 导出按钮组 -->
      <div
        v-if="config.showExportCsv !== false || config.showExportPdf !== false"
        class="btn-group"
      >
        <button
          v-if="config.showExportCsv !== false"
          class="btn-group-item"
          :title="t('exportCsv')"
          @click="handleExportCsv"
        >
          <svg
            class="btn-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10,9 9,9 8,9"></polyline>
          </svg>
          {{ t('exportCsv') }}
        </button>

        <button
          v-if="config.showExportPdf !== false"
          class="btn-group-item"
          :title="t('exportPdf')"
          @click="handleExportPdf"
        >
          <svg
            class="btn-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <line x1="12" y1="13" x2="12" y2="17"></line>
          </svg>
          {{ t('exportPdf') }}
        </button>
      </div>
    </div>

    <!-- 右侧设置区 -->
    <div class="toolbar-right">
      <!-- 时间刻度分段控制器 (Segmented) -->
      <div v-if="config.showTimeScale !== false" class="segmented-control time-scale-segmented">
        <div class="segmented-track">
          <div class="segmented-thumb" :style="getThumbStyle()"></div>
        </div>
        <button
          class="segmented-item"
          :class="{ active: currentTimeScale === 'month' }"
          :title="t('timeScaleTooltip')"
          @click="handleTimeScaleChange(TimelineScale.MONTH)"
        >
          {{ t('timeScaleMonth') }}
        </button>
        <button
          class="segmented-item"
          :class="{ active: currentTimeScale === 'week' }"
          :title="t('timeScaleTooltip')"
          @click="handleTimeScaleChange(TimelineScale.WEEK)"
        >
          {{ t('timeScaleWeek') }}
        </button>
        <button
          class="segmented-item"
          :class="{ active: currentTimeScale === 'day' }"
          :title="t('timeScaleTooltip')"
          @click="handleTimeScaleChange(TimelineScale.DAY)"
        >
          {{ t('timeScaleDay') }}
        </button>
      </div>
      <!-- 语言选择下拉菜单 -->
      <div v-if="config.showLanguage !== false" class="language-dropdown">
        <button
          class="toolbar-lang-btn"
          :title="t('languageTooltip')"
          @click="toggleLanguageDropdown"
        >
          <svg
            class="btn-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path
              d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
            ></path>
          </svg>
          <span class="lang-text">{{ currentLanguageDisplay }}</span>
          <svg
            class="dropdown-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
        </button>

        <!-- 下拉菜单 -->
        <div v-if="showLanguageDropdown" class="language-menu">
          <div
            v-for="lang in ['zh', 'en']"
            :key="lang"
            class="language-option"
            :class="{ active: currentLanguage === lang }"
            @click="selectLanguage(lang as Language)"
          >
            <span class="option-text">{{ lang === 'zh' ? '中文' : 'English' }}</span>
            <svg
              v-if="currentLanguage === lang"
              class="check-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
          </div>
        </div>
      </div>

      <!-- 今日定位按钮 -->
      <button
        v-if="config.showTodayLocate !== false"
        class="toolbar-icon-btn today-locate-btn"
        :title="t('todayLocateTooltip')"
        @click="handleTodayLocate"
      >
        <svg
          class="btn-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
          <circle cx="12" cy="16" r="1"></circle>
        </svg>
      </button>

      <button
        v-if="config.showTheme !== false"
        class="toolbar-icon-btn"
        :title="t(isDarkMode ? 'lightMode' : 'darkMode')"
        @click="handleThemeToggle"
      >
        <svg
          v-if="isDarkMode"
          class="btn-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <svg
          v-else
          class="btn-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
        <!-- 备用表情符号 -->
        <span class="icon-fallback">{{ isDarkMode ? '☀️' : '🌙' }}</span>
      </button>

      <button
        v-if="config.showFullscreen !== false"
        class="toolbar-icon-btn"
        :title="t(isFullscreen ? 'exitFullscreen' : 'fullscreen')"
        @click="handleFullscreenToggle"
      >
        <svg
          v-if="isFullscreen"
          class="btn-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
          ></path>
        </svg>
        <svg
          v-else
          class="btn-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"
          ></path>
        </svg>
        <!-- 备用表情符号 -->
        <span class="icon-fallback">{{ isFullscreen ? '⇲' : '⇱' }}</span>
      </button>
    </div>

    <!-- 确认对话框 -->
    <div v-if="showConfirmDialog" class="confirm-dialog">
      <div class="dialog-content">
        <p class="dialog-message">{{ t('confirmDialogMessage') }}</p>
        <div class="dialog-actions">
          <button class="btn btn-default" @click="cancelSaveSettings">{{ t('cancel') }}</button>
          <button class="btn btn-primary" @click="confirmSaveSettings">{{ t('confirm') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../styles/theme-variables.css';
.gantt-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--gantt-bg-toolbar, #f8f9fa);
  border-bottom: 1px solid var(--gantt-border-color, #ebeef5);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 图标按钮样式 */
.toolbar-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-right: 8px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--gantt-text-primary, #606266);
  cursor: pointer;
  outline: none;
}

.toolbar-icon-btn:hover {
  background: var(--gantt-bg-hover, rgba(0, 0, 0, 0.2));
  color: var(--gantt-primary, #409eff);
}

.toolbar-icon-btn:focus {
  outline: none;
  background: var(--gantt-bg-hover, rgba(0, 0, 0, 0.2));
  color: var(--gantt-primary, #409eff);
}

.toolbar-icon-btn:active {
  background: var(--gantt-bg-active, rgba(0, 0, 0, 0.3));
}

.toolbar-icon-btn .btn-icon {
  width: 18px;
  height: 18px;
}

/* 图标样式 */
.btn-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2;
  fill: none;
  stroke: currentColor;
  display: block;
  flex-shrink: 0;
}

/* 备用图标样式 */
.icon-fallback {
  position: absolute;
  font-size: 16px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  user-select: none;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 语言下拉菜单样式 */
.language-dropdown {
  position: relative;
  display: inline-block;
}

.toolbar-lang-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-radius: 4px;
  background: transparent;
  border: 1px solid var(--gantt-border-color, #dcdfe6);
  color: var(--gantt-text-primary, #606266);
  cursor: pointer;
  outline: none;
  font-size: 14px;
  white-space: nowrap;
}

.toolbar-lang-btn:hover {
  background: var(--gantt-bg-hover, #f5f7fa);
  border-color: var(--gantt-primary-color, #409eff);
  color: var(--gantt-primary-color, #409eff);
}

.toolbar-lang-btn:focus {
  outline: none;
  background: var(--gantt-bg-hover, #f5f7fa);
  border-color: var(--gantt-primary-color, #409eff);
  color: var(--gantt-primary-color, #409eff);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.toolbar-lang-btn:active {
  background: var(--gantt-bg-active, rgba(64, 158, 255, 0.1));
}

.toolbar-lang-btn .btn-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.lang-text {
  font-size: 14px;
  font-weight: 500;
}

.dropdown-arrow {
  width: 12px;
  height: 12px;
  stroke-width: 2;
  transition: transform 0.2s ease;
}

.language-dropdown[aria-expanded='true'] .dropdown-arrow,
.language-dropdown:has(.language-menu) .dropdown-arrow {
  transform: rotate(180deg);
}

.language-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 120px;
  background: var(--gantt-bg-primary, #ffffff);
  border: 1px solid var(--gantt-border-color, #dcdfe6);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  overflow: hidden;
  animation: dropdown-appear 0.2s ease;
}

@keyframes dropdown-appear {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.language-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  color: var(--gantt-text-primary, #606266);
  transition: all 0.2s ease;
  border-bottom: 1px solid var(--gantt-border-color, #f0f0f0);
}

.language-option:last-child {
  border-bottom: none;
}

.language-option:hover {
  background: var(--gantt-bg-hover, #f5f7fa);
  color: var(--gantt-primary-color, #409eff);
}

.language-option.active {
  background: var(--gantt-primary-color, #409eff);
  color: #ffffff;
}

.language-option.active:hover {
  background: var(--gantt-primary-hover, #66b1ff);
}

.check-icon {
  width: 14px;
  height: 14px;
  stroke-width: 2.5;
  opacity: 0.9;
  flex-shrink: 0;
}

/* 确认对话框样式 */
.confirm-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: dialog-fade-in 0.2s ease-out;
}

.dialog-content {
  background: var(--gantt-bg-primary, #ffffff);
  border-radius: 8px;
  padding: 24px;
  min-width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  animation: dialog-slide-up 0.2s ease-out;
}

.dialog-message {
  font-size: 16px;
  color: var(--gantt-text-primary, #303133);
  margin: 0 0 20px 0;
  text-align: center;
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  justify-content: center;
}

.dialog-actions .btn + .btn {
  margin-left: 12px;
}

/* 暗黑模式样式 */
:global(html[data-theme='dark']) .toolbar-icon-btn:hover {
  background: var(--gantt-bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--gantt-primary, #66b1ff);
}

:global(html[data-theme='dark']) .toolbar-icon-btn:focus {
  background: var(--gantt-bg-hover, rgba(255, 255, 255, 0.1));
  color: var(--gantt-primary, #66b1ff);
}

:global(html[data-theme='dark']) .toolbar-lang-btn:hover {
  background: var(--gantt-bg-hover, rgba(255, 255, 255, 0.06));
  border-color: var(--gantt-primary, #66b1ff);
  color: var(--gantt-primary, #66b1ff);
}

:global(html[data-theme='dark']) .toolbar-lang-btn:focus {
  background: var(--gantt-bg-hover, rgba(255, 255, 255, 0.08));
  border-color: var(--gantt-primary, #66b1ff);
  color: var(--gantt-primary, #66b1ff);
  box-shadow: 0 0 0 2px rgba(102, 177, 255, 0.4);
}

:global(html[data-theme='dark']) .dialog-content {
  background: var(--gantt-bg-secondary, #2c2c2c);
}

:global(html[data-theme='dark']) .dialog-message {
  color: var(--gantt-text-primary, #e5eaf3);
}

@keyframes dialog-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes dialog-slide-up {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .toolbar-lang-btn {
    padding: 0 8px;
    gap: 4px;
  }

  .lang-text {
    display: none; /* 移动端隐藏文字，只显示图标 */
  }

  .language-menu {
    right: 0;
    min-width: 100px;
  }

  .language-option {
    padding: 10px 12px; /* 移动端增加触摸区域 */
  }

  .dialog-content {
    padding: 16px;
  }

  .dialog-message {
    font-size: 14px;
  }

  .btn {
    padding: 8px 12px;
    font-size: 13px;
  }
}

/* 按钮组样式 - Element Plus primary button group 风格 */
.btn-group {
  display: inline-flex;
  margin-right: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.btn-group:hover,
.btn-group:focus-within {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.15);
}

.btn-group-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: 1px solid;
  background: #ffffff;
  color: #606266;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  line-height: 1;
  white-space: nowrap;
  position: relative;
  border-radius: 0;
  margin: 0;
  border-left: none;
  transition: all 0.2s ease;
}

.btn-group-item:first-child {
  border-left: 1px solid;
  border-right: none;
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}

.btn-group-item:last-child {
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}

.btn-group-item:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 0;
  top: 25%;
  height: 50%;
  width: 1px;
  background: var(--gantt-border-color, #dcdfe6);
  transition: opacity 0.2s ease;
}

/* Primary 按钮组样式 */
.add-btn-group .btn-group-item {
  background: #409eff;
  border-color: #409eff;
  color: #ffffff;
}

.add-btn-group .btn-group-item::after {
  background: rgba(255, 255, 255, 0.3);
}

.add-btn-group .btn-group-item:hover {
  background: #66b1ff;
  border-color: #66b1ff;
  z-index: 1;
}

.add-btn-group .btn-group-item:focus {
  background: #3a8ee6;
  border-color: #3a8ee6;
  z-index: 1;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}

.add-btn-group .btn-group-item:active {
  background: #337ecc;
  border-color: #337ecc;
}

/* 悬浮和焦点状态下隐藏分割线 */
.btn-group:hover .btn-group-item::after,
.btn-group:focus-within .btn-group-item::after {
  opacity: 0;
}

/* 普通按钮组样式 */
.btn-group:not(.add-btn-group) .btn-group-item {
  border-color: #dcdfe6;
}

.btn-group:not(.add-btn-group) .btn-group-item:hover {
  background: #ecf5ff;
  border-color: #b3d8ff;
  color: #409eff;
  z-index: 1;
}

.btn-group:not(.add-btn-group) .btn-group-item:focus {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
  z-index: 1;
  box-shadow: inset 0 0 0 1px #409eff;
}

.btn-group:not(.add-btn-group) .btn-group-item:active {
  background: #d9ecff;
  border-color: #409eff;
  color: #409eff;
}

/* 按钮组图标样式 */
.btn-group-item .btn-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

/* 暗黑模式下的按钮组样式 */
:global(html[data-theme='dark']) .btn-group {
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.3),
    0 1px 2px -1px rgba(0, 0, 0, 0.3);
}

:global(html[data-theme='dark']) .btn-group:hover,
:global(html[data-theme='dark']) .btn-group:focus-within {
  box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.5);
}

:global(html[data-theme='dark']) .add-btn-group .btn-group-item {
  background: #337ecc;
  border-color: #337ecc;
  color: #ffffff;
}

:global(html[data-theme='dark']) .add-btn-group .btn-group-item:hover {
  background: #4d94d4;
  border-color: #4d94d4;
}

:global(html[data-theme='dark']) .add-btn-group .btn-group-item:focus {
  background: #2c5aa0;
  border-color: #2c5aa0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}

:global(html[data-theme='dark']) .add-btn-group .btn-group-item:active {
  background: #1f4872;
  border-color: #1f4872;
}

:global(html[data-theme='dark']) .btn-group:not(.add-btn-group) .btn-group-item {
  background: #2c2c2c;
  border-color: #4c4c4c;
  color: #e5e5e5;
}

/* 分段控制器样式 - Element Plus Segmented 风格 */
.segmented-control {
  position: relative;
  display: inline-flex;
  background: var(--gantt-bg-primary, #ffffff);
  border: 1px solid var(--gantt-border-color, #dcdfe6);
  border-radius: 6px;
  padding: 1px;
  margin-right: 8px;
  overflow: hidden;
  transition: border-color 0.2s ease;
  height: 36px;
}

.segmented-control:hover {
  border-color: var(--gantt-primary-light, #79bbff);
}

.segmented-track {
  position: absolute;
  top: 1px;
  left: 1px;
  right: 1px;
  bottom: 1px;
  pointer-events: none;
}

.segmented-thumb {
  position: absolute;
  top: 0;
  left: 0;
  width: 33.333333%;
  height: 100%;
  background: var(--gantt-primary, #409eff);
  border-radius: 5px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.1),
    0 1px 6px -1px rgba(0, 0, 0, 0.1);
}

.segmented-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 34px;
  padding: 0 12px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 40px;
  z-index: 1;
  border-radius: 5px;
  user-select: none;
}

.segmented-item:hover:not(.active) {
  color: var(--gantt-primary, #409eff);
  background: var(--gantt-bg-hover, rgba(64, 158, 255, 0.06));
}

.segmented-item:active:not(.active) {
  background: var(--gantt-bg-active, rgba(64, 158, 255, 0.12));
}

.segmented-item.active {
  color: #ffffff;
  font-weight: 600;
}

.time-scale-segmented {
  height: 36px;
}

.time-scale-segmented .segmented-item {
  height: 34px;
  font-size: 13px;
  min-width: 36px;
}

/* 暗黑模式下的分段控制器样式 */
:global(html[data-theme='dark']) .segmented-control {
  background: var(--gantt-bg-secondary, #4b4b4b);
  border-color: var(--gantt-border-color, #808080);
}

:global(html[data-theme='dark']) .segmented-control:hover {
  border-color: var(--gantt-primary, #3399ff);
}

:global(html[data-theme='dark']) .segmented-thumb {
  background: var(--gantt-primary, #3399ff);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 1px 6px -1px rgba(0, 0, 0, 0.3);
}

:global(html[data-theme='dark']) .segmented-item {
  color: #ffffff !important; /* 强制使用纯白色，更加突出 */
}

/* 特别针对时间刻度分段控制器的暗黑模式样式 */
:global(html[data-theme='dark']) .time-scale-segmented .segmented-item {
  color: #ffffff !important; /* 确保时间刻度按钮也使用纯白色 */
}

:global(html[data-theme='dark']) .segmented-item:hover:not(.active) {
  color: var(--gantt-primary, #3399ff); /* 使用主色调，更加鲜艳 */
  background: rgba(51, 153, 255, 0.12); /* 调整背景透明度，与主色调匹配 */
}

:global(html[data-theme='dark']) .segmented-item:active:not(.active) {
  background: rgba(51, 153, 255, 0.2); /* 调整背景透明度，与主色调匹配 */
}

:global(html[data-theme='dark']) .segmented-item.active {
  color: #ffffff;
}
</style>

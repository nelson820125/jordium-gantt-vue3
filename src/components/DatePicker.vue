<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from '../composables/useI18n'
const { t } = useI18n()

interface Props {
  modelValue?: string | [string, string]
  type?: 'date' | 'daterange'
  placeholder?: string
  startPlaceholder?: string
  endPlaceholder?: string
  disabled?: boolean
  clearable?: boolean
  size?: 'small' | 'default' | 'large'
  format?: string
  valueFormat?: string
  rangeSeparator?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'date',
  placeholder: '请选择日期',
  startPlaceholder: '开始日期',
  endPlaceholder: '结束日期',
  disabled: false,
  clearable: true,
  size: 'default',
  format: 'YYYY-MM-DD',
  valueFormat: 'YYYY-MM-DD',
  rangeSeparator: '至',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | [string, string]]
  change: [value: string | [string, string]]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

// 内部状态
const isFocused = ref(false)
const isHovered = ref(false)
const showPicker = ref(false)
const showYearPicker = ref(false)
const showMonthPicker = ref(false)
const inputRef = ref<HTMLElement>()
const pickerRef = ref<HTMLElement>()
const blurTimer = ref<number | null>(null)
const positionUpdateKey = ref(0) // 用于强制重新计算位置

// 当前显示的年月
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth())

// 年份选择器的年份范围
const yearPickerStartYear = ref(Math.floor(new Date().getFullYear() / 10) * 10)

// 单日期模式的值
const singleValue = ref('')
// 日期范围模式的值
const startValue = ref('')
const endValue = ref('')
const rangeSelection = ref<'start' | 'end'>('start')

// 格式化日期显示
const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 显示值
const displayValue = computed(() => {
  if (props.type === 'daterange') {
    const start = startValue.value ? formatDisplayDate(startValue.value) : ''
    const end = endValue.value ? formatDisplayDate(endValue.value) : ''
    if (start && end) {
      return `${start} ${props.rangeSeparator} ${end}`
    }
    return start || end || ''
  }
  return singleValue.value ? formatDisplayDate(singleValue.value) : ''
})

// 监听外部值变化
watch(
  () => props.modelValue,
  newValue => {
    if (props.type === 'daterange') {
      if (Array.isArray(newValue) && newValue.length === 2) {
        startValue.value = newValue[0] || ''
        endValue.value = newValue[1] || ''
      } else {
        startValue.value = ''
        endValue.value = ''
      }
    } else {
      singleValue.value = (newValue as string) || ''
    }
  },
  { immediate: true }
)

// 处理单日期输入变化（预留，当前版本不使用）
// const handleSingleDateChange = (event: Event) => {
//   const target = event.target as HTMLInputElement
//   singleValue.value = target.value
//   emit('update:modelValue', target.value)
//   emit('change', target.value)
// }

// 处理开始日期变化（预留，当前版本不使用）
// const handleStartDateChange = (event: Event) => {
//   const target = event.target as HTMLInputElement
//   startValue.value = target.value
//   const newValue: [string, string] = [target.value, endValue.value]
//   emit('update:modelValue', newValue)
//   emit('change', newValue)
// }

// 处理结束日期变化（预留，当前版本不使用）
// const handleEndDateChange = (event: Event) => {
//   const target = event.target as HTMLInputElement
//   endValue.value = target.value
//   const newValue: [string, string] = [startValue.value, target.value]
//   emit('update:modelValue', newValue)
//   emit('change', newValue)
// }

// 清空值
const clearValue = () => {
  if (props.type === 'daterange') {
    startValue.value = ''
    endValue.value = ''
    emit('update:modelValue', ['', ''])
    emit('change', ['', ''])
  } else {
    singleValue.value = ''
    emit('update:modelValue', '')
    emit('change', '')
  }
  showPicker.value = false
}

// 打开/关闭日期选择器
const togglePicker = () => {
  if (props.disabled) return
  showPicker.value = !showPicker.value
  if (showPicker.value) {
    // 记录当前滚动位置
    lastScrollPosition.x = window.scrollX
    lastScrollPosition.y = window.scrollY

    // 强制更新位置计算
    positionUpdateKey.value++

    // 设置当前年月为选中日期的年月
    let currentDate: Date
    if (props.type === 'daterange') {
      currentDate = startValue.value ? new Date(startValue.value) : new Date()
    } else {
      currentDate = singleValue.value ? new Date(singleValue.value) : new Date()
    }
    currentYear.value = currentDate.getFullYear()
    currentMonth.value = currentDate.getMonth()
  }
}

// 关闭日期选择器
const closePicker = () => {
  showPicker.value = false
  showYearPicker.value = false
  showMonthPicker.value = false
  isFocused.value = false
  // 清理失焦定时器
  if (blurTimer.value) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
}

// 处理点击外部区域
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Element
  if (!inputRef.value?.contains(target) && !pickerRef.value?.contains(target)) {
    closePicker()
  }
}

// 处理页面滚动事件
const lastScrollPosition = { x: 0, y: 0 }
const handleScroll = () => {
  if (showPicker.value) {
    const currentScrollX = window.scrollX
    const currentScrollY = window.scrollY

    // 计算滚动距离
    const scrollDistanceX = Math.abs(currentScrollX - lastScrollPosition.x)
    const scrollDistanceY = Math.abs(currentScrollY - lastScrollPosition.y)

    // 如果滚动距离较小（小于50px），只更新位置；否则关闭选择器
    if (scrollDistanceX < 50 && scrollDistanceY < 50) {
      // 更新位置
      positionUpdateKey.value++
    } else {
      // 滚动距离较大，关闭选择器
      closePicker()
    }

    // 更新最后滚动位置
    lastScrollPosition.x = currentScrollX
    lastScrollPosition.y = currentScrollY
  }
}

// 处理窗口大小变化
const handleResize = () => {
  if (showPicker.value) {
    // 窗口大小变化时更新位置
    positionUpdateKey.value++
  }
}

// 生成日历数据
const calendarDays = computed(() => {
  const firstDay = new Date(currentYear.value, currentMonth.value, 1)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay())

  const days = []
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const isCurrentMonth = date.getMonth() === currentMonth.value
    const isToday = dateStr === new Date().toISOString().split('T')[0]
    const isSelected =
      props.type === 'daterange'
        ? dateStr === startValue.value || dateStr === endValue.value
        : dateStr === singleValue.value
    const isInRange =
      props.type === 'daterange' && startValue.value && endValue.value
        ? dateStr >= startValue.value && dateStr <= endValue.value
        : false

    days.push({
      date,
      dateStr,
      day: date.getDate(),
      isCurrentMonth,
      isToday,
      isSelected,
      isInRange,
    })
  }
  return days
})

// 选择日期
const selectDate = (dateStr: string) => {
  if (props.type === 'daterange') {
    if (
      rangeSelection.value === 'start' ||
      !startValue.value ||
      (startValue.value && endValue.value)
    ) {
      // 开始选择新的日期范围
      startValue.value = dateStr
      endValue.value = ''
      rangeSelection.value = 'end'
    } else {
      // 选择结束日期
      if (dateStr < startValue.value) {
        // 如果选择的日期早于开始日期，交换位置
        endValue.value = startValue.value
        startValue.value = dateStr
      } else {
        endValue.value = dateStr
      }
      rangeSelection.value = 'start'
      const newValue: [string, string] = [startValue.value, endValue.value]
      emit('update:modelValue', newValue)
      emit('change', newValue)
      // 选择完成后自动关闭面板
      setTimeout(() => {
        closePicker()
      }, 150)
    }
  } else {
    singleValue.value = dateStr
    emit('update:modelValue', dateStr)
    emit('change', dateStr)
    // 单日期选择完成后自动关闭面板
    setTimeout(() => {
      closePicker()
    }, 150)
  }
}

// 上一月
const prevMonth = (event?: MouseEvent) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  // 阻止失焦关闭
  if (blurTimer.value) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

// 下一月
const nextMonth = (event?: MouseEvent) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  // 阻止失焦关闭
  if (blurTimer.value) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

// 上一年
const prevYear = (event?: MouseEvent) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  // 阻止失焦关闭
  if (blurTimer.value) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  currentYear.value--
}

// 下一年
const nextYear = (event?: MouseEvent) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  // 阻止失焦关闭
  if (blurTimer.value) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  currentYear.value++
}

// 显示年份选择器
const showYearSelector = (event?: MouseEvent) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  // 阻止失焦关闭
  if (blurTimer.value) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  showYearPicker.value = true
  showMonthPicker.value = false
  yearPickerStartYear.value = Math.floor(currentYear.value / 10) * 10
}

// 显示月份选择器
const showMonthSelector = (event?: MouseEvent) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  // 阻止失焦关闭
  if (blurTimer.value) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  showMonthPicker.value = true
  showYearPicker.value = false
}

// 选择年份
const selectYear = (year: number, event?: MouseEvent) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  // 阻止失焦关闭
  if (blurTimer.value) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  currentYear.value = year
  showYearPicker.value = false
  // 选择年份后自动展示月份选择器
  showMonthPicker.value = true
}

// 选择月份
const selectMonth = (month: number, event?: MouseEvent) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  // 阻止失焦关闭
  if (blurTimer.value) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  currentMonth.value = month
  showMonthPicker.value = false
  // 选择月份后展示日期面板（回到日期选择界面）
}

// 年份选择器的上一页
const prevYearPage = (event?: MouseEvent) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  // 阻止失焦关闭
  if (blurTimer.value) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  yearPickerStartYear.value -= 10
}

// 年份选择器的下一页
const nextYearPage = (event?: MouseEvent) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  // 阻止失焦关闭
  if (blurTimer.value) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  yearPickerStartYear.value += 10
}

// 生成年份列表
const yearList = computed(() => {
  const years = []
  for (let i = 0; i < 10; i++) {
    years.push(yearPickerStartYear.value + i)
  }
  return years
})

/*
// 月份名称
const monthNames = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
]
const weekDays = ['日', '一', '二', '三', '四', '五', '六']
*/

// 生命周期
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('scroll', handleScroll, true) // 使用捕获模式监听所有滚动事件
  window.addEventListener('resize', handleResize) // 监听窗口大小变化

  // 初始化滚动位置
  lastScrollPosition.x = window.scrollX
  lastScrollPosition.y = window.scrollY
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', handleScroll, true)
  window.removeEventListener('resize', handleResize)
  // 清理失焦定时器
  if (blurTimer.value) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
})

// 焦点事件
const handleFocus = (event: FocusEvent) => {
  // 清除失焦定时器
  if (blurTimer.value) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  isFocused.value = true
  emit('focus', event)
}

const handleBlur = (event: FocusEvent) => {
  // 延时关闭面板，给用户时间点击面板内的元素
  blurTimer.value = setTimeout(() => {
    isFocused.value = false
    closePicker()
    emit('blur', event)
  }, 150) // 150ms 延时
}

// 面板获得焦点时取消关闭
const handlePickerFocus = () => {
  if (blurTimer.value) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
}

// 面板失去焦点时关闭
const handlePickerBlur = () => {
  blurTimer.value = setTimeout(() => {
    closePicker()
  }, 150)
}

// 鼠标悬停事件
const handleMouseEnter = () => {
  isHovered.value = true
}

const handleMouseLeave = () => {
  isHovered.value = false
}

// 组件类名
const componentClass = computed(() => [
  'el-date-picker',
  `el-date-picker--${props.size}`,
  {
    'is-disabled': props.disabled,
    'is-focused': isFocused.value,
    'is-range': props.type === 'daterange',
  },
])

// 是否显示清空按钮
const showClearButton = computed(() => {
  if (!props.clearable || props.disabled) return false
  if (props.type === 'daterange') {
    return (startValue.value || endValue.value) && isHovered.value
  }
  return singleValue.value && isHovered.value
})

// 计算面板位置
const panelStyle = computed(() => {
  if (!inputRef.value || !showPicker.value) return {}

  const rect = inputRef.value.getBoundingClientRect()
  const panelWidth = 280 // 面板宽度
  const panelHeight = 300 // 面板高度
  const spacing = 4 // 间距
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  const style: Record<string, string> = {
    position: 'fixed',
    zIndex: '10000',
  }

  // 垂直位置：优先显示在下方，空间不足时显示在上方
  const spaceBelow = viewportHeight - rect.bottom
  const spaceAbove = rect.top

  if (spaceBelow >= panelHeight + spacing || spaceBelow >= spaceAbove) {
    // 显示在下方
    style.top = `${rect.bottom + spacing}px`
  } else {
    // 显示在上方
    style.top = `${rect.top - panelHeight - spacing}px`
  }

  // 水平位置：智能选择左对齐、右对齐或居中
  const spaceRight = viewportWidth - rect.left
  const spaceLeft = rect.right

  if (spaceRight >= panelWidth) {
    // 左对齐（输入框左边缘对齐面板左边缘）
    style.left = `${rect.left}px`
  } else if (spaceLeft >= panelWidth) {
    // 右对齐（输入框右边缘对齐面板右边缘）
    style.left = `${rect.right - panelWidth}px`
  } else {
    // 居中对齐，确保不超出视窗
    const centerLeft = rect.left + (rect.width - panelWidth) / 2
    const minLeft = spacing
    const maxLeft = viewportWidth - panelWidth - spacing
    style.left = `${Math.max(minLeft, Math.min(centerLeft, maxLeft))}px`
  }

  // 确保面板完全在视窗内
  const finalTop = parseFloat(style.top!)
  const finalLeft = parseFloat(style.left!)

  // 垂直边界检查
  if (finalTop < spacing) {
    style.top = `${spacing}px`
  } else if (finalTop + panelHeight > viewportHeight - spacing) {
    style.top = `${viewportHeight - panelHeight - spacing}px`
  }

  // 水平边界检查
  if (finalLeft < spacing) {
    style.left = `${spacing}px`
  } else if (finalLeft + panelWidth > viewportWidth - spacing) {
    style.left = `${viewportWidth - panelWidth - spacing}px`
  }

  return style
})
</script>

<template>
  <div :class="componentClass" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
    <!-- 输入框 -->
    <div ref="inputRef" class="el-input" @click="togglePicker">
      <div class="el-input__wrapper">
        <div class="el-input__inner">
          <input
            :value="displayValue"
            type="text"
            class="el-input__inner-input"
            :placeholder="
              type === 'daterange'
                ? `${startPlaceholder} ${rangeSeparator} ${endPlaceholder}`
                : placeholder
            "
            :disabled="disabled"
            readonly
            @focus="handleFocus"
            @blur="handleBlur"
          />
        </div>
        <div class="el-input__suffix">
          <div class="el-input__suffix-inner">
            <!-- 清空按钮 -->
            <button
              v-if="showClearButton"
              type="button"
              class="el-input__clear"
              @click.stop="clearValue"
            >
              <svg class="el-icon" viewBox="0 0 1024 1024">
                <path
                  fill="currentColor"
                  d="M764.288 214.592 512 466.88 259.712 214.592a31.936 31.936 0 0 0-45.12 45.12L466.752 512 214.528 764.224a31.936 31.936 0 1 0 45.12 45.184L512 557.184l252.288 252.288a31.936 31.936 0 0 0 45.12-45.12L557.12 512.064l252.288-252.352a31.936 31.936 0 1 0-45.12-45.184z"
                />
              </svg>
            </button>
            <!-- 日历图标 -->
            <span v-else class="el-input__icon">
              <svg class="el-icon" viewBox="0 0 1024 1024">
                <path
                  fill="currentColor"
                  d="M128 384v512h768V384H128zm-32-64h832a32 32 0 0 1 32 32v576a32 32 0 0 1-32 32H96a32 32 0 0 1-32-32V352a32 32 0 0 1 32-32z"
                />
                <path
                  fill="currentColor"
                  d="M288 128a32 32 0 0 1 64 0v192a32 32 0 0 1-64 0V128zm384 0a32 32 0 0 1 64 0v192a32 32 0 0 1-64 0V128z"
                />
                <path fill="currentColor" d="M96 320h832q32 0 32 32t-32 32H96q-32 0-32-32t32-32z" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 日期选择器面板 -->
    <Teleport to="body">
      <Transition name="picker-fade">
        <div
          v-if="showPicker"
          ref="pickerRef"
          class="el-picker-panel"
          :style="panelStyle"
          tabindex="-1"
          @focus="handlePickerFocus"
          @blur="handlePickerBlur"
        >
          <!-- 年份选择器 -->
          <div v-if="showYearPicker" class="el-year-picker">
            <div class="el-year-picker__header">
              <button type="button" class="el-picker-panel__icon-btn" @click="prevYearPage">
                &lt;&lt;
              </button>
              <span class="el-year-picker__header-label">
                {{ yearPickerStartYear }} - {{ yearPickerStartYear + 9 }}
              </span>
              <button type="button" class="el-picker-panel__icon-btn" @click="nextYearPage">
                &gt;&gt;
              </button>
            </div>
            <div class="el-year-picker__content">
              <div
                v-for="year in yearList"
                :key="year"
                class="el-year-picker__item"
                :class="{ 'is-current': year === currentYear }"
                @click="selectYear(year, $event)"
              >
                {{ year }}
              </div>
            </div>
          </div>

          <!-- 月份选择器 -->
          <div v-else-if="showMonthPicker" class="el-month-picker">
            <div class="el-month-picker__header">
              <button type="button" class="el-picker-panel__icon-btn" @click="prevYear">
                &lt;&lt;
              </button>
              <span class="el-month-picker__header-label" @click="showYearSelector($event)">
                {{ currentYear }}
              </span>
              <button type="button" class="el-picker-panel__icon-btn" @click="nextYear">
                &gt;&gt;
              </button>
            </div>
            <div class="el-month-picker__content">
              <div
                v-for="(monthName, index) in t.monthNames"
                :key="index"
                class="el-month-picker__item"
                :class="{ 'is-current': index === currentMonth }"
                @click="selectMonth(index, $event)"
              >
                {{ monthName }}
              </div>
            </div>
          </div>

          <!-- 日期选择器 -->
          <div v-else class="el-date-picker__content-wrapper">
            <div class="el-date-picker__header">
              <button type="button" class="el-picker-panel__icon-btn" @click="prevYear">
                &lt;&lt;
              </button>
              <button type="button" class="el-picker-panel__icon-btn" @click="prevMonth">
                &lt;
              </button>
              <span class="el-date-picker__header-label">
                <span class="el-date-picker__header-year" @click="showYearSelector($event)">
                  {{ currentYear }}
                </span>
                <span class="el-date-picker__header-month" @click="showMonthSelector($event)">
                  {{ t.monthNames[currentMonth] }}
                </span>
              </span>
              <button type="button" class="el-picker-panel__icon-btn" @click="nextMonth">
                &gt;
              </button>
              <button type="button" class="el-picker-panel__icon-btn" @click="nextYear">
                &gt;&gt;
              </button>
            </div>

            <div class="el-date-picker__content">
              <!-- 星期标题 -->
              <div class="el-date-table__header">
                <div v-for="day in t.weekDays" :key="day" class="el-date-table__header-cell">
                  {{ day }}
                </div>
              </div>

              <!-- 日期网格 -->
              <div class="el-date-table__body">
                <div
                  v-for="day in calendarDays"
                  :key="`${day.date.getTime()}`"
                  class="el-date-table__cell"
                  :class="{
                    'is-other-month': !day.isCurrentMonth,
                    'is-today': day.isToday,
                    'is-selected': day.isSelected,
                    'is-in-range': day.isInRange,
                    'is-range-start': type === 'daterange' && day.dateStr === startValue,
                    'is-range-end': type === 'daterange' && day.dateStr === endValue,
                  }"
                  @click="selectDate(day.dateStr)"
                >
                  <div class="el-date-table__cell-inner">
                    {{ day.day }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
@import '../styles/theme-variables.css';

/* Element Plus 风格的日期选择器 */
.el-date-picker {
  position: relative;
  display: inline-block;
  width: 100%;
  font-size: 14px;
  line-height: 1.5;
}

/* Element Input 基础样式 */
.el-input {
  position: relative;
  font-size: 14px;
  display: inline-flex;
  width: 100%;
  line-height: 32px;
  box-sizing: border-box;
  vertical-align: middle;
  height: 44px;
}

.el-input__wrapper {
  display: flex;
  flex-grow: 1;
  align-items: center;
  justify-content: center;
  padding: 1px 11px;
  background-color: var(--gantt-bg-primary, #ffffff);
  background-image: none;
  border-radius: 4px;
  cursor: text;
  transition: all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
  transform: translate3d(0, 0, 0);
  box-shadow: 0 0 0 1px var(--gantt-border-color, #dcdfe6) inset;
}

.el-input__inner {
  width: 100%;
  flex-grow: 1;
  appearance: none;
  -webkit-appearance: none;
  color: var(--gantt-text-primary, #606266);
  font-size: inherit;
  height: 32px;
  line-height: 32px;
  padding: 0;
  outline: none;
  border: none;
  background: none;
  box-sizing: border-box;
}

.el-input__inner-input {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  font-size: inherit;
  line-height: inherit;
  padding: 0;
  margin: 0;
}

.el-input__inner-input::-webkit-calendar-picker-indicator {
  display: none;
}

.el-input__inner-input::placeholder {
  color: var(--gantt-text-placeholder, #c0c4cc);
}

.el-input__suffix {
  display: flex;
  flex-shrink: 0;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  color: var(--gantt-text-placeholder, #c0c4cc);
  text-align: center;
  transition: all 0.2s;
  pointer-events: none;
}

.el-input__suffix-inner {
  pointer-events: all;
  display: flex;
  align-items: center;
  justify-content: center;
}

.el-input__icon {
  height: inherit;
  line-height: inherit;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.2s;
  color: var(--gantt-text-placeholder, #c0c4cc);
}

.el-input__clear {
  height: inherit;
  line-height: inherit;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  color: var(--gantt-text-placeholder, #c0c4cc);
  transition: all 0.2s;
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
}

.el-input__clear:hover {
  color: var(--gantt-text-regular, #909399);
}

.el-icon {
  width: 14px;
  height: 14px;
  font-size: 14px;
  fill: currentColor;
  overflow: hidden;
}

/* 日期范围选择器样式 */
.el-range-input {
  appearance: none;
  border: none;
  outline: none;
  display: inline-flex;
  position: relative;
  font-size: inherit;
  line-height: inherit;
  width: 100%;
}

.el-range-input__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
  flex-grow: 1;
}

.el-range-input__start,
.el-range-input__end {
  appearance: none;
  border: none;
  outline: none;
  display: inline-block;
  height: 100%;
  margin: 0;
  padding: 0;
  width: 0;
  flex-grow: 1;
  box-sizing: border-box;
  font-size: inherit;
  color: var(--gantt-text-primary, #606266);
  background: transparent;
  text-align: center;
  border-radius: 0;
  min-width: 0;
}

.el-range-input__start::-webkit-calendar-picker-indicator,
.el-range-input__end::-webkit-calendar-picker-indicator {
  display: none;
}

.el-range-input__start::placeholder,
.el-range-input__end::placeholder {
  color: var(--gantt-text-placeholder, #c0c4cc);
}

.el-range-separator {
  flex-shrink: 0;
  line-height: 32px;
  padding: 0 5px;
  color: var(--gantt-text-primary, #606266);
  text-align: center;
  font-size: 14px;
}

/* 尺寸变体 */
.el-date-picker--small .el-input {
  line-height: 24px;
}

.el-date-picker--small .el-input__wrapper {
  padding: 1px 7px;
}

.el-date-picker--small .el-input__inner {
  height: 24px;
  line-height: 24px;
  font-size: 12px;
}

.el-date-picker--small .el-range-separator {
  line-height: 24px;
  font-size: 12px;
}

.el-date-picker--small .el-icon {
  width: 12px;
  height: 12px;
  font-size: 12px;
}

.el-date-picker--large .el-input {
  line-height: 40px;
}

.el-date-picker--large .el-input__wrapper {
  padding: 1px 15px;
}

.el-date-picker--large .el-input__inner {
  height: 40px;
  line-height: 40px;
  font-size: 16px;
}

.el-date-picker--large .el-range-separator {
  line-height: 40px;
  font-size: 16px;
}

.el-date-picker--large .el-icon {
  width: 16px;
  height: 16px;
  font-size: 16px;
}

/* 状态样式 */
.el-date-picker.is-focused .el-input__wrapper {
  box-shadow: 0 0 0 1px var(--gantt-primary, #409eff) inset;
}

.el-date-picker:hover .el-input__wrapper {
  box-shadow: 0 0 0 1px var(--gantt-border-hover, #c0c4cc) inset;
}

.el-date-picker.is-focused:hover .el-input__wrapper {
  box-shadow: 0 0 0 1px var(--gantt-primary, #409eff) inset;
}

.el-date-picker.is-disabled .el-input__wrapper {
  background-color: var(--gantt-bg-disabled, #f5f7fa);
  box-shadow: 0 0 0 1px var(--gantt-border-light, #e4e7ed) inset;
  color: var(--gantt-text-placeholder, #c0c4cc);
  cursor: not-allowed;
}

.el-date-picker.is-disabled .el-input__inner,
.el-date-picker.is-disabled .el-range-input__start,
.el-date-picker.is-disabled .el-range-input__end {
  color: var(--gantt-text-placeholder, #c0c4cc);
  cursor: not-allowed;
}

/* 错误状态 */
.el-date-picker.is-error .el-input__wrapper {
  box-shadow: 0 0 0 1px var(--gantt-danger, #f56c6c) inset;
}

.el-date-picker.is-error.is-focused .el-input__wrapper {
  box-shadow: 0 0 0 1px var(--gantt-danger, #f56c6c) inset;
}

/* 暗黑模式适配 */
:global(html[data-theme='dark']) .el-input__wrapper {
  background-color: var(--gantt-bg-secondary, #2c2c2c);
  box-shadow: 0 0 0 1px var(--gantt-border-dark, #414243) inset;
}

:global(html[data-theme='dark']) .el-input__inner,
:global(html[data-theme='dark']) .el-range-input__start,
:global(html[data-theme='dark']) .el-range-input__end,
:global(html[data-theme='dark']) .el-range-separator {
  color: var(--gantt-text-white, #ffffff);
}

:global(html[data-theme='dark']) .el-input__inner-input::placeholder,
:global(html[data-theme='dark']) .el-range-input__start::placeholder,
:global(html[data-theme='dark']) .el-range-input__end::placeholder {
  color: var(--gantt-text-muted, #9e9e9e);
}

:global(html[data-theme='dark']) .el-date-picker.is-focused .el-input__wrapper {
  box-shadow: 0 0 0 1px var(--gantt-primary, #409eff) inset;
}

:global(html[data-theme='dark']) .el-date-picker:hover .el-input__wrapper {
  box-shadow: 0 0 0 1px var(--gantt-border-hover, #606266) inset;
}

:global(html[data-theme='dark']) .el-date-picker.is-focused:hover .el-input__wrapper {
  box-shadow: 0 0 0 1px var(--gantt-primary, #409eff) inset;
}

:global(html[data-theme='dark']) .el-date-picker.is-disabled .el-input__wrapper {
  background-color: var(--gantt-bg-disabled, #3c3e40);
  box-shadow: 0 0 0 1px var(--gantt-border-disabled, #4c4d4f) inset;
}

:global(html[data-theme='dark']) .el-date-picker.is-disabled .el-input__inner,
:global(html[data-theme='dark']) .el-date-picker.is-disabled .el-range-input__start,
:global(html[data-theme='dark']) .el-date-picker.is-disabled .el-range-input__end {
  color: var(--gantt-text-disabled, #73767a);
}

:global(html[data-theme='dark']) .el-input__clear:hover {
  color: var(--gantt-text-secondary, #909399);
}

/* 日期选择器面板样式 */
.el-picker-panel {
  position: fixed;
  background: var(--gantt-bg-primary, #ffffff);
  border: 1px solid var(--gantt-border-color, #e4e7ed);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  margin-top: 4px;
  min-width: 280px;
  padding: 8px;
  user-select: none;
  z-index: 10000;
}

.el-date-picker__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8px 8px;
  border-bottom: 1px solid var(--gantt-border-light, #ebeef5);
  margin-bottom: 8px;
}

.el-date-picker__header-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--gantt-text-primary, #303133);
  flex: 1;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.el-date-picker__header-year,
.el-date-picker__header-month {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.el-date-picker__header-year:hover,
.el-date-picker__header-month:hover {
  background: var(--gantt-bg-hover, #f5f7fa);
  color: var(--gantt-primary, #409eff);
}

/* 年份选择器样式 */
.el-year-picker {
  min-width: 280px;
  animation: fadeIn 0.2s ease-in-out;
}

.el-year-picker__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8px 8px;
  border-bottom: 1px solid var(--gantt-border-light, #ebeef5);
  margin-bottom: 8px;
}

.el-year-picker__header-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--gantt-text-primary, #303133);
  flex: 1;
  text-align: center;
}

.el-year-picker__content {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 8px;
}

.el-year-picker__item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
  color: var(--gantt-text-primary, #606266);
  transition: all 0.2s;
}

.el-year-picker__item:hover {
  background: var(--gantt-bg-hover, #f5f7fa);
  color: var(--gantt-primary, #409eff);
  transform: scale(1.05);
}

.el-year-picker__item.is-current {
  background: var(--gantt-primary, #409eff);
  color: #ffffff;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(64, 158, 255, 0.3);
}

/* 月份选择器样式 */
.el-month-picker {
  min-width: 280px;
  animation: fadeIn 0.2s ease-in-out;
}

.el-month-picker__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8px 8px;
  border-bottom: 1px solid var(--gantt-border-light, #ebeef5);
  margin-bottom: 8px;
}

.el-month-picker__header-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--gantt-text-primary, #303133);
  flex: 1;
  text-align: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.el-month-picker__header-label:hover {
  background: var(--gantt-bg-hover, #f5f7fa);
  color: var(--gantt-primary, #409eff);
}

.el-month-picker__content {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 8px;
}

.el-month-picker__item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
  color: var(--gantt-text-primary, #606266);
  transition: all 0.2s;
}

.el-month-picker__item:hover {
  background: var(--gantt-bg-hover, #f5f7fa);
  color: var(--gantt-primary, #409eff);
  transform: scale(1.05);
}

.el-month-picker__item.is-current {
  background: var(--gantt-primary, #409eff);
  color: #ffffff;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(64, 158, 255, 0.3);
}

.el-picker-panel__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 4px;
  color: var(--gantt-text-regular, #909399);
  transition: all 0.2s;
  outline: none;
  font-size: 14px;
  font-weight: bold;
  font-family: monospace;
}

.el-picker-panel__icon-btn:hover {
  background: var(--gantt-bg-hover, #f5f7fa);
  color: var(--gantt-text-primary, #303133);
}

.el-date-picker__content {
  padding: 0;
}

.el-date-table__header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
  margin-bottom: 4px;
}

.el-date-table__header-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  font-size: 12px;
  font-weight: 400;
  color: var(--gantt-text-regular, #909399);
  text-align: center;
}

.el-date-table__body {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
}

.el-date-table__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
}

.el-date-table__cell:hover {
  background: var(--gantt-bg-hover, #f5f7fa);
}

.el-date-table__cell-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--gantt-text-primary, #606266);
  transition: all 0.2s;
}

/* 其他月份的日期 */
.el-date-table__cell.is-other-month .el-date-table__cell-inner {
  color: var(--gantt-text-placeholder, #c0c4cc);
}

/* 今天 */
.el-date-table__cell.is-today .el-date-table__cell-inner {
  color: var(--gantt-primary, #409eff);
  font-weight: 500;
}

/* 选中的日期 */
.el-date-table__cell.is-selected .el-date-table__cell-inner {
  background: var(--gantt-primary, #409eff);
  color: #ffffff;
  font-weight: 500;
}

/* 日期范围的起始点 */
.el-date-table__cell.is-range-start .el-date-table__cell-inner {
  background: var(--gantt-primary, #409eff);
  color: #ffffff;
  font-weight: 500;
}

/* 日期范围的结束点 */
.el-date-table__cell.is-range-end .el-date-table__cell-inner {
  background: var(--gantt-primary, #409eff);
  color: #ffffff;
  font-weight: 500;
}

/* 日期范围内的日期 */
.el-date-table__cell.is-in-range {
  background: var(--gantt-primary-light, #ecf5ff);
}

.el-date-table__cell.is-in-range .el-date-table__cell-inner {
  color: var(--gantt-primary, #409eff);
}

/* 确保选中的日期优先级更高 */
.el-date-table__cell.is-range-start,
.el-date-table__cell.is-range-end {
  background: transparent;
}

.el-date-table__cell.is-range-start.is-in-range,
.el-date-table__cell.is-range-end.is-in-range {
  background: var(--gantt-primary-light, #ecf5ff);
}

/* 暗黑模式下的日期选择器面板 */
:global(html[data-theme='dark']) .el-picker-panel {
  background: var(--gantt-bg-secondary, #2c2c2c);
  border-color: var(--gantt-border-dark, #414243);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

:global(html[data-theme='dark']) .el-date-picker__header {
  border-bottom-color: var(--gantt-border-dark, #414243);
}

:global(html[data-theme='dark']) .el-date-picker__header-label {
  color: var(--gantt-text-white, #ffffff);
}

:global(html[data-theme='dark']) .el-picker-panel__icon-btn {
  color: var(--gantt-text-secondary, #909399);
}

:global(html[data-theme='dark']) .el-picker-panel__icon-btn:hover {
  background: var(--gantt-bg-hover-dark, #3c3e40);
  color: var(--gantt-text-white, #ffffff);
}

:global(html[data-theme='dark']) .el-date-table__header-cell {
  color: var(--gantt-text-secondary, #909399);
}

:global(html[data-theme='dark']) .el-date-table__cell:hover {
  background: var(--gantt-bg-hover-dark, #3c3e40);
}

:global(html[data-theme='dark']) .el-date-table__cell-inner {
  color: var(--gantt-text-white, #ffffff);
}

:global(html[data-theme='dark']) .el-date-table__cell.is-other-month .el-date-table__cell-inner {
  color: var(--gantt-text-muted, #73767a);
}

:global(html[data-theme='dark']) .el-date-table__cell.is-in-range {
  background: rgba(64, 158, 255, 0.2);
}

/* 响应式适配 */
@media (max-width: 768px) {
  .el-date-picker--large .el-input {
    line-height: 36px;
  }

  .el-date-picker--large .el-input__inner {
    height: 36px;
    line-height: 36px;
    font-size: 14px;
  }

  .el-date-picker--large .el-range-separator {
    line-height: 36px;
    font-size: 14px;
  }

  .el-picker-panel {
    min-width: 260px;
  }
}

/* 动画效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 日期选择器内容包装器动画 */
.el-date-picker__content-wrapper {
  animation: fadeIn 0.2s ease-in-out;
}

/* 面板进入/离开过渡 */
.picker-fade-enter-active,
.picker-fade-leave-active {
  transition: all 0.2s ease;
}

.picker-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.picker-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.picker-fade-enter-to,
.picker-fade-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>

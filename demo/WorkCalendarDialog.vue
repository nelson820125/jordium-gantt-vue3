<template>
  <div v-if="modelValue" class="wc-dialog-mask" @click.self="handleCancel">
    <div class="wc-dialog">
      <div class="wc-dialog-header">
        <h3 class="wc-dialog-title">{{ labels.title }}</h3>
        <button class="wc-dialog-close" type="button" @click="handleCancel">&#10005;</button>
      </div>

      <div class="wc-dialog-hint">{{ labels.hint }}</div>

      <div class="wc-dialog-body">
        <table class="wc-table">
          <thead>
            <tr>
              <th class="wc-col-name">{{ labels.colName }}</th>
              <th class="wc-col-date">{{ labels.colStart }}</th>
              <th class="wc-col-date">{{ labels.colEnd }}</th>
              <th class="wc-col-type">{{ labels.colType }}</th>
              <th class="wc-col-scope">{{ labels.colScope }}</th>
              <th class="wc-col-op"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in rows" :key="row._key">
              <td>
                <input
                  v-model="row.name"
                  type="text"
                  class="wc-input"
                  :placeholder="labels.namePlaceholder"
                />
              </td>
              <td><input v-model="row.start" type="date" class="wc-input" /></td>
              <td><input v-model="row.end" type="date" class="wc-input" /></td>
              <td>
                <select v-model="row.working" class="wc-input">
                  <option :value="false">{{ labels.typeHoliday }}</option>
                  <option :value="true">{{ labels.typeMakeup }}</option>
                </select>
              </td>
              <td>
                <select v-model="row.resourceIds" class="wc-input wc-select-multiple" multiple>
                  <option v-for="res in resources" :key="res.id" :value="res.id">
                    {{ res.name }}
                  </option>
                </select>
                <div class="wc-table-hint">{{ labels.scopeHint }}</div>
              </td>
              <td>
                <button class="wc-row-delete" type="button" @click="removeRow(index)">
                  {{ labels.delete }}
                </button>
              </td>
            </tr>
            <tr v-if="rows.length === 0">
              <td colspan="6" class="wc-empty">{{ labels.empty }}</td>
            </tr>
          </tbody>
        </table>
        <button class="wc-add-row" type="button" @click="addRow">{{ labels.addRow }}</button>
      </div>

      <div class="wc-dialog-footer">
        <button class="wc-btn" type="button" @click="handleCancel">{{ labels.cancel }}</button>
        <button class="wc-btn wc-btn-primary" type="button" @click="handleConfirm">
          {{ labels.confirm }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * WorkCalendarDialog.vue - Demo 专用「更改工作时间」弹窗（仿 MS Project「项目」-「更改工作时间」）
 *
 * 仅演示用途，不属于组件库导出的公共 API：以表格形式对工作日历例外（WorkCalendarException）
 * 做增/改/删，出于简化仅支持“整天”粒度（不含具体钟点），这恰好与 Timeline/CalendarView/
 * ResourceUsageView 共享表头周末灰色展示所采纳的例外子集（全天 + 公司级）完全对应：
 * 通过本弹窗配置的例外，能同时驱动这三处视图的表头灰色展示与工时数值计算。
 */
import { ref, computed, watch } from 'vue'
import type { WorkCalendarException } from '../src/models/types/ResourceUsageTypes'
import type { Resource } from '../src/models/classes/Resource'

interface Props {
  modelValue: boolean
  exceptions: WorkCalendarException[]
  resources?: Resource[]
  locale?: 'zh-CN' | 'en-US'
}

const props = withDefaults(defineProps<Props>(), {
  resources: () => [],
  locale: 'zh-CN',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [exceptions: WorkCalendarException[]]
}>()

const LABELS = {
  'zh-CN': {
    title: '更改工作时间',
    hint: '仅支持整天粒度例外，将同时影响 Timeline/日历/资源利用率视图表头的周末灰色展示与工时计算',
    colName: '名称',
    colStart: '开始日期',
    colEnd: '结束日期',
    colType: '类型',
    colScope: '资源范围',
    namePlaceholder: '例如：元旦',
    typeHoliday: '非工作日（放假）',
    typeMakeup: '工作日（调休/加班）',
    scopeHint: '不选=全部资源',
    delete: '删除',
    addRow: '+ 新增例外',
    empty: '暂无例外，点击下方按钮新增',
    cancel: '取消',
    confirm: '确定',
  },
  'en-US': {
    title: 'Change Working Time',
    hint:
      'Only full-day exceptions are supported here; they drive the shared weekend-gray header ' +
      'display and hour calculations across Timeline / Calendar / Resource Usage views',
    colName: 'Name',
    colStart: 'Start Date',
    colEnd: 'End Date',
    colType: 'Type',
    colScope: 'Resource Scope',
    namePlaceholder: 'e.g. New Year Holiday',
    typeHoliday: 'Non-working day',
    typeMakeup: 'Working day (makeup/overtime)',
    scopeHint: 'Empty = all resources',
    delete: 'Delete',
    addRow: '+ Add Exception',
    empty: 'No exceptions yet, click below to add one',
    cancel: 'Cancel',
    confirm: 'OK',
  },
} as const

const labels = computed(() => LABELS[props.locale] ?? LABELS['zh-CN'])

interface EditableRow {
  _key: number
  id?: string
  name: string
  start: string
  end: string
  working: boolean
  resourceIds: Array<string | number>
}

let rowKeySeed = 0
const rows = ref<EditableRow[]>([])

/** 取日期字符串的纯日期部分（去掉可能带的具体时间部分），供 <input type="date"> 使用 */
function toDateOnly(value: string): string {
  return value.split(' ')[0]
}

function resetRowsFromProps() {
  rows.value = props.exceptions.map(exc => ({
    _key: rowKeySeed++,
    id: exc.id,
    name: exc.name ?? '',
    start: toDateOnly(exc.start),
    end: toDateOnly(exc.end),
    working: exc.working,
    resourceIds: exc.resourceIds ? [...exc.resourceIds] : [],
  }))
}

watch(
  () => props.modelValue,
  visible => {
    if (visible) resetRowsFromProps()
  },
  { immediate: true }
)

function addRow() {
  const today = new Date()
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  rows.value.push({
    _key: rowKeySeed++,
    name: '',
    start: day,
    end: day,
    working: false,
    resourceIds: [],
  })
}

function removeRow(index: number) {
  rows.value.splice(index, 1)
}

function handleCancel() {
  emit('update:modelValue', false)
}

function handleConfirm() {
  const result: WorkCalendarException[] = rows.value
    .filter(row => row.start && row.end)
    .map(row => ({
      id: row.id ?? `custom-${row._key}`,
      name: row.name || undefined,
      start: row.start,
      end: row.end,
      working: row.working,
      resourceIds: row.resourceIds.length > 0 ? row.resourceIds : undefined,
    }))
  emit('confirm', result)
  emit('update:modelValue', false)
}
</script>

<style scoped>
.wc-dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.wc-dialog {
  background: var(--gantt-bg-color, #fff);
  color: var(--gantt-text-color, #303133);
  border-radius: 8px;
  width: 720px;
  max-width: 92vw;
  max-height: 84vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
}

.wc-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--gantt-border-color, #ebeef5);
}

.wc-dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.wc-dialog-close {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  color: inherit;
  opacity: 0.6;
}
.wc-dialog-close:hover {
  opacity: 1;
}

.wc-dialog-hint {
  padding: 8px 20px 0;
  font-size: 12px;
  color: var(--gantt-text-secondary, #909399);
  line-height: 1.5;
}

.wc-dialog-body {
  padding: 12px 20px;
  overflow: auto;
  flex: 1;
}

.wc-table {
  width: 100%;
  border-collapse: collapse;
}

.wc-table th {
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--gantt-text-secondary, #909399);
  padding: 6px 6px;
  border-bottom: 1px solid var(--gantt-border-color, #ebeef5);
}

.wc-table td {
  padding: 6px 6px;
  vertical-align: top;
  border-bottom: 1px solid var(--gantt-border-color, #ebeef5);
}

.wc-col-name {
  width: 22%;
}
.wc-col-date {
  width: 16%;
}
.wc-col-type {
  width: 18%;
}
.wc-col-scope {
  width: 20%;
}
.wc-col-op {
  width: 8%;
}

.wc-input {
  width: 100%;
  box-sizing: border-box;
  padding: 4px 6px;
  border: 1px solid var(--gantt-border-color, #dcdfe6);
  border-radius: 4px;
  background: var(--gantt-bg-color, #fff);
  color: inherit;
  font-size: 12px;
}

.wc-select-multiple {
  min-height: 56px;
}

.wc-table-hint {
  font-size: 11px;
  color: var(--gantt-text-secondary, #909399);
  margin-top: 2px;
}

.wc-row-delete {
  border: none;
  background: transparent;
  color: #f56c6c;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 0;
}

.wc-empty {
  text-align: center;
  color: var(--gantt-text-secondary, #909399);
  padding: 16px 0;
}

.wc-add-row {
  margin-top: 10px;
  border: 1px dashed var(--gantt-border-color, #dcdfe6);
  background: transparent;
  color: var(--gantt-primary, #409eff);
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
}

.wc-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--gantt-border-color, #ebeef5);
}

.wc-btn {
  padding: 6px 16px;
  border-radius: 4px;
  border: 1px solid var(--gantt-border-color, #dcdfe6);
  background: var(--gantt-bg-color, #fff);
  color: inherit;
  cursor: pointer;
  font-size: 13px;
}

.wc-btn-primary {
  border-color: var(--gantt-primary, #409eff);
  background: var(--gantt-primary, #409eff);
  color: #fff;
}
</style>

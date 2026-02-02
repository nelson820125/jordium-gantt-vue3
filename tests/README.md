# 测试文档

## 📁 测试结构

```
tests/
├── setup.ts                           # 测试环境初始化
├── helpers/                           # 测试工具函数
│   └── mount.ts                       # Vue组件挂载辅助函数
├── fixtures/                          # 测试数据工厂
│   ├── tasks.ts                       # 任务数据生成器
│   └── columns.ts                     # 列配置生成器
├── unit/                              # 单元测试
│   └── composables/
│       └── taskRow/
│           ├── useTaskRowState.spec.ts
│           ├── useTaskRowEventHandlers.spec.ts
│           └── useTaskRowContextMenu.spec.ts
└── component/                         # 组件测试
    └── TaskRow.spec.ts
```

## 🎯 测试覆盖范围

### 单元测试 (Unit Tests)

#### useTaskRowState.spec.ts
测试任务行状态管理逻辑：
- ✅ 缩进计算（基于层级）
- ✅ 任务类型判断（普通/父任务/Story/里程碑）
- ✅ 进度状态（warning/success/danger）
- ✅ 超时判断（实际工时 vs 预计工时）
- ✅ 逾期天数计算
- ✅ 自定义行类名（字符串/函数）
- ✅ 自定义行样式（对象/函数）

#### useTaskRowEventHandlers.spec.ts
测试事件处理逻辑：
- ✅ 折叠/展开事件
- ✅ 行点击事件（父任务自动折叠）
- ✅ 双击事件
- ✅ 鼠标悬停事件（进入/离开）
- ✅ Splitter拖拽状态管理
- ✅ 任务行拖拽（enableDrag控制）

#### useTaskRowContextMenu.spec.ts
测试右键菜单和计时器：
- ✅ 右键菜单显示/隐藏
- ✅ 菜单位置计算
- ✅ 删除任务事件
- ✅ 计时器格式化（HH:MM:SS）
- ✅ 计时器实时更新（运行中）
- ✅ 计时器停止后显示累计时间
- ✅ 组件卸载时清理资源

### 组件测试 (Component Tests)

#### TaskRow.spec.ts
测试 TaskRow 组件：
- ✅ 基础渲染（任务名称、进度）
- ✅ 缩进应用（根据层级）
- ✅ 折叠按钮显示/隐藏
- ✅ 悬停高亮效果
- ✅ 双击事件触发
- ✅ 右键菜单功能
- ✅ 自定义样式（类名/样式对象/函数）
- ✅ 列渲染（可见性控制）
- ✅ 自定义插槽内容
- ✅ 声明式列渲染模式

## 🚀 运行测试

### 基本命令

```bash
# 运行所有测试（watch 模式）
npm run test

# 运行所有测试（单次运行）
npm run test:run

# 打开测试 UI 界面
npm run test:ui

# 生成覆盖率报告
npm run test:coverage
```

### 运行特定测试

```bash
# 运行单个测试文件
npx vitest tests/unit/composables/taskRow/useTaskRowState.spec.ts

# 运行匹配模式的测试
npx vitest --grep "计时器"

# 运行特定目录的测试
npx vitest tests/unit/
```

## 📊 覆盖率目标

| 指标 | 目标 | 说明 |
|------|------|------|
| Statements | ≥ 80% | 语句覆盖率 |
| Branches | ≥ 75% | 分支覆盖率 |
| Functions | ≥ 80% | 函数覆盖率 |
| Lines | ≥ 80% | 行覆盖率 |

查看覆盖率报告：
```bash
npm run test:coverage
# 报告生成在 coverage/ 目录
# 打开 coverage/index.html 查看详细报告
```

## 🔧 测试工具

### Fixtures (测试数据工厂)

#### tasks.ts
提供10种预配置的任务数据生成器：
- `createTask()` - 基础任务
- `createParentTask()` - 父任务（带子任务）
- `createChildTask()` - 子任务
- `createMilestone()` - 里程碑任务
- `createTaskWithPredecessor()` - 带前置任务
- `createTimerTask()` - 正在计时的任务
- `createOvertimeTask()` - 超时任务
- `createOverdueTask()` - 逾期任务
- `createReadonlyTask()` - 只读任务
- `createCustomTask()` - 自定义属性任务

示例：
```typescript
import { createTask, createParentTask } from 'tests/fixtures/tasks'

const task = createTask({ name: 'My Task', progress: 50 })
const parent = createParentTask({ id: 1, children: [task] })
```

#### columns.ts
提供列配置生成器：
- `createNameColumn()` - 名称列
- `createPredecessorColumn()` - 前置任务列
- `createAssigneeColumn()` - 负责人列
- `createStartDateColumn()` - 开始日期列
- `createEndDateColumn()` - 结束日期列
- `createProgressColumn()` - 进度列
- `createDefaultColumns()` - 默认列配置列表

### Helpers (测试工具函数)

#### mount.ts
- `mountComponent()` - 挂载 Vue 组件
- `flushPromises()` - 等待所有 Promise 完成
- `sleep(ms)` - 延迟执行
- `triggerMouseEvent()` - 触发鼠标事件
- `getComputed()` - 获取组件 computed 值
- `hasClass()` - 检查元素类名
- `getStyle()` - 获取元素样式

## 📝 编写测试指南

### 1. 单元测试示例

```typescript
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useTaskRowState } from '@/composables/...'
import { createTask } from '../../../fixtures/tasks'

describe('useTaskRowState', () => {
  it('应该正确计算缩进', () => {
    const task = ref(createTask())
    const level = ref(2)
    const { taskState } = useTaskRowState(task, level)

    expect(taskState.value.indent).toBe('50px') // 10 + 2*20
  })
})
```

### 2. 组件测试示例

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskRow from '@/components/TaskList/taskRow/TaskRow.vue'
import { createTask } from '../../fixtures/tasks'
import { createDefaultColumns } from '../../fixtures/columns'

describe('TaskRow', () => {
  it('应该渲染任务名称', () => {
    const wrapper = mount(TaskRow, {
      props: {
        task: createTask({ name: 'Test Task' }),
        level: 0,
        columns: createDefaultColumns(),
      },
    })

    expect(wrapper.text()).toContain('Test Task')
  })
})
```

## 🐛 调试测试

### 使用 Vitest UI

```bash
npm run test:ui
```

浏览器会自动打开，提供：
- 实时测试运行状态
- 测试代码高亮
- 错误堆栈追踪
- 覆盖率可视化

### 调试单个测试

在测试文件中添加 `.only`：
```typescript
it.only('应该测试某个功能', () => {
  // 只运行这个测试
})
```

### 查看详细输出

```bash
npx vitest --reporter=verbose
```

## ⚠️ 常见问题

### Q: 测试失败显示 "Cannot find module '@/...'"
A: 确保 `vitest.config.ts` 中配置了正确的路径别名。

### Q: 组件测试中 slot 不显示
A: 检查 slot 语法，确保使用 `slots: { 'slot-name': () => '...' }`。

### Q: 计时器测试不稳定
A: 使用 `vi.useFakeTimers()` 和 `vi.advanceTimersByTime()` 控制时间。

### Q: 覆盖率未达标
A: 运行 `npm run test:coverage`，打开 HTML 报告查看未覆盖代码。

## 📚 参考资料

- [Vitest 官方文档](https://vitest.dev/)
- [Vue Test Utils](https://test-utils.vuejs.org/)
- [Happy DOM](https://github.com/capricorn86/happy-dom)

## 🧪 性能与算法测试

### test-interval-tree.html
区间树算法可视化测试页面，用于验证 v1.9.3 中的性能优化：

**测试内容**：
- ✅ **测试1**: 算法切换验证（50/100/101/200任务）
- ✅ **测试2**: 性能对比（O(n²) vs O(n log n)）
- ✅ **测试3**: 结果正确性验证
- ✅ **测试4**: 极限场景测试（500任务）

**使用方法**：
```bash
# 直接在浏览器中打开
open tests/test-interval-tree.html
```

**验证目标**：
- 任务数 > 100 时自动切换到区间树算法
- 500任务场景性能提升 2.8-3.5 倍（120ms → 42ms）
- 算法优化不影响功能正确性

### verify-interval-tree.js
控制台验证脚本，提供4种验证方法：

**使用方法**：
```bash
# 方法1: 在项目运行时，浏览器控制台执行
node tests/verify-interval-tree.js

# 方法2: 在 Demo 中查看实时监控日志
# 1. npm run dev
# 2. 切换到资源视图
# 3. 拖拽任务条
# 4. 查看控制台输出 [Conflict Detection] 日志
```

**验证检查清单**：
- ☑️ src/utils/conflictUtils.ts 包含 IntervalTree 类
- ☑️ src/utils/conflictUtils.ts 包含 detectConflictsWithIntervalTree 函数
- ☑️ detectConflicts 函数有算法选择逻辑
- ☑️ perfMonitor.ts 包含 recordConflictDetection 方法
- ☑️ 性能目标: 500任务从120ms降至~40ms

### demo/data-resources-large.json
大数据集测试文件（由 `scripts/generate-large-data.js` 生成）：

**数据规模**：
- 100个资源
- 约2500个任务
- 任务分布：每个资源20-30个任务

**用途**：
- 测试资源视图垂直滚动性能
- 验证区间树算法在大数据量下的表现
- 测试冲突检测性能（多资源场景）

**重新生成数据**：
```bash
node scripts/generate-large-data.js
```

## 🎯 待扩展测试

以下功能建议增加测试覆盖：
- [ ] TaskRowBadges 组件（徽章显示）
- [ ] TaskRowCollapseButton 组件（折叠按钮）
- [ ] TaskRowIcon 组件（任务图标，特别是里程碑无发光效果）
- [ ] TaskRowNameContent 组件（名称内容）
- [ ] 集成测试（TaskList 整体交互）
- [ ] 快照测试（组件输出稳定性）
- [ ] GanttConflicts 组件测试（Canvas 渲染、冲突可视化）
- [ ] 区间树算法单元测试（正确性、边界条件）

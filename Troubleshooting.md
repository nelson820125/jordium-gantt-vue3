# Troubleshooting

常见问题与解决方案 / Common issues and solutions.

---

## 目录 / Table of Contents

- [内存占用过高 / 浏览器卡死（大数据量场景）](#issue-13-内存占用过高--浏览器卡死大数据量场景)

---

## Issue #13: 内存占用过高 / 浏览器卡死（大数据量场景）

**标签 / Labels**: `performance`, `answer`  
**状态 / Status**: ✅ 已解决 / Resolved  
**Issue 地址**: [#13 Memory leak and high CPU use](https://github.com/nelson820125/jordium-gantt-vue3/issues/13) → 已转为 Discussion [#16](https://github.com/nelson820125/jordium-gantt-vue3/discussions/16)

### 现象

在加载约 80+ 条任务数据时，页面出现严重卡顿、内存持续增长甚至浏览器崩溃。

### 根本原因

问题**不在组件本身**，而在于调用方的数据绑定方式：

1. **使用 `reactive` 深层包裹任务数组** — Vue 会为数组内每一个对象建立深层侦听器，数据量较大时侦听器数量爆炸，导致内存超过 10 GB。
2. **日期格式错误** — API 返回 ISO 日期时间字符串（如 `"2026-03-07T08:34:00.230"`），但组件要求纯日期格式（`"2026-03-07"`）。

### 解决方案（来自 [@eldrift](https://github.com/eldrift)）

#### 1. 使用 `shallowRef` 替代 `reactive` 存储任务列表

```ts
// ❌ 错误 — 深层响应性，性能灾难
const data = reactive({ tasks: [] as Task[] })

// ✅ 正确 — Vue 只监听数组引用，不深入每个对象
const tasks = shallowRef<Task[]>([])
```

#### 2. 截断 ISO 日期时间为纯日期格式

```ts
tasks.value = res.data.map((t: Task) => ({
  ...t,
  startDate: t.startDate?.substring(0, 10) ?? t.startDate,
  endDate:   t.endDate?.substring(0, 10)   ?? t.endDate,
}))
```

#### 3. 使用正确的 Task 类型

确保传入组件的数据符合 `Task` 接口定义，避免类型不匹配导致的隐性计算开销。

### 参考

- 完整讨论与报告：[Discussion #16](https://github.com/nelson820125/jordium-gantt-vue3/discussions/16)
- 原始 Issue：[#13 Memory leak and high CPU use](https://github.com/nelson820125/jordium-gantt-vue3/issues/13)

---

## 反馈 / Feedback

如果遇到未收录的问题，欢迎提交 Issue：

- [GitHub Issues](https://github.com/nelson820125/jordium-gantt-vue3/issues)
- [Gitee Issues](https://gitee.com/jordium/jordium-gantt-vue3/issues)
- 📧 ning.li@jordium.com

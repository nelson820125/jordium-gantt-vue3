# Troubleshooting

Common issues and solutions for `jordium-gantt-vue3`.

---

## Table of Contents

- [High Memory Usage / Browser Freeze with Large Datasets](#issue-13-high-memory-usage--browser-freeze-with-large-datasets)

---

## Issue #13: High Memory Usage / Browser Freeze with Large Datasets

**Labels**: `performance`, `answer`  
**Status**: ✅ Resolved  
**Issue**: [#13 Memory leak and high CPU use](https://github.com/nelson820125/jordium-gantt-vue3/issues/13) → converted to Discussion [#16](https://github.com/nelson820125/jordium-gantt-vue3/discussions/16)

### Symptoms

When loading ~80+ tasks, the page becomes severely sluggish, memory grows continuously, and the browser may crash.

### Root Cause

The problem is **not in the component itself**, but in how the caller binds data:

1. **Using `reactive` to deeply wrap the task array** — Vue creates deep watchers for every object in the array. With a large dataset, the number of watchers explodes and memory can exceed 10 GB.
2. **Incorrect date format** — The API returns ISO datetime strings (e.g. `"2026-03-07T08:34:00.230"`), but the component expects plain date strings (`"2026-03-07"`).

### Solution (credit: [@eldrift](https://github.com/eldrift))

#### 1. Use `shallowRef` instead of `reactive` to store the task list

```ts
// ❌ Wrong — deep reactivity, performance disaster
const data = reactive({ tasks: [] as Task[] })

// ✅ Correct — Vue only watches the array reference, not each object deeply
const tasks = shallowRef<Task[]>([])
```

#### 2. Truncate ISO datetime strings to plain date format

```ts
tasks.value = res.data.map((t: Task) => ({
  ...t,
  startDate: t.startDate?.substring(0, 10) ?? t.startDate,
  endDate:   t.endDate?.substring(0, 10)   ?? t.endDate,
}))
```

#### 3. Use the correct Task type

Ensure the data passed to the component conforms to the `Task` interface to avoid hidden computation overhead from type mismatches.

### References

- Full discussion & report: [Discussion #16](https://github.com/nelson820125/jordium-gantt-vue3/discussions/16)
- Original issue: [#13 Memory leak and high CPU use](https://github.com/nelson820125/jordium-gantt-vue3/issues/13)

---

## Feedback

If you encounter an issue not listed here, feel free to submit one:

- [GitHub Issues](https://github.com/nelson820125/jordium-gantt-vue3/issues)
- [Gitee Issues](https://gitee.com/jordium/jordium-gantt-vue3/issues)
- 📧 ning.li@jordium.com

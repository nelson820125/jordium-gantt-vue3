<script setup>
const props = defineProps({
  tasks: { type: Array, default: () => [] },
})
</script>
<template>
  <div class="stub-gantt">
    <p style="margin:0 0 8px;font-weight:600;">(占位) jordium-gantt-vue3 未正确打包，显示 Stub 组件。</p>
    <table>
      <thead>
        <tr><th>任务ID</th><th>名称</th><th>开始</th><th>结束</th><th>进度</th></tr>
      </thead>
      <tbody>
        <tr v-for="t in tasks" :key="t.id">
          <td>{{ t.id }}</td>
          <td>{{ t.text }}</td>
          <td>{{ t.start }}</td>
            <td>{{ t.end }}</td>
          <td>{{ (t.progress*100).toFixed(0) }}%</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<style scoped>
.stub-gantt { font-size:12px; background:#fffbe6; padding:8px; border:1px dashed #faad14; }
.stub-gantt table { width:100%; border-collapse: collapse; }
.stub-gantt th, .stub-gantt td { border:1px solid #ddd; padding:4px; }
</style>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
const props = defineProps<{ visible: boolean }>()

const versionList = ref<any[]>([])

onMounted(async () => {
  const res = await fetch('./version-history.json')
  const data = await res.json()
  // 按日期和版本号倒序排列
  versionList.value = data.sort((a, b) => {
    if (a.date === b.date) {
      // 版本号倒序
      return b.version.localeCompare(a.version, undefined, { numeric: true })
    }
    return b.date.localeCompare(a.date)
  })
})
</script>

<template>
  <div>
    <div v-if="props.visible" class="drawer-mask" @click="$emit('close')"></div>
    <div class="version-history-drawer" :class="{ open: props.visible }">
      <div class="drawer-header">
        <h3 class="drawer-title">版本历史</h3>
        <button class="drawer-close-btn" type="button" @click="$emit('close')">
          <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="drawer-body">
        <div class="version-timeline">
          <div
            v-for="(item, idx) in versionList"
            :key="item.version"
            class="version-timeline-group"
          >
            <div :class="['version-timeline-dot', idx === 0 ? 'latest' : '']">
              <div class="dot-label">
                <span class="dot-version">{{ item.version }}</span>
                <span class="dot-date">{{ item.date }}</span>
              </div>
            </div>
            <div class="version-timeline-content version-card">
              <ul class="version-notes">
                <li v-for="(note, nidx) in item.notes" :key="nidx">{{ note }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.version-history-drawer {
  position: fixed;
  top: 0;
  left: 0;
  width: 540px; /* 增加Drawer宽度，适中大气 */
  height: 100vh;
  background: var(--gantt-bg-primary, #fff);
  box-shadow: 2px 0 24px rgba(0, 0, 0, 0.1);
  z-index: 2000;
  transform: translateX(-100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  /* 去除圆角 */
}
.version-history-drawer.open {
  transform: translateX(0);
}
.drawer-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5); /* 与TaskDrawer一致 */
  z-index: 1999;
  transition: background 0.2s;
}
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--gantt-border-light, #ebeef5);
  background: var(--gantt-bg-secondary, #f5f7fa);
}
.drawer-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--gantt-text-primary, #303133);
}

.drawer-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--gantt-text-muted, #909399);
  transition: color 0.2s;
}

.drawer-close-btn:hover {
  color: var(--gantt-text-secondary, #606266);
}

.close-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}
.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 32px 32px 32px 60px;
  background: var(--gantt-bg-primary, #fff); /* 统一用变量，便于主题切换 */
  scrollbar-width: thin;
  scrollbar-color: #b3c6e0 #f0f2f5;
  /* 去除圆角 */
}
.drawer-body::-webkit-scrollbar {
  width: 6px;
  background: #f0f2f5;
}
.drawer-body::-webkit-scrollbar-thumb {
  background: #b3c6e0;
  border-radius: 4px;
}
.drawer-body::-webkit-scrollbar-track {
  background: #f0f2f5;
}
.version-timeline {
  position: relative;
  margin-left: 140px;
  border-left: 0;
}
.version-timeline::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 0;
  width: 2px;
  height: 100%;
  background: repeating-linear-gradient(
    to bottom,
    var(--gantt-timeline-line, #a0cfff) 0 8px,
    transparent 8px 16px
  );
  border-radius: 1px;
  z-index: 0;
}
.version-timeline-group {
  position: relative;
  margin-bottom: 40px;
  padding-left: 18px;
  min-height: 60px;
  transition: box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.version-timeline-dot {
  position: absolute;
  left: -13px;
  top: 18px;
  width: 10px;
  height: 10px;
  background: var(--gantt-timeline-dot, #a0cfff); /* 更柔和主色 */
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px var(--gantt-timeline-line, #b3d8ff);
  z-index: 3;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  transition:
    background 0.2s,
    box-shadow 0.2s;
}
.version-timeline-group:hover .version-timeline-dot {
  background: var(--gantt-timeline-dot-hover, #409eff); /* hover主色 */
}
.version-timeline-dot.latest {
  background: var(--gantt-primary, #409eff);
}
.dot-label {
  position: absolute;
  left: -140px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 90px;
  max-width: 110px;
  font-size: 13px;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.version-timeline-group:hover .dot-label {
  left: -110px; /* 悬停时向右移动，接近原点 */
}
.version-timeline-content.version-card {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.08); /* 主色阴影 */
  padding: 18px 18px 12px 18px;
  margin-left: 0;
  margin-top: 0;
  margin-bottom: 0;
  min-width: 0;
  border: none;
  transition: box-shadow 0.2s;
  position: relative;
  z-index: 2;
}
.version-timeline-group:hover .version-timeline-content.version-card {
  box-shadow: 0 8px 24px rgba(64, 158, 255, 0.16);
}
.version-timeline-content.version-card::before {
  content: '';
  position: absolute;
  left: -16px; /* 让箭头更靠近原点但不覆盖 */
  top: 18px;
  width: 0;
  height: 0;
  filter: drop-shadow(-2px 0 2px var(--gantt-timeline-line, #a0cfff));
  z-index: 1;
}
.version-timeline-group:hover .version-timeline-content.version-card::before {
  filter: drop-shadow(-2px 0 2px var(--gantt-primary, #409eff));
}
.version-notes {
  margin: 0;
  padding-left: 18px;
  color: #aaa;
  font-size: 14px;
  list-style: disc;
  transition: color 0.2s;
}
.version-timeline-group:hover .version-notes {
  color: #333;
}
.dot-version {
  font-weight: 700;
  font-size: 16px;
  color: var(--gantt-primary, #409eff); /* 统一主色 */
  letter-spacing: 0.5px;
  line-height: 1.2;
  text-shadow: 0 1px 4px rgba(64, 158, 255, 0.08);
}
.dot-date {
  color: #b0b3bb;
  font-size: 12px;
  margin-top: 2px;
  font-weight: 400;
  letter-spacing: 0.2px;
  line-height: 1.1;
}

/* 暗黑主题适配，完全对齐TaskDrawer风格 */
:global(html[data-theme='dark']) .version-history-drawer {
  background: var(--gantt-bg-primary, #6b6b6b) !important;
  box-shadow: 2px 0 24px rgba(0, 0, 0, 0.4) !important;
}
:global(html[data-theme='dark']) .drawer-header {
  background: var(--gantt-bg-secondary, #4b4b4b) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
}
:global(html[data-theme='dark']) .drawer-title {
  color: var(--gantt-text-white, #fff) !important;
}
:global(html[data-theme='dark']) .drawer-close-btn:hover {
  background: var(--gantt-bg-hover, rgba(255, 255, 255, 0.1)) !important;
  border-radius: 4px;
}
:global(html[data-theme='dark']) .drawer-body {
  background: var(--gantt-bg-primary, #6b6b6b) !important;
  scrollbar-color: #888888 #4b4b4b !important;
}
:global(html[data-theme='dark']) .drawer-body::-webkit-scrollbar-thumb {
  background: #888888 !important;
}
:global(html[data-theme='dark']) .drawer-body::-webkit-scrollbar-track {
  background: #4b4b4b !important;
}
:global(html[data-theme='dark']) .version-timeline-content.version-card {
  background: var(--gantt-bg-secondary, #4b4b4b) !important;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.32) !important;
  color: var(--gantt-text-white, #fff) !important;
}
:global(html[data-theme='dark'])
  .version-timeline-group:hover
  .version-timeline-content.version-card {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.44) !important;
}
:global(html[data-theme='dark']) .version-timeline-content.version-card::before {
  filter: drop-shadow(-2px 0 2px #222) !important;
}
:global(html[data-theme='dark']) .dot-version {
  color: var(--gantt-primary, #3399ff) !important;
  text-shadow: 0 1px 4px rgba(51, 153, 255, 0.12) !important;
}
:global(html[data-theme='dark']) .dot-date {
  color: #e0e0e0 !important;
}
:global(html[data-theme='dark']) .version-notes {
  color: #e0e0e0 !important;
}
:global(html[data-theme='dark']) .version-timeline-dot {
  background: var(--gantt-timeline-dot, #3399ff) !important;
  box-shadow: 0 0 0 2px #222 !important;
}
:global(html[data-theme='dark']) .version-timeline-dot.latest {
  background: var(--gantt-primary, #3399ff) !important;
}
:global(html[data-theme='dark']) .version-timeline-group:hover .version-timeline-dot {
  background: var(--gantt-primary, #3399ff) !important;
}
:global(html[data-theme='dark']) .version-timeline::before {
  background: repeating-linear-gradient(to bottom, #3399ff 0 8px, transparent 8px 16px) !important;
}
</style>

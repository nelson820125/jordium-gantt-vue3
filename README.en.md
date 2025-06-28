# <svg width="28" height="28" viewBox="0 0 24 24" style="vertical-align:middle;"><rect x="2" y="4" width="20" height="2" rx="1" fill="#409eff"/><rect x="2" y="8" width="12" height="2" rx="1" fill="#67c23a"/><rect x="2" y="12" width="16" height="2" rx="1" fill="#e6a23c"/><rect x="2" y="16" width="8" height="2" rx="1" fill="#f56c6c"/><rect x="2" y="20" width="14" height="2" rx="1" fill="#909399"/><circle cx="22" cy="5" r="1" fill="#409eff"/><circle cx="16" cy="9" r="1" fill="#67c23a"/><circle cx="20" cy="13" r="1" fill="#e6a23c"/><circle cx="12" cy="17" r="1" fill="#f56c6c"/><circle cx="18" cy="21" r="1" fill="#909399"/></svg> Jordium Gantt Vue3

> Modern, open-source, and high-performance Gantt chart component library for Vue3 + TypeScript

---

## 🚀 Product Positioning

Jordium Gantt Vue3 is a high-performance Gantt chart component library for modern web applications, focusing on excellent interaction, flexible extension, and open-source compliance. Ideal for project management, progress visualization, R&D collaboration, and more.

- **Tech Stack**: Vue 3 + TypeScript
- **Design Language**: Element Plus style (no dependency)
- **Use Cases**: Enterprise project management, scheduling, resource allocation, etc.

## ✨ Key Features

- **Modern UI/UX**: Minimalist, clean, responsive, supports light/dark themes, auto system adaptation
- **High Performance**: Virtual scrolling, auto-expanding timeline, smooth with large datasets
- **Task Management**: Multi-level tasks, milestones, drag & resize, progress, dependencies
- **Enhanced Interaction**: Today locator, fullscreen, version history, toolbar, quick actions
- **Internationalization**: Built-in Chinese/English, easy to extend to more languages
- **Flexible Extension**: Custom editors, event handling, data sources, export, etc.
- **Open Source Compliance**: MIT License, suitable for secondary development and commercial use

## 🖌️ Design Philosophy

- **Ultimate Experience**: Interaction details match top-tier products, smooth animation, positioning, and theme switching
- **No External Dependencies**: Only Vue3/TS required, Element Plus style but zero dependency
- **Easy to Use & Extend**: Friendly API, supports slots, events, and deep prop customization
- **Ready to Use**: Comprehensive documentation, easy integration

## 📦 Installation & Usage

```bash
npm install jordium-gantt-vue3
```

### Basic Usage

```vue
<template>
  <GanttChart :tasks="tasks" />
</template>

<script setup lang="ts">
import GanttChart from 'jordium-gantt-vue3'
const tasks = [/* ...task data... */]
</script>
```

### Advanced Usage

- Custom task editor (disable default drawer, handle double-click events)
- Custom toolbar buttons, export, theme switching
- Listen to task/milestone changes, drag, dependency events
- Support for external data sources, async loading

See [API_USAGE.md](./API_USAGE.md) for details.

## 🎨 Theming & Adaptation

- Supports light/dark themes, auto system detection
- Theme variables customizable for easy brand adaptation
- Fully responsive, works on desktop and mobile

## 📝 Version History

See [version-history.json](./demo/version-history.json) for details.

- **0.9.x-ALPHA**: Productization refactor, full interaction & visual upgrade, MIT License
- **0.2 Beta**: API improvements, tasks/milestones/dependencies/toolbar/i18n/theme
- **0.1 Beta**: Basic features, Element Plus style

## 📚 API Documentation

See [API_USAGE.md](./API_USAGE.md) for full API reference.

## 🤝 Contribution & Community

Issues, PRs, suggestions, and stars are welcome! For custom development, enterprise support, or bug reports, contact [jordium.com](https://jordium.com).

## 📄 License

MIT License © Jordium

# README.en.md

This file has been deprecated. Please refer to `README.md` for the latest documentation.

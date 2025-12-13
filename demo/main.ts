import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import JordiumGantt from '../src/index'
// import DeclarativeColumnsDemo from './DeclarativeColumnsDemo.vue'

// 使用 DeclarativeColumnsDemo 替代 App 来演示声明式列功能
// 如果要切换回原来的演示，取消注释 App 并注释掉 DeclarativeColumnsDemo
const app = createApp(App)
app.use(JordiumGantt) // 全局注册 GanttChart 和 TaskListColumn
app.mount('#app')

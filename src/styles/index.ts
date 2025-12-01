// 导出所有样式为字符串（用于运行时动态注入）
import themeVariables from './theme-variables.css?inline'
import listStyles from './list.css?inline'
import appStyles from './app.css?inline'

// 合并所有样式
const allStyles = `${themeVariables}\n${listStyles}\n${appStyles}`

export default allStyles

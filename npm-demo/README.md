# Gantt Demo App

基于 Vite + Vue3 的示例项目，用于本地调试 `jordium-gantt-vue3` 组件包。

## 调试方式
支持两种：
1. npm link （推荐开发阶段）
2. 打包 tgz 后 file: 引用（已改为 link 模式，可回退）

## 使用 npm link 调试流程
在本地库目录（例如：`D:/02 Project/01 久元鼎晟/300 框架集/02 Plugins/01 Gantt/npm-package`）执行：
```powershell
# 进入库源码根目录
npm install
npm run build:lib   # 若需要生成 dist
npm link             # 全局注册该包
```
回到示例项目目录执行：
```powershell
npm uninstall jordium-gantt-vue3 -D -S 2>$null | Out-Null  # 忽略不存在情形
npm install
npm link jordium-gantt-vue3
npm run dev
```
如果已经 link 过，只需：
```powershell
npm run dev
```
修改库源码后，可在库目录重新 `npm run build:lib`，示例项目无需重新安装，只要刷新浏览器（若是构建产物路径不变）。

## 回退为 tgz 引用
将 `package.json` 中：
```json
"jordium-gantt-vue3": "1.4.0"
```
改回：
```json
"jordium-gantt-vue3": "file:绝对路径/jordium-gantt-vue3-1.4.0.tgz"
```
然后：
```powershell
npm install --force
```

## 运行
```powershell
npm install
npm run dev
```
访问: http://localhost:5173/

## 占位组件
当真实库无法加载时，显示 `StubGantt.vue` 占位以避免报错。

## 常见问题
| 现象 | 处理 |
|------|------|
| Failed to resolve entry | 确认 dist 产物与 main/module 指向正确，重新 build:lib |
| 样式缺失 | 确认是否需要单独引入 css，如 `import 'jordium-gantt-vue3/dist/style.css'` |
| 代码未热更新 | 重新 build:lib 或使用源码 symlink + Vite optimizeDeps.exclude |

## License
仅内部开发调试使用。

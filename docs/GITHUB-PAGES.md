# GitHub Pages 部署指南

本项目已配置 GitHub Pages 自动部署，用户可以在线体验完整的 Gantt 图表功能。

## 🌐 在线访问

**Demo 地址**: https://nelson820125.github.io/jordium-gantt-vue3/

## 🔧 部署配置

### 自动化部署

项目使用 GitHub Actions 自动部署到 GitHub Pages：

- **触发条件**: 推送到 `main` 或 `master` 分支
- **构建命令**: `npm run build:pages`
- **部署目录**: `./dist`
- **工作流文件**: `.github/workflows/deploy-github-pages.yml`

### 手动启用 GitHub Pages

1. 进入 GitHub 仓库设置页面
2. 找到 "Pages" 设置选项
3. 选择 "Source" 为 "GitHub Actions"
4. 推送代码到主分支，自动触发部署

## 📁 构建产物

- **开发构建**: `npm run build` → `dist/`
- **GitHub Pages**: `npm run build:pages` → `dist/` (包含正确的 base 路径)
- **NPM 包构建**: `npm run build:lib` → `npm-package/dist/`

## 🛠️ 本地预览

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建并预览生产版本
npm run build:pages
npm run preview
```

## 🔄 更新部署

每次推送到主分支时，GitHub Actions 会自动：

1. 检出代码
2. 安装 Node.js 和依赖
3. 构建 demo 应用
4. 部署到 GitHub Pages

## 📝 注意事项

- 部署通常需要 1-5 分钟生效
- 确保 GitHub Pages 在仓库设置中已启用
- 自定义域名需要在 `demo/public/CNAME` 文件中配置
- 静态资源路径使用相对路径，确保在 Pages 环境中正常加载

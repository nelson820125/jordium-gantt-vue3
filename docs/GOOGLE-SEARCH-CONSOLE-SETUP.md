# Google Search Console Setup Guide

## 提交到 Google Search Console 的步骤

### 1. 访问 Google Search Console
前往 [Google Search Console](https://search.google.com/search-console)

### 2. 添加资源
- 选择 "URL 前缀" 方式
- 输入: `https://nelson820125.github.io/jordium-gantt-vue3/`

### 3. 验证所有权

#### 方法 A: HTML 文件验证（推荐）
1. 下载 Google 提供的验证文件（例如: `google1234567890abcdef.html`）
2. 将文件放到 `demo/public/` 目录下
3. 重新构建并部署
4. 在 Google Search Console 点击"验证"

#### 方法 B: HTML 标签验证
1. Google 会提供一个 meta 标签，例如:
   ```html
   <meta name="google-site-verification" content="your-verification-code" />
   ```
2. 将此标签添加到 `demo/index.html` 的 `<head>` 部分
3. 重新构建并部署
4. 在 Google Search Console 点击"验证"

### 4. 提交 Sitemap
验证成功后:
1. 进入左侧菜单 "索引" > "站点地图"
2. 输入 sitemap URL: `https://nelson820125.github.io/jordium-gantt-vue3/sitemap.xml`
3. 点击"提交"

### 5. 检查索引状态
- 在 "概览" 中查看索引覆盖率
- 在 "网址检查" 中测试具体页面
- 通常需要几天到几周时间才能被完全索引

## 文件清单

以下文件已为 SEO 优化准备好:

### ✅ 已创建的 SEO 文件:
- `demo/index.html` - 包含完整的 meta 标签和结构化数据
- `demo/public/robots.txt` - 搜索引擎爬虫配置
- `demo/public/sitemap.xml` - 网站地图

### 📋 SEO 特性:
- ✅ Meta 标签（title, description, keywords）
- ✅ Open Graph 标签（用于社交媒体分享）
- ✅ Twitter Cards
- ✅ Schema.org 结构化数据
- ✅ Canonical URL
- ✅ Sitemap
- ✅ Robots.txt

## 关键 URL

以下 URL 已在 sitemap 中定义并优化索引:

1. **Demo 地址**: https://nelson820125.github.io/jordium-gantt-vue3/
2. **仓库地址**: https://github.com/nelson820125/jordium-gantt-vue3
3. **英文文档**: https://github.com/nelson820125/jordium-gantt-vue3/blob/master/README-EN.md
4. **中文文档**: https://github.com/nelson820125/jordium-gantt-vue3/blob/master/README.md
5. **NPM 包**: https://www.npmjs.com/package/jordium-gantt-vue3

## 监控和优化

### 使用 Google Search Console 监控:
- 点击次数和展示次数
- 平均排名
- 索引覆盖率
- 移动设备可用性
- Core Web Vitals

### 建议的关键词:
- vue3 gantt chart
- vue gantt component
- typescript gantt
- project management vue
- task scheduler vue
- gantt chart component
- vue3 timeline
- interactive gantt

## 注意事项

1. **构建时确保文件复制**
   - 确保 `robots.txt` 和 `sitemap.xml` 被复制到构建输出目录
   - 如果使用 Vite，这些文件在 `public` 目录中会自动复制

2. **更新频率**
   - 每次发布新版本后，更新 `sitemap.xml` 中的 `<lastmod>` 日期
   - 在 Google Search Console 中重新提交 sitemap

3. **监控 404 错误**
   - 定期检查 Search Console 的 "覆盖率" 报告
   - 修复任何爬取错误

## 验证 SEO 设置

在浏览器中测试以下 URL:
- https://nelson820125.github.io/jordium-gantt-vue3/
- https://nelson820125.github.io/jordium-gantt-vue3/robots.txt
- https://nelson820125.github.io/jordium-gantt-vue3/sitemap.xml

使用工具验证:
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)

# GitHub Pages Deployment Guide

This project has been configured with automatic deployment of GitHub Pages, and users can experience the complete Gantt charting function online.

## 🌐 Online visit

**Demo Address**: https://nelson820125.github.io/jordium-gantt-vue3/

## 🔧 Deployment Configuration

### Automated deployment

Projects are automatically deployed to GitHub Pages using GitHub Actions:

- **Triggering condition**: Push to `main` or `master` branch
- **Build Command**: `npm run build:pages`
- **Deployment Directory**: `./dist`
- **Workflows**: `.github/workflows/deploy-github-pages.yml`

### Enable GitHub Pages manually

1. Enter the GitHub repository settings page
2. Find the "Pages" setting options
3. Select "Source" as "GitHub Actions"
4. Push code to the main branch and automatically trigger deployment

## 📁 Construct the product

- **Development and Construction**: `npm run build` → `dist/`
- **GitHub Pages**: `npm run build:pages` → `dist/` (contains the correct base path)
- **NPM package build**: `npm run build:lib` → `npm-package/dist/`

## 🛠️ Local Preview

```bash
# Installation dependencies
npm install

# Start the development server
npm run dev

# Build and preview the production version
npm run build:pages
npm run preview
```

## 🔄 Update deployment

GitHub Actions will automatically:

1. Check out the code
2. Install Node.js and dependencies
3. Build demo application
4. Deploy to GitHub Pages

## 📝 Notes

- Deployment usually takes 1-5 minutes to take effect
- Make sure GitHub Pages is enabled in repository settings
- Custom domain names need to be configured in the `demo/public/CNAME` file
- Static resource paths use relative paths to ensure normal loading in the Pages environment

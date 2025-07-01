# Contributing to jordium-gantt-vue3

Thank you for your interest in contributing to jordium-gantt-vue3! We welcome contributions from the community and are pleased to have you join us.

## 🌍 Languages

This document is available in multiple languages:
- [中文版](./CONTRIBUTING.md)
- [English](./CONTRIBUTING-EN.md)

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to [ning.li@jordium.com](mailto:ning.li@jordium.com) / [nelson820125@gmail.com](mailto:nelson820125@gmail.com).

### Our Standards

- **Be respectful** and inclusive
- **Be collaborative** and constructive
- **Be patient** with newcomers
- **Be considerate** of different perspectives
- **Focus on what's best** for the community

## 🤝 How to Contribute

There are many ways to contribute to jordium-gantt-vue3:

### 🐛 Bug Reports
- Search existing issues first
- Use our bug report template
- Provide clear reproduction steps
- Include environment details

### 💡 Feature Requests
- Check if the feature already exists
- Explain the use case and benefits
- Provide mockups or examples if possible

### 🔧 Code Contributions
- Bug fixes
- New features
- Performance improvements
- Documentation updates

### 📚 Documentation
- Fix typos or unclear content
- Add examples and tutorials
- Translate documentation
- Improve API documentation

## 🛠️ Development Setup

### Prerequisites

- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0 (or yarn >= 1.22.0)
- **Git**: Latest version

### Clone and Setup

```bash
# Clone the repository
git clone https://github.com/nelson820125/jordium-gantt-vue3.git
cd jordium-gantt-vue3

# Install dependencies
npm install

# Start development server
npm run dev

# Open another terminal for the demo
cd demo
npm run dev
```

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run dev:demo         # Start demo development server

# Building
npm run build            # Build for production
npm run build:lib        # Build library for npm

# Quality Assurance
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run type-check       # TypeScript type checking
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting

# Testing
npm run test             # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage
```

## 📁 Project Structure

```
jordium-gantt-vue3/
├── src/                     # Main source code
│   ├── components/          # Vue components
│   │   ├── GanttChart.vue   # Main Gantt chart component
│   │   ├── Timeline.vue     # Timeline component
│   │   ├── TaskList.vue     # Task list component
│   │   └── ...
│   ├── composables/         # Vue composables
│   │   ├── useI18n.ts       # Internationalization
│   │   └── useMessage.ts    # Message system
│   ├── models/              # TypeScript models
│   │   ├── classes/         # Data classes
│   │   └── configs/         # Configuration types
│   └── styles/              # Global styles
├── demo/                    # Demo application
├── packageDemo/             # Package demo for testing
├── docs/                    # Documentation
├── tests/                   # Test files
└── ...
```

## 🎨 Coding Standards

### Code Style

We use ESLint and Prettier to maintain consistent code style:

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Not required
- **Line length**: 100 characters max
- **Trailing commas**: ES5 style

### Vue.js Guidelines

```vue
<script setup lang="ts">
// 1. Imports first
import { ref, computed, onMounted } from 'vue'
import type { Task } from '../models/classes/Task'

// 2. Props definition
interface Props {
  tasks: Task[]
  showToolbar?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  showToolbar: true
})

// 3. Emits definition
const emit = defineEmits<{
  taskUpdated: [task: Task]
}>()

// 4. Reactive data
const isLoading = ref(false)

// 5. Computed properties
const taskCount = computed(() => props.tasks.length)

// 6. Methods
const handleTaskUpdate = (task: Task) => {
  emit('taskUpdated', task)
}

// 7. Lifecycle hooks
onMounted(() => {
  // Initialize component
})
</script>

<template>
  <!-- Use semantic HTML and accessible attributes -->
  <div class="gantt-container" role="application" aria-label="Gantt Chart">
    <!-- Component content -->
  </div>
</template>

<style scoped>
/* Use CSS custom properties for theming */
.gantt-container {
  background: var(--gantt-bg-primary, #ffffff);
  color: var(--gantt-text-primary, #303133);
}
</style>
```

### TypeScript Guidelines

- **Strict mode**: Enable strict TypeScript checking
- **Explicit types**: Prefer explicit type annotations for public APIs
- **Interfaces**: Use interfaces for object shapes
- **Enums**: Use const assertions or union types instead of enums

```typescript
// Good
interface TaskOptions {
  id: number
  name: string
  assignee?: string
}

// Better for simple cases
type TaskStatus = 'pending' | 'in-progress' | 'completed'

// Use generic constraints
function updateTask<T extends Task>(task: T): T {
  return { ...task, updatedAt: new Date() }
}
```

## 📝 Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification:

### Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Add or update tests
- **chore**: Maintenance tasks

### Examples

```bash
feat(timeline): add zoom feature
fix(taskbar): fix drag position calculation issue
docs(api): update GanttChart props documentation
style(components): format code with prettier
refactor(composables): extract common logic to useGantt
perf(timeline): optimize virtual scrolling
test(timeline): add unit tests for zoom feature
chore(deps): update vue to 3.4.0
```

### Scope Guidelines

- **components**: Vue components
- **composables**: Vue composables
- **models**: TypeScript models
- **styles**: CSS/styling changes
- **timeline**: Timeline-related changes
- **taskbar**: Taskbar-related changes
- **i18n**: Internationalization
- **demo**: Demo application
- **build**: Build system
- **ci**: CI/CD changes

## 🔄 Pull Request Process

### Before Submitting

1. **Fork** the repository
2. **Create** a feature branch from `main`
3. **Make** your changes
4. **Add** tests for new functionality
5. **Update** documentation
6. **Run** linting and tests
7. **Commit** using conventional commit format

### PR Checklist

- [ ] Code follows the style guidelines
- [ ] Self-review of code completed
- [ ] Tests added for new functionality
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No merge conflicts
- [ ] Conventional commit format used

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Manual testing completed
- [ ] Demo application works

## Screenshots (if applicable)
Add screenshots here

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated
- [ ] Documentation updated
```

## 🐛 Issue Guidelines

### Bug Reports

Use the bug report template and include:

1. **Environment**: OS, browser, Node.js version
2. **Steps to reproduce**: Clear, numbered steps
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Screenshots**: If applicable
6. **Additional context**: Any other relevant information

### Feature Requests

Use the feature request template and include:

1. **Problem description**: What problem does this solve?
2. **Proposed solution**: How should it work?
3. **Alternatives considered**: Other approaches considered
4. **Additional context**: Mockups, examples, etc.

## 🧪 Testing

### Writing Tests

```typescript
// Example unit test
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GanttChart from '../src/components/GanttChart.vue'

describe('GanttChart', () => {
  it('renders tasks correctly', () => {
    const tasks = [
      { id: 1, name: 'Task 1', startDate: '2025-01-01', endDate: '2025-01-05' }
    ]
    
    const wrapper = mount(GanttChart, {
      props: { tasks }
    })
    
    expect(wrapper.text()).toContain('Task 1')
  })
})
```

### Test Coverage

- Aim for **80%+ code coverage**
- Test **critical functionality** thoroughly
- Include **edge cases** and **error scenarios**
- Test **accessibility** features

## 📚 Documentation

### Code Documentation

```typescript
/**
 * Calculates the position of a task on the timeline
 * @param task - The task object containing date information
 * @param startDate - The timeline start date
 * @param dayWidth - Width of one day in pixels
 * @returns Object containing left position and width
 */
function calculateTaskPosition(
  task: Task,
  startDate: Date,
  dayWidth: number
): { left: number; width: number } {
  // Implementation
}
```

### README Updates

When adding new features:

1. Update the feature list
2. Add usage examples
3. Update API documentation
4. Include screenshots if UI changes

## 🌍 Internationalization

### Adding New Languages

1. Create language file in `src/composables/useI18n.ts`
2. Add translations for all keys
3. Test with the new language
4. Update documentation

```typescript
// Example language addition
const messages = {
  'zh-CN': { /* Chinese translations */ },
  'en-US': { /* English translations */ },
  'fr-FR': { /* French translations */ }, // New language
}
```

## 🏷️ Release Process

### Version Bumping

We use [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Git tag created
- [ ] NPM package published
- [ ] GitHub release created

## 📞 Getting Help

### Community Support

- **GitHub Discussions**: General questions and ideas
- **GitHub Issues**: Bug reports and feature requests
- **Email**: [ning.li@jordium.com](mailto:ning.li@jordium.com) / [nelson820125@gmail.com](mailto:nelson820125@gmail.com)

### Maintainer Response Times

- **Critical bugs**: Within 24 hours
- **Regular issues**: Within 7 days
- **Feature requests**: Within 14 days
- **Pull requests**: Within 7 days

## 🙏 Recognition

Contributors will be:
- Added to the [Contributors](./CONTRIBUTORS.md) list
- Mentioned in release notes
- Given credit in documentation

## 📄 License

By contributing to jordium-gantt-vue3, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to jordium-gantt-vue3! 🎉**

Your contributions help make this project better for everyone.

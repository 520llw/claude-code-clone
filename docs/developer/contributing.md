# Contributing Guide

Guidelines for contributing to Claude Code Clone.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Code Standards](#code-standards)
4. [Submitting Changes](#submitting-changes)
5. [Testing](#testing)
6. [Documentation](#documentation)
7. [Issue Reporting](#issue-reporting)
8. [Code Review](#code-review)
9. [Release Process](#release-process)
10. [Community Guidelines](#community-guidelines)

## Getting Started

### Ways to Contribute

- **Code**: Bug fixes, features, improvements
- **Documentation**: Guides, examples, corrections
- **Testing**: Bug reports, test cases
- **Design**: UI/UX improvements
- **Community**: Support, advocacy

### Before You Start

1. **Read this guide** completely
2. **Check existing issues** for similar work
3. **Join the community** on Discord
4. **Set up your environment**

### Finding Issues

Look for issues labeled:

| Label | Description | Skill Level |
|-------|-------------|-------------|
| `good-first-issue` | Easy starter issues | Beginner |
| `help-wanted` | Need community help | Any |
| `bug` | Something is broken | Varies |
| `feature` | New functionality | Varies |
| `documentation` | Docs improvements | Any |

## Development Setup

### Fork and Clone

```bash
# Fork on GitHub, then clone
git clone https://github.com/YOUR_USERNAME/claude-code-clone.git
cd claude-code-clone

# Add upstream remote
git remote add upstream https://github.com/claude-code-clone/claude-code-clone.git
```

### Install Dependencies

```bash
# Install Node.js 18+
nvm use 18

# Install dependencies
npm install

# Build project
npm run build
```

### Configure Development Environment

```bash
# Create development config
cp .env.example .env

# Edit configuration
nano .env

# Set API key for testing
export ANTHROPIC_API_KEY="your-key"
```

### Run Development Version

```bash
# Link for global access
npm link

# Run development version
claude-code-clone --dev

# Or run directly
npm run dev
```

### Verify Setup

```bash
# Run tests
npm test

# Run linter
npm run lint

# Check types
npm run typecheck

# Run full check
npm run check
```

## Code Standards

### TypeScript Guidelines

#### Type Safety

```typescript
// Good: Explicit types
function processData(data: string[]): ProcessedData {
  return data.map(item => process(item));
}

// Bad: Implicit any
function processData(data) {
  return data.map(item => process(item));
}
```

#### Interfaces vs Types

```typescript
// Use interface for object shapes
interface User {
  id: string;
  name: string;
  email: string;
}

// Use type for unions/aliases
type Status = 'pending' | 'active' | 'inactive';
type ID = string | number;
```

#### Null Safety

```typescript
// Good: Handle null/undefined
function getUser(id: string): User | undefined {
  return users.find(u => u.id === id);
}

// Check before use
const user = getUser('123');
if (user) {
  console.log(user.name);
}

// Or use optional chaining
console.log(user?.name);
```

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Check formatting
npm run lint

# Fix formatting
npm run lint:fix

# Format with Prettier
npm run format
```

#### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `userName` |
| Constants | UPPER_SNAKE | `MAX_SIZE` |
| Functions | camelCase | `getUser()` |
| Classes | PascalCase | `UserManager` |
| Interfaces | PascalCase | `UserConfig` |
| Types | PascalCase | `UserStatus` |
| Enums | PascalCase | `StatusCode` |
| Files | kebab-case | `user-manager.ts` |

#### File Organization

```typescript
// 1. Imports (external first, then internal)
import fs from 'fs';
import path from 'path';

import { Config } from './config';
import { Logger } from '../utils/logger';

// 2. Types/Interfaces
interface Options {
  verbose: boolean;
}

// 3. Constants
const DEFAULT_TIMEOUT = 5000;

// 4. Class/Function
export class MyClass {
  // Implementation
}

// 5. Exports
export { helper } from './helpers';
```

### Error Handling

```typescript
// Good: Custom error types
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Good: Try-catch with specific handling
try {
  await processFile(file);
} catch (error) {
  if (error instanceof ValidationError) {
    logger.warn(`Validation failed: ${error.field}`);
  } else {
    logger.error('Unexpected error:', error);
    throw error;
  }
}
```

### Async/Await

```typescript
// Good: Use async/await
async function fetchData(): Promise<Data> {
  const response = await api.get('/data');
  return response.data;
}

// Good: Parallel execution
async function fetchMultiple(): Promise<void> {
  const [users, posts] = await Promise.all([
    fetchUsers(),
    fetchPosts()
  ]);
}

// Good: Error handling in async
async function safeFetch(): Promise<Data | null> {
  try {
    return await fetchData();
  } catch (error) {
    logger.error('Fetch failed:', error);
    return null;
  }
}
```

## Submitting Changes

### Branch Naming

```
type/description

Examples:
  feature/add-search-tool
  fix/file-read-error
  docs/update-readme
  refactor/simplify-context
  test/add-unit-tests
```

### Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Code style (formatting) |
| `refactor` | Code refactoring |
| `test` | Tests |
| `chore` | Maintenance |

**Examples:**

```
feat(tools): add browser screenshot tool

fix(file): handle large file reads correctly

docs(api): update tool reference documentation

test(session): add unit tests for session manager
```

### Pull Request Process

1. **Create branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes**
   - Write code
   - Add tests
   - Update docs

3. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

4. **Push branch**
   ```bash
   git push origin feature/my-feature
   ```

5. **Create PR**
   - Fill out PR template
   - Link related issues
   - Request review

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass

## Related Issues
Fixes #123
```

## Testing

### Test Structure

```
tests/
├── unit/                      # Unit tests
│   ├── core/
│   ├── tools/
│   └── utils/
├── integration/               # Integration tests
│   ├── api/
│   └── cli/
├── e2e/                       # End-to-end tests
└── fixtures/                  # Test fixtures
```

### Writing Tests

```typescript
// tests/unit/tools/file.test.ts
import { readFile } from '../../../src/tools/file';

describe('readFile', () => {
  it('should read file contents', async () => {
    const result = await readFile({
      file_path: 'tests/fixtures/sample.txt'
    });
    
    expect(result.content).toBe('Hello, World!');
  });
  
  it('should throw on missing file', async () => {
    await expect(readFile({
      file_path: 'nonexistent.txt'
    })).rejects.toThrow('File not found');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- file.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run e2e tests
npm run test:e2e
```

### Test Coverage

Minimum coverage requirements:

| Type | Minimum |
|------|---------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

## Documentation

### Documentation Types

1. **Code Documentation**
   - JSDoc comments
   - Type definitions
   - Inline comments

2. **User Documentation**
   - Guides
   - Tutorials
   - Reference

3. **Developer Documentation**
   - Architecture
   - Contributing
   - API docs

### Code Documentation

```typescript
/**
 * Reads a file from the filesystem.
 * 
 * @param params - The read parameters
 * @param params.file_path - Path to the file to read
 * @param params.offset - Line number to start from (optional)
 * @param params.limit - Maximum lines to read (optional)
 * @returns The file content and metadata
 * @throws {FileNotFoundError} If file doesn't exist
 * @throws {PermissionError} If file cannot be read
 * 
 * @example
 * ```typescript
 * const result = await readFile({
 *   file_path: '/path/to/file.txt',
 *   offset: 1,
 *   limit: 50
 * });
 * console.log(result.content);
 * ```
 */
export async function readFile(
  params: ReadFileParams
): Promise<ReadFileResult> {
  // Implementation
}
```

### Documentation Updates

When making changes:

1. Update relevant guides
2. Update API documentation
3. Add examples if needed
4. Update CHANGELOG.md

## Issue Reporting

### Bug Reports

Include:

- **Description**: Clear bug description
- **Steps to Reproduce**: Numbered steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: OS, version, config
- **Logs**: Relevant error messages

**Template:**

```markdown
**Description**
Brief bug description

**Steps to Reproduce**
1. Step one
2. Step two
3. Step three

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: macOS 14.0
- Version: 1.0.0
- Node: 18.0.0

**Logs**
```
Error message here
```
```

### Feature Requests

Include:

- **Description**: Feature description
- **Use Case**: Why it's needed
- **Proposed Solution**: How it should work
- **Alternatives**: Other approaches considered

## Code Review

### Review Checklist

**For Authors:**

- [ ] Tests pass
- [ ] Code is documented
- [ ] No console.log statements
- [ ] No hardcoded secrets
- [ ] Error handling in place

**For Reviewers:**

- [ ] Code is readable
- [ ] Tests cover changes
- [ ] No security issues
- [ ] Performance is acceptable
- [ ] Documentation is updated

### Review Process

1. **Automated checks** must pass
2. **At least one approval** required
3. **Address feedback** promptly
4. **Squash commits** if needed

## Release Process

### Version Numbering

Follow Semantic Versioning:

| Version | Change Type |
|---------|-------------|
| MAJOR | Breaking changes |
| MINOR | New features (backward compatible) |
| PATCH | Bug fixes |

### Release Steps

1. **Update version**
   ```bash
   npm version [major|minor|patch]
   ```

2. **Update CHANGELOG**
   - Add release notes
   - List all changes

3. **Create release PR**
   - Title: "Release vX.Y.Z"
   - Get approval

4. **Merge and tag**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

5. **Publish to npm**
   ```bash
   npm publish
   ```

## Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect different viewpoints

### Communication

- **GitHub Issues**: Bug reports, features
- **Discord**: Quick questions, chat
- **Forum**: Discussions, proposals
- **Email**: Private matters

### Recognition

Contributors are recognized in:

- README.md contributors section
- Release notes
- Annual contributor report

---

**Contributing Quick Reference**

```
Setup:
  1. Fork and clone
  2. npm install
  3. npm run build
  4. npm link

Development:
  - npm run dev        # Run dev version
  - npm test           # Run tests
  - npm run lint       # Check style
  - npm run typecheck  # Check types

Submitting:
  1. Create branch: git checkout -b feature/name
  2. Make changes
  3. Commit: git commit -m "feat: description"
  4. Push: git push origin feature/name
  5. Create PR
```

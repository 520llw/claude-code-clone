# Skills Development Guide

This guide explains how to create custom skills for the Claude Code system.

## Table of Contents

- [Overview](#overview)
- [Skill Structure](#skill-structure)
- [Creating a Skill](#creating-a-skill)
- [Skill Definition](#skill-definition)
- [Skill Implementation](#skill-implementation)
- [Registration](#registration)
- [Examples](#examples)
- [Best Practices](#best-practices)

## Overview

Skills are reusable AI capabilities that can be:
- Loaded dynamically
- Composed together
- Shared across sessions
- Version controlled

Each skill has:
- Clear purpose and scope
- Input/output schemas
- Example usage
- Required tools
- Required context
- Success criteria

## Skill Structure

A skill consists of:

1. **Definition** - Metadata, schemas, and configuration
2. **Implementation** - The actual skill logic
3. **Factory** - Function to create skill instances

## Creating a Skill

### 1. Define the Skill

Create a skill definition with metadata, schemas, and examples:

```typescript
const mySkillDefinition: SkillDefinition = {
  metadata: {
    id: 'my-skill',
    name: 'My Skill',
    version: '1.0.0',
    description: 'What this skill does',
    category: 'custom',
    author: { name: 'Your Name' },
    tags: ['custom', 'example'],
    license: 'MIT',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  compatibility: { minPlatformVersion: '1.0.0' },
  config: {
    enabled: true,
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
    parallel: false,
    maxConcurrency: 1,
    cacheResults: false,
    cacheTtl: 3600000,
    logLevel: 'info',
    customSettings: {},
  },
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        name: 'input',
        type: 'string',
        description: 'Input description',
        required: true,
      },
    },
    required: ['input'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      result: {
        name: 'result',
        type: 'string',
        description: 'Result description',
        required: true,
      },
    },
    required: ['result'],
  },
  examples: [
    {
      name: 'Example 1',
      description: 'Example usage',
      input: { input: 'test' },
      expectedOutput: { result: 'output' },
    },
  ],
  requiredTools: [],
  requiredContext: [],
  successCriteria: [
    {
      name: 'success',
      description: 'Success criteria',
      check: (output) => output.success,
    },
  ],
  dependencies: [],
  documentation: {
    readme: '# My Skill\n\nDocumentation...',
    changelog: '# Changelog\n\n## 1.0.0\n- Initial release',
    apiReference: 'API reference...',
    tutorials: [],
  },
};
```

### 2. Implement the Skill

Extend the `Skill` base class:

```typescript
export class MySkill extends Skill {
  constructor(config?: Partial<SkillConfig>) {
    super(mySkillDefinition, config);
  }

  protected async onInitialize(): Promise<void> {
    // Initialize resources
  }

  protected async onExecute(input: SkillInput, context: SkillContext): Promise<SkillOutput> {
    // Execute skill logic
    return {
      success: true,
      data: { result: 'output' },
      metadata: {
        executionTime: 100,
        startTime: new Date(),
        endTime: new Date(),
        cached: false,
        retryCount: 0,
      },
    };
  }

  protected async onDispose(): Promise<void> {
    // Clean up resources
  }
}
```

### 3. Create Factory Function

```typescript
export default function createSkill(config?: Partial<SkillConfig>): MySkill {
  return new MySkill(config);
}
```

## Skill Definition

### Metadata

- `id` - Unique identifier (kebab-case)
- `name` - Human-readable name
- `version` - Semantic version
- `description` - What the skill does
- `category` - 'code', 'analysis', 'generation', 'git', 'utility', 'custom'
- `author` - Author information
- `tags` - Searchable tags
- `license` - License identifier

### Input/Output Schemas

Define parameters with:
- `name` - Parameter name
- `type` - 'string', 'number', 'boolean', 'array', 'object', 'file'
- `description` - Parameter description
- `required` - Is this parameter required?
- `default` - Default value
- `enum` - Allowed values

### Examples

Provide example inputs and expected outputs for documentation and testing.

## Skill Implementation

### Lifecycle Methods

- `onInitialize()` - Called once before first execution
- `onExecute()` - Main execution logic
- `onDispose()` - Called when skill is unloaded

### Helper Methods

- `_log(level, message, meta)` - Log messages
- `_isAborted()` - Check if execution was cancelled
- `_throwIfAborted()` - Throw if cancelled
- `_delay(ms)` - Delay execution

### Error Handling

Use `SkillExecutionError` for typed errors:

```typescript
throw new SkillExecutionError(
  'INVALID_INPUT',
  'Input validation failed',
  { field: 'name' }
);
```

## Registration

### Register with SkillManager

```typescript
import { SkillManager } from '@claude-code/skills';
import createMySkill from './my-skill';

const manager = new SkillManager();
await manager.initialize();

const skill = createMySkill();
await manager.register(skill.definition);
```

### Execute the Skill

```typescript
const result = await manager.execute('my-skill', {
  input: 'test'
});
```

## Examples

See `custom-skill-example.ts` for a complete example.

## Best Practices

1. **Clear Purpose** - Each skill should have a single, clear purpose
2. **Validation** - Validate all inputs thoroughly
3. **Error Handling** - Provide meaningful error messages
4. **Documentation** - Document all parameters and outputs
5. **Examples** - Include practical examples
6. **Testing** - Test edge cases and error conditions
7. **Performance** - Consider timeout and caching options
8. **Versioning** - Use semantic versioning
9. **Dependencies** - Declare all required tools and context
10. **Cleanup** - Properly dispose of resources

## Skill Categories

### Code Skills
- Code review
- Refactoring
- Documentation generation
- Test generation

### Analysis Skills
- Code analysis
- Performance analysis
- Security analysis

### Generation Skills
- Code generation
- Configuration generation

### Git Skills
- Commit message generation
- PR description generation
- Changelog generation

### Utility Skills
- Debugging
- Optimization
- Migration

## Advanced Topics

### Skill Composition

Compose multiple skills into workflows:

```typescript
const composition = manager.composer.createLinear('my-pipeline', 'Pipeline', [
  'skill-1',
  'skill-2',
  'skill-3',
]);

const result = await manager.executeComposition(composition, input, context);
```

### Skill Hooks

Add lifecycle hooks to your skill definition:

```typescript
hooks: {
  beforeExecute: `(input) => { console.log('Before:', input); return input; }`,
  afterExecute: `(output) => { console.log('After:', output); return output; }`,
  onError: `(error) => { console.error('Error:', error); }`,
}
```

### Custom Configuration

Access custom settings in your skill:

```typescript
const customSetting = this._config.customSettings.mySetting;
```

## Publishing Skills

1. Create a package with your skill
2. Include `skill.config.json` metadata
3. Publish to npm or private registry
4. Users can load with `SkillLoader`

```typescript
const result = await loader.loadFromNpm('my-skill-package');
```

## Support

For more information, see the main documentation or open an issue.

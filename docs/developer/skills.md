# Skill Development Guide

Guide to creating and using skills in Claude Code Clone.

## Table of Contents

1. [What are Skills?](#what-are-skills)
2. [Skill Structure](#skill-structure)
3. [Creating Skills](#creating-skills)
4. [Skill Types](#skill-types)
5. [Skill Patterns](#skill-patterns)
6. [Skill Configuration](#skill-configuration)
7. [Advanced Skills](#advanced-skills)
8. [Skill Best Practices](#skill-best-practices)
9. [Skill Examples](#skill-examples)
10. [Skill Distribution](#skill-distribution)

## What are Skills?

Skills are domain-specific expertise modules that enhance Claude Code Clone's capabilities for particular technologies, frameworks, or domains.

### Skill vs Tool

| Aspect | Tool | Skill |
|--------|------|-------|
| Purpose | Execute actions | Provide expertise |
| Interface | Function calls | Prompts/knowledge |
| Execution | Direct | Guides AI behavior |
| Example | `read_file` | React expertise |

### Benefits of Skills

- **Domain Expertise**: Specialized knowledge for specific technologies
- **Consistency**: Enforce coding standards and patterns
- **Efficiency**: Faster, more accurate responses
- **Customization**: Tailor behavior to your needs

## Skill Structure

### Basic Skill Interface

```typescript
interface Skill {
  name: string;
  description: string;
  patterns: string[];      // File patterns this applies to
  prompts: Prompts;        // Prompt templates
  knowledge?: string[];    // Additional knowledge
  examples?: Example[];    // Usage examples
}

interface Prompts {
  [key: string]: string;   // Named prompt templates
}

interface Example {
  description: string;
  input: string;
  output: string;
}
```

### Skill File Structure

```
skills/
└── my-skill/
    ├── index.ts           # Main skill definition
    ├── prompts/           # Prompt templates
    │   ├── component.md
    │   └── test.md
    ├── knowledge/         # Knowledge base
    │   ├── patterns.md
    │   └── best-practices.md
    ├── examples/          # Example usages
    │   └── example1.md
    └── config.json        # Skill configuration
```

## Creating Skills

### Basic Skill

```typescript
// skills/react-basic/index.ts
import { Skill } from '@claude-code-clone/sdk';

export const reactBasicSkill: Skill = {
  name: 'react-basic',
  description: 'Basic React development assistance',
  
  patterns: [
    '*.jsx',
    '*.tsx',
    'components/**/*'
  ],
  
  prompts: {
    default: `
You are helping with a React project. Follow these guidelines:
- Use functional components
- Prefer hooks over class components
- Use JSX syntax
- Follow React naming conventions
`,
    component: `
Create a React component with:
- Clear, descriptive name
- Proper props interface
- Default props where appropriate
- JSDoc documentation
`,
    hook: `
Create a custom React hook with:
- use[Name] naming convention
- Clear return type
- Proper cleanup
- Usage example
`
  },
  
  knowledge: [
    'React components are functions that return JSX',
    'Hooks must start with "use"',
    'Components should be pure when possible'
  ]
};
```

### Skill with Examples

```typescript
// skills/typescript-expert/index.ts
export const typescriptExpertSkill: Skill = {
  name: 'typescript-expert',
  description: 'Expert TypeScript development',
  
  patterns: ['*.ts', '*.tsx'],
  
  prompts: {
    default: `
You are a TypeScript expert. Follow these guidelines:
- Use strict mode
- Prefer interfaces over types for objects
- Use explicit return types on exported functions
- Avoid 'any' type
- Use generics for reusable code
`,
    interface: 'Create a TypeScript interface...',
    generic: 'Create a generic type...',
    type: 'Create a type alias...'
  },
  
  examples: [
    {
      description: 'Creating a generic API response type',
      input: 'Create a type for API responses',
      output: `
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

// Usage
interface User {
  id: string;
  name: string;
}

type UserResponse = ApiResponse<User>;
`
    }
  ]
};
```

## Skill Types

### Framework Skills

```typescript
// skills/nextjs-expert/index.ts
export const nextjsExpertSkill: Skill = {
  name: 'nextjs-expert',
  description: 'Next.js framework expertise',
  
  patterns: [
    'pages/**/*',
    'app/**/*',
    'next.config.*'
  ],
  
  prompts: {
    page: `
Create a Next.js page with:
- Proper data fetching method
- Error handling
- SEO metadata
- Loading states
`,
    api: `
Create a Next.js API route with:
- Proper HTTP method handling
- Input validation
- Error responses
- TypeScript types
`,
    component: `
Create a Next.js component with:
- Server Component by default
- Client Component when needed ('use client')
- Proper data fetching
- Error boundaries
`
  },
  
  knowledge: [
    'App Router vs Pages Router differences',
    'Server Components vs Client Components',
    'Next.js caching strategies',
    'Image optimization with next/image'
  ]
};
```

### Language Skills

```typescript
// skills/python-expert/index.ts
export const pythonExpertSkill: Skill = {
  name: 'python-expert',
  description: 'Python development expertise',
  
  patterns: ['*.py', 'requirements.txt'],
  
  prompts: {
    default: `
You are a Python expert. Follow PEP 8 guidelines:
- Use 4 spaces for indentation
- Maximum line length of 79 characters
- Use snake_case for functions and variables
- Use PascalCase for classes
- Add docstrings to modules, classes, and functions
`,
    function: `
Create a Python function with:
- Type hints
- Docstring (Google style)
- Input validation
- Error handling
`,
    class: `
Create a Python class with:
- Clear __init__ method
- Type hints
- Docstrings
- Proper encapsulation
`
  },
  
  knowledge: [
    'Python uses duck typing',
    'List comprehensions are preferred over map/filter',
    'Context managers (with statement) for resources',
    'Virtual environments for dependency management'
  ]
};
```

### Domain Skills

```typescript
// skills/ml-expert/index.ts
export const mlExpertSkill: Skill = {
  name: 'ml-expert',
  description: 'Machine learning development expertise',
  
  patterns: [
    '*.ipynb',
    '*-model.*',
    'train.py',
    'inference.py'
  ],
  
  prompts: {
    preprocessing: `
Create data preprocessing code with:
- Handling missing values
- Feature scaling/normalization
- Train/validation/test split
- Reproducible random seeds
`,
    model: `
Create a machine learning model with:
- Clear architecture definition
- Hyperparameter configuration
- Training loop with metrics
- Model checkpointing
`,
    evaluation: `
Create model evaluation code with:
- Appropriate metrics for the problem
- Confusion matrix for classification
- Cross-validation
- Error analysis
`
  },
  
  knowledge: [
    'Always split data before any preprocessing',
    'Use cross-validation for robust evaluation',
    'Monitor for overfitting with validation set',
    'Save model artifacts and training metadata'
  ]
};
```

## Skill Patterns

### Pattern Matching

```typescript
export const skill: Skill = {
  name: 'example-skill',
  
  // Glob patterns for file matching
  patterns: [
    // Specific files
    'package.json',
    
    // File extensions
    '*.test.js',
    '*.spec.ts',
    
    // Directory patterns
    'src/components/**/*.tsx',
    'tests/**/*',
    
    // Negation
    '!node_modules/**',
    '!dist/**',
    
    // Multiple extensions
    '*.{js,ts,jsx,tsx}'
  ]
};
```

### Conditional Activation

```typescript
export const skill: Skill = {
  name: 'conditional-skill',
  
  patterns: ['*.js'],
  
  // Activation conditions
  conditions: {
    // Check for specific file existence
    fileExists: ['package.json'],
    
    // Check for specific dependency
    hasDependency: 'react',
    
    // Check for config value
    configValue: {
      key: 'project.type',
      value: 'nodejs'
    }
  }
};
```

## Skill Configuration

### Skill Config File

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "My custom skill",
  "author": "Your Name",
  
  "activation": {
    "patterns": ["*.js", "*.ts"],
    "priority": 100
  },
  
  "prompts": {
    "directory": "./prompts",
    "default": "default.md"
  },
  
  "knowledge": {
    "directory": "./knowledge",
    "files": ["patterns.md", "best-practices.md"]
  },
  
  "examples": {
    "directory": "./examples"
  }
}
```

### Loading External Prompts

```typescript
// skills/advanced-skill/index.ts
import { readFileSync } from 'fs';
import { join } from 'path';

function loadPrompt(name: string): string {
  return readFileSync(
    join(__dirname, 'prompts', `${name}.md`),
    'utf-8'
  );
}

export const advancedSkill: Skill = {
  name: 'advanced-skill',
  description: 'Skill with external prompts',
  
  patterns: ['*.ts'],
  
  prompts: {
    default: loadPrompt('default'),
    component: loadPrompt('component'),
    test: loadPrompt('test')
  }
};
```

### Dynamic Prompts

```typescript
export const dynamicSkill: Skill = {
  name: 'dynamic-skill',
  
  patterns: ['*.js'],
  
  prompts: {
    default: (context) => {
      // Generate prompt based on context
      const hasTests = context.files.some(f => f.includes('.test.'));
      
      return `
You are helping with a JavaScript project.
${hasTests ? 'This project has tests. Maintain test coverage.' : ''}
Follow best practices for JavaScript development.
`;
    }
  }
};
```

## Advanced Skills

### Multi-Language Skills

```typescript
export const fullstackSkill: Skill = {
  name: 'fullstack-expert',
  description: 'Full-stack development expertise',
  
  patterns: ['*'],
  
  subSkills: {
    frontend: {
      patterns: ['src/**/*', 'components/**/*'],
      prompts: {
        default: 'Frontend development guidelines...'
      }
    },
    backend: {
      patterns: ['server/**/*', 'api/**/*'],
      prompts: {
        default: 'Backend development guidelines...'
      }
    },
    database: {
      patterns: ['migrations/**/*', 'models/**/*'],
      prompts: {
        default: 'Database design guidelines...'
      }
    }
  }
};
```

### Context-Aware Skills

```typescript
export const contextAwareSkill: Skill = {
  name: 'context-aware-skill',
  
  patterns: ['*.ts'],
  
  contextProviders: [
    // Provide additional context
    {
      name: 'project-info',
      provide: async () => {
        const packageJson = await readFile('package.json');
        return {
          framework: packageJson.dependencies?.next ? 'nextjs' : 'react',
          hasTypeScript: true,
          testFramework: packageJson.devDependencies?.jest ? 'jest' : 'vitest'
        };
      }
    }
  ],
  
  prompts: {
    default: (context) => `
You are helping with a ${context.framework} project.
Testing framework: ${context.testFramework}.
Follow appropriate patterns for this stack.
`
  }
};
```

### Composable Skills

```typescript
// Base skill
export const baseSkill: Skill = {
  name: 'base-skill',
  patterns: ['*.ts'],
  prompts: {
    default: 'Base TypeScript guidelines...'
  }
};

// Extended skill
export const extendedSkill: Skill = {
  name: 'extended-skill',
  extends: 'base-skill',
  patterns: ['*.tsx'],
  prompts: {
    default: 'Extended guidelines building on base...',
    component: 'React component specific guidelines...'
  }
};
```

## Skill Best Practices

### Prompt Design

```typescript
export const wellDesignedSkill: Skill = {
  name: 'well-designed-skill',
  
  prompts: {
    // Be specific and clear
    component: `
Create a React component with these specific requirements:
1. Use TypeScript with explicit prop types
2. Include JSDoc with @param and @returns
3. Add PropTypes for runtime validation
4. Include a usage example in comments
5. Handle loading and error states
6. Make it accessible with ARIA labels
`,

    // Provide examples
    function: `
Create a utility function following this pattern:

Example:
\`\`\`typescript
export function formatDate(
  date: Date,
  format: string = 'YYYY-MM-DD'
): string {
  // Implementation
}
\`\`\`

Your function should follow the same structure.
`
  }
};
```

### Knowledge Organization

```typescript
export const organizedSkill: Skill = {
  name: 'organized-skill',
  
  knowledge: [
    // Core concepts
    'Core concept 1: explanation',
    'Core concept 2: explanation',
    
    // Best practices
    'Best practice 1: when and why to use',
    'Best practice 2: common pitfalls to avoid',
    
    // Patterns
    'Pattern 1: description and use case',
    'Pattern 2: description and use case',
    
    // Anti-patterns
    'Anti-pattern 1: why to avoid',
    'Anti-pattern 2: better alternative'
  ]
};
```

## Skill Examples

### React Expert Skill

```typescript
export const reactExpertSkill: Skill = {
  name: 'react-expert',
  description: 'Expert React development assistance',
  
  patterns: ['*.jsx', '*.tsx', 'components/**/*'],
  
  prompts: {
    default: `
You are a React expert. Follow these principles:

Component Structure:
- Use functional components
- Define props interface with TypeScript
- Use destructuring for props
- Keep components focused and small

State Management:
- Use useState for local state
- Use useReducer for complex state
- Lift state up when needed
- Consider Context for global state

Performance:
- Use React.memo for expensive renders
- Use useMemo for expensive calculations
- Use useCallback for function props
- Profile before optimizing

Hooks:
- Follow Rules of Hooks
- Create custom hooks for reusable logic
- Name hooks with use prefix
- Document hook parameters and return values
`,

    component: `
Create a React component:

1. Start with props interface
2. Use destructuring in parameters
3. Add JSDoc with description and examples
4. Include PropTypes for JS files
5. Handle edge cases (null, undefined, empty)
6. Add loading states if async
7. Make accessible (ARIA labels, keyboard nav)
8. Export as default or named export
`,

    hook: `
Create a custom React hook:

1. Name with use[Name] convention
2. Define parameter types
3. Define return type
4. Include cleanup in useEffect
5. Return stable references (useMemo for objects/arrays)
6. Add JSDoc with usage example
7. Handle errors gracefully
`
  },
  
  knowledge: [
    'React re-renders when props or state change',
    'Keys are required for list items',
    'useEffect runs after render',
    'Refs persist across renders',
    'State updates may be batched'
  ],
  
  examples: [
    {
      description: 'Counter component',
      input: 'Create a counter component',
      output: `
import React, { useState } from 'react';

interface CounterProps {
  initialCount?: number;
  onChange?: (count: number) => void;
}

/**
 * Counter component with increment/decrement
 * @example
 * <Counter initialCount={0} onChange={console.log} />
 */
export const Counter: React.FC<CounterProps> = ({
  initialCount = 0,
  onChange
}) => {
  const [count, setCount] = useState(initialCount);
  
  const increment = () => {
    const newCount = count + 1;
    setCount(newCount);
    onChange?.(newCount);
  };
  
  const decrement = () => {
    const newCount = count - 1;
    setCount(newCount);
    onChange?.(newCount);
  };
  
  return (
    <div>
      <button onClick={decrement}>-</button>
      <span>{count}</span>
      <button onClick={increment}>+</button>
    </div>
  );
};
`
    }
  ]
};
```

### API Design Skill

```typescript
export const apiDesignSkill: Skill = {
  name: 'api-design-expert',
  description: 'REST API design expertise',
  
  patterns: ['api/**/*', 'routes/**/*', 'controllers/**/*'],
  
  prompts: {
    default: `
You are an API design expert. Follow REST principles:

Resources:
- Use nouns for resources (/users, not /getUsers)
- Use plural nouns (/orders, not /order)
- Use nested resources (/users/123/orders)

HTTP Methods:
- GET: Read resources
- POST: Create resources
- PUT: Full update
- PATCH: Partial update
- DELETE: Remove resources

Status Codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

Response Format:
- Consistent structure across endpoints
- Include pagination for lists
- Use proper content types
- Version your API
`,

    endpoint: `
Design a REST API endpoint:

1. Choose appropriate HTTP method
2. Design clear URL path
3. Define request parameters
4. Define request body schema
5. Define response schema
6. Document error responses
7. Include example requests/responses
8. Consider rate limiting
`
  }
};
```

## Skill Distribution

### Packaging Skills

```bash
# Create skill package
mkdir my-skill
cd my-skill

# Structure
my-skill/
├── index.ts
├── prompts/
├── knowledge/
├── examples/
├── package.json
└── README.md
```

### Publishing Skills

```bash
# Build skill
npm run build

# Publish to npm
npm publish

# Or submit to registry
claude-code-clone skill submit ./my-skill
```

### Using Skills

```bash
# Install skill
claude-code-clone skill install my-skill

# Or add to config
{
  "skills": {
    "enabled": ["react-expert", "typescript-expert"]
  }
}
```

---

**Skill Development Quick Reference**

```
Structure:
  name          # Unique identifier
  description   # What the skill does
  patterns      # File patterns to match
  prompts       # Prompt templates
  knowledge     # Domain knowledge
  examples      # Usage examples

Types:
  Framework  # React, Next.js, Django
  Language   # TypeScript, Python, Go
  Domain     # ML, Security, Testing

Best Practices:
  - Be specific in prompts
  - Provide examples
  - Organize knowledge
  - Test with real code
```

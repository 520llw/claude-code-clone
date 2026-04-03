/**
 * Custom Skill Example
 * 
 * This example demonstrates how to create a custom skill for the Claude Code system.
 */

import { Skill } from '../../src/skills/Skill';
import {
  SkillInput,
  SkillOutput,
  SkillContext,
  SkillDefinition,
  SkillConfig,
} from '../../src/skills/types';

/**
 * Custom skill definition
 */
const customSkillDefinition: SkillDefinition = {
  metadata: {
    id: 'my-custom-skill',
    name: 'My Custom Skill',
    version: '1.0.0',
    description: 'A custom skill that demonstrates the skills system.',
    category: 'custom',
    author: {
      name: 'Your Name',
      email: 'your.email@example.com',
    },
    tags: ['custom', 'example'],
    license: 'MIT',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  compatibility: {
    minPlatformVersion: '1.0.0',
  },
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
      message: {
        name: 'message',
        type: 'string',
        description: 'Message to process',
        required: true,
      },
      options: {
        name: 'options',
        type: 'object',
        description: 'Processing options',
        required: false,
      },
    },
    required: ['message'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      result: {
        name: 'result',
        type: 'string',
        description: 'Processing result',
        required: true,
      },
      processedAt: {
        name: 'processedAt',
        type: 'string',
        description: 'Processing timestamp',
        required: true,
      },
    },
    required: ['result', 'processedAt'],
  },
  examples: [
    {
      name: 'Basic usage',
      description: 'Process a simple message',
      input: {
        message: 'Hello, World!',
      },
      expectedOutput: {
        result: 'Processed: Hello, World!',
        processedAt: '2024-01-01T00:00:00.000Z',
      },
    },
  ],
  requiredTools: [],
  requiredContext: [],
  successCriteria: [
    {
      name: 'success',
      description: 'Processing completed successfully',
      check: (output) => output.success && output.data !== undefined,
    },
  ],
  dependencies: [],
  documentation: {
    readme: `# My Custom Skill

A custom skill for the Claude Code system.

## Usage

\`\`\`typescript
const result = await skill.execute({
  message: 'Hello, World!'
}, context);
\`\`\`

## Input

- \`message\` (string, required): Message to process

## Output

- \`result\` (string): Processing result
- \`processedAt\` (string): Processing timestamp`,
    changelog: '# Changelog\n\n## 1.0.0\n- Initial release',
    apiReference: 'See input/output schemas for API details.',
    tutorials: [],
  },
};

/**
 * Custom skill implementation
 */
export class MyCustomSkill extends Skill {
  constructor(config?: Partial<SkillConfig>) {
    super(customSkillDefinition, config);
  }

  /**
   * Initialize the skill
   */
  protected async onInitialize(): Promise<void> {
    this._log('info', 'Initializing MyCustomSkill');
    
    // Perform any initialization here
    // e.g., load models, connect to services, etc.
  }

  /**
   * Execute the skill
   */
  protected async onExecute(input: SkillInput, context: SkillContext): Promise<SkillOutput> {
    const startTime = Date.now();
    
    this._log('info', 'Executing MyCustomSkill', { message: input.message });

    try {
      // Validate input
      if (!input.message || typeof input.message !== 'string') {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Message is required and must be a string',
          },
          metadata: this._createMetadata(startTime),
        };
      }

      // Process the message
      const result = this._processMessage(input.message as string);

      return {
        success: true,
        data: {
          result,
          processedAt: new Date().toISOString(),
        },
        metadata: this._createMetadata(startTime),
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SKILL_EXECUTION_FAILED',
          message: error instanceof Error ? error.message : String(error),
        },
        metadata: this._createMetadata(startTime),
      };
    }
  }

  /**
   * Dispose the skill
   */
  protected async onDispose(): Promise<void> {
    this._log('info', 'Disposing MyCustomSkill');
    
    // Perform any cleanup here
    // e.g., close connections, release resources, etc.
  }

  /**
   * Process the message
   */
  private _processMessage(message: string): string {
    // Your custom processing logic here
    return `Processed: ${message}`;
  }

  /**
   * Create metadata for output
   */
  private _createMetadata(startTime: number) {
    return {
      executionTime: Date.now() - startTime,
      startTime: new Date(startTime),
      endTime: new Date(),
      cached: false,
      retryCount: 0,
    };
  }
}

/**
 * Factory function for registration
 */
export default function createSkill(config?: Partial<SkillConfig>): MyCustomSkill {
  return new MyCustomSkill(config);
}

/**
 * Skill definition export
 */
export { customSkillDefinition as definition };

// ============================================================================
// Usage Example
// ============================================================================

/**
 * Example: Using the custom skill
 * 
 * ```typescript
 * import { SkillManager } from '@claude-code/skills';
 * import createMyCustomSkill from './custom-skill-example';
 * 
 * async function main() {
 *   // Create skill manager
 *   const manager = new SkillManager();
 *   await manager.initialize();
 * 
 *   // Create and register the skill
 *   const skill = createMyCustomSkill();
 *   await manager.register(skill.definition);
 * 
 *   // Execute the skill
 *   const result = await manager.execute('my-custom-skill', {
 *     message: 'Hello, World!'
 *   });
 * 
 *   console.log(result.data); // { result: 'Processed: Hello, World!', processedAt: '...' }
 * 
 *   // Clean up
 *   await manager.dispose();
 * }
 * 
 * main().catch(console.error);
 * ```
 */

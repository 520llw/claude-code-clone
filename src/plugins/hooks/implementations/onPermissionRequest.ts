/**
 * onPermissionRequest.ts
 * 
 * Permission Request Hook Implementation
 * 
 * This hook is triggered when a permission is requested. It allows plugins
 * to handle, grant, or deny permission requests.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { HookDefinition, HookCategory, HookExecutionOrder, OnPermissionRequestData, HookContext } from '../types';

/**
 * onPermissionRequest hook definition
 */
export const onPermissionRequestDefinition: HookDefinition<OnPermissionRequestData> = {
  name: 'onPermissionRequest',
  description: 'Called when a permission is requested. Plugins can handle, grant, or deny permissions.',
  category: HookCategory.PERMISSION,
  executionOrder: HookExecutionOrder.SEQUENTIAL,
  cancellable: true,
  defaultTimeout: 60000,
  allowModification: true,
  stopOnError: false,
  stopOnSuccess: true,
  examples: [
    `// Auto-grant certain permissions
plugin.registerHook('onPermissionRequest', async (context) => {
  const { permissionType, resource } = context.data;
  
  if (permissionType === 'read' && resource.startsWith('/tmp/')) {
    context.grant(60000); // Grant for 1 minute
  }
});`,
    `// Log permission requests
plugin.registerHook('onPermissionRequest', async (context) => {
  const { permissionType, resource, reason } = context.data;
  console.log(\`Permission requested: \${permissionType} \${resource}\`);
  if (reason) console.log(\`Reason: \${reason}\`);
});`,
    `// Deny dangerous permissions
plugin.registerHook('onPermissionRequest', async (context) => {
  const { permissionType, resource } = context.data;
  
  if (permissionType === 'write' && resource.includes('/etc/')) {
    context.deny('Writing to /etc/ is not allowed');
  }
});`
  ],
  relatedHooks: ['onToolCall', 'onCommand'],
  schema: {
    input: {
      type: 'object',
      properties: {
        requestId: { type: 'string', description: 'Unique request ID' },
        permissionType: { type: 'string', description: 'Permission type' },
        resource: { type: 'string', description: 'Resource being accessed' },
        action: { type: 'string', description: 'Action being performed' },
        reason: { type: 'string', description: 'Request reason' },
        granted: { type: 'boolean', description: 'Whether permission is granted' },
        grantDuration: { type: 'number', description: 'Grant duration in ms' },
        timestamp: { type: 'string', format: 'date-time' }
      },
      required: ['requestId', 'permissionType', 'resource', 'action', 'granted', 'timestamp']
    }
  }
};

/**
 * Permission types
 */
export enum PermissionType {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  DELETE = 'delete',
  NETWORK = 'network',
  FILESYSTEM = 'filesystem',
  SHELL = 'shell',
  LLM = 'llm'
}

/**
 * Permission grant result
 */
export interface PermissionGrant {
  granted: boolean;
  duration?: number;
  reason?: string;
}

/**
 * onPermissionRequest hook context
 */
export interface OnPermissionRequestContext extends HookContext<OnPermissionRequestData> {
  /** Grant the permission */
  grant(duration?: number): void;
  /** Deny the permission */
  deny(reason: string): void;
  /** Check if permission is already granted */
  isGranted(): boolean;
  /** Get remaining grant time */
  getRemainingTime(): number;
  /** Show permission dialog to user */
  showDialog(): Promise<boolean>;
  /** Add condition for automatic grant */
  addAutoGrantCondition(condition: (data: OnPermissionRequestData) => boolean): void;
  /** Log permission request */
  log(message: string): void;
}

/**
 * Creates an onPermissionRequest hook context
 */
export function createOnPermissionRequestContext(
  data: OnPermissionRequestData,
  executionId: string
): OnPermissionRequestContext {
  return {
    hookName: 'onPermissionRequest',
    data,
    executionId,
    timestamp: new Date(),
    cancelled: false,
    metadata: {},

    get<K extends keyof OnPermissionRequestData>(key: K): OnPermissionRequestData[K] {
      return data[key];
    },

    set<K extends keyof OnPermissionRequestData>(key: K, value: OnPermissionRequestData[K]): void {
      (data as any)[key] = value;
    },

    cancel(reason?: string): void {
      this.cancelled = true;
      this.cancellationReason = reason;
    },

    addMeta(key: string, value: any): void {
      this.metadata[key] = value;
    },

    grant(duration?: number): void {
      data.granted = true;
      data.grantDuration = duration;
    },

    deny(reason: string): void {
      data.granted = false;
      // Store denial reason in metadata
      this.addMeta('denialReason', reason);
    },

    isGranted(): boolean {
      return data.granted;
    },

    getRemainingTime(): number {
      return data.grantDuration || 0;
    },

    async showDialog(): Promise<boolean> {
      // Would show permission dialog to user
      console.log(`[onPermissionRequest] Dialog: ${data.permissionType} ${data.resource}`);
      return false;
    },

    addAutoGrantCondition(condition: (data: OnPermissionRequestData) => boolean): void {
      this.addMeta('autoGrantCondition', condition);
    },

    log(message: string): void {
      console.log(`[onPermissionRequest] ${message}`);
    }
  };
}

/**
 * Default onPermissionRequest handler
 */
export async function defaultOnPermissionRequestHandler(context: OnPermissionRequestContext): Promise<void> {
  const { requestId, permissionType, resource, action, reason } = context.data;
  
  console.log(`[onPermissionRequest] ${permissionType} ${action} ${resource}`);
  
  if (reason) {
    console.log(`  Reason: ${reason}`);
  }
  
  // Auto-grant read permissions for safe locations
  if (permissionType === PermissionType.READ) {
    const safePaths = ['/tmp/', '/home/', process.cwd()];
    const isSafe = safePaths.some(path => resource.startsWith(path));
    
    if (isSafe) {
      context.grant(300000); // Grant for 5 minutes
      console.log('  Auto-granted (safe path)');
      return;
    }
  }
  
  // Show dialog for other permissions
  const granted = await context.showDialog();
  if (granted) {
    context.grant(60000);
  } else {
    context.deny('User denied permission');
  }
}

export default onPermissionRequestDefinition;

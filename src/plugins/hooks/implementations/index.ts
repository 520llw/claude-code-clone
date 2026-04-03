/**
 * Hook Implementations Index
 * 
 * Exports all hook implementations for the plugin system.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

// Import all hook definitions
export { onInitDefinition, createOnInitContext, defaultOnInitHandler } from './onInit';
export { onMessageDefinition, createOnMessageContext, defaultOnMessageHandler } from './onMessage';
export { onToolCallDefinition, createOnToolCallContext, defaultOnToolCallHandler, isDangerousCommand } from './onToolCall';
export { onToolResultDefinition, createOnToolResultContext, defaultOnToolResultHandler, shouldCache } from './onToolResult';
export { onResponseDefinition, createOnResponseContext, defaultOnResponseHandler } from './onResponse';
export { onErrorDefinition, createOnErrorContext, defaultOnErrorHandler, createErrorData, ErrorSeverity } from './onError';
export { onSessionStartDefinition, createOnSessionStartContext, defaultOnSessionStartHandler } from './onSessionStart';
export { onSessionEndDefinition, createOnSessionEndContext, defaultOnSessionEndHandler } from './onSessionEnd';
export { onFileChangeDefinition, createOnFileChangeContext, defaultOnFileChangeHandler } from './onFileChange';
export { onCommandDefinition, createOnCommandContext, defaultOnCommandHandler, isDangerousCommand as isDangerousShellCommand } from './onCommand';
export { onContextCompactDefinition, createOnContextCompactContext, defaultOnContextCompactHandler } from './onContextCompact';
export { onPermissionRequestDefinition, createOnPermissionRequestContext, defaultOnPermissionRequestHandler, PermissionType } from './onPermissionRequest';
export { onLLMCallDefinition, createOnLLMCallContext, defaultOnLLMCallHandler } from './onLLMCall';
export { onStreamTokenDefinition, createOnStreamTokenContext, defaultOnStreamTokenHandler, cleanupStreamStats, containsSensitiveData } from './onStreamToken';
export { onExitDefinition, createOnExitContext, defaultOnExitHandler, ExitCode, getExitCodeDescription } from './onExit';

// Export hook definitions array
import { onInitDefinition } from './onInit';
import { onMessageDefinition } from './onMessage';
import { onToolCallDefinition } from './onToolCall';
import { onToolResultDefinition } from './onToolResult';
import { onResponseDefinition } from './onResponse';
import { onErrorDefinition } from './onError';
import { onSessionStartDefinition } from './onSessionStart';
import { onSessionEndDefinition } from './onSessionEnd';
import { onFileChangeDefinition } from './onFileChange';
import { onCommandDefinition } from './onCommand';
import { onContextCompactDefinition } from './onContextCompact';
import { onPermissionRequestDefinition } from './onPermissionRequest';
import { onLLMCallDefinition } from './onLLMCall';
import { onStreamTokenDefinition } from './onStreamToken';
import { onExitDefinition } from './onExit';

/**
 * All hook definitions
 */
export const allHookDefinitions = [
  onInitDefinition,
  onMessageDefinition,
  onToolCallDefinition,
  onToolResultDefinition,
  onResponseDefinition,
  onErrorDefinition,
  onSessionStartDefinition,
  onSessionEndDefinition,
  onFileChangeDefinition,
  onCommandDefinition,
  onContextCompactDefinition,
  onPermissionRequestDefinition,
  onLLMCallDefinition,
  onStreamTokenDefinition,
  onExitDefinition
];

export default allHookDefinitions;

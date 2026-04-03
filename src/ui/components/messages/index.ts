/**
 * Message components for Claude Code Clone
 * @module components/messages
 */

export { UserMessage, CompactUserMessage, DetailedUserMessage } from './UserMessage.js';
export { 
  AssistantMessage, 
  StreamingAssistantMessage, 
  CompactAssistantMessage 
} from './AssistantMessage.js';
export { ToolMessage, CompactToolMessage } from './ToolMessage.js';
export { 
  ErrorMessage, 
  CompactErrorMessage, 
  SimpleErrorMessage 
} from './ErrorMessage.js';
export { 
  SystemMessage, 
  InfoMessage, 
  WarningMessage, 
  SuccessMessage, 
  NotificationMessage,
  ToastMessage 
} from './SystemMessage.js';

// Re-export types
export type { UserMessageProps } from './UserMessage.js';
export type { AssistantMessageProps } from './AssistantMessage.js';
export type { ToolMessageProps } from './ToolMessage.js';
export type { ErrorMessageProps } from './ErrorMessage.js';
export type { SystemMessageProps } from './SystemMessage.js';

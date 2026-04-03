/**
 * Security Utilities Module Index
 * 
 * Central export point for all security-related utility modules.
 */

export * from './sanitizer';
export * from './validator';

// Re-export with namespace for convenience
import * as sanitizer from './sanitizer';
import * as validator from './validator';

export const security = {
  sanitizer,
  validator,
};

export default security;
